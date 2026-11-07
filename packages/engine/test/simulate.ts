// AI-vs-AI balance simulation: npm run simulate -- [games-per-pairing] [difficulty]
import { actingPlayer, applyAction, chooseAction, CIVS, createGame, validateData, type CivId, type Difficulty, type GameState } from '../src/index';

export function playOut(seed: number, a: CivId, b: CivId, diff: Difficulty = 'normal', first?: 0 | 1) {
  let st: GameState = createGame(seed, [{ name: 'A', civ: a }, { name: 'B', civ: b }], first).state;
  let guard = 0;
  while (st.phase !== 'over' && guard++ < 8000) {
    const pid = actingPlayer(st)!;
    st = applyAction(st, pid, chooseAction(st, pid, diff)).state;
  }
  return st;
}

const isMain = /simulate\.ts$/.test(process.argv[1] ?? '');
if (isMain) {
  const n = Number(process.argv[2] ?? 6);
  const diff = (process.argv[3] ?? 'normal') as Difficulty;
  const errs = validateData(); if (errs.length) console.log(errs);
  const wins: Record<string, number> = {}, games: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  const ages: number[] = [];
  let firstWins = 0, total = 0, turns = 0, milShare = 0, drafts = 0, tucked = 0, sprungAt = 0, probes = 0;
  const t0 = Date.now();
  for (const x of CIVS) for (const y of CIVS) {
    if (x.id === y.id) continue;
    for (let i = 0; i < n; i++) {
      const st = playOut(1000 + i * 7919 + x.id.length * 31 + y.id.length, x.id, y.id, diff, (i % 2) as 0 | 1);
      total++; turns += st.turn;
      const w = st.winner!;
      wins[st.players[w].civ] = (wins[st.players[w].civ] ?? 0) + 1;
      games[x.id] = (games[x.id] ?? 0) + 1; games[y.id] = (games[y.id] ?? 0) + 1;
      const r = (st.winReason ?? '').split(':')[0];
      reasons[r] = (reasons[r] ?? 0) + 1;
      if (w === (i % 2)) firstWins++;
      ages.push(st.players[0].age, st.players[1].age);
      for (const l of st.log) { if (/hides a card/.test(l.text)) tucked++; if (/Hidden traps spring/.test(l.text)) sprungAt++; if (/sends 1 unit across/.test(l.text)) probes++; }
      for (const l of st.log) { const m = l.text.match(/picks (\d+) Civilization and (\d+) Military/); if (m) { drafts++; milShare += +m[2] / Math.max(1, +m[1] + +m[2]); } }
    }
  }
  console.log(`games=${total} avgPlayerTurns=${(turns / total).toFixed(1)} firstPlayerWin=${(100 * firstWins / total).toFixed(0)}% militaryPickShare=${(100 * milShare / drafts).toFixed(0)}% avgFinalAge=${(ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(2)} time=${Date.now() - t0}ms`);
  console.log(`traps: tucked/game=${(tucked / total).toFixed(1)} springs/game=${(sprungAt / total).toFixed(1)} single-unit attacks/game=${(probes / total).toFixed(1)}`);
  for (const c of CIVS) console.log(c.id.padEnd(9), `${(100 * (wins[c.id] ?? 0) / games[c.id]).toFixed(0)}%`);
  console.log(reasons);
}
