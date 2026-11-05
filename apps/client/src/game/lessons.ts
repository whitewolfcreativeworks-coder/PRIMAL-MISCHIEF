import type { Action } from '@pm/engine';
import { buildingUid, handUid, isPlay, unitUids, type Lesson } from './tutorial';

/*
 * One guided lesson per civilization. Seat 0 is the player, seat 1 the
 * scripted rival. Keep each lesson to one or two turns and 6–9 steps.
 */

const kush: Lesson = {
  id: 'kush',
  civ: 'kush',
  opponent: 'sumer',
  title: 'Iron and the Bow',
  summary: 'Arm your army with Meroë’s iron, strike a Legacy engine, then turn an assault into a massacre.',
  setup(t) {
    t.build(0, 'farm', 'quarry');
    t.unit(0, 'spearmen');
    t.unit(0, 'kush_archers');
    t.give(0, 'kush_furnace', 'kush_kandake', 'ambush', 'farm');
    t.edit((st) => { st.players[0].goods = 9; });
    t.build(1, 'farm', 'temple');
    t.unit(1, 'militia');
    t.unit(1, 'spearmen');
    t.unit(1, 'spearmen');
  },
  steps: [
    {
      text: 'Kush is a military economy. Your Quarry supplies ore and fuel, which is exactly what the Iron Furnaces of Meroë need. Your rival, Sumer, has a Temple quietly earning Legacy every turn.',
    },
    {
      text: 'Play the Iron Furnaces of Meroë. Every unit you own gets +1 Strength while the Furnaces work — and they only work while your Quarry stands.',
      highlight: [{ kind: 'hand', cardId: 'kush_furnace' }],
      expect: (a, st) => isPlay(a, st, 'kush_furnace'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'kush_furnace') }),
      hint: 'Tap the Iron Furnaces of Meroë in your hand, then Play.',
    },
    {
      text: 'Now play Kandake’s Command. It is Bronze, like the Furnaces, so playing it straight after them is a Chain: +1 Momentum. Your units also gain +1 Strength this turn.',
      highlight: [{ kind: 'hand', cardId: 'kush_kandake' }],
      expect: (a, st) => isPlay(a, st, 'kush_kandake'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'kush_kandake') }),
      hint: 'Play Kandake’s Command next to chain it.',
    },
    {
      text: 'Attack the enemy Temple with your Spearmen only. Keep the Archers at home: units that attack are exhausted and cannot block on your rival’s turn. Tap the Spearmen, then tap the Temple.',
      highlight: [{ kind: 'unit', cardId: 'spearmen', owner: 'me' }, { kind: 'building', cardId: 'temple', owner: 'opp' }],
      expect: (a, st) => a.type === 'attack' && a.target.kind === 'building' && a.target.uid === buildingUid(st, 1, 'temple')
        && a.unitUids.length === 1 && a.unitUids[0] === unitUids(st, 0, 'spearmen')[0],
      solution: (st) => ({ type: 'attack', unitUids: unitUids(st, 0, 'spearmen'), target: { kind: 'building', uid: buildingUid(st, 1, 'temple') } }),
      oppResponse: (st) => ({ type: 'respond', blockerUids: unitUids(st, 1, 'militia') }),
      hint: 'Select only your Spearmen, then tap the rival’s Temple.',
    },
    {
      text: 'Your Spearmen hit with 4 Strength (2 base, +1 iron, +1 Kandake). The Militia could not stop it and the Temple is damaged. Now end your turn and see what Sumer does.',
      highlight: [{ kind: 'button', name: 'endTurn' }],
      expect: (a) => a.type === 'endTurn',
      solution: () => ({ type: 'endTurn' }),
      hint: 'Tap End turn.',
    },
    {
      text: 'Sumer attacks your city with two Spearmen. This is your moment: tap your Archers of Ta-Seti to block, choose Ambush from your hand, then Respond. Ambush wounds every attacker before the fight; Ranged archers hit harder while blocking.',
      onEnter: (t) => t.opp({ type: 'attack', unitUids: unitUids(t.state, 1, 'spearmen'), target: { kind: 'city' } }),
      highlight: [{ kind: 'unit', cardId: 'kush_archers', owner: 'me' }, { kind: 'hand', cardId: 'ambush' }, { kind: 'button', name: 'respond' }],
      expect: (a, st) => a.type === 'respond' && a.reactionUid === handUid(st, 0, 'ambush') && a.blockerUids.includes(unitUids(st, 0, 'kush_archers')[0]),
      solution: (st): Action => ({ type: 'respond', reactionUid: handUid(st, 0, 'ambush'), blockerUids: unitUids(st, 0, 'kush_archers') }),
      hint: 'Block with your Archers and pick Ambush before tapping Respond.',
    },
    {
      text: 'Ambush and your Archers cut down both Spearmen. Your Archers fell too and 1 damage reached the city, a good trade for two attackers. Playing reactions earns Momentum. Your rival ends their turn…',
      onEnter: (t) => { t.opp({ type: 'endTurn' }); t.edit((st) => { st.players[0].momentum = Math.max(3, st.players[0].momentum); }); },
    },
    {
      text: 'You have enough Momentum for your Signature. Invoke Land of the Bow: 1 damage to every enemy unit, and your units gain +1 Strength this turn.',
      highlight: [{ kind: 'button', name: 'signature' }],
      expect: (a) => a.type === 'signature',
      solution: () => ({ type: 'signature' }),
      hint: 'Tap the Land of the Bow button.',
    },
    {
      text: 'Lesson complete. Kush wins by keeping its Quarry and Furnaces safe, striking the rival’s Legacy buildings, and holding archers and reactions back for the counter-blow.',
    },
  ],
};

