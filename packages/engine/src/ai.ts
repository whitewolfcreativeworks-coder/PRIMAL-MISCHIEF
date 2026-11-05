import { getCard, RULES } from './data';
import { actingPlayer, applyAction, incomeOf, maxIntegrity, other, unitMaxHp, unitStr, workingBuildings } from './engine';
import { availableBlockers, listPlays, playableReactions, readyAttackers } from './legal';
import type { Action, GameState, PlayerId, PlayerState } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

/*
 * Heuristic opponent. It only ever reasons about public information plus its
 * own hand: when it simulates an attack it assumes the defender blocks as well
 * as possible but never peeks at the defender's hidden reactions, and its
 * evaluation counts hand size rather than the identity of undrawn cards.
 */

// ------------------------------------------------------------------ evaluation

function playerValue(p: PlayerState, oppPower: number): number {
  const w = workingBuildings(p);
  const inc = incomeOf(p);
  let v = 0;
  // Stability matters more the closer it is to zero.
  v += p.stability * 3 + Math.max(0, 10 - p.stability) * 2.5;
  v += p.legacy * 2.2 + Math.max(0, p.legacy - 8) * 2.5;
  v += p.goods * 0.45 + Math.min(p.food, 8) * 0.3 + p.momentum * 1.1;
  v += Math.min(p.hand.length, 7) * 1.3;
  v += inc.goods * 1.6 + inc.legacy * 4.2;
  v += inc.netFood >= 0 ? Math.min(inc.netFood, 3) * 0.8 : inc.netFood * 2.5;
  if (p.food + inc.netFood < 0) v -= 6; // famine next turn
  for (const b of p.buildings) {
    const c = getCard(b.cardId);
    const health = (maxIntegrity(b) - b.damage) / maxIntegrity(b);
    v += (w.has(b.uid) ? 1.2 + c.cost * 0.9 : 0.4 + c.cost * 0.3) * (0.6 + 0.4 * health);
    if ((c.passives ?? []).includes('wall') && w.has(b.uid)) v += (maxIntegrity(b) - b.damage) * 0.35;
  }
  let myPower = 0;
  for (const u of p.units) {
    const s = unitStr(p, u);
    myPower += s;
    v += s * 1.6 + (unitMaxHp(p, u) - u.damage) * 0.9 + 0.5;
  }
  // Exposure: enemy strength our army could not absorb next turn.
  v -= Math.max(0, oppPower - myPower) * 0.6;
  return v;
}

export function evaluate(st: GameState, me: PlayerId): number {
  if (st.phase === 'over') return st.winner === me ? 1e6 : -1e6;
  const a = st.players[me], b = st.players[other(me)];
  const pa = a.units.reduce((s, u) => s + unitStr(a, u), 0);
  const pb = b.units.reduce((s, u) => s + unitStr(b, u), 0);
  return playerValue(a, pb) - playerValue(b, pa);
}

// ------------------------------------------------------------------ helpers

function tryApply(st: GameState, pid: PlayerId, a: Action): GameState | null {
  try { return applyAction(st, pid, a).state; } catch { return null; }
}

function subsets<T>(items: T[], max = 64): T[][] {
  const out: T[][] = [];
  const n = Math.min(items.length, 6);
  for (let m = 0; m < 1 << n && out.length < max; m++) out.push(items.slice(0, n).filter((_, i) => m & (1 << i)));
  return out;
}

/** Best blocks for `defender` without any reaction — public information only. */
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

/** After one of our actions, assume a sensible reply if a response window opened. */
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

/** Greedy best single action this instant, or endTurn. */
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

/** Play out the rest of the turn greedily and return the resulting value. */
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

// ------------------------------------------------------------------ public API

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

export function chooseAction(st: GameState, me: PlayerId, diff: Difficulty = 'normal'): Action {
  if (actingPlayer(st) !== me) throw new Error('AI asked to act out of turn.');
  if (st.phase === 'response') return chooseResponse(st, me, diff);
  if (diff !== 'hard') return greedy(st, me, diff).action;

  // Hard: look one action ahead and play the rest of the turn out greedily.
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
  return bestA;
}

/** Safety valve used by callers: a turn never needs more than this many AI actions. */
export const AI_ACTIONS_PER_TURN = RULES.maxBuildings + RULES.maxUnits + 12;
