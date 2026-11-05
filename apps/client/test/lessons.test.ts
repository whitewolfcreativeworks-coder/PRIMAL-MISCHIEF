import { describe, expect, it } from 'vitest';
import { LESSONS } from '../src/game/lessons';
import { TutorialRunner } from '../src/game/tutorial';
import { CIVS } from '@pm/engine';

describe('Academy lessons', () => {
  it('has a lesson for every civilization', () => {
    expect(LESSONS.map((l) => l.civ).sort()).toEqual(CIVS.map((c) => c.id).sort());
  });
  for (const lesson of LESSONS) {
    it(`${lesson.civ}: every step can be completed with its solution`, () => {
      const r = new TutorialRunner(lesson);
      const errors: string[] = [];
      r.onError = (m) => errors.push(`step ${r.index}: ${m}`);
      for (let guard = 0; guard < 40 && r.coach.mode !== 'done'; guard++) {
        const before = r.index;
        const step = r.coach.step;
        if (step.expect) {
          expect(step.solution, `step ${r.index} needs a solution`).toBeTruthy();
          const a = step.solution!(r.state);
          expect(step.expect(a, r.state), `step ${r.index} solution must satisfy expect`).toBe(true);
        }
        r.solve();
        expect(errors).toEqual([]);
        expect(r.index).toBe(before + 1);
      }
      expect(r.coach.mode).toBe('done');
      expect(r.state.phase).not.toBe('response');
    });
    it(`${lesson.civ}: rejects an off-script move with a hint`, () => {
      const r = new TutorialRunner(lesson);
      while (r.coach.mode === 'info') r.next();
      let msg = '';
      r.onError = (m) => { msg = m; };
      expect(r.send({ type: 'concede' })).toBe(false);
      expect(msg.length).toBeGreaterThan(0);
    });
  }
});
