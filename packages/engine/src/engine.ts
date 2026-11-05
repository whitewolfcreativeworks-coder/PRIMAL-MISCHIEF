import { getCard, getCiv, RULES } from './data';
import { shuffleInPlace } from './rng';
import type {
  Action, ApplyResult, AttackTarget, BuildingInst, CardDef, CardInst, CivId, Effect, GameEvent,
  GameState, Passive, PendingAction, PendingAttack, PlayerId, PlayerState, ReactionKind, Resource, UnitInst,
} from './types';
import { RuleError } from './types';

// ====================================================================== setup

export interface PlayerSetup {
  name: string;
  civ: CivId;
  deck?: string[]; // defaults to the civ's starter deck (validate before passing)
}

export function createGame(seed: number, setups: [PlayerSetup, PlayerSetup], firstPlayer?: PlayerId): ApplyResult {
  const st: GameState = {
    version: 1, seed, rng: seed >>> 0 || 1, turn: 0, active: 0, phase: 'main', pending: null,
    players: [null as unknown as PlayerState, null as unknown as PlayerState],
    winner: null, winReason: null, uidCounter: 0, log: [],
  };
  setups.forEach((s, i) => {
    const id = i as PlayerId;
    const deckIds = s.deck ?? getCiv(s.civ).starterDeck;
    const deck: CardInst[] = deckIds.map((cardId) => ({ uid: newUid(st), cardId }));
    shuffleInPlace(st, deck);
    st.players[id] = {
      id, name: s.name, civ: s.civ, stability: RULES.startingStability, legacy: 0, goods: 0,
      food: RULES.startingFood, momentum: 0, deck, hand: [], discard: [], buildings: [], units: [],
      signatureUsed: false, lastSuit: null, handRevealedTo: false,
    };
  });
  const first: PlayerId = firstPlayer ?? (Math.floor(((st.rng >>> 0) % 1000) / 500) as PlayerId);
  const second = other(first);
  const events: GameEvent[] = [];
  for (const p of st.players) drawCards(st, p.id, RULES.startingHand, events, true);
  // Second-player compensation: an extra card and a head start on Momentum.
  drawCards(st, second, 1, events, true);
  st.players[second].momentum = 1;
  st.active = first;
  log(st, null, `${st.players[first].name} (${getCiv(st.players[first].civ).name}) moves first.`);
  beginTurn(st, first, events, true);
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

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

/** Buildings that are working: not in Unrest and with their requirements met (computed to a fixpoint). */
export function workingBuildings(p: PlayerState): Set<string> {
  let working = new Set(p.buildings.filter((b) => b.unrest <= 0).map((b) => b.uid));
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
    working = new Set(working);
  }
}

export function isWorking(p: PlayerState, uid: string): boolean {
  return workingBuildings(p).has(uid);
}

export function hasTag(p: PlayerState, tag: string): boolean {
  const w = workingBuildings(p);
  return p.buildings.some((b) => w.has(b.uid) && (getCard(b.cardId).tags ?? []).includes(tag));
}

export function hasPassive(p: PlayerState, passive: Passive): boolean {
  return countPassive(p, passive) > 0;
}

function countPassive(p: PlayerState, passive: Passive): number {
  const w = workingBuildings(p);
  return p.buildings.filter((b) => w.has(b.uid) && (getCard(b.cardId).passives ?? []).includes(passive)).length;
}

export function maxIntegrity(b: BuildingInst): number {
  return (getCard(b.cardId).integrity ?? 1) + b.bonusIntegrity;
}

export function unitStr(p: PlayerState, u: UnitInst): number {
  return (getCard(u.cardId).str ?? 0) + (hasPassive(p, 'unitStr') ? 1 : 0) + u.buff;
}

export function unitMaxHp(p: PlayerState, u: UnitInst): number {
  return (getCard(u.cardId).hp ?? 1) + (hasPassive(p, 'unitHp') ? 1 : 0);
}

