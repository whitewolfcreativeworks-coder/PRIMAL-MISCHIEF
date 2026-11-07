import { getCard, progressNeeded, RULES } from './data';
import { actingPlayer, applyAction, costOf, draftNeeded, incomeOf, maxIntegrity, other, unitMaxHp, unitStr, workingBuildings } from './engine';
import { availableBlockers, listPlays, playableReactions, readyAttackers } from './legal';
import type { Action, Age, CivId, GameState, PlayerId, PlayerState } from './types';
import { HIDDEN_CARD } from './view';

export type Difficulty = 'easy' | 'normal' | 'hard';

/*
 * Heuristic opponent. It reasons only from what its own seat can see: its
 * hand, the board and public counts. Attack previews assume the defender
 * blocks as well as possible but never peek at the defender's reactions.
 */

// ------------------------------------------------------------------ evaluation

/** Total development: Progress banked across all Ages. Reaching the Golden Age = 60. */
export function development(p: PlayerState): number {
  let d = p.progress;
  for (let a = 1; a < p.age; a++) d += progressNeeded(a as Age);
  return d;
}
const GOLDEN = RULES.progressToAdvance.reduce((a, b) => a + b, 0);

function armyPower(p: PlayerState) {
  return p.units.reduce((s, u) => s + unitStr(p, u), 0);
}

function playerValue(p: PlayerState, oppPower: number): number {
  const w = workingBuildings(p);
  const inc = incomeOf(p);
  const dev = development(p);
  let v = 0;
  v += dev * 2.4 + Math.max(0, dev - GOLDEN * 0.6) * 3; // the race to the Golden Age
  v += p.age * 4;
  v += p.stability * 2.6 + Math.max(0, 12 - p.stability) * 3;
  v += p.prosperity * 0.35 + p.momentum * 1.2;
  v += Math.min(p.hand.length, RULES.handSize) * 1.1;
  v += inc.net * 1.4 + inc.growth * 3.2;
  if (inc.net < 0) v -= 5; // the army is about to desert
  for (const b of p.buildings) {
    const c = getCard(b.cardId);
    const health = (maxIntegrity(b) - b.damage) / maxIntegrity(b);
    v += (w.has(b.uid) ? 1 + c.cost * 0.7 : 0.3 + c.cost * 0.25) * (0.6 + 0.4 * health);
    if ((c.passives ?? []).includes('wall') && w.has(b.uid)) v += (maxIntegrity(b) - b.damage) * 0.35;
  }
  const power = armyPower(p);
  for (const u of p.units) v += unitStr(p, u) * 1.5 + (unitMaxHp(p, u) - u.damage) * 0.8 + 0.4;
  v -= Math.max(0, oppPower - power) * 0.7;
  return v;
}

export function evaluate(st: GameState, me: PlayerId): number {
  if (st.phase === 'over') return st.winner === me ? 1e6 : -1e6;
  const a = st.players[me], b = st.players[other(me)];
  return playerValue(a, armyPower(b)) - playerValue(b, armyPower(a));
}

// ------------------------------------------------------------------ draft

const AGGRESSION: Record<CivId, number> = { kush: 0.5, carthage: 0.5, inca: 0.2, aksum: -0.3, sumer: -0.4 };

