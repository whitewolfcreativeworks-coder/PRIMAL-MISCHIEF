// AI-vs-AI balance simulation: npm run simulate -- [games-per-pairing] [difficulty]
import { actingPlayer, applyAction, chooseAction, CIVS, createGame, validateDeck, type CivId, type Difficulty, type GameState } from '../src/index';

export function playOut(seed: number, a: CivId, b: CivId, diff: Difficulty = 'normal', first?: 0 | 1) {
  let st: GameState = createGame(seed, [{ name: 'A', civ: a }, { name: 'B', civ: b }], first).state;
  let guard = 0;
  while (st.phase !== 'over' && guard++ < 5000) {
    const pid = actingPlayer(st)!;
    st = applyAction(st, pid, chooseAction(st, pid, diff)).state;
  }
  return st;
}

const isMain = process.argv[1]?.includes('simulate');
if (isMain) {
  const n = Number(process.argv[2] ?? 6);
  const diff = (process.argv[3] ?? 'normal') as Difficulty;
  for (const c of CIVS) { const e = validateDeck(c.id, c.starterDeck); if (e.length) console.log(c.id, e); }
  const wins: Record<string, number> = {}, games: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  let firstWins = 0, total = 0, turns = 0;
  const t0 = Date.now();
  for (const x of CIVS) for (const y of CIVS) {
    if (x.id === y.id) continue;
    for (let i = 0; i < n; i++) {
      const st = playOut(1000 + i * 7919 + x.id.length * 31 + y.id.length, x.id, y.id, diff, (i % 2) as 0 | 1);
      total++; turns += st.turn;
      const w = st.winner!;
      const civ = st.players[w].civ;
      wins[civ] = (wins[civ] ?? 0) + 1;
      games[x.id] = (games[x.id] ?? 0) + 1; games[y.id] = (games[y.id] ?? 0) + 1;
      const r = (st.winReason ?? '').split(':')[0];
      reasons[r] = (reasons[r] ?? 0) + 1;
      if (w === (i % 2)) firstWins++;
    }
  }
  console.log(`games=${total} avgPlayerTurns=${(turns / total).toFixed(1)} firstPlayerWin=${(100 * firstWins / total).toFixed(0)}% time=${Date.now() - t0}ms`);
  for (const c of CIVS) console.log(c.id.padEnd(9), `${(100 * (wins[c.id] ?? 0) / games[c.id]).toFixed(0)}%`);
  console.log(reasons);
}
