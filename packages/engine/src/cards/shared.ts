import type { CardDef } from '../types';

/*
 * Shared backbone of every civilization's two decks. Each Age tier mixes
 * these with the civilization's own cards (see civs.ts).
 */

// ===================================================================== Civilization deck

export const SHARED_CIV: CardDef[] = [
  // ---------------- Age I
  { id: 'farm', name: 'Farmland', family: 'civ', kind: 'building', age: 1, cost: 1, art: 'farm',
    progress: 1, integrity: 3, tags: ['farm'], food: 2,
    text: 'Makes 2 Food each turn.', flavor: 'Every army, temple and market rests on the harvest.' },
  { id: 'village', name: 'Village', family: 'civ', kind: 'building', age: 1, cost: 2, art: 'village',
    progress: 1, growth: 1, integrity: 2, tags: ['housing'], eats: 1, workers: 1,
    text: 'Eats 1 Food. Gives 1 Worker and +1 Progress each turn.', flavor: 'Families settle, and a settlement becomes a people.' },
  { id: 'quarry', name: 'Quarry', family: 'civ', kind: 'building', age: 1, cost: 2, art: 'quarry',
    income: 1, progress: 1, integrity: 4, tags: ['quarry'], staff: 1,
    text: 'Needs 1 Worker. +1 Prosperity each turn. Supports Workshops and forges.' },
  { id: 'festival', name: 'Harvest Festival', family: 'civ', kind: 'development', age: 1, cost: 1, art: 'festival',
    progress: 2, text: 'A season of plenty.' },
  // ---------------- Age II
  { id: 'granary', name: 'Granary', family: 'civ', kind: 'building', age: 2, cost: 2, art: 'granary',
    progress: 1, growth: 1, integrity: 3, tags: ['granary'], requires: ['farm'], store: 2,
    text: '+1 Progress each turn. Keeps up to 2 spare Food for hungry turns. Requires a Farm.' },
  { id: 'road', name: 'Road', family: 'civ', kind: 'building', age: 2, cost: 2, art: 'road',
    progress: 1, integrity: 3, tags: ['road'], passives: ['swift'],
    text: 'Your units can attack the turn they are deployed. Supports Markets.' },
  { id: 'market', name: 'Market', family: 'civ', kind: 'building', age: 2, cost: 3, art: 'market',
    income: 2, progress: 1, integrity: 3, tags: ['market', 'trade'], requires: ['road', 'harbor'], staff: 1,
    text: 'Needs 1 Worker. +2 Prosperity each turn. Requires a Road or Harbor.' },
  { id: 'caravanFair', name: 'Caravan Fair', family: 'civ', kind: 'development', age: 2, cost: 2, art: 'caravan',
    progress: 2, effects: [{ op: 'gain', res: 'prosperity', amount: 2 }],
    text: '+2 Prosperity now.' },
  // ---------------- Age III
  { id: 'temple', name: 'Temple', family: 'civ', kind: 'building', age: 3, cost: 3, art: 'temple',
    progress: 2, growth: 1, integrity: 4, tags: ['temple'], staff: 1,
    text: 'Needs 1 Worker. +1 Progress each turn.' },
  { id: 'workshop', name: 'Workshop', family: 'civ', kind: 'building', age: 3, cost: 3, art: 'workshop',
    progress: 1, integrity: 3, tags: ['workshop'], requires: ['quarry'], passives: ['buildDiscount'], staff: 1,
    text: 'Needs 1 Worker. Your Civilization cards cost 1 less (minimum 1). Requires a Quarry.' },
  { id: 'guilds', name: 'Craft Guilds', family: 'civ', kind: 'development', age: 3, cost: 3, art: 'guilds',
    progress: 4, text: 'Potters, weavers and smiths organise their trades.' },
  // ---------------- Age IV
  { id: 'palace', name: 'Palace', family: 'civ', kind: 'building', age: 4, cost: 5, art: 'palace',
    income: 2, progress: 3, growth: 1, integrity: 6, tags: ['palace'], eats: 2,
    text: 'Eats 2 Food. +2 Prosperity and +1 Progress each turn.' },
  { id: 'greatFestival', name: 'Great Festival', family: 'civ', kind: 'development', age: 4, cost: 4, art: 'festival',
    progress: 5, text: 'The whole realm gathers to celebrate.' },
  // ---------------- Age V
  { id: 'works', name: 'Age of Works', family: 'civ', kind: 'development', age: 5, cost: 5, art: 'works',
    progress: 6, text: 'Builders, artisans and scholars at the height of their craft.' },
];