export function costOf(p: PlayerState, card: CardDef): number {
  if (card.kind === 'building' && card.cost > 0 && hasPassive(p, 'buildDiscount')) return Math.max(1, card.cost - 1);
  return card.cost;
}

export function canRecruit(p: PlayerState, card: CardDef): boolean {
  return !card.requiresToRecruit || hasTag(p, card.requiresToRecruit);
}

/** Per-turn income a player would receive right now (used by UI and AI). */
export function incomeOf(p: PlayerState) {
  const w = workingBuildings(p);
  let goods = RULES.baseGoods, food = 0, legacy = 0, upkeep = 0, wages = 0;
  const irrigation = countPassive(p, 'irrigation') > 0;
  for (const b of p.buildings) {
    if (!w.has(b.uid)) continue;
    const c = getCard(b.cardId);
    goods += c.goods ?? 0;
    food += (c.food ?? 0) + (irrigation && (c.tags ?? []).includes('farm') ? 1 : 0);
    legacy += c.legacy ?? 0;
    if (c.legacyPerSuit) legacy += p.buildings.filter((o) => o.uid !== b.uid && w.has(o.uid) && getCard(o.cardId).suit === c.legacyPerSuit).length;
    if ((c.passives ?? []).includes('mint')) goods += p.buildings.filter((o) => o.uid !== b.uid && w.has(o.uid) && getCard(o.cardId).suit === 'silk').length;
  }
  for (const u of p.units) { upkeep += getCard(u.cardId).upkeep ?? 0; wages += getCard(u.cardId).wage ?? 0; }
  return { goods, food, legacy, upkeep, wages, netFood: food - upkeep };
}

function changeRes(st: GameState, pid: PlayerId, res: Resource, delta: number, events: GameEvent[]) {
  const p = st.players[pid];
  const before = p[res];
  let v = before + delta;
  if (res === 'goods') v = Math.min(RULES.goodsCap, Math.max(0, v));
  if (res === 'food') v = Math.min(RULES.foodCap, v); // may go negative: famine is checked at turn start
  if (res === 'momentum') v = Math.min(RULES.momentumCap, Math.max(0, v));
  if (res === 'legacy') v = Math.max(0, v);
  p[res] = v;
  if (v !== before) events.push({ type: 'resource', player: pid, res, delta: v - before });
  if (res === 'stability' && v < before) events.push({ type: 'cityDamaged', player: pid, amount: before - v });
}

function drawCards(st: GameState, pid: PlayerId, n: number, events: GameEvent[], quiet = false) {
  const p = st.players[pid];
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    if (p.deck.length === 0) {
      if (p.discard.length === 0) { changeRes(st, pid, 'stability', -1, events); continue; }
      p.deck = shuffleInPlace(st, p.discard.splice(0));
      changeRes(st, pid, 'stability', -1, events);
      log(st, pid, `${p.name} reshuffles their discard pile (-1 Stability).`);
    }
    const c = p.deck.shift()!;
    if (p.hand.length >= RULES.handLimit) { p.discard.push(c); continue; }
    p.hand.push(c);
    drawn++;
  }
  if (drawn && !quiet) events.push({ type: 'draw', player: pid, n: drawn });
}

function destroyBuilding(st: GameState, pid: PlayerId, uid: string, events: GameEvent[]) {
  const p = st.players[pid];
  const idx = p.buildings.findIndex((b) => b.uid === uid);
  if (idx < 0) return;
  const [b] = p.buildings.splice(idx, 1);
  p.discard.push({ uid: b.uid, cardId: b.cardId });
  events.push({ type: 'buildingDestroyed', player: pid, uid, cardId: b.cardId });
  log(st, pid, `${getCard(b.cardId).name} of ${p.name} collapses (-1 Stability).`);
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
  if (!getCard(u.cardId).token && !u.uid.startsWith('t')) p.discard.push({ uid: u.uid, cardId: u.cardId });
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
  events.push({ type: 'unitRecruited', player: pid, uid: u.uid, cardId });
}

