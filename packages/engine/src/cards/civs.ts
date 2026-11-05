import type { CardDef, CivDef } from '../types';

/**
 * Civilization-specific cards. Rules text describes the game effect;
 * `flavor` carries a short, careful historical note. Where the record
 * is uncertain the note says so (see docs/HISTORY_NOTES.md).
 */
export const CIV_CARDS: CardDef[] = [
  // ================================================================ KUSH
  {
    id: 'kush_furnace', civ: 'kush', name: 'Iron Furnaces of Meroë', kind: 'building', suit: 'bronze', cost: 4,
    art: 'furnace', rarity: 'rare', maxCopies: 1, integrity: 4, tags: ['forge'], requires: ['quarry'], passives: ['unitStr'],
    text: 'Your units have +1 Strength. Requires a Quarry for ore and fuel.',
    flavor: 'Large slag heaps at Meroë attest to iron smelting on a considerable scale.',
  },
  {
    id: 'kush_archers', civ: 'kush', name: 'Archers of Ta-Seti', kind: 'unit', suit: 'bronze', cost: 3,
    art: 'archers', str: 2, hp: 3, upkeep: 1, keywords: ['ranged'],
    text: 'Ranged: +1 Strength while blocking. Upkeep 1 Food.',
    flavor: 'Egyptian texts called Nubia "Ta-Seti", the Land of the Bow.',
  },
  {
    id: 'kush_pyramid', civ: 'kush', name: 'Pyramids of Meroë', kind: 'building', suit: 'star', cost: 5,
    art: 'pyramid', rarity: 'wonder', maxCopies: 1, integrity: 7, legacy: 2, tags: ['wonder'],
    text: 'Wonder. +2 Legacy each turn.',
    flavor: 'Kushite royal pyramids are smaller and steeper than Egypt’s; more than 200 survive in Sudan.',
  },
  {
    id: 'kush_apedemak', civ: 'kush', name: 'Lion Temple of Apedemak', kind: 'building', suit: 'star', cost: 2,
    art: 'lion', integrity: 4, tags: ['temple'], passives: ['blockStr'],
    text: 'Your blocking units have +1 Strength.',
    flavor: 'Apedemak, a lion-headed deity of war, was honoured at the temple at Naqa.',
  },
  {
    id: 'kush_kandake', civ: 'kush', name: "Kandake's Command", kind: 'action', suit: 'bronze', cost: 2,
    art: 'kandake', effects: [{ op: 'buffUnits', str: 1 }, { op: 'draw', n: 1 }],
    text: 'Your units get +1 Strength this turn. Draw a card.',
    flavor: 'Kandake was the title of Kushite ruling queens; Amanirenas resisted Roman forces c. 25 BCE.',
  },
  // ================================================================ AKSUM
  {
    id: 'aksum_adulis', civ: 'aksum', name: 'Port of Adulis', kind: 'building', suit: 'silk', cost: 3,
    art: 'port', integrity: 4, goods: 2, tags: ['harbor'],
    text: '+2 Goods. Harbor: supports Markets and fleets.',
    flavor: 'Adulis on the Red Sea linked Aksum to Egypt, Arabia and the Indian Ocean.',
  },
  {
    id: 'aksum_mint', civ: 'aksum', name: 'Aksumite Mint', kind: 'building', suit: 'silk', cost: 3,
    art: 'mint', rarity: 'rare', integrity: 3, tags: ['mint'], requires: ['market', 'harbor'], passives: ['mint'],
    text: '+1 Goods for each other Silk building you control. Requires a Market or Harbor.',
    flavor: 'Aksum issued its own gold, silver and bronze coins from the late 3rd century CE.',
  },
  {
    id: 'aksum_stele', civ: 'aksum', name: 'Great Stele', kind: 'building', suit: 'star', cost: 3,
    art: 'stele', rarity: 'rare', integrity: 5, legacy: 1, legacyPerSuit: 'star', tags: ['stele'],
    text: '+1 Legacy, plus +1 for each other Star building you control.',
    flavor: 'Carved granite stelae, some over 20 m tall, mark the royal tombs of Aksum.',
  },
  {
    id: 'aksum_fleet', civ: 'aksum', name: 'Red Sea Traders', kind: 'unit', suit: 'silk', cost: 3,
    art: 'ship', str: 2, hp: 3, upkeep: 1, keywords: ['raider'], requiresToRecruit: 'harbor',
    text: 'Raider: when this attack damages its target, steal 2 Goods. Requires a Harbor.',
  },
  {
    id: 'aksum_coinage', civ: 'aksum', name: 'Gold Coinage', kind: 'action', suit: 'silk', cost: 0,
    art: 'coin', effects: [{ op: 'gain', res: 'goods', amount: 1, per: { kind: 'suitBuildings', suit: 'silk' } }],
    chain: { suit: 'silk', effects: [{ op: 'gain', res: 'legacy', amount: 1 }], text: 'Chain Silk: +1 Legacy.' },
    text: '+1 Goods for each Silk building you control.',
  },
  // ================================================================ CARTHAGE
  {
    id: 'carth_cothon', civ: 'carthage', name: 'The Cothon', kind: 'building', suit: 'silk', cost: 3,
    art: 'cothon', rarity: 'rare', integrity: 5, goods: 1, tags: ['harbor'], passives: ['swift'],
    text: '+1 Goods. Harbor. Your units may attack the turn they are recruited.',
    flavor: 'Carthage’s enclosed circular naval harbor could shelter a large war fleet.',
  },
  {
    id: 'carth_mercs', civ: 'carthage', name: 'Mercenary Company', kind: 'unit', suit: 'bronze', cost: 1,
    art: 'mercenary', str: 3, hp: 2, upkeep: 0, wage: 1,
    text: 'Wage: pay 1 Goods at the start of each of your turns or this unit deserts.',
    flavor: 'Carthage relied heavily on hired and allied soldiers from across the western Mediterranean.',
  },
  {
    id: 'carth_cavalry', civ: 'carthage', name: 'Numidian Horse', kind: 'unit', suit: 'bronze', cost: 3,
    art: 'cavalry', str: 3, hp: 2, upkeep: 1, keywords: ['swift'],
    text: 'Swift: may attack the turn it is recruited. Upkeep 1 Food.',
    flavor: 'Numidian allies were famed light cavalry, riding without bridles.',
  },
  {
    id: 'carth_quinq', civ: 'carthage', name: 'Quinquereme', kind: 'unit', suit: 'silk', cost: 4,
    art: 'ship', str: 3, hp: 4, upkeep: 1, keywords: ['raider'], requiresToRecruit: 'harbor',
    text: 'Raider: when this attack damages its target, steal 2 Goods. Requires a Harbor.',
  },
  {
    id: 'carth_blockade', civ: 'carthage', name: 'Blockade', kind: 'action', suit: 'shadow', cost: 3,
    art: 'blockade', hostile: true,
    effects: [{ op: 'unrestSuit', suit: 'silk', turns: 1 }, { op: 'gain', res: 'goods', amount: -2, who: 'opp' }],
    text: 'Hostile. All enemy Silk buildings fall into Unrest for 1 turn. Opponent loses 2 Goods.',
  },
  // ================================================================ SUMER
  {
    id: 'sumer_canals', civ: 'sumer', name: 'Irrigation Canals', kind: 'building', suit: 'earth', cost: 2,
    art: 'canal', integrity: 3, food: 1, tags: ['canal'], requires: ['farm'], passives: ['irrigation'],
    text: '+1 Food, and each of your Farms produces +1 Food. Requires a Farm.',
    flavor: 'Canals drawn from the Tigris and Euphrates made southern Mesopotamia farmable.',
  },
  {
    id: 'sumer_ziggurat', civ: 'sumer', name: 'Ziggurat', kind: 'building', suit: 'star', cost: 5,
    art: 'ziggurat', rarity: 'wonder', maxCopies: 1, integrity: 8, legacy: 2, tags: ['temple', 'wonder'],
    text: 'Wonder. +2 Legacy each turn.',
    flavor: 'Stepped mud-brick temple platforms rose at the heart of cities such as Ur.',
  },
  {
    id: 'sumer_archive', civ: 'sumer', name: 'Tablet House', kind: 'building', suit: 'star', cost: 3,
    art: 'tablets', rarity: 'rare', integrity: 3, legacy: 1, tags: ['archive'], passives: ['scribes'],
    text: '+1 Legacy. Draw an extra card at the start of your turn while your hand is below 5.',
    flavor: 'Cuneiform writing grew out of the need to record rations, land and labor.',
  },
  {
    id: 'sumer_uruk', civ: 'sumer', name: 'Walls of Uruk', kind: 'building', suit: 'stone', cost: 4,
    art: 'walls', rarity: 'rare', maxCopies: 1, integrity: 10, tags: ['walls'], passives: ['wall'],
    text: 'Wall: damage that gets past your blockers hits these walls first.',
    flavor: 'Uruk’s great walls, credited in legend to Gilgamesh, ran for about 9 km.',
  },
  {
    id: 'sumer_census', civ: 'sumer', name: 'Census of the Granaries', kind: 'action', suit: 'star', cost: 2,
    art: 'tablets', effects: [{ op: 'gain', res: 'stability', amount: 2 }, { op: 'repairAll', amount: 2 }],
    chain: { suit: 'stone', effects: [{ op: 'gain', res: 'stability', amount: 1 }], text: 'Chain Stone: +1 Stability.' },
    text: '+2 Stability. Repair 2 damage on each of your buildings.',
  },
  {
    id: 'sumer_wagon', civ: 'sumer', name: 'Battle Wagon', kind: 'unit', suit: 'bronze', cost: 3,
    art: 'wagon', str: 3, hp: 3, upkeep: 1,
    text: 'Upkeep 1 Food.',
    flavor: 'The Standard of Ur shows four-wheeled wagons drawn by equids, c. 2500 BCE.',
  },
  // ================================================================ INCA
  {
    id: 'inca_road', civ: 'inca', name: 'Qhapaq Ñan', kind: 'building', suit: 'stone', cost: 3,
    art: 'andeanRoad', rarity: 'rare', integrity: 4, goods: 1, tags: ['road'], passives: ['swift'],
    text: '+1 Goods. Road: your units may attack the turn they are recruited.',
    flavor: 'The Inca road system linked roughly 30,000 km of routes through the Andes.',
  },
  {
    id: 'inca_terraces', civ: 'inca', name: 'Andean Terraces', kind: 'building', suit: 'earth', cost: 2,
    art: 'terraces', integrity: 4, food: 2, tags: ['farm'],
    text: '+2 Food. Counts as a Farm. Sturdier than lowland fields.',
    flavor: 'Andenes turned steep slopes into stable, irrigated fields.',
  },
  {
    id: 'inca_qullqa', civ: 'inca', name: 'Qullqa Storehouses', kind: 'building', suit: 'earth', cost: 2,
    art: 'granary', integrity: 4, food: 1, goods: 1, tags: ['granary'], passives: ['famineShield'],
    text: '+1 Food, +1 Goods. Famine cannot cost you Stability or units.',
    flavor: 'Rows of hillside storehouses held food, cloth and weapons for the state.',
  },
  {
    id: 'inca_chasqui', civ: 'inca', name: 'Chasqui Relay', kind: 'action', suit: 'silk', cost: 1,
    art: 'runner', effects: [{ op: 'draw', n: 2, ifTag: 'road', elseN: 1 }],
    text: 'Draw a card, or 2 if you control a Road.',
    flavor: 'Relay runners carried messages and khipu records along the roads.',
  },
  {
    id: 'inca_masonry', civ: 'inca', name: 'Ashlar Masonry', kind: 'action', suit: 'stone', cost: 2,
    art: 'masonry', target: 'ownBuilding', effects: [{ op: 'fortify', amount: 3 }, { op: 'repair', full: true, clearUnrest: true }],
    chain: { suit: 'stone', effects: [{ op: 'gain', res: 'stability', amount: 1 }], text: 'Chain Stone: +1 Stability.' },
    text: 'One of your buildings gains +3 Integrity permanently and is fully repaired.',
    flavor: 'Precisely fitted, mortarless stonework has survived centuries of earthquakes.',
  },
  {
    id: 'inca_slingers', civ: 'inca', name: 'Slingers', kind: 'unit', suit: 'bronze', cost: 2,
    art: 'slinger', str: 2, hp: 2, upkeep: 1, keywords: ['ranged'],
    text: 'Ranged: +1 Strength while blocking. Upkeep 1 Food.',
    flavor: 'The woven sling (warakʼa) was a common Andean weapon.',
  },
];

