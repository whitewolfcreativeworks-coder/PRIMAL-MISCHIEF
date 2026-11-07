import { ageName, getCard, getCiv, progressNeeded, RULES } from './data';
import { shuffleInPlace } from './rng';
import { HIDDEN_CARD } from './view';
import type {
  UnitFate, TrapInst, TrapReport, TrapRole,
  Action, Age, ApplyResult, AttackTarget, BuildingInst, CardDef, CardInst, CivId, Effect, Family, GameEvent,
  GameState, Passive, PendingAction, PendingAttack, PlayerId, PlayerState, ReactionKind, Resource, UnitInst,
} from './types';
import { RuleError } from './types';

/*
 * Turn flow
 *   1. Upkeep  — Prosperity income, Progress from growth, army upkeep (unpaid units desert).
 *   2. Draft   — refill the hand to 6, choosing blind how many cards come from each deck.
 *   3. Main    — play cards, attack across the river, invoke the Signature, end the turn.
 * Attacks and Hostile cards open a response window for the defender.
 */

// ====================================================================== setup

export interface PlayerSetup { name: string; civ: CivId }

export function createGame(seed: number, setups: [PlayerSetup, PlayerSetup], firstPlayer?: PlayerId): ApplyResult {
  const st: GameState = {
    version: 2, seed, rng: seed >>> 0 || 1, turn: 0, active: 0, phase: 'draft', pending: null,
    players: [null as unknown as PlayerState, null as unknown as PlayerState],
    winner: null, winReason: null, uidCounter: 0, log: [], struck: [],
  };
  setups.forEach((s, i) => {
    const p: PlayerState = {
      id: i as PlayerId, name: s.name, civ: s.civ, age: 1, progress: 0, prosperity: 0,
      stability: RULES.startingStability, momentum: 0,
      piles: { civ: [], mil: [] }, discards: { civ: [], mil: [] }, hand: [],
      buildings: [], units: [], signatureUsed: false, handRevealedTo: false, peek: null, traps: [],
    };
    st.players[i] = p;
    for (const f of ['civ', 'mil'] as Family[]) {
      p.piles[f] = shuffleInPlace(st, getCiv(s.civ).decks[f][0].map((cardId) => ({ uid: newUid(st), cardId })));
    }
  });
  const first: PlayerId = firstPlayer ?? (Math.floor(((st.rng >>> 0) % 1000) / 500) as PlayerId);
  // Going second: a small head start.
  st.players[other(first)].prosperity = 1;
  st.players[other(first)].momentum = 1;
  log(st, null, `${st.players[first].name} (${getCiv(st.players[first].civ).name}) moves first.`);
  const events: GameEvent[] = [];
  beginTurn(st, first, events);
  return { state: st, events };
}

// ====================================================================== helpers

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0);

function newUid(st: GameState): string {
  st.uidCounter += 1;
  return `c${st.uidCounter}`;
}

function log(st: GameState, player: PlayerId | null, text: string) {
  st.log.push({ turn: st.turn, player, text });
  if (st.log.length > 200) st.log.splice(0, st.log.length - 200);
}

// ---------------------------------------------------------------- hidden traps

export const trapsOf = (p: PlayerState): TrapInst[] => (p.traps ??= []);

/** What a card does when it springs from under a building: decided by its kind, so every card has a use. */
export function trapRole(card: CardDef): TrapRole {
  if (card.kind === 'unit') return 'garrison';
  if (card.kind === 'reaction') return 'reaction';
  if (card.kind === 'fort') return 'wall';
  if (card.kind === 'tactic') return 'snare';
  return 'brace';
}
/** Damage a sprung Civilization card soaks: higher Ages brace harder. */
export const braceOf = (card: CardDef) => card.age + 1;
/** Damage a sprung fort soaks, as a wall for that one fight. */
export const trapWallOf = (card: CardDef) => card.integrity ?? 3;
/** Damage each attacker takes from a sprung tactic. */
export const SNARE_DAMAGE = 1;

/** Spring every known trap under `spot` (a building uid or 'city'): they are removed and returned for resolution. */
function springTraps(st: GameState, pid: PlayerId, spot: string, events: GameEvent[]): TrapInst[] {
  const p = st.players[pid];
  const all = trapsOf(p);
  const sprung = all.filter((t) => t.at === spot && t.cardId !== HIDDEN_CARD);
  if (!sprung.length) return [];
  p.traps = all.filter((t) => !sprung.includes(t));
  const where = spot === 'city' ? 'city' : p.buildings.find((b) => b.uid === spot)?.cardId ?? 'city';
  events.push({ type: 'trapSprung', player: pid, at: where, cards: sprung.map((t) => t.cardId) });
  log(st, pid, `Hidden traps spring at ${where === 'city' ? 'the city' : getCard(where).name}: ${sprung.map((t) => getCard(t.cardId).name).join(', ')}!`);
  changeRes(st, pid, 'momentum', 1, events);
  return sprung;
}

