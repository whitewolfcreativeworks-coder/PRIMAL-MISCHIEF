import { describe, expect, it } from 'vitest';
import { CIVS, getCard } from '@pm/engine';
import { galleryScenes } from '../src/holo/gallery';
import { Stage } from '../src/holo/theater';
import { castFor } from '../src/holo/director';
import { ARCH_CARD_IDS } from '../src/holo/arch';

/** Run a scene headlessly from start to finish (no WebGL needed). */
function play(make: () => { setup: (s: Stage) => void; update: (s: Stage, t: number) => void; duration: number }) {
  const v = make();
  const s = new Stage();
  v.setup(s);
  for (let t = 0; t <= v.duration + 0.001; t += 1 / 15) { v.update(s, Math.min(t, v.duration)); s.tick(1 / 15); }
  const objects = (() => { let n = 0; s.root.traverse(() => { n++; }); return n; })();
  s.clear();
  return objects;
}

describe('holograms', () => {
  for (const civ of CIVS) {
    const rival = civ.id === 'sumer' ? 'kush' : 'sumer';
    it(`every ${civ.name} scene plays without errors`, () => {
      const items = galleryScenes(civ.id, rival);
      expect(items.length).toBeGreaterThan(25);
      for (const it of items) {
        try { expect(play(it.make)).toBeGreaterThan(3); } catch (e) { throw new Error(`${it.group} / ${it.label}: ${(e as Error).message}`); }
      }
    });
  }
  it('every unit card is cast with people or machines', () => {
    for (const civ of CIVS) for (const id of new Set([...civ.decks.mil.flat()])) {
      if (getCard(id).kind !== 'unit') continue;
      const c = castFor(id, civ.id);
      expect(c.count + (c.vehicles ?? 0), id).toBeGreaterThan(0);
      if (civ.id === 'inca') expect(['horse', 'elephant'], `${id}: no horses or elephants in the Andes`).not.toContain(c.vehicle);
    }
  });
  it('every building card has architecture', () => {
    for (const civ of CIVS) for (const id of new Set([...civ.decks.civ.flat(), ...civ.decks.mil.flat()])) {
      const k = getCard(id).kind;
      if (k === 'building' || k === 'fort') expect(ARCH_CARD_IDS, id).toContain(id);
    }
  });
});
