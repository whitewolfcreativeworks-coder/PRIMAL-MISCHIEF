import { CIV_CARDS, CIVS } from './cards/civs';
import { SHARED_CIV, SHARED_MIL } from './cards/shared';
import type { Age, CardDef, CivDef, CivId } from './types';

export const RULES = {
  handSize: 6,
  handLimit: 9, // effects that draw extra cards can go above the hand size, up to this
  startingStability: 22,
  /** Progress needed to leave each Age; at Age V it completes the Golden Age. */
  progressToAdvance: [8, 10, 12, 14, 16] as readonly number[],
  /** Base Prosperity each turn, by Age. */
  baseIncome: [3, 4, 5, 6, 7] as readonly number[],
  prosperityCap: 20,
  momentumCap: 5,
  maxBuildings: 8, // buildings and forts on your bank
  maxUnits: 6,
  turnLimit: 80, // player-turns before the match is decided on points
  trapsPerSpot: 3, // hidden cards under one building or the city
} as const;

export const ALL_CARDS: CardDef[] = [...SHARED_CIV, ...SHARED_MIL, ...CIV_CARDS];
const CARD_MAP = new Map(ALL_CARDS.map((c) => [c.id, c]));
const CIV_MAP = new Map(CIVS.map((c) => [c.id, c]));

export { CIVS };

export function getCard(id: string): CardDef {
  const c = CARD_MAP.get(id);
  if (!c) throw new Error(`Unknown card: ${id}`);
  return c;
}

export function hasCard(id: string): boolean {
  return CARD_MAP.has(id);
}

export function getCiv(id: CivId): CivDef {
  const c = CIV_MAP.get(id);
  if (!c) throw new Error(`Unknown civilization: ${id}`);
  return c;
}

export function isCivId(id: unknown): id is CivId {
  return typeof id === 'string' && CIV_MAP.has(id as CivId);
}

export function ageName(civ: CivId, age: Age): string {
  return getCiv(civ).ages[age - 1];
}

export function progressNeeded(age: Age): number {
  return RULES.progressToAdvance[age - 1];
}

/** Every distinct card a civilization's decks can contain, in Age order. */
export function cardPoolFor(civ: CivId): CardDef[] {
  const d = getCiv(civ).decks;
  const ids = new Set([...d.civ.flat(), ...d.mil.flat()]);
  return [...ids].map(getCard).sort((a, b) => a.age - b.age || (a.family === b.family ? 0 : a.family === 'civ' ? -1 : 1) || a.cost - b.cost);
}

/** Problems with the card data (empty = fine). Used by tests and at startup in development. */
export function validateData(): string[] {
  const errs: string[] = [];
  for (const civ of CIVS) {
    for (const fam of ['civ', 'mil'] as const) {
      civ.decks[fam].forEach((tier, i) => {
        for (const id of tier) {
          if (!CARD_MAP.has(id)) { errs.push(`${civ.id}: unknown card ${id}`); continue; }
          const c = getCard(id);
          if (c.family !== fam) errs.push(`${civ.id}: ${id} is not a ${fam} card`);
          if (c.age > i + 1) errs.push(`${civ.id}: ${id} is Age ${c.age} but sits in tier ${i + 1}`); // older cards may be reprinted in later tiers
          if (c.civ && c.civ !== civ.id) errs.push(`${civ.id}: ${id} belongs to ${c.civ}`);
        }
      });
    }
  }
  for (const c of ALL_CARDS) {
    if (c.kind === 'unit' && (c.str === undefined || c.hp === undefined)) errs.push(`${c.id}: unit without stats`);
    if (c.kind === 'unit' && !c.role) errs.push(`${c.id}: unit without a battlefield role`);
    if ((c.kind === 'building' || c.kind === 'fort') && !c.integrity) errs.push(`${c.id}: no integrity`);
    if (c.kind === 'reaction' && !c.reaction) errs.push(`${c.id}: reaction without kind`);
    if (c.family === 'mil' && c.progress) errs.push(`${c.id}: military cards do not give Progress`);
  }
  return errs;
}