export const CIVS: CivDef[] = [
  {
    id: 'kush', name: 'Kingdom of Kush', region: 'Nile Valley, Sudan', era: 'c. 785 BCE – 350 CE',
    epithet: 'Iron and the Bow',
    summary: 'A disciplined military economy. Iron furnaces sharpen every unit and archers punish attackers.',
    history: 'Kush ruled from Napata and later Meroë, for a time governing Egypt as its 25th Dynasty. Meroë became a major iron-working centre, and Kushite queens (Kandakes) held real power.',
    palette: { primary: '#8a3b1e', secondary: '#d9a441', accent: '#f2d08a', ink: '#2a1408' },
    signature: { name: 'Land of the Bow', cost: 3, text: 'Deal 1 damage to every enemy unit. Your units get +1 Strength this turn.', effects: [{ op: 'damageEnemyUnits', amount: 1 }, { op: 'buffUnits', str: 1 }] },
    starterDeck: [
      'farm', 'farm', 'quarry', 'barracks', 'walls', 'road', 'temple',
      'kush_furnace', 'kush_archers', 'kush_archers', 'kush_pyramid', 'kush_apedemak', 'kush_kandake', 'kush_kandake',
      'spearmen', 'spearmen', 'militia', 'archers',
      'festival', 'arson', 'levy',
      'shieldWall', 'feignedRetreat', 'turnTheTide',
    ],
  },
  {
    id: 'aksum', name: 'Kingdom of Aksum', region: 'Ethiopian & Eritrean highlands', era: 'c. 100 – 940 CE',
    epithet: 'Coin and Stone',
    summary: 'A trading power. Ports and coinage compound into wealth, and stelae carry its name to victory by Legacy.',
    history: 'Aksum controlled trade between the Roman world and the Indian Ocean through its port of Adulis, minted its own coinage, and raised monumental stelae at its capital.',
    palette: { primary: '#1f4e6b', secondary: '#c9a24a', accent: '#efe3c2', ink: '#0d2231' },
    signature: { name: 'Red Sea Commerce', cost: 3, text: 'Gain 3 Goods and 2 Legacy. Draw a card.', effects: [{ op: 'gain', res: 'goods', amount: 3 }, { op: 'gain', res: 'legacy', amount: 2 }, { op: 'draw', n: 1 }] },
    starterDeck: [
      'farm', 'farm', 'road', 'market', 'market', 'temple', 'granary',
      'aksum_adulis', 'aksum_mint', 'aksum_stele', 'aksum_stele', 'aksum_fleet', 'aksum_fleet', 'aksum_coinage', 'aksum_coinage',
      'spearmen', 'spearmen', 'archers', 'archers', 'walls',
      'caravan',
      'vigilantWatch', 'mirror', 'shieldWall',
    ],
  },
  {
    id: 'carthage', name: 'Carthage', region: 'North African coast, Tunisia', era: 'c. 814 – 146 BCE',
    epithet: 'Sea Lanes and Silver',
    summary: 'A maritime disruptor. Hired blades hit hard, fleets raid treasuries, blockades choke rival trade.',
    history: 'Founded by Phoenician settlers from Tyre, Carthage built a commercial and naval network across the western Mediterranean and fought Rome in the Punic Wars.',
    palette: { primary: '#5b2a5e', secondary: '#b8863b', accent: '#e9d3b0', ink: '#22102a' },
    signature: { name: 'Close the Sea Lanes', cost: 3, text: 'Your opponent loses 4 Goods. You gain 2 Goods.', effects: [{ op: 'gain', res: 'goods', amount: -4, who: 'opp' }, { op: 'gain', res: 'goods', amount: 2 }] },
    starterDeck: [
      'farm', 'farm', 'road', 'market', 'quarry',
      'carth_cothon', 'carth_mercs', 'carth_mercs', 'carth_cavalry', 'carth_cavalry', 'carth_quinq', 'carth_blockade',
      'spearmen', 'militia',
      'caravan', 'saboteurs', 'saboteurs', 'arson', 'poison', 'spy',
      'feignedRetreat', 'vigilantWatch', 'mirror', 'ambush',
    ],
  },
  {
    id: 'sumer', name: 'Sumer', region: 'Southern Mesopotamia, Iraq', era: 'c. 4500 – 1900 BCE',
    epithet: 'Canal and Tablet',
    summary: 'The resilient builder. Irrigation feeds a deep economy, records keep cards flowing, walls hold.',
    history: 'Sumerian city-states such as Uruk and Ur built some of the earliest cities, irrigation networks and the cuneiform writing system.',
    palette: { primary: '#1d3f8f', secondary: '#c08a3e', accent: '#e8dcc0', ink: '#0d1a3b' },
    signature: { name: 'Rebuild the City', cost: 3, text: 'Fully repair all your buildings, end their Unrest, +2 Stability.', effects: [{ op: 'repairAll', full: true, clearUnrest: true }, { op: 'gain', res: 'stability', amount: 2 }] },
    starterDeck: [
      'farm', 'farm', 'granary', 'quarry', 'workshop', 'temple', 'road',
      'sumer_canals', 'sumer_ziggurat', 'sumer_archive', 'sumer_uruk', 'sumer_census', 'sumer_census', 'sumer_wagon', 'sumer_wagon',
      'spearmen', 'spearmen', 'ram',
      'repair', 'repair', 'festival',
      'shieldWall', 'vigilantWatch', 'feignedRetreat',
    ],
  },
  {
    id: 'inca', name: 'Inca', region: 'Andes, South America', era: 'c. 1438 – 1533 CE',
    epithet: 'Road and Terrace',
    summary: 'Mountain logistics. Roads move armies at once, terraces and storehouses shrug off famine and sabotage.',
    history: 'Tawantinsuyu, the Inca state, governed the Andes through a vast road network, relay runners, terraced farming, storehouses and labor obligations.',
    palette: { primary: '#7a2e2a', secondary: '#d4a017', accent: '#efe2c4', ink: '#2a100e' },
    signature: { name: 'Mountain Logistics', cost: 3, text: 'Draw 2 cards and gain 2 Food.', effects: [{ op: 'draw', n: 2 }, { op: 'gain', res: 'food', amount: 2 }] },
    starterDeck: [
      'inca_road', 'inca_terraces', 'inca_terraces', 'inca_qullqa', 'inca_chasqui', 'inca_chasqui', 'inca_masonry', 'inca_slingers', 'inca_slingers',
      'quarry', 'barracks', 'walls', 'temple', 'farm',
      'spearmen', 'spearmen', 'militia',
      'festival', 'repair', 'levy',
      'shieldWall', 'ambush', 'turnTheTide', 'vigilantWatch',
    ],
  },
];
