import { COMMON_CARDS } from './cards/common';
import { CIV_CARDS, CIVS } from './cards/civs';
import type { CardDef, CivDef, CivId } from './types';

export const RULES = {
  deckSize: 24,
  defaultMaxCopies: 2,
  startingHand: 5,
  startingStability: 20,
  legacyTarget: 20,
  baseGoods: 3,
  goodsCap: 15,
  foodCap: 12,
  startingFood: 2,
  momentumCap: 5,
  handLimit: 9,
  maxBuildings: 7,
  maxUnits: 6,
  rallyCost: 2,
  turnLimit: 60, // total player-turns before the match is decided on points
} as const;

export const ALL_CARDS: CardDef[] = [...COMMON_CARDS, ...CIV_CARDS];
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

/** Cards a given civilization may put in its deck. */
export function cardPoolFor(civ: CivId): CardDef[] {
  return ALL_CARDS.filter((c) => !c.token && (!c.civ || c.civ === civ));
}

export function maxCopies(card: CardDef): number {
  return card.maxCopies ?? (card.rarity === 'wonder' ? 1 : RULES.defaultMaxCopies);
}

/** Returns a list of problems; empty means the deck is legal. */
export function validateDeck(civ: CivId, cardIds: unknown): string[] {
  const errors: string[] = [];
  if (!Array.isArray(cardIds)) return ['Deck must be a list of card ids.'];
  if (cardIds.length !== RULES.deckSize) errors.push(`Deck must contain exactly ${RULES.deckSize} cards (has ${cardIds.length}).`);
  const counts = new Map<string, number>();
  for (const id of cardIds) {
    if (typeof id !== 'string' || !CARD_MAP.has(id)) { errors.push(`Unknown card: ${String(id)}`); continue; }
    const c = CARD_MAP.get(id)!;
    if (c.token) errors.push(`${c.name} cannot be included in a deck.`);
    if (c.civ && c.civ !== civ) errors.push(`${c.name} belongs to another civilization.`);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    const c = CARD_MAP.get(id)!;
    if (n > maxCopies(c)) errors.push(`Too many copies of ${c.name} (max ${maxCopies(c)}).`);
  }
  return errors;
}
