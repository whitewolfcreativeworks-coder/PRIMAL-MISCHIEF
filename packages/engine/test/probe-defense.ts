// Defence probe: how often a defender can answer an attack (npx tsx test/probe-defense.ts).
import { actingPlayer, applyAction, chooseAction, CIVS, createGame, getCard, type GameState } from '../src/index';
import { ATTACK_REACTIONS } from '../src/engine';
const c = { mustered: 0, attacks: 0, noUnitsFree: 0, noReactInHand: 0, reactInHandUnaffordable: 0, reactUsed: 0, blocked: 0, undefended: 0, trapAtTarget: 0, prosp: 0, unitsOnBoard: 0 };
for (const x of CIVS) for (const y of CIVS) { if (x.id === y.id) continue; for (let i = 0; i < 4; i++) {
  let st: GameState = createGame(500 + i * 13 + x.id.length, [{ name: 'A', civ: x.id }, { name: 'B', civ: y.id }], (i % 2) as 0 | 1).state;
  let g = 0;
  while (st.phase !== 'over' && g++ < 8000) {
    const pid = actingPlayer(st)!;
    const a = chooseAction(st, pid, 'normal');
    if (st.phase === 'response' && st.pending?.kind === 'attack' && a.type === 'respond') {
      const d = st.players[pid]; c.attacks++;
      const free = d.units.filter((u) => !u.attacked && !u.blocked);
      c.unitsOnBoard += d.units.length; c.prosp += d.prosperity;
      if (!free.length) c.noUnitsFree++;
      const reacts = d.hand.filter((h) => { const k = getCard(h.cardId); return k.kind === 'reaction' && ATTACK_REACTIONS.includes(k.reaction!); });
      if (!reacts.length) c.noReactInHand++;
      else if (!reacts.some((h) => getCard(h.cardId).cost <= d.prosperity)) c.reactInHandUnaffordable++;
      const tgt = st.pending.target; const at = tgt.kind === 'city' ? 'city' : tgt.uid;
      if (d.traps.some((t) => t.at === at)) c.trapAtTarget++;
      if (a.reactionUid) c.reactUsed++; if (a.musterUid) c.mustered++;
      if (a.blockerUids.length) c.blocked++;
      if (!a.reactionUid && !a.musterUid && !a.blockerUids.length && !d.traps.some((t) => t.at === at)) c.undefended++;
    }
    st = applyAction(st, pid, a).state;
  }
}}
const p = (k: number) => `${(100 * k / c.attacks).toFixed(0)}%`;
console.log({ attacks: c.attacks, noUnitsFree: p(c.noUnitsFree), noReactInHand: p(c.noReactInHand), reactInHandButBroke: p(c.reactInHandUnaffordable), reactUsed: p(c.reactUsed), mustered: p(c.mustered), blockedWithUnits: p(c.blocked), trapAtTarget: p(c.trapAtTarget), fullyUndefended: p(c.undefended), avgProsperity: (c.prosp / c.attacks).toFixed(1), avgUnits: (c.unitsOnBoard / c.attacks).toFixed(1) });