/** Unsprung traps go back into their decks at the start of their owner's turn. */
function returnTraps(st: GameState, pid: PlayerId, events: GameEvent[]) {
  const p = st.players[pid];
  const back = trapsOf(p).splice(0);
  let n = 0;
  const touched = new Set<Family>();
  for (const t of back) {
    if (t.cardId === HIDDEN_CARD) continue;
    const card = getCard(t.cardId);
    if (card.token || card.age < p.age - 1) continue; // retired tier: leaves the game
    p.piles[card.family].push({ uid: t.uid, cardId: t.cardId });
    touched.add(card.family);
    n++;
  }
  for (const f of touched) shuffleInPlace(st, p.piles[f]);
  if (n) { events.push({ type: 'trapsReturned', player: pid, n }); log(st, pid, `${n} unsprung trap${n === 1 ? '' : 's'} of ${p.name} return${n === 1 ? 's' : ''} to the decks.`); }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

const trait = (p: PlayerState) => getCiv(p.civ).trait.kind;

/** Buildings that are working: not in Unrest and with their requirements met (computed to a fixpoint). */
export function workingBuildings(p: PlayerState): Set<string> {
  const working = new Set(p.buildings.filter((b) => b.unrest <= 0).map((b) => b.uid));
  for (;;) {
    let changed = false;
    for (const b of p.buildings) {
      if (!working.has(b.uid)) continue;
      const req = getCard(b.cardId).requires;
      if (!req || req.length === 0) continue;
      const ok = p.buildings.some((o) => o.uid !== b.uid && working.has(o.uid) && (getCard(o.cardId).tags ?? []).some((t) => req.includes(t)));
      if (!ok) { working.delete(b.uid); changed = true; }
    }
    if (!changed) return working;
  }
}

export function isWorking(p: PlayerState, uid: string): boolean {
  return workingBuildings(p).has(uid);
}

export function hasTag(p: PlayerState, tag: string): boolean {
  const w = workingBuildings(p);
  return p.buildings.some((b) => w.has(b.uid) && (getCard(b.cardId).tags ?? []).includes(tag));
}

function countTag(p: PlayerState, tag: string): number {
  const w = workingBuildings(p);
  return p.buildings.filter((b) => w.has(b.uid) && (getCard(b.cardId).tags ?? []).includes(tag)).length;
}

export function hasPassive(p: PlayerState, passive: Passive): boolean {
  const w = workingBuildings(p);
  return p.buildings.some((b) => w.has(b.uid) && (getCard(b.cardId).passives ?? []).includes(passive));
}

export function maxIntegrity(b: BuildingInst): number {
  return (getCard(b.cardId).integrity ?? 1) + b.bonusIntegrity;
}

export function unitStr(p: PlayerState, u: UnitInst): number {
  const c = getCard(u.cardId);
  const ranged = (c.keywords ?? []).includes('ranged');
  return (c.str ?? 0) + (hasPassive(p, 'unitStr') ? 1 : 0) + (ranged && trait(p) === 'bowmen' ? 1 : 0) + u.buff;
}

export function unitMaxHp(p: PlayerState, u: UnitInst): number {
  return (getCard(u.cardId).hp ?? 1) + (hasPassive(p, 'unitHp') ? 1 : 0);
}

export function costOf(p: PlayerState, card: CardDef): number {
  if (card.family === 'civ' && card.cost > 0 && hasPassive(p, 'buildDiscount')) return Math.max(1, card.cost - 1);
  if (card.kind === 'unit' && trait(p) === 'hiredSwords') return Math.max(1, card.cost - 1);
  return card.cost;
}

export function canDeploy(p: PlayerState, card: CardDef): boolean {
  return !card.requiresToDeploy || hasTag(p, card.requiresToDeploy);
}

/** What a player would collect at their next turn start (used by UI and AI). */
export function incomeOf(p: PlayerState) {
  const w = workingBuildings(p);
  let prosperity = RULES.baseIncome[p.age - 1], growth = 0, upkeep = 0;
  const farmBoost = hasPassive(p, 'farmBoost');
  for (const b of p.buildings) {
    if (!w.has(b.uid)) continue;
    const c = getCard(b.cardId);
    const tags = c.tags ?? [];
    prosperity += (c.income ?? 0) + (farmBoost && tags.includes('farm') ? 1 : 0) + (trait(p) === 'trade' && tags.includes('harbor') ? 1 : 0);
    growth += c.growth ?? 0;
  }
  for (const u of p.units) upkeep += getCard(u.cardId).upkeep ?? 0;
  return { prosperity, growth, upkeep, net: prosperity - upkeep };
}

function changeRes(st: GameState, pid: PlayerId, res: Resource, delta: number, events: GameEvent[]) {
  if (res === 'progress') { if (delta >= 0) addProgress(st, pid, delta, events); else loseProgress(st, pid, -delta, events, false); return; }
  const p = st.players[pid];
  const before = p[res];
  let v = before + delta;
  if (res === 'prosperity') v = Math.min(RULES.prosperityCap, Math.max(0, v));
  if (res === 'momentum') v = Math.min(RULES.momentumCap, Math.max(0, v));
  p[res] = v;
  if (v !== before) events.push({ type: 'resource', player: pid, res, delta: v - before });
  if (res === 'stability' && v < before) events.push({ type: 'cityDamaged', player: pid, amount: before - v });
}

/** Gain Progress; may advance one or more Ages, or complete the Golden Age. */
function addProgress(st: GameState, pid: PlayerId, n: number, events: GameEvent[]) {
  if (n <= 0 || st.phase === 'over') return;
  const p = st.players[pid];
  p.progress += n;
  events.push({ type: 'resource', player: pid, res: 'progress', delta: n });
  while (p.progress >= progressNeeded(p.age)) {
    if (p.age === 5) {
      p.progress = progressNeeded(5);
      log(st, pid, `${p.name} enters the ${ageName(p.civ, 5)} — a Golden Age!`);
      finish(st, pid, 'Golden Age: their civilization reaches its height', events);
      return;
    }
    p.progress -= progressNeeded(p.age);
    advanceAge(st, pid, events);
  }
}

/** Lose Progress (never below 0, never back an Age). Raids and fallen buildings are softened by storehouses. */
function loseProgress(st: GameState, pid: PlayerId, n: number, events: GameEvent[], fromAttack: boolean): number {
  const p = st.players[pid];
  let amount = n;
  if (fromAttack && trait(p) === 'storehouses') amount = Math.floor(n / 2);
  amount = Math.min(amount, p.progress);
  if (amount <= 0) return 0;
  p.progress -= amount;
  events.push({ type: 'resource', player: pid, res: 'progress', delta: -amount });
  return amount;
}

function advanceAge(st: GameState, pid: PlayerId, events: GameEvent[]) {
  const p = st.players[pid];
  p.age = (p.age + 1) as Age;
  const tiers = getCiv(p.civ).decks;
  // Stronger cards join both decks; cards two Ages old retire.
  for (const f of ['civ', 'mil'] as Family[]) {
    const keep = [...p.piles[f], ...p.discards[f]].filter((c) => getCard(c.cardId).age >= p.age - 1);
    const fresh = tiers[f][p.age - 1].map((cardId) => ({ uid: newUid(st), cardId }));
    p.piles[f] = shuffleInPlace(st, [...keep, ...fresh]);
    p.discards[f] = [];
  }
  events.push({ type: 'ageUp', player: pid, age: p.age, name: ageName(p.civ, p.age) });
  log(st, pid, `${p.name} advances to Age ${['I', 'II', 'III', 'IV', 'V'][p.age - 1]}: ${ageName(p.civ, p.age)}.`);
  changeRes(st, pid, 'momentum', 2, events);
}

function discard(st: GameState, pid: PlayerId, c: CardInst) {
  const p = st.players[pid];
  const card = getCard(c.cardId);
  if (card.token) return;
  if (card.age < p.age - 1) return; // retired tier: leaves the game
  p.discards[card.family].push(c);
}

function drawFrom(st: GameState, pid: PlayerId, f: Family, n: number): number {
  const p = st.players[pid];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (p.piles[f].length === 0) {
      if (p.discards[f].length === 0) break;
      p.piles[f] = shuffleInPlace(st, p.discards[f].splice(0));
    }
    if (p.hand.length >= RULES.handLimit) break;
    p.hand.push(p.piles[f].shift()!);
    drawn++;
  }
  return drawn;
}

