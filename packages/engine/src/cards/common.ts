import type { CardDef } from '../types';

/** Cards any civilization may include in its deck. */
export const COMMON_CARDS: CardDef[] = [
  // ------------------------------------------------------------ infrastructure
  {
    id: 'farm', name: 'Farmland', kind: 'building', suit: 'earth', cost: 1, art: 'farm',
    integrity: 3, food: 2, tags: ['farm'],
    text: '+2 Food each turn. Supports Barracks and Granaries.',
    flavor: 'Every army, temple and market rests on the harvest.',
  },
  {
    id: 'granary', name: 'Granary', kind: 'building', suit: 'earth', cost: 2, art: 'granary',
    integrity: 3, food: 1, tags: ['granary'], requires: ['farm'], passives: ['famineShield'],
    text: '+1 Food. Famine cannot cost you Stability or units. Requires a Farm.',
  },
  {
    id: 'quarry', name: 'Quarry', kind: 'building', suit: 'stone', cost: 1, art: 'quarry',
    integrity: 4, goods: 1, tags: ['quarry'],
    text: '+1 Goods each turn. Supports Workshops.',
  },
  {
    id: 'road', name: 'Road', kind: 'building', suit: 'stone', cost: 2, art: 'road',
    integrity: 3, tags: ['road'], passives: ['swift'],
    text: 'Your units may attack the turn they are recruited. Supports Markets.',
  },
  {
    id: 'market', name: 'Market', kind: 'building', suit: 'silk', cost: 3, art: 'market',
    integrity: 3, goods: 2, tags: ['market'], requires: ['road', 'harbor'],
    text: '+2 Goods each turn. Requires a Road or Harbor.',
  },
  {
    id: 'walls', name: 'City Walls', kind: 'building', suit: 'stone', cost: 3, art: 'walls',
    integrity: 6, tags: ['walls'], passives: ['wall'],
    text: 'Wall: damage that gets past your blockers hits these walls first.',
  },
  {
    id: 'barracks', name: 'Barracks', kind: 'building', suit: 'bronze', cost: 2, art: 'barracks',
    integrity: 4, tags: ['barracks'], requires: ['farm'], passives: ['unitHp'],
    text: 'Your units have +1 Health. Requires a Farm to feed it.',
  },
  {
    id: 'temple', name: 'Temple', kind: 'building', suit: 'star', cost: 3, art: 'temple',
    integrity: 3, legacy: 1, tags: ['temple'],
    text: '+1 Legacy each turn.',
  },
  {
    id: 'workshop', name: 'Workshop', kind: 'building', suit: 'stone', cost: 3, art: 'workshop',
    integrity: 3, tags: ['workshop'], requires: ['quarry'], passives: ['buildDiscount'],
    text: 'Your buildings cost 1 less (minimum 1). Enables siege engines. Requires a Quarry.',
  },
  // ------------------------------------------------------------ military
  {
    id: 'militia', name: 'Militia', kind: 'unit', suit: 'bronze', cost: 1, art: 'militia',
    str: 1, hp: 2, upkeep: 0,
    text: 'No upkeep.',
  },
  {
    id: 'spearmen', name: 'Spearmen', kind: 'unit', suit: 'bronze', cost: 2, art: 'spearmen',
    str: 2, hp: 3, upkeep: 1,
    text: 'Upkeep 1 Food.',
  },
  {
    id: 'archers', name: 'Archers', kind: 'unit', suit: 'bronze', cost: 2, art: 'archers',
    str: 2, hp: 2, upkeep: 1, keywords: ['ranged'],
    text: 'Ranged: +1 Strength while blocking. Upkeep 1 Food.',
  },
  {
    id: 'ram', name: 'Battering Ram', kind: 'unit', suit: 'bronze', cost: 3, art: 'ram',
    str: 2, hp: 3, upkeep: 1, keywords: ['siege'], requiresToRecruit: 'workshop',
    text: 'Siege: +2 Strength when attacking a building or a walled city. Requires a Workshop.',
  },
  // ------------------------------------------------------------ actions
  {
    id: 'festival', name: 'Harvest Festival', kind: 'action', suit: 'earth', cost: 1, art: 'festival',
    effects: [{ op: 'gain', res: 'food', amount: 3 }],
    chain: { suit: 'earth', effects: [{ op: 'gain', res: 'stability', amount: 2 }], text: 'Chain Earth: +2 Stability.' },
    text: '+3 Food.',
  },
  {
    id: 'caravan', name: 'Caravan', kind: 'action', suit: 'silk', cost: 1, art: 'caravan',
    effects: [{ op: 'gain', res: 'goods', amount: 3 }],
    chain: { suit: 'silk', effects: [{ op: 'draw', n: 1 }], text: 'Chain Silk: draw a card.' },
    text: '+3 Goods.',
  },
  {
    id: 'saboteurs', name: 'Saboteurs', kind: 'action', suit: 'shadow', cost: 2, art: 'saboteurs',
    target: 'enemyBuilding', hostile: true,
    effects: [{ op: 'unrest', turns: 2 }],
    text: 'Hostile. Throw an enemy building into Unrest for 2 turns: it stops working and stops supporting others.',
  },
  {
    id: 'arson', name: 'Arson', kind: 'action', suit: 'shadow', cost: 3, art: 'arson',
    target: 'enemyBuilding', hostile: true,
    effects: [{ op: 'damageBuilding', amount: 3 }],
    chain: { suit: 'shadow', effects: [{ op: 'gain', res: 'momentum', amount: 1 }], text: 'Chain Shadow: +1 Momentum.' },
    text: 'Hostile. Deal 3 damage to an enemy building.',
  },
  {
    id: 'spy', name: 'Spy Network', kind: 'action', suit: 'shadow', cost: 1, art: 'spy',
    effects: [{ op: 'revealHand' }, { op: 'draw', n: 1 }],
    text: "See your opponent's hand this turn. Draw a card.",
  },
  {
    id: 'poison', name: 'Spoil the Stores', kind: 'action', suit: 'shadow', cost: 2, art: 'poison',
    hostile: true,
    effects: [{ op: 'gain', res: 'food', amount: -4, who: 'opp' }],
    text: 'Hostile. Your opponent loses 4 Food. Hungry armies desert.',
  },
  {
    id: 'repair', name: 'Repair Crews', kind: 'action', suit: 'stone', cost: 1, art: 'repair',
    target: 'ownBuilding',
    effects: [{ op: 'repair', full: true, clearUnrest: true }],
    chain: { suit: 'stone', effects: [{ op: 'gain', res: 'stability', amount: 1 }], text: 'Chain Stone: +1 Stability.' },
    text: 'Fully repair one of your buildings and end its Unrest.',
  },
  {
    id: 'levy', name: 'Call the Levy', kind: 'action', suit: 'bronze', cost: 2, art: 'levy',
    effects: [{ op: 'createUnit', card: 'militia', n: 2 }],
    text: 'Raise 2 Militia.',
  },
  // ------------------------------------------------------------ reactions
  {
    id: 'shieldWall', name: 'Shield Wall', kind: 'reaction', suit: 'bronze', cost: 1, art: 'shieldWall',
    reaction: 'shieldWall',
    text: 'Reaction to an attack: your blockers get +1 Strength and +1 Health this combat.',
  },
  {
    id: 'feignedRetreat', name: 'Feigned Retreat', kind: 'reaction', suit: 'bronze', cost: 2, art: 'feignedRetreat',
    reaction: 'feignedRetreat',
    text: 'Reaction to an attack: cancel it. Each attacking unit takes 1 damage.',
  },
  {
    id: 'turnTheTide', name: 'Turn the Tide', kind: 'reaction', suit: 'bronze', cost: 3, art: 'turnTheTide', rarity: 'rare',
    reaction: 'turnTheTide', maxCopies: 1,
    text: "Reaction to an attack: your blockers deal double damage. Damage beyond the attackers strikes the attacker's city.",
  },
  {
    id: 'ambush', name: 'Ambush', kind: 'reaction', suit: 'bronze', cost: 2, art: 'ambush',
    reaction: 'ambush',
    text: 'Reaction to an attack: deal 2 damage to every attacking unit before combat.',
  },
  {
    id: 'vigilantWatch', name: 'Vigilant Watch', kind: 'reaction', suit: 'shadow', cost: 1, art: 'vigilantWatch',
    reaction: 'vigilantWatch',
    text: 'Reaction to a Hostile action: cancel it.',
  },
  {
    id: 'mirror', name: 'Mirror the Scheme', kind: 'reaction', suit: 'shadow', cost: 3, art: 'mirror', rarity: 'rare',
    reaction: 'mirror', maxCopies: 1,
    text: 'Reaction to a Hostile action: cancel it, then it strikes its caster instead.',
  },
];