// ====================================================================== turn flow

function beginTurn(st: GameState, pid: PlayerId, events: GameEvent[], firstTurnOfGame = false) {
  st.turn += 1;
  st.active = pid;
  st.phase = 'main';
  st.pending = null;
  const p = st.players[pid];
  const opp = st.players[other(pid)];
  p.signatureUsed = false;
  p.lastSuit = null;
  for (const u of p.units) { u.ready = true; u.attacked = false; }
  for (const u of opp.units) u.blocked = false;
  events.push({ type: 'turnStart', player: pid, turn: st.turn });

  // Wages: hired soldiers want paying before anything else.
  for (const u of [...p.units]) {
    const wage = getCard(u.cardId).wage ?? 0;
    if (!wage) continue;
    if (p.goods >= wage) changeRes(st, pid, 'goods', -wage, events);
    else { removeUnit(st, pid, u.uid, events, true); log(st, pid, `Unpaid, ${getCard(u.cardId).name} deserts ${p.name}.`); }
  }

  const inc = incomeOf(p);
  changeRes(st, pid, 'goods', inc.goods, events);
  changeRes(st, pid, 'food', inc.netFood, events);
  if (p.food < 0) {
    p.food = 0;
    events.push({ type: 'famine', player: pid });
    if (hasPassive(p, 'famineShield')) {
      log(st, pid, `Famine strikes ${p.name}, but the storehouses hold.`);
    } else {
      changeRes(st, pid, 'stability', -2, events);
      const hungry = [...p.units].filter((u) => (getCard(u.cardId).upkeep ?? 0) > 0)
        .sort((a, b) => (getCard(b.cardId).upkeep ?? 0) - (getCard(a.cardId).upkeep ?? 0) || (getCard(b.cardId).cost - getCard(a.cardId).cost))[0];
      if (hungry) removeUnit(st, pid, hungry.uid, events, true);
      log(st, pid, `Famine! ${p.name} loses 2 Stability${hungry ? ` and ${getCard(hungry.cardId).name} deserts` : ''}.`);
    }
  }
  changeRes(st, pid, 'legacy', inc.legacy, events);
  events.push({ type: 'income', player: pid, goods: inc.goods, food: inc.netFood, legacy: inc.legacy });

  if (!firstTurnOfGame) drawCards(st, pid, 1, events);
  if (hasPassive(p, 'scribes') && p.hand.length < 5) drawCards(st, pid, 1, events);
  checkVictory(st, events);
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
  return p.stability + p.legacy;
}

function decideOnPoints(st: GameState, events: GameEvent[]) {
  const [a, b] = st.players;
  const winner: PlayerId = score(a) === score(b) ? (a.legacy >= b.legacy ? 0 : 1) : score(a) > score(b) ? 0 : 1;
  finish(st, winner, 'Time: the chronicles favour the stronger civilization', events);
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
  const order: PlayerId[] = [st.active, other(st.active)];
  for (const pid of order) {
    if (st.players[other(pid)].stability <= 0) return finish(st, pid, 'Conquest: the rival civilization has collapsed', events);
  }
  for (const pid of order) {
    if (st.players[pid].legacy >= RULES.legacyTarget) return finish(st, pid, 'Legacy: their name will outlast every empire', events);
  }
}

// ====================================================================== effects

interface EffectCtx { self: PlayerId; targetUid?: string; }

