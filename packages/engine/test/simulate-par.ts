// Parallel balance run: npx tsx test/simulate-par.ts [games-per-pairing] [difficulty]
import { fork } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import { CIVS, type CivId, type Difficulty } from '../src/index';

type Job = { a: CivId; b: CivId; i: number; diff: Difficulty };
type Res = Job & { winner: CivId; reason: string; turns: number; firstWon: boolean };

if (process.env.PM_WORKER) {
  const { playOut } = await import('./simulate');
  process.on('message', (jobs: Job[]) => {
    const out: Res[] = jobs.map((j) => {
      const st = playOut(1000 + j.i * 7919 + j.a.length * 31 + j.b.length, j.a, j.b, j.diff, (j.i % 2) as 0 | 1);
      return { ...j, winner: st.players[st.winner!].civ, reason: (st.winReason ?? '').split(':')[0], turns: st.turn, firstWon: st.winner === (j.i % 2) };
    });
    process.send!(out);
    process.exit(0);
  });
} else {
  const n = Number(process.argv[2] ?? 8);
  const diff = (process.argv[3] ?? 'normal') as Difficulty;
  const jobs: Job[] = [];
  for (const x of CIVS) for (const y of CIVS) if (x.id !== y.id) for (let i = 0; i < n; i++) jobs.push({ a: x.id, b: y.id, i, diff });
  const k = Math.max(1, availableParallelism() - 1);
  const chunks: Job[][] = Array.from({ length: k }, (_, c) => jobs.filter((_, j) => j % k === c));
  const t0 = Date.now();
  const results = (await Promise.all(chunks.map((chunk) => new Promise<Res[]>((ok) => {
    const w = fork(fileURLToPath(import.meta.url), [], { env: { ...process.env, PM_WORKER: '1' }, execArgv: ['--import', 'tsx'] });
    w.on('message', (m) => ok(m as Res[]));
    w.send(chunk);
  })))).flat();
  const wins: Record<string, number> = {}, games: Record<string, number> = {}, reasons: Record<string, number> = {};
  const vs: Record<string, number> = {};
  for (const r of results) {
    wins[r.winner] = (wins[r.winner] ?? 0) + 1;
    games[r.a] = (games[r.a] ?? 0) + 1; games[r.b] = (games[r.b] ?? 0) + 1;
    reasons[r.reason] = (reasons[r.reason] ?? 0) + 1;
    if (r.winner === r.a) vs[`${r.a}>${r.b}`] = (vs[`${r.a}>${r.b}`] ?? 0) + 1;
  }
  const avg = results.reduce((s, r) => s + r.turns, 0) / results.length;
  console.log(`games=${results.length} avgPlayerTurns=${avg.toFixed(1)} firstPlayerWin=${(100 * results.filter((r) => r.firstWon).length / results.length).toFixed(0)}% time=${Date.now() - t0}ms`);
  for (const c of CIVS) console.log(c.id.padEnd(9), `${(100 * (wins[c.id] ?? 0) / games[c.id]).toFixed(0)}%`, CIVS.filter((o) => o.id !== c.id).map((o) => `${o.id.slice(0, 4)}:${Math.round(100 * ((vs[`${c.id}>${o.id}`] ?? 0) + (n - (vs[`${o.id}>${c.id}`] ?? 0))) / (2 * n))}`).join(' '));
  console.log(reasons);
}
