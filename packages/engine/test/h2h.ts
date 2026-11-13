// Head-to-head between difficulties: npx tsx test/h2h.ts <diffA> <diffB> [games-per-pairing] [slip]
import { actingPlayer, applyAction, chooseAction, CIVS, createGame, viewFor, setNormalSlip, type Difficulty, type GameState } from '../src/index';
const [A, B] = [process.argv[2] as Difficulty, process.argv[3] as Difficulty];
const n = Number(process.argv[4] ?? 1); if (process.argv[5]) setNormalSlip(Number(process.argv[5]));
let aWins = 0, total = 0, turns = 0;
for (const x of CIVS) for (const y of CIVS) { if (x.id === y.id) continue; for (let i = 0; i < n; i++) {
  const aSeat = (i + x.id.length) % 2 as 0 | 1;
  let st: GameState = createGame(3000 + i * 101 + x.id.length * 13 + y.id.length, [{ name: 'A', civ: x.id }, { name: 'B', civ: y.id }], (i % 2) as 0 | 1).state;
  let g = 0;
  while (st.phase !== 'over' && g++ < 8000) { const pid = actingPlayer(st)!; st = applyAction(st, pid, chooseAction(viewFor(st, pid), pid, pid === aSeat ? A : B)).state; }
  total++; turns += st.turn; if (st.winner === aSeat) aWins++;
}}
console.log(`${A} vs ${B}: ${A} wins ${(100 * aWins / total).toFixed(0)}% of ${total}, avg turns ${(turns / total).toFixed(1)}`);