const aksum: Lesson = {
  id: 'aksum',
  civ: 'aksum',
  opponent: 'carthage',
  title: 'Coin and Stone',
  summary: 'Grow a Red Sea trade economy, raise a Great Stele, and turn a rival’s Arson back on their own Market.',
  setup(t) {
    t.build(0, 'farm', 'road', 'market');
    t.give(0, 'aksum_adulis', 'aksum_coinage', 'aksum_stele', 'temple', 'mirror');
    t.edit((st) => { st.players[0].goods = 10; });
    t.build(1, 'farm', 'road', 'market');
    t.give(1, 'arson');
  },
  steps: [
    {
      text: 'Aksum is a trading power. Your Road supports your Market, which earns 2 Goods a turn. Silk buildings feed each other, and Star buildings carry your name toward a Legacy victory.',
    },
    {
      text: 'Play the Port of Adulis. It earns 2 Goods every turn and is a Harbor, so it would keep your Market working even if the Road were lost.',
      highlight: [{ kind: 'hand', cardId: 'aksum_adulis' }],
      expect: (a, st) => isPlay(a, st, 'aksum_adulis'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'aksum_adulis') }),
      hint: 'Tap the Port of Adulis in your hand, then Play.',
    },
    {
      text: 'Now play Gold Coinage. It costs nothing and pays 1 Goods for each Silk building you control: the Market and the Port make 2. It is Silk like the Port, so it chains: +1 Momentum, and its chain bonus adds +1 Legacy.',
      highlight: [{ kind: 'hand', cardId: 'aksum_coinage' }],
      expect: (a, st) => isPlay(a, st, 'aksum_coinage'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'aksum_coinage') }),
      hint: 'Play Gold Coinage straight after the Port to chain it.',
    },
    {
      text: 'Raise the Great Stele. It gives 1 Legacy a turn, plus 1 more for every other Star building you control. With 5 Integrity it is also hard to knock down.',
      highlight: [{ kind: 'hand', cardId: 'aksum_stele' }],
      expect: (a, st) => isPlay(a, st, 'aksum_stele'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'aksum_stele') }),
      hint: 'Play the Great Stele from your hand.',
    },
    {
      text: 'Build a Temple beside it. The Temple is Star like the Stele, so this is another chain (+1 Momentum). Now the Temple earns 1 Legacy and the Stele earns 2: 3 Legacy every turn.',
      highlight: [{ kind: 'hand', cardId: 'temple' }],
      expect: (a, st) => isPlay(a, st, 'temple'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'temple') }),
      hint: 'Play the Temple to chain it after the Stele.',
    },
    {
      text: 'You have 3 Goods left, exactly what Mirror the Scheme costs. Keep them. A Legacy engine like this will draw your rival’s attention. End your turn.',
      highlight: [{ kind: 'button', name: 'endTurn' }],
      expect: (a) => a.type === 'endTurn',
      solution: () => ({ type: 'endTurn' }),
      hint: 'Tap End turn.',
    },
    {
      text: 'Carthage casts Arson at your Great Stele: 3 damage. It is a Hostile scheme, so you may answer. Choose Mirror the Scheme, then Respond. It cancels the Arson and casts it on its owner instead, striking their most valuable building.',
      onEnter: (t) => t.opp({ type: 'play', uid: handUid(t.state, 1, 'arson'), targetUid: buildingUid(t.state, 0, 'aksum_stele') }),
      highlight: [{ kind: 'hand', cardId: 'mirror' }, { kind: 'button', name: 'respond' }],
      expect: (a, st) => a.type === 'respond' && a.reactionUid === handUid(st, 0, 'mirror'),
      solution: (st): Action => ({ type: 'respond', reactionUid: handUid(st, 0, 'mirror'), blockerUids: [] }),
      hint: 'Pick Mirror the Scheme from your hand, then tap Respond.',
    },
    {
      text: 'The fire burned Carthage’s own Market to the ground, costing them 1 Stability. Your rival ends their turn. Your trade paid out and your Legacy grew. Playing a reaction earned Momentum, and with your two chains you now have 3. Invoke Red Sea Commerce: +3 Goods, +2 Legacy and a card.',
      onEnter: (t) => t.opp({ type: 'endTurn' }),
      highlight: [{ kind: 'button', name: 'signature' }],
      expect: (a) => a.type === 'signature',
      solution: () => ({ type: 'signature' }),
      hint: 'Tap the Red Sea Commerce button.',
    },
    {
      text: 'Lesson complete. Aksum wins by stacking Silk buildings for Goods, raising Star buildings for Legacy, and keeping a reaction ready so the rival’s mischief backfires.',
    },
  ],
};