function destroyBuilding(st: GameState, pid: PlayerId, uid: string, events: GameEvent[]) {
  const p = st.players[pid];
  const idx = p.buildings.findIndex((b) => b.uid === uid);
  if (idx < 0) return;
  const [b] = p.buildings.splice(idx, 1);
  const card = getCard(b.cardId);
  discard(st, pid, { uid: b.uid, cardId: b.cardId });
  const lost = card.family === 'civ' ? loseProgress(st, pid, card.age, events, true) : 0;
  events.push({ type: 'buildingDestroyed', player: pid, uid, cardId: b.cardId, progressLost: lost });
  log(st, pid, `${card.name} of ${p.name} falls (-1 Stability${lost ? `, -${lost} Progress` : ''}).`);
  changeRes(st, pid, 'stability', -1, events);
}

function damageBuilding(st: GameState, pid: PlayerId, uid: string, amount: number, events: GameEvent[]) {
  const b = st.players[pid].buildings.find((x) => x.uid === uid);
  if (!b || amount <= 0) return;
  b.damage += amount;
  events.push({ type: 'buildingDamaged', player: pid, uid, amount });
  if (b.damage >= maxIntegrity(b)) destroyBuilding(st, pid, uid, events);
}

function removeUnit(st: GameState, pid: PlayerId, uid: string, events: GameEvent[], deserted = false) {
  const p = st.players[pid];
  const idx = p.units.findIndex((u) => u.uid === uid);
  if (idx < 0) return;
  const [u] = p.units.splice(idx, 1);
  if (!u.uid.startsWith('t')) discard(st, pid, { uid: u.uid, cardId: u.cardId });
  events.push({ type: deserted ? 'unitDeserted' : 'unitDestroyed', player: pid, uid, cardId: u.cardId });
}

function damageUnit(st: GameState, pid: PlayerId, u: UnitInst, amount: number, events: GameEvent[]) {
  if (amount <= 0) return;
  u.damage += amount;
  if (u.damage >= unitMaxHp(st.players[pid], u)) removeUnit(st, pid, u.uid, events);
}

function addUnit(st: GameState, pid: PlayerId, cardId: string, events: GameEvent[], uid?: string) {
  const p = st.players[pid];
  if (p.units.length >= RULES.maxUnits) return;
  const card = getCard(cardId);
  const swift = (card.keywords ?? []).includes('swift') || hasPassive(p, 'swift');
  const u: UnitInst = { uid: uid ?? `t${newUid(st)}`, cardId, damage: 0, ready: swift, attacked: false, blocked: false, buff: 0 };
  p.units.push(u);
  events.push({ type: 'unitDeployed', player: pid, uid: u.uid, cardId });
}

// ====================================================================== turn flow

function beginTurn(st: GameState, pid: PlayerId, events: GameEvent[]) {
  st.turn += 1;
  st.active = pid;
  st.phase = 'draft';
  st.pending = null;
  const p = st.players[pid];
  const opp = st.players[other(pid)];
  p.signatureUsed = false;
  st.struck = [];
  returnTraps(st, pid, events);
  for (const u of p.units) { u.ready = true; u.attacked = false; }
  for (const u of opp.units) u.blocked = false;
  events.push({ type: 'turnStart', player: pid, turn: st.turn });

  // Income first, then upkeep: the army is paid strongest-first; whoever can't be paid deserts.
  const inc = incomeOf(p);
  changeRes(st, pid, 'prosperity', inc.prosperity, events);
  let paid = 0;
  const byValue = [...p.units].sort((a, b) => getCard(b.cardId).cost - getCard(a.cardId).cost);
  for (const u of byValue) {
    const fee = getCard(u.cardId).upkeep ?? 0;
    if (!fee) continue;
    if (p.prosperity >= fee) { p.prosperity -= fee; paid += fee; }
    else { removeUnit(st, pid, u.uid, events, true); log(st, pid, `Unpaid, ${getCard(u.cardId).name} deserts ${p.name}.`); }
  }
  if (paid) events.push({ type: 'resource', player: pid, res: 'prosperity', delta: -paid });
  events.push({ type: 'income', player: pid, prosperity: inc.prosperity, growth: inc.growth, upkeep: paid });
  if (inc.growth) addProgress(st, pid, inc.growth, events);
  if ((st.phase as string) === 'over') return; // growth may complete the Golden Age
  p.peek = trait(p) === 'scribes' ? { civ: topCard(p, 'civ'), mil: topCard(p, 'mil') } : null;
  checkVictory(st, events);
}

function topCard(p: PlayerState, f: Family): string | null {
  return p.piles[f][0]?.cardId ?? null;
}

function endTurn(st: GameState, events: GameEvent[]) {
  const pid = st.active;
  const p = st.players[pid];
  for (const b of p.buildings) if (b.unrest > 0) b.unrest -= 1;
  for (const pl of st.players) for (const u of pl.units) { u.damage = 0; u.buff = 0; }
  st.players[other(pid)].handRevealedTo = false;
  if (st.turn >= RULES.turnLimit) { decideOnPoints(st, events); return; }
  beginTurn(st, other(pid), events);
}

export function score(p: PlayerState): number {
  let total = p.stability + p.progress;
  for (let a = 1; a < p.age; a++) total += progressNeeded(a as Age);
  return total;
}

function decideOnPoints(st: GameState, events: GameEvent[]) {
  const [a, b] = st.players;
  const winner: PlayerId = score(a) >= score(b) ? 0 : 1;
  finish(st, winner, 'Time: the chronicles favour the more developed civilization', events);
}

