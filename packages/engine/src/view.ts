import type { CardInst, GameState, PlayerId } from './types';

export const HIDDEN_CARD = '?';

const hide = (cards: CardInst[], prefix: string): CardInst[] => cards.map((_, i) => ({ uid: `${prefix}${i}`, cardId: HIDDEN_CARD }));

/**
 * The state as a given seat is allowed to see it. Opponent hands (unless revealed
 * by a Spy Network), both decks' order and the RNG are removed. `viewer = null`
 * is a spectator who sees no hands at all. The server only ever sends views.
 */
export function viewFor(state: GameState, viewer: PlayerId | null): GameState {
  const v: GameState = JSON.parse(JSON.stringify(state));
  v.rng = 0;
  v.seed = 0;
  for (const p of v.players) {
    p.deck = hide(p.deck, `d${p.id}-`);
    const canSee = viewer === p.id || (viewer !== null && p.handRevealedTo);
    if (!canSee) p.hand = hide(p.hand, `h${p.id}-`);
  }
  return v;
}