const carthage: Lesson = {
  id: 'carthage',
  civ: 'carthage',
  opponent: 'aksum',
  title: 'Sea Lanes and Silver',
  summary: 'Cut a rival’s trade with one sabotage, raid their treasury by sea, and make their counter-attack strike empty ground.',
  setup(t) {
    t.build(0, 'farm', 'quarry');
    t.give(0, 'saboteurs', 'carth_cothon', 'carth_quinq', 'carth_mercs', 'feignedRetreat');
    t.edit((st) => { st.players[0].goods = 12; });
    t.build(1, 'farm', 'road', 'market');
    t.unit(1, 'spearmen');
    t.unit(1, 'spearmen');
  },
  steps: [
    {
      text: 'Carthage is a maritime disruptor. Look at your rival, Aksum: their Market only works because their Road supports it. Pull out the right piece and the rest stops too.',
    },
    {
      text: 'Play Saboteurs on the rival’s Road. It falls into Unrest for 2 turns. A building in Unrest stops working and stops supporting others, so their Market goes dark as well.',
      highlight: [{ kind: 'hand', cardId: 'saboteurs' }, { kind: 'building', cardId: 'road', owner: 'opp' }],
      expect: (a, st) => isPlay(a, st, 'saboteurs', 'road'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'saboteurs'), targetUid: buildingUid(st, 1, 'road') }),
      hint: 'Tap Saboteurs, then tap the rival’s Road.',
    },
    {
      text: 'Both buildings are switched off. Now build The Cothon, your great harbor. It earns 1 Goods, counts as a Harbor for your fleet, and lets units attack the turn they are recruited.',
      highlight: [{ kind: 'hand', cardId: 'carth_cothon' }],
      expect: (a, st) => isPlay(a, st, 'carth_cothon'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'carth_cothon') }),
      hint: 'Play The Cothon from your hand.',
    },
    {
      text: 'Launch a Quinquereme. It needs a Harbor, which you now have. It is Silk like the Cothon, so this is a chain: +1 Momentum. As a Raider it steals 2 Goods whenever its attack does damage.',
      highlight: [{ kind: 'hand', cardId: 'carth_quinq' }],
      expect: (a, st) => isPlay(a, st, 'carth_quinq'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'carth_quinq') }),
      hint: 'Play the Quinquereme next to chain it after the Cothon.',
    },
    {
      text: 'Hire a Mercenary Company. For just 1 Goods you get 3 Strength. The catch is its Wage: pay 1 Goods at the start of each of your turns, or it deserts.',
      highlight: [{ kind: 'hand', cardId: 'carth_mercs' }],
      expect: (a, st) => isPlay(a, st, 'carth_mercs'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'carth_mercs') }),
      hint: 'Play the Mercenary Company from your hand.',
    },
    {
      text: 'Thanks to the Cothon both units can attack at once. Select the Quinquereme and the Mercenaries, then attack the rival city.',
      highlight: [{ kind: 'unit', cardId: 'carth_quinq', owner: 'me' }, { kind: 'unit', cardId: 'carth_mercs', owner: 'me' }, { kind: 'button', name: 'attackCity' }],
      expect: (a, st) => a.type === 'attack' && a.target.kind === 'city' && a.unitUids.length === 2
        && a.unitUids.includes(unitUids(st, 0, 'carth_quinq')[0]) && a.unitUids.includes(unitUids(st, 0, 'carth_mercs')[0]),
      solution: (st) => ({ type: 'attack', unitUids: [...unitUids(st, 0, 'carth_quinq'), ...unitUids(st, 0, 'carth_mercs')], target: { kind: 'city' } }),
      hint: 'Select both the Quinquereme and the Mercenary Company, then tap Attack city.',
    },
    {
      text: 'Aksum did not block. Your fleet hit for 6, the Quinquereme stole 2 Goods, and the damage earned 1 Momentum. You now hold 4 Goods: enough for a reaction and for the Mercenaries’ wage. Both units are exhausted and cannot block next turn. End your turn.',
      highlight: [{ kind: 'button', name: 'endTurn' }],
      expect: (a) => a.type === 'endTurn',
      solution: () => ({ type: 'endTurn' }),
      hint: 'Tap End turn.',
    },
    {
      text: 'Aksum strikes back at your city with two Spearmen, and you have no fresh blockers. You do not need any. Choose Feigned Retreat, then Respond: the attack is cancelled and every attacker takes 1 damage.',
      onEnter: (t) => t.opp({ type: 'attack', unitUids: unitUids(t.state, 1, 'spearmen'), target: { kind: 'city' } }),
      highlight: [{ kind: 'hand', cardId: 'feignedRetreat' }, { kind: 'button', name: 'respond' }],
      expect: (a, st) => a.type === 'respond' && a.reactionUid === handUid(st, 0, 'feignedRetreat') && a.blockerUids.length === 0,
      solution: (st): Action => ({ type: 'respond', reactionUid: handUid(st, 0, 'feignedRetreat'), blockerUids: [] }),
      hint: 'Pick Feigned Retreat from your hand, then tap Respond. No blockers are needed.',
    },
    {
      text: 'The assault struck empty ground. Your rival ends their turn. At the start of yours you paid the Mercenaries their 1 Goods wage, so they stay. The chain, the raid and the reaction gave you 3 Momentum. Invoke Close the Sea Lanes: your rival loses 4 Goods and you gain 2.',
      onEnter: (t) => t.opp({ type: 'endTurn' }),
      highlight: [{ kind: 'button', name: 'signature' }],
      expect: (a) => a.type === 'signature',
      solution: () => ({ type: 'signature' }),
      hint: 'Tap the Close the Sea Lanes button.',
    },
    {
      text: 'Lesson complete. Carthage wins by cutting supply lines, raiding with ships, hiring cheap muscle when it can afford the wages, and making the rival’s answers miss.',
    },
  ],
};