function finish(st: GameState, winner: PlayerId, reason: string, events: GameEvent[]) {
  if (st.phase === 'over') return;
  st.phase = 'over';
  st.pending = null;
  st.winner = winner;
  st.winReason = reason;
  events.push({ type: 'gameOver', winner, reason });
  log(st, winner, `${st.players[winner].name} wins — ${reason}.`);
}

function checkVictory(st: GameState, events: GameEvent[]) {
  if (st.phase === 'over') return;
  for (const pid of [st.active, other(st.active)] as PlayerId[]) {
    if (st.players[other(pid)].stability <= 0) return finish(st, pid, 'Conquest: the rival city has fallen', events);
  }
}

// ====================================================================== effects

interface EffectCtx { self: PlayerId; targetUid?: string; /** Damage a sprung trap still soaks from this scheme. */ shield?: { left: number; used: number } }

function soak(ctx: EffectCtx, amount: number): number {
  if (!ctx.shield || ctx.shield.left <= 0) return amount;
  const take = Math.min(ctx.shield.left, amount);
  ctx.shield.left -= take; ctx.shield.used += take;
  return amount - take;
}

function runEffects(st: GameState, effects: Effect[], ctx: EffectCtx, events: GameEvent[]) {
  const self = st.players[ctx.self];
  const opp = st.players[other(ctx.self)];
  for (const e of effects) {
    if (st.phase === 'over') return;
    switch (e.op) {
      case 'gain': {
        const amount = e.perTag ? e.amount * countTag(self, e.perTag) : e.amount;
        const who = e.who === 'opp' ? opp.id : self.id;
        if (e.res === 'progress' && amount < 0) loseProgress(st, who, -amount, events, e.who === 'opp');
        else changeRes(st, who, e.res, amount, events);
        break;
      }
      case 'draw':
        if (e.family) drawFrom(st, self.id, e.family, e.ifTag ? (hasTag(self, e.ifTag) ? e.n : e.elseN ?? 0) : e.n);
        else for (let i = 0; i < e.n; i++) drawFrom(st, self.id, self.piles.civ.length >= self.piles.mil.length ? 'civ' : 'mil', 1);
        break;
      case 'damageBuilding':
        if (ctx.targetUid) damageBuilding(st, opp.id, ctx.targetUid, soak(ctx, e.amount), events);
        break;
      case 'damageCity': {
        const a = soak(ctx, e.amount);
        if (a) changeRes(st, opp.id, 'stability', -a, events);
        break;
      }
      case 'unrest': {
        const b = opp.buildings.find((x) => x.uid === ctx.targetUid);
        if (b) { b.unrest = Math.max(b.unrest, e.turns); events.push({ type: 'buildingUnrest', player: opp.id, uid: b.uid }); }
        break;
      }
      case 'unrestTag':
        for (const b of opp.buildings) if ((getCard(b.cardId).tags ?? []).includes(e.tag)) {
          b.unrest = Math.max(b.unrest, e.turns);
          events.push({ type: 'buildingUnrest', player: opp.id, uid: b.uid });
        }
        break;
      case 'damageEnemyUnits':
        for (const u of [...opp.units]) damageUnit(st, opp.id, u, e.amount, events);
        break;
      case 'createUnit':
        for (let i = 0; i < e.n; i++) addUnit(st, self.id, e.card, events);
        break;
      case 'repair': {
        const b = self.buildings.find((x) => x.uid === ctx.targetUid);
        if (b) { b.damage = e.full ? 0 : Math.max(0, b.damage - (e.amount ?? 0)); if (e.clearUnrest) b.unrest = 0; }
        break;
      }
      case 'repairAll':
        for (const b of self.buildings) { b.damage = e.full ? 0 : Math.max(0, b.damage - (e.amount ?? 0)); if (e.clearUnrest) b.unrest = 0; }
        break;
      case 'fortify': {
        const b = self.buildings.find((x) => x.uid === ctx.targetUid);
        if (b) b.bonusIntegrity += e.amount;
        break;
      }
      case 'readyUnits':
        for (const u of self.units) { u.ready = true; u.attacked = false; if (e.heal) u.damage = 0; }
        break;
      case 'buffUnits':
        for (const u of self.units) u.buff += e.str;
        break;
      case 'revealHand':
        opp.handRevealedTo = true;
        break;
    }
  }
}

// ====================================================================== combat

/** Strength bonus every blocking unit gets for defending its own riverbank. */
export const RIVERBANK = 1;

export const ATTACK_REACTIONS: ReactionKind[] = ['shieldWall', 'feignedRetreat', 'turnTheTide', 'ambush', 'treaty'];
export const ACTION_REACTIONS: ReactionKind[] = ['vigilantWatch', 'mirror'];

/** Distribute damage to units, weakest first. Returns damage left over after every unit is dead. */
function distribute(st: GameState, pid: PlayerId, units: UnitInst[], dmg: number, hpBonus: number, events: GameEvent[]): number {
  const p = st.players[pid];
  const sorted = [...units].sort((a, b) => (unitMaxHp(p, a) - a.damage) - (unitMaxHp(p, b) - b.damage));
  let left = dmg;
  for (const u of sorted) {
    if (left <= 0) break;
    const remaining = unitMaxHp(p, u) + hpBonus - u.damage;
    if (left >= remaining) { left -= remaining; removeUnit(st, pid, u.uid, events); }
    else { u.damage += left; left = 0; }
  }
  return Math.max(0, left);
}