function runEffects(st: GameState, effects: Effect[], ctx: EffectCtx, events: GameEvent[]) {
  const self = st.players[ctx.self];
  const opp = st.players[other(ctx.self)];
  for (const e of effects) {
    switch (e.op) {
      case 'gain': {
        let amount = e.amount;
        if (e.per) {
          const w = workingBuildings(self);
          const n = e.per.kind === 'suitBuildings'
            ? self.buildings.filter((b) => w.has(b.uid) && getCard(b.cardId).suit === (e.per as { suit: string }).suit).length
            : self.buildings.filter((b) => w.has(b.uid) && (getCard(b.cardId).tags ?? []).includes((e.per as { tag: string }).tag)).length;
          amount *= n;
        }
        const who = e.who === 'opp' ? opp.id : self.id;
        if (e.res === 'food' && amount < 0) {
          // Food loss cannot push below zero from an effect; it bites at the next upkeep instead.
          amount = Math.max(amount, -st.players[who].food);
        }
        changeRes(st, who, e.res, amount, events);
        break;
      }
      case 'draw':
        drawCards(st, self.id, e.ifTag ? (hasTag(self, e.ifTag) ? e.n : e.elseN ?? 0) : e.n, events);
        break;
      case 'damageBuilding':
        if (ctx.targetUid) damageBuilding(st, opp.id, ctx.targetUid, e.amount, events);
        break;
      case 'unrest': {
        const b = opp.buildings.find((x) => x.uid === ctx.targetUid);
        if (b) { b.unrest = Math.max(b.unrest, e.turns); events.push({ type: 'buildingUnrest', player: opp.id, uid: b.uid }); }
        break;
      }
      case 'unrestSuit':
        for (const b of opp.buildings) if (getCard(b.cardId).suit === e.suit) {
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

export const ATTACK_REACTIONS: ReactionKind[] = ['shieldWall', 'feignedRetreat', 'turnTheTide', 'ambush'];
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

function resolveAttack(st: GameState, pend: PendingAttack, blockerUids: string[], reaction: ReactionKind | null, events: GameEvent[]) {
  const atk = st.players[pend.attacker];
  const def = st.players[other(pend.attacker)];
  let attackers = atk.units.filter((u) => pend.unitUids.includes(u.uid));
  const blockers = def.units.filter((u) => blockerUids.includes(u.uid));
  for (const b of blockers) b.blocked = true;
  const attackerCards = attackers.map((u) => u.cardId);
  const blockerCards = blockers.map((u) => u.cardId);
  const tgtCard = pend.target.kind === 'building' ? def.buildings.find((b) => b.uid === (pend.target as { uid: string }).uid)?.cardId ?? 'city' : 'city';
  const detail = (extra: { wallCard?: string | null; cancelled?: boolean; tideBack?: number }) => ({
    attackerCards, blockerCards,
    attackersLost: attackerCards.length - atk.units.filter((u) => pend.unitUids.includes(u.uid)).length,
    blockersLost: blockerCards.length - def.units.filter((u) => blockerUids.includes(u.uid)).length,
    target: tgtCard, wallCard: extra.wallCard ?? null, reaction, cancelled: extra.cancelled ?? false, tideBack: extra.tideBack ?? 0,
    targetDestroyed: tgtCard !== 'city' && !def.buildings.some((b) => b.uid === (pend.target as { uid: string }).uid),
  });

  if (reaction === 'feignedRetreat') {
    for (const u of attackers) damageUnit(st, atk.id, u, 1, events);
    log(st, def.id, `${def.name} feigns a retreat — the attack strikes empty ground.`);
    events.push({ type: 'combat', attacker: atk.id, power: 0, blocked: 0, wallAbsorbed: 0, dealt: 0, ...detail({ cancelled: true }) });
    return;
  }
  if (reaction === 'ambush') {
    for (const u of attackers) damageUnit(st, atk.id, u, 2, events);
    attackers = atk.units.filter((u) => pend.unitUids.includes(u.uid));
  }

  const targetBuilding = pend.target.kind === 'building' ? def.buildings.find((b) => b.uid === (pend.target as { uid: string }).uid) : undefined;
  const walls = def.buildings.filter((b) => workingBuildings(def).has(b.uid) && (getCard(b.cardId).passives ?? []).includes('wall') && b.uid !== targetBuilding?.uid);
  const structural = !!targetBuilding || walls.length > 0;
  let power = 0;
  const raiders = attackers.filter((u) => (getCard(u.cardId).keywords ?? []).includes('raider')).length;
  for (const u of attackers) {
    power += unitStr(atk, u);
    if (structural && (getCard(u.cardId).keywords ?? []).includes('siege')) power += 2;
  }

  const shield = reaction === 'shieldWall' ? 1 : 0;
  const blockStr = hasPassive(def, 'blockStr') ? 1 : 0;
  let blockDmg = 0;
  for (const b of blockers) {
    blockDmg += unitStr(def, b) + blockStr + shield + ((getCard(b.cardId).keywords ?? []).includes('ranged') ? 1 : 0);
  }
  if (reaction === 'turnTheTide') blockDmg *= 2;

  // Simultaneous clash.
  const blockerHp = blockers.reduce((s, b) => s + unitMaxHp(def, b) + shield - b.damage, 0);
  const excessBack = distribute(st, atk.id, attackers, blockDmg, 0, events);
  let overflow = distribute(st, def.id, blockers, power, shield, events);
  if (blockers.length === 0) overflow = power;

  if (reaction === 'turnTheTide' && excessBack > 0) {
    log(st, def.id, `The tide turns! ${excessBack} damage crashes back into ${atk.name}'s city.`);
    changeRes(st, atk.id, 'stability', -excessBack, events);
  }

  let wallAbsorbed = 0;
  for (const w of walls) {
    if (overflow <= 0) break;
    const room = maxIntegrity(w) - w.damage;
    const take = Math.min(room, overflow);
    wallAbsorbed += take;
    overflow -= take;
    damageBuilding(st, def.id, w.uid, take, events);
  }

  let dealt = 0;
  if (overflow > 0) {
    if (pend.target.kind === 'city') { dealt = overflow; changeRes(st, def.id, 'stability', -overflow, events); }
    else if (def.buildings.some((b) => b.uid === targetBuilding?.uid)) { dealt = overflow; damageBuilding(st, def.id, targetBuilding!.uid, overflow, events); }
  }
  events.push({ type: 'combat', attacker: atk.id, power, blocked: Math.min(power, blockerHp), wallAbsorbed, dealt,
    ...detail({ wallCard: walls[0]?.cardId ?? null, tideBack: reaction === 'turnTheTide' ? excessBack : 0 }) });

  if (dealt > 0) {
    changeRes(st, atk.id, 'momentum', 1, events);
    if (raiders) {
      const steal = Math.min(def.goods, 2 * raiders);
      if (steal) { changeRes(st, def.id, 'goods', -steal, events); changeRes(st, atk.id, 'goods', steal, events); }
    }
    log(st, atk.id, `${atk.name}'s assault deals ${dealt} damage${wallAbsorbed ? ` after the walls absorb ${wallAbsorbed}` : ''}.`);
  } else {
    if (blockers.length) changeRes(st, def.id, 'momentum', 1, events);
    log(st, def.id, `${def.name} holds the line.`);
  }
}

/** Choose the caster's most valuable building as the target of a mirrored scheme. */
function mirrorTarget(p: PlayerState): string | undefined {
  return [...p.buildings].sort((a, b) => getCard(b.cardId).cost - getCard(a.cardId).cost)[0]?.uid;
}

function resolveAction(st: GameState, pend: PendingAction, reaction: ReactionKind | null, events: GameEvent[]) {
  const card = getCard(pend.card.cardId);
  const caster = st.players[pend.caster];
  caster.discard.push(pend.card);
  const defP = st.players[other(pend.caster)];
  const targetCardId = pend.targetUid ? defP.buildings.find((b) => b.uid === pend.targetUid)?.cardId ?? null : null;
  const scheme = (outcome: 'hit' | 'foiled' | 'mirrored', mirrorTargetCardId: string | null = null) =>
    events.push({ type: 'scheme', caster: pend.caster, cardId: card.id, targetCardId, outcome, mirrorTargetCardId });
  if (reaction === 'vigilantWatch') {
    scheme('foiled');
    log(st, other(pend.caster), `${card.name} is discovered and foiled.`);
    return;
  }
  if (reaction === 'mirror') {
    const defender = other(pend.caster);
    log(st, defender, `${card.name} is turned back on ${caster.name}!`);
    events.push({ type: 'reversed', player: defender, cardId: card.id });
    const t = card.target === 'enemyBuilding' ? mirrorTarget(caster) : pend.targetUid;
    scheme('mirrored', t ? caster.buildings.find((b) => b.uid === t)?.cardId ?? null : null);
    runEffects(st, card.effects ?? [], { self: defender, targetUid: t }, events);
    return;
  }
  scheme('hit');
  runEffects(st, card.effects ?? [], { self: pend.caster, targetUid: pend.targetUid }, events);
}

// ====================================================================== validation

function requireActive(st: GameState, pid: PlayerId) {
  if (st.phase === 'over') throw new RuleError('The match is over.');
  if (st.phase !== 'main') throw new RuleError('Waiting for a response.');
  if (st.active !== pid) throw new RuleError('It is not your turn.');
}

function validateTarget(st: GameState, pid: PlayerId, card: CardDef, targetUid?: string) {
  const spec = card.target ?? 'none';
  if (spec === 'none') return;
  const owner = spec === 'enemyBuilding' ? st.players[other(pid)] : st.players[pid];
  if (!targetUid || !owner.buildings.some((b) => b.uid === targetUid)) throw new RuleError('Choose a valid building target.');
}

export function canPlayCard(st: GameState, pid: PlayerId, uid: string): string | null {
  try { checkPlay(st, pid, uid); return null; } catch (e) { return (e as Error).message; }
}

function checkPlay(st: GameState, pid: PlayerId, uid: string, targetUid?: string, skipTarget = true) {
  requireActive(st, pid);
  const p = st.players[pid];
  const inst = p.hand.find((c) => c.uid === uid);
  if (!inst) throw new RuleError('That card is not in your hand.');
  const card = getCard(inst.cardId);
  if (card.kind === 'reaction') throw new RuleError('Reactions are played during your opponent’s turn.');
  if (p.goods < costOf(p, card)) throw new RuleError('Not enough Goods.');
  if (card.kind === 'building' && p.buildings.length >= RULES.maxBuildings) throw new RuleError('Your city has no room for more buildings.');
  if (card.kind === 'unit' && p.units.length >= RULES.maxUnits) throw new RuleError('Your army is at full strength.');
  if (card.kind === 'unit' && !canRecruit(p, card)) throw new RuleError(`Requires a working ${card.requiresToRecruit}.`);
  if (card.target && card.target !== 'none') {
    const owner = card.target === 'enemyBuilding' ? st.players[other(pid)] : p;
    if (owner.buildings.length === 0) throw new RuleError('No valid building to target.');
    if (!skipTarget) validateTarget(st, pid, card, targetUid);
  }
  return { p, inst, card };
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
    case 'endTurn': {
      requireActive(st, pid);
      endTurn(st, events);
      break;
    }
    case 'rally': {
      requireActive(st, pid);
      const p = st.players[pid];
      if (p.momentum < RULES.rallyCost) throw new RuleError(`Rally needs ${RULES.rallyCost} Momentum.`);
      changeRes(st, pid, 'momentum', -RULES.rallyCost, events);
      drawCards(st, pid, 1, events);
      break;
    }
    case 'signature': {
      requireActive(st, pid);
      const p = st.players[pid];
      const sig = getCiv(p.civ).signature;
      if (p.signatureUsed) throw new RuleError('Your signature has already been used this turn.');
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
      changeRes(st, pid, 'goods', -costOf(p, card), events);
      p.hand = p.hand.filter((c) => c.uid !== inst.uid);
      events.push({ type: 'cardPlayed', player: pid, cardId: card.id });
      // Chains: matching the suit of your previous card earns Momentum, and some cards reward it further.
      const chained = p.lastSuit !== null && p.lastSuit === card.suit;
      const chainBonus = card.chain && p.lastSuit === card.chain.suit;
      if (chained) { changeRes(st, pid, 'momentum', 1, events); events.push({ type: 'chain', player: pid, suit: card.suit }); }
      p.lastSuit = card.suit;
      log(st, pid, `${p.name} plays ${card.name}${chained ? ' (chain)' : ''}.`);
      if (card.kind === 'building') {
        p.buildings.push({ uid: inst.uid, cardId: card.id, damage: 0, bonusIntegrity: 0, unrest: 0 });
        events.push({ type: 'buildingRaised', player: pid, uid: inst.uid, cardId: card.id });
      } else if (card.kind === 'unit') {
        addUnit(st, pid, card.id, events, inst.uid);
      }
      if (chainBonus) runEffects(st, card.chain!.effects, { self: pid, targetUid: action.targetUid }, events);
      if (card.kind === 'action') {
        if (card.hostile) {
          st.phase = 'response';
          st.pending = { kind: 'action', caster: pid, card: inst, targetUid: action.targetUid };
        } else {
          p.discard.push(inst);
          runEffects(st, card.effects ?? [], { self: pid, targetUid: action.targetUid }, events);
        }
      }
      break;
    }
    case 'attack': {
      requireActive(st, pid);
      const p = st.players[pid];
      const opp = st.players[other(pid)];
      const uids = [...new Set(action.unitUids)];
      if (uids.length === 0) throw new RuleError('Choose at least one unit to attack with.');
      for (const uid of uids) {
        const u = p.units.find((x) => x.uid === uid);
        if (!u) throw new RuleError('Unknown unit.');
        if (!u.ready || u.attacked) throw new RuleError(`${getCard(u.cardId).name} is not ready to attack.`);
      }
      if (action.target.kind === 'building' && !opp.buildings.some((b) => b.uid === (action.target as { uid: string }).uid)) throw new RuleError('Unknown target building.');
      for (const u of p.units) if (uids.includes(u.uid)) u.attacked = true;
      const target: AttackTarget = action.target.kind === 'city' ? { kind: 'city' } : { kind: 'building', uid: action.target.uid };
      st.phase = 'response';
      st.pending = { kind: 'attack', attacker: pid, unitUids: uids, target };
      events.push({ type: 'attackDeclared', player: pid, unitUids: uids, target });
      const tName = target.kind === 'city' ? 'the city' : getCard(opp.buildings.find((b) => b.uid === (target as { uid: string }).uid)!.cardId).name;
      log(st, pid, `${p.name} attacks ${tName} with ${uids.length} unit${uids.length > 1 ? 's' : ''}.`);
      break;
    }
    case 'respond': {
      if (st.phase !== 'response' || !st.pending) throw new RuleError('There is nothing to respond to.');
      const attackerOrCaster = st.pending.kind === 'attack' ? st.pending.attacker : st.pending.caster;
      const defender = other(attackerOrCaster);
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
        if (def.goods < card.cost) throw new RuleError('Not enough Goods for that reaction.');
        changeRes(st, defender, 'goods', -card.cost, events);
        def.hand = def.hand.filter((c) => c.uid !== inst.uid);
        def.discard.push(inst);
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

  // Support changes: report buildings that stopped working because something they depend on fell.
  st.players.forEach((p, i) => {
    const now = workingBuildings(p);
    for (const uid of before[i]) {
      if (!now.has(uid) && p.buildings.some((b) => b.uid === uid && b.unrest <= 0)) events.push({ type: 'supportLost', player: p.id, uid });
    }
  });
  checkVictory(st, events);
  return { state: st, events };
}

/** Who must act next: the active player in main phase, the defender during a response window. */
export function actingPlayer(st: GameState): PlayerId | null {
  if (st.phase === 'over') return null;
  if (st.phase === 'response' && st.pending) return other(st.pending.kind === 'attack' ? st.pending.attacker : st.pending.caster);
  return st.active;
}