const sumer: Lesson = {
  id: 'sumer',
  civ: 'sumer',
  opponent: 'kush',
  title: 'Canal and Tablet',
  summary: 'Irrigate your fields, open a Tablet House, let the Walls of Uruk take the blow, and rebuild stronger.',
  setup(t) {
    t.build(0, 'farm', 'farm');
    t.give(0, 'sumer_canals', 'sumer_archive', 'sumer_uruk', 'vigilantWatch');
    t.edit((st) => { st.players[0].goods = 10; st.players[0].momentum = 2; });
    t.build(1, 'farm', 'quarry', 'kush_furnace');
    t.unit(1, 'spearmen');
    t.unit(1, 'spearmen');
    t.give(1, 'arson');
  },
  steps: [
    {
      text: 'Sumer is the resilient builder. Two Farms feed your city, and you have 2 Momentum saved. Your rival, Kush, has Iron Furnaces: its Spearmen hit with 3 Strength instead of 2.',
    },
    {
      text: 'Dig Irrigation Canals. They need a Farm, make 1 Food, and give every Farm +1 Food. From your next turn you make 7 Food instead of 4.',
      highlight: [{ kind: 'hand', cardId: 'sumer_canals' }],
      expect: (a, st) => isPlay(a, st, 'sumer_canals'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'sumer_canals') }),
      hint: 'Tap the Irrigation Canals in your hand, then Play.',
    },
    {
      text: 'Open a Tablet House. It earns 1 Legacy, and whenever your hand is below 5 at the start of your turn, your scribes draw you an extra card.',
      highlight: [{ kind: 'hand', cardId: 'sumer_archive' }],
      expect: (a, st) => isPlay(a, st, 'sumer_archive'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'sumer_archive') }),
      hint: 'Play the Tablet House from your hand.',
    },
    {
      text: 'Raise the Walls of Uruk. With 10 Integrity they soak up any damage that gets past your blockers before it reaches your city or your other buildings.',
      highlight: [{ kind: 'hand', cardId: 'sumer_uruk' }],
      expect: (a, st) => isPlay(a, st, 'sumer_uruk'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'sumer_uruk') }),
      hint: 'Play the Walls of Uruk from your hand.',
    },
    {
      text: 'You have 1 Goods left: just enough for Vigilant Watch if your rival tries a scheme. End your turn.',
      highlight: [{ kind: 'button', name: 'endTurn' }],
      expect: (a) => a.type === 'endTurn',
      solution: () => ({ type: 'endTurn' }),
      hint: 'Tap End turn.',
    },
    {
      text: 'Kush attacks your city with two iron-armed Spearmen: 6 damage. You have no army, and you do not need one. Tap Respond without choosing a blocker or a reaction, and let the walls hold.',
      onEnter: (t) => t.opp({ type: 'attack', unitUids: unitUids(t.state, 1, 'spearmen'), target: { kind: 'city' } }),
      highlight: [{ kind: 'building', cardId: 'sumer_uruk', owner: 'me' }, { kind: 'button', name: 'respond' }],
      expect: (a) => a.type === 'respond' && !a.reactionUid && a.blockerUids.length === 0,
      solution: (): Action => ({ type: 'respond', blockerUids: [] }),
      hint: 'Save Vigilant Watch for a scheme. Just tap Respond with nothing selected.',
    },
    {
      text: 'The Walls of Uruk absorbed all 6 damage. Your city lost no Stability. Now Kush casts Arson at your Irrigation Canals to burn your harvest. Choose Vigilant Watch, then Respond, to catch the arsonists.',
      onEnter: (t) => t.opp({ type: 'play', uid: handUid(t.state, 1, 'arson'), targetUid: buildingUid(t.state, 0, 'sumer_canals') }),
      highlight: [{ kind: 'hand', cardId: 'vigilantWatch' }, { kind: 'button', name: 'respond' }],
      expect: (a, st) => a.type === 'respond' && a.reactionUid === handUid(st, 0, 'vigilantWatch'),
      solution: (st): Action => ({ type: 'respond', reactionUid: handUid(st, 0, 'vigilantWatch'), blockerUids: [] }),
      hint: 'Pick Vigilant Watch from your hand, then tap Respond.',
    },
    {
      text: 'The Arson was foiled, and the reaction brought you to 3 Momentum. Your rival ends their turn. Your irrigated fields produced 7 Food, filling your stores to the 12 Food cap, and the Tablet House drew you an extra card. Invoke Rebuild the City: every building is fully repaired, and you gain 2 Stability.',
      onEnter: (t) => t.opp({ type: 'endTurn' }),
      highlight: [{ kind: 'button', name: 'signature' }],
      expect: (a) => a.type === 'signature',
      solution: () => ({ type: 'signature' }),
      hint: 'Tap the Rebuild the City button.',
    },
    {
      text: 'Lesson complete. The Walls of Uruk stand whole again. Sumer wins by out-producing its rival, keeping cards flowing, and outlasting every assault.',
    },
  ],
};