function resolveAttack(st: GameState, pend: PendingAttack, blockerUids: string[], handReaction: ReactionKind | null, events: GameEvent[]) {
  const atk = st.players[pend.attacker];
  const def = st.players[other(pend.attacker)];
  let attackers = atk.units.filter((u) => pend.unitUids.includes(u.uid));
  const targetUid = pend.target.kind === 'building' ? pend.target.uid : null;
  const tgtCard = targetUid ? def.buildings.find((b) => b.uid === targetUid)?.cardId ?? 'city' : 'city';

  // Hidden traps at the target spring on contact (unless a reaction from hand calls the attack off first).
  const handCancels = handReaction === 'feignedRetreat' || handReaction === 'treaty';
  const sprung = handCancels ? [] : springTraps(st, def.id, targetUid ?? 'city', events);
  const roles = sprung.map((t) => trapRole(getCard(t.cardId)));
  const reactions: ReactionKind[] = handReaction ? [handReaction] : [];
  sprung.forEach((t, i) => {
    const r = getCard(t.cardId).reaction;
    if (roles[i] === 'reaction' && r && ATTACK_REACTIONS.includes(r) && !reactions.includes(r)) reactions.push(r);
  });
  const has = (r: ReactionKind) => reactions.includes(r);
  const cancel: ReactionKind | null = has('feignedRetreat') ? 'feignedRetreat' : has('treaty') ? 'treaty' : null;
  const trap: TrapReport | null = sprung.length ? { cards: sprung.map((t) => t.cardId), roles, absorbed: 0, snare: 0 } : null;
  // Every sprung card is spent; garrison troops are discarded when they leave the field.
  sprung.forEach((t, i) => { if (roles[i] !== 'garrison' || cancel) discard(st, def.id, { uid: t.uid, cardId: t.cardId }); });

  // Garrison troops burst out and fight as blockers for this one fight.
  const garrison: UnitInst[] = cancel ? [] : sprung.filter((_, i) => roles[i] === 'garrison')
    .map((t) => ({ uid: t.uid, cardId: t.cardId, damage: 0, ready: false, attacked: false, blocked: true, buff: 0 }));
  def.units.push(...garrison);
  const blockers = [...def.units.filter((u) => blockerUids.includes(u.uid)), ...garrison];
  for (const b of blockers) b.blocked = true;
  const attackerCards = attackers.map((u) => u.cardId);
  const blockerCards = blockers.map((u) => u.cardId);
  const blockerFromTrap = blockers.map((b) => garrison.includes(b));
  let towerHits = 0, progressRaided = 0;
  // Exactly who fell, and to what, so the hologram can stage each death.
  const attackerUids = attackers.map((u) => u.uid);
  const fates: Record<string, UnitFate> = {};
  const markFallen = (why: UnitFate) => { for (const uid of attackerUids) if (!fates[uid] && !atk.units.some((u) => u.uid === uid)) fates[uid] = why; };
  const blockerFates = () => blockers.map((b) => !def.units.some((u) => u.uid === b.uid));
  const detail = (extra: { wallCard?: string | null; cancelled?: boolean; tideBack?: number }) => ({
    attackerCards, blockerCards,
    attackerFates: (markFallen('melee'), attackerUids.map((uid) => fates[uid] ?? null)),
    blockerFates: blockerFates(),
    attackersLost: attackerCards.length - atk.units.filter((u) => pend.unitUids.includes(u.uid)).length,
    blockersLost: blockerFates().filter(Boolean).length,
    target: tgtCard, wallCard: extra.wallCard ?? null, reaction: reactions[0] ?? null, reactions, cancelled: extra.cancelled ?? false, tideBack: extra.tideBack ?? 0,
    targetDestroyed: !!targetUid && !def.buildings.some((b) => b.uid === targetUid), towerHits, progressRaided,
    trap, blockerFromTrap,
  });
  /** Garrison troops leave once the fight is over (their cards go to the discard). */
  const dismissGarrison = () => {
    for (const g of garrison) {
      if (!def.units.some((u) => u.uid === g.uid)) continue;
      def.units = def.units.filter((u) => u.uid !== g.uid);
      discard(st, def.id, { uid: g.uid, cardId: g.cardId });
    }
  };

  if (cancel) {
    if (cancel === 'feignedRetreat') { for (const u of attackers) damageUnit(st, atk.id, u, 1, events); markFallen('retreat'); }
    else changeRes(st, atk.id, 'prosperity', 3, events);
    log(st, def.id, cancel === 'treaty' ? `${def.name} offers a treaty — the attack is called off.` : `${def.name} feigns a retreat — the attack strikes empty ground.`);
    events.push({ type: 'combat', attacker: atk.id, power: 0, blocked: 0, wallAbsorbed: 0, dealt: 0, ...detail({ cancelled: true }) });
    return;
  }

  // Towers loose arrows as the attackers cross the river; snares and ambushes hit before the clash.
  const w = workingBuildings(def);
  const towers = def.buildings.filter((b) => w.has(b.uid) && (getCard(b.cardId).passives ?? []).includes('tower')).length;
  if (towers) { towerHits = towers; for (const u of [...attackers]) damageUnit(st, atk.id, u, towers, events); markFallen('tower'); }
  const snare = roles.filter((r) => r === 'snare').length * SNARE_DAMAGE;
  if (snare && trap) { trap.snare = snare; for (const u of [...atk.units.filter((x) => attackerUids.includes(x.uid))]) damageUnit(st, atk.id, u, snare, events); markFallen('trap'); }
  if (has('ambush')) { for (const u of [...atk.units.filter((x) => attackerUids.includes(x.uid))]) damageUnit(st, atk.id, u, 2, events); markFallen('ambush'); }
  attackers = atk.units.filter((u) => pend.unitUids.includes(u.uid));

  const targetBuilding = targetUid ? def.buildings.find((b) => b.uid === targetUid) : undefined;
  const walls = def.buildings.filter((b) => w.has(b.uid) && (getCard(b.cardId).passives ?? []).includes('wall') && b.uid !== targetBuilding?.uid);
  const trapWall = sprung.reduce((sum, t, i) => sum + (roles[i] === 'wall' ? trapWallOf(getCard(t.cardId)) : 0), 0);
  const brace = sprung.reduce((sum, t, i) => sum + (roles[i] === 'brace' ? braceOf(getCard(t.cardId)) : 0), 0);
  const structural = !!targetBuilding || walls.length > 0 || trapWall > 0;
  let power = 0;
  const raiders = attackers.filter((u) => (getCard(u.cardId).keywords ?? []).includes('raider')).length;
  for (const u of attackers) {
    power += unitStr(atk, u);
    if (structural && (getCard(u.cardId).keywords ?? []).includes('siege')) power += 2;
  }

  const shield = has('shieldWall') ? 1 : 0;
  const blockStr = hasPassive(def, 'blockStr') ? 1 : 0;
  let blockDmg = 0;
  // Holding the riverbank: attackers fight their way out of the water, so every blocker gets +1 Strength.
  for (const b of blockers) blockDmg += unitStr(def, b) + RIVERBANK + blockStr + shield + ((getCard(b.cardId).keywords ?? []).includes('ranged') ? 1 : 0);
  if (has('turnTheTide')) blockDmg *= 2;

  const blockerHp = blockers.reduce((s, b) => s + unitMaxHp(def, b) + shield - b.damage, 0);
  const excessBack = distribute(st, atk.id, attackers, blockDmg, 0, events);
  let overflow = distribute(st, def.id, blockers, power, shield, events);
  if (blockers.length === 0) overflow = power;

  if (has('turnTheTide') && excessBack > 0) {
    log(st, def.id, `The tide turns! ${excessBack} damage crashes back into ${atk.name}'s city.`);
    changeRes(st, atk.id, 'stability', -excessBack, events);
  }

  // A sprung fort stands as a wall for this fight; braced buildings soak what gets through.
  let trapAbsorbed = Math.min(trapWall, overflow);
  overflow -= trapAbsorbed;
  let wallAbsorbed = 0;
  for (const wall of walls) {
    if (overflow <= 0) break;
    const take = Math.min(maxIntegrity(wall) - wall.damage, overflow);
    wallAbsorbed += take;
    overflow -= take;
    damageBuilding(st, def.id, wall.uid, take, events);
  }
  const braced = Math.min(brace, overflow);
  overflow -= braced;
  trapAbsorbed += braced;
  if (trap) trap.absorbed = trapAbsorbed;

  let dealt = 0;
  if (overflow > 0) {
    if (pend.target.kind === 'city') { dealt = overflow; changeRes(st, def.id, 'stability', -overflow, events); }
    else if (targetBuilding && def.buildings.some((b) => b.uid === targetBuilding.uid)) { dealt = overflow; damageBuilding(st, def.id, targetBuilding.uid, overflow, events); }
  }

  if (dealt > 0) {
    changeRes(st, atk.id, 'momentum', 1, events);
    if (raiders) progressRaided = loseProgress(st, def.id, 2 * raiders, events, true);
    log(st, atk.id, `${atk.name}'s assault deals ${dealt} damage${wallAbsorbed ? ` after the walls absorb ${wallAbsorbed}` : ''}${progressRaided ? ` and raids ${progressRaided} Progress` : ''}.`);
  } else {
    if (blockers.length || wallAbsorbed || trapAbsorbed) changeRes(st, def.id, 'momentum', 1, events);
    log(st, def.id, `${def.name} holds the riverbank.`);
  }
  const fin = detail({ wallCard: walls[0]?.cardId ?? null, tideBack: has('turnTheTide') ? excessBack : 0 });
  dismissGarrison();
  events.push({ type: 'combat', attacker: atk.id, power, blocked: Math.min(power, blockerHp), wallAbsorbed, dealt, ...fin });
}

