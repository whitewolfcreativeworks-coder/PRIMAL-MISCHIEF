import { CIVS, getCard, getCiv, type CivId, type GameEvent, type ReactionKind, type UnitFate } from '@pm/engine';
import { cardPoolFor } from '@pm/engine';
import type { Vignette } from './theater';
import { ageUpScene, battleScene, collapseScene, deployScene, growScene, previewScene, schemeScene, signatureScene, tacticScene, victoryScene } from './vignettes';

/*
 * Every hologram scene the game can show, generated from card data: used by
 * the Hologram Theater screen and by the test that makes sure every card is
 * acted out without errors.
 */

export interface GalleryItem { group: string; label: string; make: () => Vignette }

type Combat = Extract<GameEvent, { type: 'combat' }>;
function combat(over: Partial<Combat> & { attackerCards: string[] }): Combat {
  const fates = over.attackerFates ?? over.attackerCards.map(() => null as UnitFate | null);
  const bf = over.blockerFates ?? (over.blockerCards ?? []).map(() => false);
  return {
    type: 'combat', attacker: 0, power: 4, blocked: 0, wallAbsorbed: 0, dealt: 0, blockerCards: [], attackersLost: fates.filter(Boolean).length, blockersLost: bf.filter(Boolean).length,
    target: 'city', wallCard: null, reaction: null, cancelled: false, tideBack: 0, targetDestroyed: false, towerHits: 0, progressRaided: 0,
    ...over, attackerFates: fates, blockerFates: bf,
  };
}

export function galleryScenes(civ: CivId, rival: CivId): GalleryItem[] {
  const out: GalleryItem[] = [];
  const pool = cardPoolFor(civ).map((c) => c.id);
  const units = pool.filter((id) => getCard(id).kind === 'unit');
  const ctx = { aCiv: civ, dCiv: rival, aAge: 3, dAge: 3 };
  const rctx = { aCiv: rival, dCiv: civ, aAge: 3, dAge: 3 };
  const add = (group: string, label: string, make: () => Vignette) => out.push({ group, label, make });

  // Battles: every staging branch.
  const strong = units.slice(-2), weak = units.slice(0, 2);
  add('Battles', 'Assault on the city', () => battleScene(combat({ attackerCards: strong, blockerCards: ['spearmen'], blockerFates: [true], dealt: 4, attackerFates: [null, null] }), true, ctx));
  add('Battles', 'Held at the river', () => battleScene(combat({ attackerCards: weak, blockerCards: ['spearmen', 'archers'], attackerFates: ['melee', null] }), true, ctx));
  add('Battles', 'Walls breached, building falls', () => battleScene(combat({ attackerCards: [units.find((u) => (getCard(u).keywords ?? []).includes('siege')) ?? 'ram', weak[0]], target: 'temple', wallCard: 'walls', wallAbsorbed: 2, dealt: 3, targetDestroyed: true }), true, ctx));
  add('Battles', 'Towers thin the crossing', () => battleScene(combat({ attackerCards: weak, towerHits: 1, wallCard: 'watchtower', attackerFates: ['tower', null], dealt: 1 }), true, ctx));
  add('Battles', 'Raiders carry off Progress', () => battleScene(combat({ attackerCards: ['raiders', 'raiders'], dealt: 2, progressRaided: 4 }), true, ctx));
  const R: ReactionKind[] = ['shieldWall', 'ambush', 'feignedRetreat', 'turnTheTide', 'treaty'];
  for (const r of R) {
    const cancelled = r === 'feignedRetreat' || r === 'treaty';
    add('Reactions', getCard(r === 'treaty' ? 'aksum_treaty' : r).name, () => battleScene(combat({
      attacker: 1, attackerCards: ['spearmen', 'militia', 'archers'], blockerCards: ['spearmen', 'archers'], reaction: r, cancelled,
      attackerFates: r === 'ambush' ? ['ambush', 'ambush', null] : r === 'feignedRetreat' ? ['retreat', null, null] : cancelled ? [null, null, null] : ['melee', 'melee', null],
      tideBack: r === 'turnTheTide' ? 3 : 0,
    }), false, rctx));
  }
  // Each unit card's troop in action.
  for (const id of [...new Set(units)]) add('Troops', getCard(id).name, () => previewScene(id));
  // Every hostile scheme, each outcome.
  const hostile = [...new Set([...pool, 'saboteurs', 'arson', 'raidStores', 'arrowStorm', 'sack'])].filter((id) => getCard(id).hostile);
  for (const id of hostile) {
    for (const outcome of ['hit', 'foiled', 'mirrored'] as const) {
      const c = getCard(id);
      add('Schemes', `${c.name} · ${outcome}`, () => schemeScene({ type: 'scheme', caster: 0, cardId: id, targetCardId: c.target === 'enemyBuilding' ? 'market' : null, outcome, mirrorTargetCardId: outcome === 'mirrored' ? 'granary' : null }, true,
        { casterCiv: civ, victimCiv: rival, casterAge: 3, victimAge: 3, victimUnits: ['spearmen'], victimUnitsLost: ['archers', 'militia'], destroyed: { target: outcome === 'hit' && c.target === 'enemyBuilding', mirror: false } }));
    }
  }
  // Building and growing, card by card.
  for (const id of [...new Set(pool)].filter((x) => getCard(x).family === 'civ')) add('Construction', getCard(id).name, () => growScene(id, civ, Math.min(5, Math.max(1, getCard(id).age)), true, getCard(id).progress));
  for (const id of [...new Set(pool)].filter((x) => getCard(x).kind === 'fort')) add('Forts', getCard(id).name, () => deployScene([id], true, civ));
  for (const id of [...new Set(pool)].filter((x) => getCard(x).kind === 'tactic' && !getCard(x).hostile)) add('Tactics', getCard(id).name, () => tacticScene(id, true, civ));
  for (let a = 2; a <= 5; a++) add('Ages', `Age ${a}: ${getCiv(civ).ages[a - 1]}`, () => ageUpScene(civ, a, getCiv(civ).ages[a - 1], true));
  add('Signature', getCiv(civ).signature.name, () => signatureScene(getCiv(civ).signature.name, true, { civ, age: 3, rivalCiv: rival, rivalUnits: ['spearmen'], rivalUnitsLost: ['archers', 'militia'] }));
  add('Endings', 'A building collapses', () => collapseScene(pool.find((x) => getCard(x).kind === 'building') ?? 'temple', true, civ));
  add('Endings', 'Victory', () => victoryScene(civ, 5, true));
  return out;
}

export const ALL_CIVS = CIVS.map((c) => c.id);