const inca: Lesson = {
  id: 'inca',
  civ: 'inca',
  opponent: 'carthage',
  title: 'Road and Terrace',
  summary: 'Move an army along the royal road, shrug off a poisoned granary, and hold the line with Slingers.',
  setup(t) {
    t.build(0, 'inca_terraces', 'inca_qullqa', 'barracks');
    t.unit(0, 'inca_slingers');
    t.give(0, 'inca_road', 'spearmen', 'inca_chasqui', 'shieldWall');
    t.edit((st) => { st.players[0].goods = 7; });
    t.build(1, 'farm', 'quarry');
    t.unit(1, 'carth_mercs');
    t.give(1, 'poison');
  },
  steps: [
    {
      text: 'The Inca thrive on mountain logistics. Andean Terraces count as a Farm, so they support your Barracks (+1 Health for your units). Qullqa Storehouses add Food and Goods, and stop famine from ever costing you Stability or units.',
    },
    {
      text: 'Build the Qhapaq Ñan, the royal road. It earns 1 Goods and counts as a Road: your units may attack the turn they are recruited.',
      highlight: [{ kind: 'hand', cardId: 'inca_road' }],
      expect: (a, st) => isPlay(a, st, 'inca_road'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'inca_road') }),
      hint: 'Tap the Qhapaq Ñan in your hand, then Play.',
    },
    {
      text: 'Recruit Spearmen. Normally new units must wait a turn, but the road lets them march at once.',
      highlight: [{ kind: 'hand', cardId: 'spearmen' }],
      expect: (a, st) => isPlay(a, st, 'spearmen'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'spearmen') }),
      hint: 'Play the Spearmen from your hand.',
    },
    {
      text: 'Attack the rival city with your new Spearmen only. Keep the Slingers at home: units that attack cannot block on your rival’s turn.',
      highlight: [{ kind: 'unit', cardId: 'spearmen', owner: 'me' }, { kind: 'button', name: 'attackCity' }],
      expect: (a, st) => a.type === 'attack' && a.target.kind === 'city'
        && a.unitUids.length === 1 && a.unitUids[0] === unitUids(st, 0, 'spearmen')[0],
      solution: (st) => ({ type: 'attack', unitUids: unitUids(st, 0, 'spearmen'), target: { kind: 'city' } }),
      hint: 'Select only your Spearmen, then tap Attack city.',
    },
    {
      text: 'The Spearmen hit for 2 and earned 1 Momentum. Now send a Chasqui Relay. It draws 1 card, or 2 while you control a Road, and you just built one.',
      highlight: [{ kind: 'hand', cardId: 'inca_chasqui' }],
      expect: (a, st) => isPlay(a, st, 'inca_chasqui'),
      solution: (st) => ({ type: 'play', uid: handUid(st, 0, 'inca_chasqui') }),
      hint: 'Play the Chasqui Relay from your hand.',
    },
    {
      text: 'You kept 1 Goods for Shield Wall. End your turn.',
      highlight: [{ kind: 'button', name: 'endTurn' }],
      expect: (a) => a.type === 'endTurn',
      solution: () => ({ type: 'endTurn' }),
      hint: 'Tap End turn.',
    },
    {
      text: 'Carthage plays Spoil the Stores: you lose 4 Food. Let it happen. Your Terraces and Storehouses make 3 Food a turn and your army eats 2, and even if you went hungry, the Qullqa would stop famine from costing Stability. Tap Respond with nothing selected.',
      onEnter: (t) => t.opp({ type: 'play', uid: handUid(t.state, 1, 'poison') }),
      highlight: [{ kind: 'building', cardId: 'inca_qullqa', owner: 'me' }, { kind: 'button', name: 'respond' }],
      expect: (a) => a.type === 'respond' && !a.reactionUid && a.blockerUids.length === 0,
      solution: (): Action => ({ type: 'respond', blockerUids: [] }),
      hint: 'Save your Goods for Shield Wall. Just tap Respond with nothing selected.',
    },
    {
      text: 'Now a Mercenary Company attacks your city with 3 Strength. Block with your Slingers, choose Shield Wall, then Respond. The Slingers hit for 4 (2, +1 Ranged, +1 Shield Wall) and have 4 Health (2, +1 Barracks, +1 Shield Wall).',
      onEnter: (t) => t.opp({ type: 'attack', unitUids: unitUids(t.state, 1, 'carth_mercs'), target: { kind: 'city' } }),
      highlight: [{ kind: 'unit', cardId: 'inca_slingers', owner: 'me' }, { kind: 'hand', cardId: 'shieldWall' }, { kind: 'button', name: 'respond' }],
      expect: (a, st) => a.type === 'respond' && a.reactionUid === handUid(st, 0, 'shieldWall') && a.blockerUids.includes(unitUids(st, 0, 'inca_slingers')[0]),
      solution: (st): Action => ({ type: 'respond', reactionUid: handUid(st, 0, 'shieldWall'), blockerUids: unitUids(st, 0, 'inca_slingers') }),
      hint: 'Block with your Slingers and pick Shield Wall before tapping Respond.',
    },
    {
      text: 'The Mercenaries fell and your Slingers survived. The reaction and holding the line each earned Momentum: you have 3. Your rival ends their turn, and your fields still fed the army with Food to spare. Invoke Mountain Logistics: draw 2 cards and gain 2 Food.',
      onEnter: (t) => t.opp({ type: 'endTurn' }),
      highlight: [{ kind: 'button', name: 'signature' }],
      expect: (a) => a.type === 'signature',
      solution: () => ({ type: 'signature' }),
      hint: 'Tap the Mountain Logistics button.',
    },
    {
      text: 'Lesson complete. The Inca win by moving armies fast along their roads, keeping food secure against sabotage, and holding the mountains with well-supplied defenders. When a building matters most, Ashlar Masonry gives it +3 Integrity for good.',
    },
  ],
};

export const LESSONS: Lesson[] = [kush, aksum, carthage, sumer, inca];