function mirrorTarget(p: PlayerState): string | undefined {
  return [...p.buildings].sort((a, b) => getCard(b.cardId).cost - getCard(a.cardId).cost)[0]?.uid;
}

function resolveAction(st: GameState, pend: PendingAction, handReaction: ReactionKind | null, events: GameEvent[]) {
  const card = getCard(pend.card.cardId);
  const caster = st.players[pend.caster];
  const defender = other(pend.caster);
  discard(st, pend.caster, pend.card);
  const defP = st.players[defender];
  const targetCardId = pend.targetUid ? defP.buildings.find((b) => b.uid === pend.targetUid)?.cardId ?? null : null;

  // Hidden traps at the targeted spot (the building, or the city for schemes with no target) spring first.
  let reaction = handReaction;
  let trap: TrapReport | null = null;
  const shield = { left: 0, used: 0 };
  if (!reaction) {
    const sprung = springTraps(st, defender, pend.targetUid ?? 'city', events);
    if (sprung.length) {
      const cards = sprung.map((t) => getCard(t.cardId));
      const roles = cards.map(trapRole);
      trap = { cards: cards.map((c) => c.id), roles, absorbed: 0, snare: 0 };
      sprung.forEach((t) => discard(st, defender, { uid: t.uid, cardId: t.cardId }));
      // Soldiers, snares, watchmen and ambushers catch the agents; a Mirror sends the scheme home.
      if (cards.some((c) => c.reaction === 'mirror')) reaction = 'mirror';
      else if (cards.some((c, i) => roles[i] === 'garrison' || roles[i] === 'snare' || c.reaction === 'vigilantWatch' || c.reaction === 'ambush')) reaction = 'vigilantWatch';
      cards.forEach((c, i) => { if (roles[i] === 'brace') shield.left += braceOf(c); if (roles[i] === 'wall') shield.left += trapWallOf(c); });
    }
  }
  const scheme = (outcome: 'hit' | 'foiled' | 'mirrored', mirrorTargetCardId: string | null = null) =>
    events.push({ type: 'scheme', caster: pend.caster, cardId: card.id, targetCardId, outcome, mirrorTargetCardId, trap });
  if (reaction === 'vigilantWatch') {
    scheme('foiled');
    log(st, defender, `${card.name} is ${trap ? 'caught by a hidden trap' : 'discovered'} and foiled.`);
    return;
  }
  if (reaction === 'mirror') {
    log(st, defender, `${card.name} is turned back on ${caster.name}!`);
    events.push({ type: 'reversed', player: defender, cardId: card.id });
    const t = card.target === 'enemyBuilding' ? mirrorTarget(caster) : pend.targetUid;
    scheme('mirrored', t ? caster.buildings.find((b) => b.uid === t)?.cardId ?? null : null);
    runEffects(st, card.effects ?? [], { self: defender, targetUid: t }, events);
    return;
  }
  const ev = { type: 'scheme', caster: pend.caster, cardId: card.id, targetCardId, outcome: 'hit', mirrorTargetCardId: null, trap } as GameEvent;
  events.push(ev);
  runEffects(st, card.effects ?? [], { self: pend.caster, targetUid: pend.targetUid, shield }, events);
  if (trap) trap.absorbed = shield.used;
}

// ====================================================================== validation