/** Decide the blind pick: how many cards from each deck, and what to throw away first. */
export function chooseDraft(st: GameState, me: PlayerId, diff: Difficulty = 'normal'): Action {
  const p = st.players[me], opp = st.players[other(me)];
  // Discard cards from retired Ages, and surplus reactions.
  const discard: string[] = [];
  let reactions = 0;
  for (const c of p.hand) {
    if (c.cardId === '?') continue;
    const card = getCard(c.cardId);
    if (card.age < p.age - 1) discard.push(c.uid);
    else if (card.kind === 'reaction' && ++reactions > 2) discard.push(c.uid);
  }
  const need = draftNeeded(p, discard.length);
  if (need === 0) return { type: 'draft', civ: 0, mil: 0, discard };

  const myDefense = p.units.filter((u) => !u.attacked).reduce((s, u) => s + unitStr(p, u) + 1, 0)
    + p.buildings.filter((b) => (getCard(b.cardId).passives ?? []).includes('wall')).reduce((s, b) => s + (maxIntegrity(b) - b.damage) * 0.5, 0);
  const threat = armyPower(opp) - myDefense;
  const behind = development(opp) - development(p); // rival racing ahead: slow them down
  const milInHand = p.hand.filter((c) => c.cardId !== '?' && !discard.includes(c.uid) && getCard(c.cardId).family === 'mil').length;
  const civInHand = p.hand.length - discard.length - milInHand;

  let mil = need * 0.35 + AGGRESSION[p.civ];
  mil += Math.max(0, threat) * 0.35;
  mil += Math.max(0, behind) * 0.08;
  mil += (civInHand - milInHand) * 0.25;
  if (p.prosperity + incomeOf(p).net < 3) mil -= 0.5; // cannot afford an army: grow first
  // Sumer's scribes: lean toward whichever deck is showing a strong card on top.
  if (p.peek && diff !== 'easy') {
    const worth = (id: string | null) => (id ? getCard(id).cost + (getCard(id).age >= p.age ? 2 : 0) : 0);
    mil += (worth(p.peek.mil) - worth(p.peek.civ)) * 0.25;
  }
  if (diff === 'easy') mil += ((st.turn * 7919) % 5) / 2 - 1;
  const m = Math.max(0, Math.min(need, Math.round(mil)));
  return { type: 'draft', civ: need - m, mil: m, discard };
}

// ------------------------------------------------------------------ play

function tryApply(st: GameState, pid: PlayerId, a: Action): GameState | null {
  try { return applyAction(st, pid, a).state; } catch { return null; }
}

function subsets<T>(items: T[], max = 64): T[][] {
  const out: T[][] = [];
  const n = Math.min(items.length, 6);
  for (let m = 0; m < 1 << n && out.length < max; m++) out.push(items.slice(0, n).filter((_, i) => m & (1 << i)));
  return out;
}

function bestBlockOnly(st: GameState, defender: PlayerId): GameState {
  let best: GameState | null = null, bestV = -Infinity;
  for (const blk of subsets(availableBlockers(st, defender))) {
    const s = tryApply(st, defender, { type: 'respond', blockerUids: blk });
    if (!s) continue;
    const v = evaluate(s, defender);
    if (v > bestV) { bestV = v; best = s; }
  }
  return best ?? applyAction(st, defender, { type: 'respond', blockerUids: [] }).state;
}

function settle(st: GameState, me: PlayerId, diff: Difficulty): GameState {
  if (st.phase !== 'response' || !st.pending) return st;
  const defender = other(me);
  if (st.pending.kind === 'attack' && diff !== 'easy') return bestBlockOnly(st, defender);
  return applyAction(st, defender, { type: 'respond', blockerUids: [] }).state;
}

function attackOptions(st: GameState, me: PlayerId): Action[] {
  const ready = readyAttackers(st, me);
  if (!ready.length) return [];
  const p = st.players[me], opp = st.players[other(me)];
  const byStr = [...ready].sort((x, y) => unitStr(p, p.units.find((u) => u.uid === y)!) - unitStr(p, p.units.find((u) => u.uid === x)!));
  const groups: string[][] = [ready];
  if (ready.length > 1) groups.push(byStr.slice(0, Math.ceil(ready.length / 2)));
  if (ready.length > 2) groups.push(byStr.slice(0, 1));
  const out: Action[] = [];
  for (const g of groups) {
    out.push({ type: 'attack', unitUids: g, target: { kind: 'city' } });
    for (const b of opp.buildings) out.push({ type: 'attack', unitUids: g, target: { kind: 'building', uid: b.uid } });
  }
  return out;
}

