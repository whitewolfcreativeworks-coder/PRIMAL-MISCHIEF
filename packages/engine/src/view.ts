import type { CardInst, GameState, PlayerId } from './types';

export const HIDDEN_CARD = '?';

const hide = (cards: CardInst[], prefix: string): CardInst[] => cards.map((_, i) => ({ uid: `${prefix}${i}`, cardId: HIDDEN_CARD }));

/**
 * The state as a given seat is allowed to see it. Both draw piles are hidden
 * (only their size shows), the opponent's hand is hidden unless revealed, the
 * scribes' peek is visible only to its owner, and the RNG is removed.
 * `viewer = null` is a spectator. The server only ever sends views.
 */
export function viewFor(state: GameState, viewer: PlayerId | null): GameState {
  const v: GameState = JSON.parse(JSON.stringify(state));
  v.rng = 0;
  v.seed = 0;
  for (const p of v.players) {
    p.piles = { civ: hide(p.piles.civ, `pc${p.id}-`), mil: hide(p.piles.mil, `pm${p.id}-`) };
    const canSee = viewer === p.id || (viewer !== null && p.handRevealedTo);
    if (!canSee) p.hand = hide(p.hand, `h${p.id}-`);
    if (viewer !== p.id) {
      p.peek = null;
      // Hidden traps: the rival learns how many, never which cards or where.
      p.traps = (p.traps ?? []).map((_, i) => ({ uid: `x${p.id}-${i}`, cardId: HIDDEN_CARD, at: HIDDEN_CARD }));
    }
  }
  return v;
}