function requireMain(st: GameState, pid: PlayerId) {
  if (st.phase === 'over') throw new RuleError('The match is over.');
  if (st.active !== pid) throw new RuleError('It is not your turn.');
  if (st.phase === 'draft') throw new RuleError('Pick your cards first.');
  if (st.phase !== 'main') throw new RuleError('Waiting for a response.');
}

/** null when `pid` may take main-phase actions, else the reason. */
export function requireMainPhase(st: GameState, pid: PlayerId): string | null {
  try { requireMain(st, pid); return null; } catch (e) { return (e as Error).message; }
}

export function canPlayCard(st: GameState, pid: PlayerId, uid: string): string | null {
  try { checkPlay(st, pid, uid); return null; } catch (e) { return (e as Error).message; }
}

function checkPlay(st: GameState, pid: PlayerId, uid: string, targetUid?: string, skipTarget = true) {
  requireMain(st, pid);
  const p = st.players[pid];
  const inst = p.hand.find((c) => c.uid === uid);
  if (!inst) throw new RuleError('That card is not in your hand.');
  const card = getCard(inst.cardId);
  if (card.kind === 'reaction') throw new RuleError('Reactions are played during your rival’s turn.');
  if (p.prosperity < costOf(p, card)) throw new RuleError('Not enough Prosperity.');
  if ((card.kind === 'building' || card.kind === 'fort') && p.buildings.length >= RULES.maxBuildings) throw new RuleError('Your riverbank has no room for more buildings.');
  if (card.kind === 'unit' && p.units.length >= RULES.maxUnits) throw new RuleError('Your army is at full strength.');
  if (card.kind === 'unit' && !canDeploy(p, card)) throw new RuleError(`Requires a working ${card.requiresToDeploy}.`);
  if (card.target && card.target !== 'none') {
    const owner = card.target === 'enemyBuilding' ? st.players[other(pid)] : p;
    if (owner.buildings.length === 0) throw new RuleError('No building to target.');
    if (!skipTarget && (!targetUid || !owner.buildings.some((b) => b.uid === targetUid))) throw new RuleError('Choose a valid building.');
  }
  return { p, inst, card };
}

/** How many cards the active player must pick this draft (after discards). */
export function draftNeeded(p: PlayerState, discards = 0): number {
  return Math.max(0, RULES.handSize - (p.hand.length - discards));
}

// ====================================================================== apply

/**
 * The single entry point for changing game state. Pure: returns a new state
 * and the presentation events. Throws RuleError for illegal actions.
 */