// ===================================================================== Military deck

export const SHARED_MIL: CardDef[] = [
  // ---------------- Age I
  { id: 'militia', name: 'Militia', family: 'mil', kind: 'unit', age: 1, cost: 1, art: 'militia',
    str: 1, hp: 2, role: 'shield', upkeep: 0, text: 'Eats no Food.' },
  { id: 'spearmen', name: 'Spearmen', family: 'mil', kind: 'unit', age: 1, cost: 2, art: 'spearmen',
    str: 2, hp: 3, role: 'spear', upkeep: 1, text: 'Eats 1 Food.' },
  { id: 'archers', name: 'Archers', family: 'mil', kind: 'unit', age: 1, cost: 2, art: 'archers',
    str: 2, hp: 2, role: 'archer', upkeep: 1, keywords: ['ranged'], text: 'Ranged: +1 Strength while blocking. Eats 1 Food.' },
  { id: 'palisade', name: 'Palisade', family: 'mil', kind: 'fort', age: 1, cost: 2, art: 'palisade',
    integrity: 4, tags: ['walls'], passives: ['wall'],
    text: 'Wall: damage that gets past your blockers hits this first.' },
  { id: 'shieldWall', name: 'Shield Wall', family: 'mil', kind: 'reaction', age: 1, cost: 1, art: 'shieldWall',
    reaction: 'shieldWall', text: 'Reaction to an attack: your blockers get +1 Strength and +1 Health this combat.' },
  // ---------------- Age II
  { id: 'raiders', name: 'River Raiders', family: 'mil', kind: 'unit', age: 2, cost: 2, art: 'raiders',
    str: 2, hp: 2, role: 'raider', upkeep: 1, keywords: ['raider'],
    text: 'Raider: when this attack gets through, the rival loses 2 Progress. Eats 1 Food.' },
  { id: 'watchtower', name: 'Watchtower', family: 'mil', kind: 'fort', age: 2, cost: 2, art: 'vigilantWatch',
    integrity: 3, passives: ['tower'], text: 'Tower: deals 1 damage to every attacker before combat.' },
  { id: 'saboteurs', name: 'Saboteurs', family: 'mil', kind: 'tactic', age: 2, cost: 2, art: 'saboteurs',
    target: 'enemyBuilding', hostile: true, effects: [{ op: 'unrest', turns: 2 }],
    text: 'Hostile. An enemy building falls into Unrest for 2 turns: it stops working, and so does anything that depends on it.' },
  { id: 'ambush', name: 'Ambush', family: 'mil', kind: 'reaction', age: 2, cost: 2, art: 'ambush',
    reaction: 'ambush', text: 'Reaction to an attack: deal 2 damage to every attacker before combat.' },
  { id: 'vigilantWatch', name: 'Vigilant Watch', family: 'mil', kind: 'reaction', age: 2, cost: 1, art: 'vigilantWatch',
    reaction: 'vigilantWatch', text: 'Reaction to a Hostile card: cancel it.' },
  // ---------------- Age III
  { id: 'shieldBearers', name: 'Shield Bearers', family: 'mil', kind: 'unit', age: 3, cost: 3, art: 'shieldBearers',
    str: 3, hp: 4, role: 'shield', upkeep: 1, text: 'Eats 1 Food.' },
  { id: 'arson', name: 'Arson', family: 'mil', kind: 'tactic', age: 3, cost: 3, art: 'arson',
    target: 'enemyBuilding', hostile: true, effects: [{ op: 'damageBuilding', amount: 3 }],
    text: 'Hostile. Deal 3 damage to an enemy building.' },
  { id: 'raidStores', name: 'Raid the Storehouses', family: 'mil', kind: 'tactic', age: 3, cost: 3, art: 'poison',
    hostile: true, effects: [{ op: 'gain', res: 'progress', amount: -3, who: 'opp' }],
    text: 'Hostile. The rival loses 3 Progress.' },
  { id: 'walls', name: 'City Walls', family: 'mil', kind: 'fort', age: 3, cost: 3, art: 'walls',
    integrity: 7, tags: ['walls'], passives: ['wall'],
    text: 'Wall: damage that gets past your blockers hits these walls first.' },
  { id: 'feignedRetreat', name: 'Feigned Retreat', family: 'mil', kind: 'reaction', age: 3, cost: 2, art: 'feignedRetreat',
    reaction: 'feignedRetreat', text: 'Reaction to an attack: cancel it. Each attacker takes 1 damage.' },
  // ---------------- Age IV
  { id: 'ram', name: 'Siege Ram', family: 'mil', kind: 'unit', age: 4, cost: 4, art: 'ram',
    str: 3, hp: 4, role: 'siege', upkeep: 1, keywords: ['siege'], requiresToDeploy: 'workshop',
    text: 'Siege: +2 Strength against a building or a walled city. Built in a Workshop. Eats 1 Food.' },
  { id: 'eliteGuard', name: 'Elite Guard', family: 'mil', kind: 'unit', age: 4, cost: 4, art: 'eliteGuard',
    str: 4, hp: 5, role: 'spear', upkeep: 1, text: 'Eats 1 Food.' },
  { id: 'arrowStorm', name: 'Arrow Storm', family: 'mil', kind: 'tactic', age: 4, cost: 3, art: 'arrowStorm',
    hostile: true, effects: [{ op: 'damageEnemyUnits', amount: 2 }],
    text: 'Hostile. Deal 2 damage to every enemy unit.' },
  { id: 'turnTheTide', name: 'Turn the Tide', family: 'mil', kind: 'reaction', age: 4, cost: 3, art: 'turnTheTide', rarity: 'rare',
    reaction: 'turnTheTide', text: 'Reaction to an attack: your blockers deal double damage. Damage beyond the attackers crashes into the attacker’s city.' },
  // ---------------- Age V
  { id: 'grandArmy', name: 'Grand Army', family: 'mil', kind: 'unit', age: 5, cost: 6, art: 'grandArmy',
    str: 6, hp: 6, role: 'spear', upkeep: 2, text: 'Eats 2 Food.' },
  { id: 'sack', name: 'Sack the City', family: 'mil', kind: 'tactic', age: 5, cost: 5, art: 'sack',
    hostile: true, effects: [{ op: 'damageCity', amount: 5 }],
    text: 'Hostile. The rival’s city loses 5 Stability.' },
  { id: 'mirror', name: 'Mirror the Scheme', family: 'mil', kind: 'reaction', age: 5, cost: 3, art: 'mirror', rarity: 'rare',
    reaction: 'mirror', text: 'Reaction to a Hostile card: cancel it, then it strikes its caster instead.' },
];

/** Shared cards in each Age tier (duplicates = copies). Civ cards are added per civilization. */
export const SHARED_TIERS: Record<'civ' | 'mil', string[][]> = {
  civ: [
    ['farm', 'farm', 'village', 'village', 'quarry', 'festival'],
    ['granary', 'road', 'market', 'caravanFair'],
    ['temple', 'temple', 'workshop', 'guilds'],
    ['palace', 'greatFestival', 'temple'],
    ['works', 'works', 'palace'],
  ],
  mil: [
    ['militia', 'militia', 'spearmen', 'archers', 'palisade', 'shieldWall'],
    ['raiders', 'watchtower', 'saboteurs', 'ambush', 'vigilantWatch'],
    ['shieldBearers', 'arson', 'raidStores', 'walls', 'feignedRetreat'],
    ['ram', 'eliteGuard', 'arrowStorm', 'turnTheTide', 'vigilantWatch'],
    ['grandArmy', 'sack', 'mirror', 'eliteGuard'],
  ],
};