function candidates(st: GameState, me: PlayerId): Action[] {
  return [...listPlays(st, me), ...attackOptions(st, me)];
}

function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function greedy(st: GameState, me: PlayerId, diff: Difficulty, salt = 0): { action: Action; value: number } {
  let bestA: Action = { type: 'endTurn' };
  let bestV = evaluate(st, me) + 0.25;
  candidates(st, me).forEach((a, i) => {
    const s = tryApply(st, me, a);
    if (!s) return;
    let v = evaluate(settle(s, me, diff), me);
    if (diff === 'easy') v += (noise(st.turn * 131 + i * 7 + salt) - 0.5) * 8;
    if (v > bestV) { bestV = v; bestA = a; }
  });
  return { action: bestA, value: bestV };
}

function rollout(st: GameState, me: PlayerId, steps: number): number {
  let s = st;
  for (let i = 0; i < steps && s.phase === 'main' && s.active === me; i++) {
    const { action } = greedy(s, me, 'normal');
    if (action.type === 'endTurn') break;
    const n = tryApply(s, me, action);
    if (!n) break;
    s = settle(n, me, 'normal');
  }
  return evaluate(s, me);
}

export function chooseResponse(st: GameState, me: PlayerId, diff: Difficulty = 'normal'): Action {
  const reactions: (string | undefined)[] = [undefined, ...playableReactions(st, me)];
  const blockSets = st.pending?.kind === 'attack'
    ? (diff === 'easy' ? [[], availableBlockers(st, me)] : subsets(availableBlockers(st, me)))
    : [[]];
  let best: Action = { type: 'respond', blockerUids: [] };
  let bestV = -Infinity;
  reactions.forEach((r, ri) => {
    for (const blk of blockSets) {
      const a: Action = { type: 'respond', reactionUid: r, blockerUids: blk };
      const s = tryApply(st, me, a);
      if (!s) continue;
      let v = evaluate(s, me);
      if (diff === 'easy') v += (noise(st.turn * 17 + ri * 3 + blk.length) - 0.5) * 6;
      if (v > bestV) { bestV = v; best = a; }
    }
  });
  return best;
}

// ------------------------------------------------------------------ hidden traps

/** The AI never sees where the rival hid traps or what they are: it only knows how many. */
export function maskTraps(st: GameState, me: PlayerId): GameState {
  const opp = st.players[other(me)];
  if (!(opp.traps ?? []).some((t) => t.cardId !== HIDDEN_CARD)) return st;
  const v: GameState = JSON.parse(JSON.stringify(st));
  v.players[other(me)].traps = opp.traps.map((_, i) => ({ uid: `x${i}`, cardId: HIDDEN_CARD, at: HIDDEN_CARD }));
  return v;
}

/**
 * Before ending its turn, the AI hides cards it cannot use soon under the
 * spots the rival is most likely to hit, spreading them out (and bluffing a
 * little) so a single probe cannot clear them all.
 */