export function applyAction(state: GameState, pid: PlayerId, action: Action): ApplyResult {
  const st = clone(state);
  const events: GameEvent[] = [];
  const before = st.players.map((p) => workingBuildings(p));

  switch (action.type) {
    case 'concede': {
      if (st.phase === 'over') throw new RuleError('The match is over.');
      log(st, pid, `${st.players[pid].name} concedes.`);
      finish(st, other(pid), 'Concession', events);
      break;
    }
    case 'draft': {
      if (st.phase === 'over') throw new RuleError('The match is over.');
      if (st.active !== pid) throw new RuleError('It is not your turn.');
      if (st.phase !== 'draft') throw new RuleError('You have already picked this turn.');
      const p = st.players[pid];
      const dis = [...new Set(action.discard ?? [])];
      for (const uid of dis) if (!p.hand.some((c) => c.uid === uid)) throw new RuleError('You can only discard cards from your hand.');
      const civ = Number(action.civ), mil = Number(action.mil);
      if (!Number.isInteger(civ) || !Number.isInteger(mil) || civ < 0 || mil < 0) throw new RuleError('Choose how many cards to take from each deck.');
      const need = draftNeeded(p, dis.length);
      if (civ + mil !== need) throw new RuleError(`Pick exactly ${need} card${need === 1 ? '' : 's'}.`);
      for (const uid of dis) { const c = p.hand.find((x) => x.uid === uid)!; p.hand = p.hand.filter((x) => x.uid !== uid); discard(st, pid, c); }
      const gotC = drawFrom(st, pid, 'civ', civ);
      const gotM = drawFrom(st, pid, 'mil', mil + (civ - gotC)); // a short pile spills over to the other
      const shortM = mil + (civ - gotC) - gotM;
      if (shortM > 0) drawFrom(st, pid, 'civ', shortM);
      p.peek = null;
      st.phase = 'main';
      events.push({ type: 'drafted', player: pid, civ: gotC, mil: gotM, discarded: dis.length });
      log(st, pid, `${p.name} picks ${civ} Civilization and ${mil} Military card${civ + mil === 1 ? '' : 's'}${dis.length ? ` after discarding ${dis.length}` : ''}.`);
      break;
    }
    case 'endTurn': {
      requireMain(st, pid);
      endTurn(st, events);
      break;
    }
    case 'signature': {
      requireMain(st, pid);
      const p = st.players[pid];
      const sig = getCiv(p.civ).signature;
      if (p.signatureUsed) throw new RuleError('Your Signature has already been used this turn.');
      if (p.momentum < sig.cost) throw new RuleError(`${sig.name} needs ${sig.cost} Momentum.`);
      changeRes(st, pid, 'momentum', -sig.cost, events);
      p.signatureUsed = true;
      events.push({ type: 'signature', player: pid, name: sig.name });
      log(st, pid, `${p.name} invokes ${sig.name}.`);
      runEffects(st, sig.effects, { self: pid, targetUid: action.targetUid }, events);
      break;
    }
    case 'play': {
      const { p, inst, card } = checkPlay(st, pid, action.uid, action.targetUid, false);
      changeRes(st, pid, 'prosperity', -costOf(p, card), events);
      p.hand = p.hand.filter((c) => c.uid !== inst.uid);
      events.push({ type: 'cardPlayed', player: pid, cardId: card.id });
      log(st, pid, `${p.name} plays ${card.name}.`);
      if (card.kind === 'building' || card.kind === 'fort') {
        p.buildings.push({ uid: inst.uid, cardId: card.id, damage: 0, bonusIntegrity: 0, unrest: 0 });
        events.push({ type: 'buildingRaised', player: pid, uid: inst.uid, cardId: card.id });
      } else if (card.kind === 'unit') {
        addUnit(st, pid, card.id, events, inst.uid);
      }
      if (card.family === 'civ') {
        if (card.kind === 'development') discard(st, pid, inst);
        if (card.progress) { events.push({ type: 'grow', player: pid, cardId: card.id, progress: card.progress }); addProgress(st, pid, card.progress, events); }
        if (st.phase !== 'over' && card.effects) runEffects(st, card.effects, { self: pid, targetUid: action.targetUid }, events);
      } else if (card.kind === 'tactic') {
        if (card.hostile) {
          st.phase = 'response';
          st.pending = { kind: 'action', caster: pid, card: inst, targetUid: action.targetUid };
          (st.struck ??= []).push(action.targetUid ?? 'city');
        } else {
          discard(st, pid, inst);
          events.push({ type: 'tactic', player: pid, cardId: card.id });
          runEffects(st, card.effects ?? [], { self: pid, targetUid: action.targetUid }, events);
        }
      }
      break;
    }
    case 'tuck': {
      requireMain(st, pid);
      const p = st.players[pid];
      const inst = p.hand.find((c) => c.uid === action.uid);
      if (!inst) throw new RuleError('That card is not in your hand.');
      const at = String(action.at);
      if (at !== 'city' && !p.buildings.some((b) => b.uid === at)) throw new RuleError('Tuck it under one of your buildings or your city.');
      if (trapsOf(p).filter((t) => t.at === at).length >= RULES.trapsPerSpot) throw new RuleError(`At most ${RULES.trapsPerSpot} cards can hide in one place.`);
      p.hand = p.hand.filter((c) => c.uid !== inst.uid);
      trapsOf(p).push({ uid: inst.uid, cardId: inst.cardId, at });
      events.push({ type: 'tucked', player: pid, total: p.traps.length });
      log(st, pid, `${p.name} hides a card face-down beside the river.`);
      break;
    }
    case 'attack': {
      requireMain(st, pid);
      const p = st.players[pid];
      const opp = st.players[other(pid)];
      const uids = [...new Set(action.unitUids)];
      if (uids.length === 0) throw new RuleError('Choose at least one unit to send across the river.');
      for (const uid of uids) {
        const u = p.units.find((x) => x.uid === uid);
        if (!u) throw new RuleError('Unknown unit.');
        if (!u.ready || u.attacked) throw new RuleError(`${getCard(u.cardId).name} is not ready to attack.`);
        if ((getCard(u.cardId).keywords ?? []).includes('guard')) throw new RuleError(`${getCard(u.cardId).name} only defends.`);
      }
      if (action.target.kind === 'building' && !opp.buildings.some((b) => b.uid === (action.target as { uid: string }).uid)) throw new RuleError('Unknown target building.');
      for (const u of p.units) if (uids.includes(u.uid)) u.attacked = true;
      const target: AttackTarget = action.target.kind === 'city' ? { kind: 'city' } : { kind: 'building', uid: action.target.uid };
      st.phase = 'response';
      st.pending = { kind: 'attack', attacker: pid, unitUids: uids, target };
      (st.struck ??= []).push(target.kind === 'city' ? 'city' : target.uid);
      events.push({ type: 'attackDeclared', player: pid, unitUids: uids, target });
      const tName = target.kind === 'city' ? 'the city' : getCard(opp.buildings.find((b) => b.uid === (target as { uid: string }).uid)!.cardId).name;
      log(st, pid, `${p.name} sends ${uids.length} unit${uids.length > 1 ? 's' : ''} across the river at ${tName}.`);
      break;
    }
    case 'respond': {
      if (st.phase !== 'response' || !st.pending) throw new RuleError('There is nothing to respond to.');
      const instigator = st.pending.kind === 'attack' ? st.pending.attacker : st.pending.caster;
      const defender = other(instigator);
      if (pid !== defender) throw new RuleError('Only the defender may respond.');
      const def = st.players[defender];
      let reaction: ReactionKind | null = null;
      if (action.reactionUid) {
        const inst = def.hand.find((c) => c.uid === action.reactionUid);
        if (!inst) throw new RuleError('That reaction is not in your hand.');
        const card = getCard(inst.cardId);
        if (card.kind !== 'reaction' || !card.reaction) throw new RuleError('That card is not a reaction.');
        const allowed = st.pending.kind === 'attack' ? ATTACK_REACTIONS : ACTION_REACTIONS;
        if (!allowed.includes(card.reaction)) throw new RuleError(`${card.name} cannot answer this.`);
        if (def.prosperity < card.cost) throw new RuleError('Not enough Prosperity for that reaction.');
        changeRes(st, defender, 'prosperity', -card.cost, events);
        def.hand = def.hand.filter((c) => c.uid !== inst.uid);
        discard(st, defender, inst);
        reaction = card.reaction;
        changeRes(st, defender, 'momentum', 1, events);
        events.push({ type: 'reaction', player: defender, cardId: card.id, reaction });
        log(st, defender, `${def.name} reacts with ${card.name}!`);
      }
      const blockers = [...new Set(action.blockerUids ?? [])];
      if (st.pending.kind === 'action' && blockers.length) throw new RuleError('Units cannot block a scheme.');
      for (const uid of blockers) {
        const u = def.units.find((x) => x.uid === uid);
        if (!u) throw new RuleError('Unknown blocker.');
        if (u.blocked) throw new RuleError(`${getCard(u.cardId).name} has already blocked this turn.`);
        if (u.attacked) throw new RuleError(`${getCard(u.cardId).name} is exhausted from attacking.`);
      }
      const pend = st.pending;
      st.pending = null;
      st.phase = 'main';
      if (pend.kind === 'attack') resolveAttack(st, pend, blockers, reaction, events);
      else resolveAction(st, pend, reaction, events);
      break;
    }
    default:
      throw new RuleError('Unknown action.');
  }

  st.players.forEach((p, i) => {
    const now = workingBuildings(p);
    for (const uid of before[i]) {
      if (!now.has(uid) && p.buildings.some((b) => b.uid === uid && b.unrest <= 0)) events.push({ type: 'supportLost', player: p.id, uid });
    }
  });
  checkVictory(st, events);
  return { state: st, events };
}

/** Who must act next: the active player (draft or main), or the defender during a response window. */
export function actingPlayer(st: GameState): PlayerId | null {
  if (st.phase === 'over') return null;
  if (st.phase === 'response' && st.pending) return other(st.pending.kind === 'attack' ? st.pending.attacker : st.pending.caster);
  return st.active;
}