export function chooseTuck(st: GameState, me: PlayerId, diff: Difficulty): Action | null {
  const p = st.players[me], opp = st.players[other(me)];
  if (diff === 'easy' && noise(st.turn * 37 + p.hand.length) < 0.6) return null;
  const known = p.hand.filter((c) => c.cardId !== HIDDEN_CARD);
  if (known.length <= 2) return null;
  const nextBudget = p.prosperity + incomeOf(p).net;
  // Keep the cards worth holding: reactions (one), and what it can afford next turn (best first).
  const ranked = known.map((c) => {
    const card = getCard(c.cardId);
    let keep = card.age * 1.5 + card.cost;
    if (card.age < p.age - 1) keep -= 20; // retired: pure junk
    if (costOf(p, card) > nextBudget) keep -= 8; // cannot pay for it soon
    if (card.kind === 'reaction') keep += 6;
    return { c, card, keep };
  }).sort((a, b) => b.keep - a.keep);
  const reactionsKept = ranked.slice(0, 3).filter((r) => r.card.kind === 'reaction').length;
  const spare = ranked.slice(3).concat(reactionsKept > 1 ? ranked.slice(0, 3).filter((r) => r.card.kind === 'reaction').slice(1) : []);
  const pick = spare.sort((a, b) => a.keep - b.keep)[0];
  if (!pick) return null;
  const traps = p.traps ?? [];
  // Where will the rival strike? The city when they have an army, otherwise the most valuable buildings.
  const w = workingBuildings(p);
  const spots = [{ at: 'city', weight: opp.units.length ? 3 + armyPower(opp) * 0.3 : 1 }, ...p.buildings.map((b) => {
    const c = getCard(b.cardId);
    return { at: b.uid, weight: (w.has(b.uid) ? 1 + c.cost * 0.6 : 0.4) + (c.rarity === 'wonder' ? 2 : 0) };
  })];
  let best: { at: string; v: number } | null = null;
  spots.forEach((sp, i) => {
    const here = traps.filter((t) => t.at === sp.at).length;
    if (here >= RULES.trapsPerSpot) return;
    const v = sp.weight / (1 + here * 1.3) + (diff === 'hard' ? 0 : noise(st.turn * 53 + i) * 1.5);
    if (!best || v > best.v) best = { at: sp.at, v };
  });
  return best ? { type: 'tuck', uid: pick.c.uid, at: (best as { at: string }).at } : null;
}

/** Before committing the army against a spot that may hide traps, send the cheapest unit in first. */
function probeFirst(st: GameState, me: PlayerId, a: Action): Action {
  if (a.type !== 'attack' || a.unitUids.length < 2) return a;
  const opp = st.players[other(me)];
  if (!(opp.traps ?? []).length) return a;
  const spot = a.target.kind === 'city' ? 'city' : a.target.uid;
  if ((st.struck ?? []).includes(spot)) return a; // already tested this turn
  const p = st.players[me];
  const cheapest = [...a.unitUids].sort((x, y) => {
    const ux = p.units.find((u) => u.uid === x)!, uy = p.units.find((u) => u.uid === y)!;
    return getCard(ux.cardId).cost + unitStr(p, ux) * 0.5 - (getCard(uy.cardId).cost + unitStr(p, uy) * 0.5);
  })[0];
  return { type: 'attack', unitUids: [cheapest], target: a.target };
}

export function chooseAction(full: GameState, me: PlayerId, diff: Difficulty = 'normal'): Action {
  if (actingPlayer(full) !== me) throw new Error('AI asked to act out of turn.');
  const st = maskTraps(full, me);
  if (st.phase === 'draft') return chooseDraft(st, me, diff);
  if (st.phase === 'response') return chooseResponse(st, me, diff);
  const finish = (a: Action): Action => {
    if (a.type === 'endTurn') return chooseTuck(st, me, diff) ?? a;
    return diff === 'easy' ? a : probeFirst(st, me, a);
  };
  if (diff !== 'hard') return finish(greedy(st, me, diff).action);

  const base = rollout(st, me, 0) + 0.25;
  const scored: { a: Action; v: number }[] = [];
  for (const a of candidates(st, me)) {
    const s = tryApply(st, me, a);
    if (!s) continue;
    scored.push({ a, v: evaluate(settle(s, me, 'hard'), me) });
  }
  scored.sort((x, y) => y.v - x.v);
  let bestA: Action = { type: 'endTurn' };
  let bestV = base;
  for (const { a } of scored.slice(0, 6)) {
    const s = settle(applyAction(st, me, a).state, me, 'hard');
    const v = rollout(s, me, 6);
    if (v > bestV) { bestV = v; bestA = a; }
  }
  return finish(bestA);
}

export const AI_ACTIONS_PER_TURN = RULES.maxBuildings + RULES.maxUnits + 14 + RULES.handLimit;
