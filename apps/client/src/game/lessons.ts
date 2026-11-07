import type { Action, Family, GameState, PlayerId } from '@pm/engine';
import { buildingUid, handUid, isPlay, unitUids, type Lesson, type Step, type TutorApi } from './tutorial';

/*
 * Academy lessons, one per civilization. Each lesson teaches the blind
 * draft, growing into a new Age, a fight across the river, and the
 * civilization's trait and Signature. Draws are random, so lessons stack
 * the top of a deck (or hand out cards) whenever a later step needs a card.
 */

// ------------------------------------------------------------------ helpers

/** Put these cards on top of a draw pile, first id on top (moved from the pile, or created if absent). */
function stack(t: TutorApi, pid: PlayerId, fam: Family, ...ids: string[]) {
  t.edit((st) => {
    const pile = st.players[pid].piles[fam];
    for (const id of [...ids].reverse()) {
      const i = pile.findIndex((c) => c.cardId === id);
      pile.unshift(i >= 0 ? pile.splice(i, 1)[0] : { uid: `L${++st.uidCounter}`, cardId: id });
    }
  });
}

const need = (st: GameState, pid: PlayerId) => Math.max(0, 6 - st.players[pid].hand.length);

/** The rival's blind pick at the start of its turn. Its draws never matter to a lesson. */
function oppDraft(t: TutorApi) {
  const n = need(t.state, 1);
  t.opp({ type: 'draft', civ: Math.ceil(n / 2), mil: Math.floor(n / 2) });
}

/** The rival plays a card it is given on the spot. */
function oppPlay(t: TutorApi, cardId: string, targetUid?: string) {
  t.give(1, cardId);
  const hand = t.state.players[1].hand;
  t.opp({ type: 'play', uid: hand[hand.length - 1].uid, targetUid });
}

/** A draft step: at least `civ` Civilization and `mil` Military cards, no discards. */
function draftStep(text: string, civ: number, mil: number, solveMil: number, hint: string, extra: Partial<Step> = {}): Step {
  return {
    text,
    expect: (a) => a.type === 'draft' && a.civ >= civ && a.mil >= mil && !(a.discard?.length),
    solution: (st) => { const n = need(st, 0); const m = Math.min(n, solveMil); return { type: 'draft', civ: n - m, mil: m }; },
    hint,
    highlight: [{ kind: 'button', name: 'draft' }],
    ...extra,
  };
}

function playStep(text: string, cardId: string, hint: string, extra: Partial<Step> = {}): Step {
  return {
    text,
    expect: (a, st) => isPlay(a, st, cardId),
    solution: (st) => ({ type: 'play', uid: handUid(st, 0, cardId) }),
    hint,
    highlight: [{ kind: 'hand', cardId }],
    ...extra,
  };
}

const endTurnStep = (text: string, extra: Partial<Step> = {}): Step => ({
  text,
  expect: (a) => a.type === 'endTurn',
  solution: () => ({ type: 'endTurn' }),
  hint: 'Tap End turn.',
  highlight: [{ kind: 'button', name: 'endTurn' }],
  ...extra,
});

const signatureStep = (text: string, hint: string, extra: Partial<Step> = {}): Step => ({
  text,
  expect: (a) => a.type === 'signature',
  solution: () => ({ type: 'signature' }),
  hint,
  highlight: [{ kind: 'button', name: 'signature' }],
  ...extra,
});

const reactionIs = (a: Action, st: GameState, cardId: string) =>
  a.type === 'respond' && !!a.reactionUid && st.players[0].hand.find((c) => c.uid === a.reactionUid)?.cardId === cardId;

const attackBuilding = (st: GameState, target: string, unitCards?: string[]): Action => ({
  type: 'attack',
  unitUids: unitCards ? unitCards.flatMap((id) => unitUids(st, 0, id)) : unitUids(st, 0),
  target: { kind: 'building', uid: buildingUid(st, 1, target) },
});

const isAttackOn = (a: Action, st: GameState, target: string, unitCards: string[]) =>
  a.type === 'attack' && a.target.kind === 'building' && a.target.uid === buildingUid(st, 1, target) &&
  unitCards.every((id) => unitUids(st, 0, id).some((u) => a.unitUids.includes(u)));

// ------------------------------------------------------------------ Kush

const kush: Lesson = {
  id: 'kush-bow',
  civ: 'kush',
  opponent: 'carthage',
  title: 'Land of the Bow',
  summary: 'Draft archers, grow into Kerma, spring an Ambush on Carthage’s mercenaries and finish them with Rain of Arrows.',
  setup: (t) => {
    t.edit((st) => { st.phase = 'draft'; st.players[0].progress = 7; });
    stack(t, 0, 'civ', 'kush_cattle');
    stack(t, 0, 'mil', 'kush_archers', 'ambush');
    t.build(1, 'carth_post');
    t.unit(1, 'carth_mercs');
    t.unit(1, 'carth_mercs');
  },
  steps: [
    {
      text: 'Kush holds the near bank of the river. Carthage holds the far bank, with two Mercenary Companies ready to cross. You win by filling your Age bar through all five Ages, or by bringing Carthage’s Stability from 22 to 0.',
    },
    draftStep(
      'Every turn you refill your hand to 6 cards, and you choose blind how many come from each deck. Civilization cards grow your city. Military cards defend it. With soldiers facing you, take at least 2 Military cards.',
      1, 2, 3,
      'Set at least 2 Military and at least 1 Civilization, keep every card, then tap Draw.',
    ),
    playStep(
      'Your Age bar stands at 7 of 8. Cattle Herds costs 1 Prosperity, gives +1 Progress when built and makes 2 Food every turn: food for your people and your soldiers. Build it and watch Kush enter a new Age.',
      'kush_cattle',
      'Play Cattle Herds from your hand.',
    ),
    playStep(
      'Welcome to Kerma, Age II. Stronger cards joined both decks and you gained 2 Momentum. Your Military picks brought Archers of Ta-Seti. Land of the Bow, the Kush trait, gives Ranged units +1 Strength while they defend your bank. Deploy them.',
      'kush_archers',
      'Play Archers of Ta-Seti.',
    ),
    endTurnStep('New units must wait a turn before they cross, but they can defend right away. You also drew an Ambush, a reaction you play on Carthage’s turn. Keep 2 Prosperity for it and end your turn.'),
    {
      text: 'Carthage sends both Mercenaries at your city: 6 Strength. Your Archers would strike back with 7 (2, +1 Land of the Bow, +1 for holding the riverbank, +1 for Ranged, +2 because archers beat spearmen), but the Mercenaries’ 6 would cut them down and 4 damage would hit your city. Play Ambush and block with your Archers.',
      onEnter: (t) => {
        oppDraft(t);
        t.opp({ type: 'attack', unitUids: unitUids(t.state, 1), target: { kind: 'city' } });
      },
      expect: (a, st) => reactionIs(a, st, 'ambush') && a.type === 'respond' && unitUids(st, 0, 'kush_archers').every((u) => a.blockerUids.includes(u)),
      solution: (st) => ({ type: 'respond', reactionUid: handUid(st, 0, 'ambush'), blockerUids: unitUids(st, 0, 'kush_archers') }),
      hint: 'Choose the Ambush card, then your Archers as blockers, and confirm.',
      highlight: [{ kind: 'hand', cardId: 'ambush' }, { kind: 'unit', cardId: 'kush_archers', owner: 'me' }, { kind: 'button', name: 'respond' }],
    },
    draftStep(
      'Mischief! Ambush dealt 2 damage to each attacker before the clash. Mercenaries have only 2 Health, so both fell in the water. Holding the bank and reacting earned you 2 Momentum. Carthage hired two fresh Mercenaries and passed. Your Momentum can handle them, so lean on growth: take at least 2 Civilization cards.',
      2, 0, 1,
      'Set at least 2 Civilization cards, keep every card, then tap Draw.',
      {
        onEnter: (t) => {
          oppPlay(t, 'carth_mercs');
          oppPlay(t, 'carth_mercs');
          t.opp({ type: 'endTurn' });
        },
      },
    ),
    signatureStep(
      'You have 4 Momentum. Rain of Arrows, the Kush Signature, costs 3 and deals 2 damage to every enemy unit. That is exactly a Mercenary’s Health.',
      'Tap the Signature button: Rain of Arrows.',
    ),
    {
      text: 'The far bank is empty. Send your Archers across the river at Carthage’s city.',
      expect: (a, st) => a.type === 'attack' && a.target.kind === 'city' && unitUids(st, 0, 'kush_archers').every((u) => a.unitUids.includes(u)),
      solution: (st) => ({ type: 'attack', unitUids: unitUids(st, 0, 'kush_archers'), target: { kind: 'city' } }),
      hint: 'Select your Archers, then tap Attack city.',
      highlight: [{ kind: 'unit', cardId: 'kush_archers', owner: 'me' }, { kind: 'button', name: 'attackCity' }],
    },
    {
      text: 'Unblocked, your Archers deal 2 and Carthage falls to 20 Stability. That is Kush: draft enough bows, let iron and archers hold the bank, and turn every failed attack into Momentum.',
    },
  ],
};

// ------------------------------------------------------------------ Aksum

const aksum: Lesson = {
  id: 'aksum-coin',
  civ: 'aksum',
  opponent: 'kush',
  title: 'Coin and Stone',
  summary: 'Open the Port of Adulis, mint Gold Coinage into a new Age, stop Kush with a Treaty of Kings and cash in with Red Sea Commerce.',
  setup: (t) => {
    t.edit((st) => { st.phase = 'draft'; const p = st.players[0]; p.age = 2; p.progress = 6; p.prosperity = 8; });
    t.build(0, 'aksum_fields', 'market');
    stack(t, 0, 'civ', 'aksum_adulis', 'aksum_coinage');
    stack(t, 0, 'mil', 'aksum_treaty');
    t.build(1, 'kush_cattle');
    t.unit(1, 'kush_archers');
    t.unit(1, 'kush_archers');
  },
  steps: [
    {
      text: 'Aksum is in Age II with 6 of 10 Progress. Your Market sits idle: it needs a Road or Harbor to work. Across the river, Kush has two Archers. Aksum wins by trade, racing its Age bar to the Golden Age.',
    },
    draftStep(
      'You refill to 6 cards, choosing blind from two decks. Trade buildings live in the Civilization deck, so take at least 2 Civilization cards. Keep at least 1 Military card in case Kush crosses.',
      2, 1, 2,
      'Set at least 2 Civilization and 1 Military, keep every card, then tap Draw.',
    ),
    playStep(
      'You drew the Port of Adulis, a Harbor. Red Sea Trade, the Aksum trait, gives each Harbor +1 extra Prosperity, so Adulis pays 2 a turn. It also wakes up your Market. Build it.',
      'aksum_adulis',
      'Play Port of Adulis.',
    ),
    playStep(
      'Progress 7 of 10. Gold Coinage gives 1 Progress, +2 Prosperity, and +1 Progress for each Harbor or Market. You have two, so it brings 3 Progress. Mint it.',
      'aksum_coinage',
      'Play Gold Coinage.',
    ),
    endTurnStep('Early Aksum, Age III! The bar resets, stronger cards join both decks and you gain 2 Momentum. You also hold Treaty of Kings, a reaction that costs 3. You have 5 Prosperity. End your turn.'),
    {
      text: 'Kush sends both Archers at the Port of Adulis: 6 Strength against 4 Integrity. It would fall, costing 1 Stability, and your Market would stop working. Play Treaty of Kings: the attack is cancelled, and Kush gains 3 Prosperity as the price of peace.',
      onEnter: (t) => {
        oppDraft(t);
        t.opp({ type: 'attack', unitUids: unitUids(t.state, 1), target: { kind: 'building', uid: buildingUid(t.state, 0, 'aksum_adulis') } });
      },
      expect: (a, st) => reactionIs(a, st, 'aksum_treaty'),
      solution: (st) => ({ type: 'respond', reactionUid: handUid(st, 0, 'aksum_treaty'), blockerUids: [] }),
      hint: 'Choose Treaty of Kings, then confirm.',
      highlight: [{ kind: 'hand', cardId: 'aksum_treaty' }, { kind: 'button', name: 'respond' }],
    },
    draftStep(
      'Peace holds and the treaty earned you 1 Momentum. Your trade paid well this turn: 5 base, 1 from your fields, 2 from Adulis and 2 from the Market. The Kush archers are still there and your Treaty is spent, so take at least 1 Military card.',
      0, 1, 1,
      'Set at least 1 Military card, keep every card, then tap Draw.',
      { onEnter: (t) => t.opp({ type: 'endTurn' }) },
    ),
    signatureStep(
      'You have 3 Momentum. Red Sea Commerce, the Aksum Signature, gives +2 Prosperity and +1 Progress for each Harbor and Market. Invoke it.',
      'Tap the Signature button: Red Sea Commerce.',
    ),
    {
      text: 'Two Progress toward Age IV, with no card spent. That is Aksum: build Harbors and Markets, let every coin and Signature count them, and buy peace when Kush comes calling.',
    },
  ],
};

// ------------------------------------------------------------------ Carthage

const carthage: Lesson = {
  id: 'carthage-sea',
  civ: 'carthage',
  opponent: 'aksum',
  title: 'Sea Lanes and Silver',
  summary: 'Build the Cothon, hire cheap Mercenaries and Raiders that cross at once, sink Aksum’s harbor and close its sea lanes.',
  setup: (t) => {
    t.edit((st) => { st.phase = 'draft'; const p = st.players[0]; p.progress = 6; p.prosperity = 8; st.players[1].progress = 6; });
    stack(t, 0, 'civ', 'carth_cothon');
    stack(t, 0, 'mil', 'carth_mercs', 'raiders');
    t.build(0, 'farm'); // food for the soldiers you are about to hire
    t.build(1, 'aksum_fields', 'aksum_adulis', 'market');
  },
  steps: [
    {
      text: 'Carthage faces Aksum across the river. Aksum’s wealth runs through the Port of Adulis: its Market needs that Harbor to work. Nobody guards their bank yet.',
    },
    draftStep(
      'You refill to 6 cards, choosing blind from the Civilization and Military decks. Hired Swords, the Carthage trait, makes your units cost 1 less. Strike while the bank is open: take at least 2 Military cards.',
      1, 2, 3,
      'Set at least 2 Military and 1 Civilization, keep every card, then tap Draw.',
    ),
    playStep(
      'Your Age bar is at 6 of 8. The Cothon, Carthage’s great harbor, gives 2 Progress and lets your units attack the turn they are deployed. Build it.',
      'carth_cothon',
      'Play The Cothon.',
    ),
    playStep(
      'Qart-Hadasht, Age II! Stronger cards joined your decks and you gained 2 Momentum. Now hire a Mercenary Company: Strength 3, and only 1 Prosperity with Hired Swords.',
      'carth_mercs',
      'Play Mercenary Company.',
    ),
    playStep(
      'Add River Raiders, also 1 Prosperity. Raiders steal 2 Progress whenever their attack gets through.',
      'raiders',
      'Play River Raiders.',
    ),
    {
      text: 'Thanks to the Cothon, both can cross now. Hitting the city costs Aksum Stability. Hitting a building can do more. Send both at the Port of Adulis: 5 Strength against 4 Integrity.',
      expect: (a, st) => isAttackOn(a, st, 'aksum_adulis', ['carth_mercs', 'raiders']),
      solution: (st) => attackBuilding(st, 'aksum_adulis'),
      hint: 'Select both units, then tap the Port of Adulis on the far bank.',
      highlight: [{ kind: 'unit', cardId: 'carth_mercs', owner: 'me' }, { kind: 'unit', cardId: 'raiders', owner: 'me' }, { kind: 'building', cardId: 'aksum_adulis', owner: 'opp' }],
    },
    signatureStep(
      'Adulis falls! Aksum loses 1 Stability and 2 Progress for an Age II building, and your Raiders steal 2 more. Its Market has lost its Harbor and stops working. The hit also gave you 1 Momentum, so you have 3. Invoke Close the Sea Lanes.',
      'Tap the Signature button: Close the Sea Lanes.',
    ),
    endTurnStep('Aksum lost 4 Prosperity and its last 2 Progress, and you took 3 Prosperity for yourself. End your turn.'),
    draftStep(
      'Aksum hired two Highland Spearmen to guard its bank. Each blocks with 3 Strength (2, +1 for holding the riverbank). To cross again you need more soldiers: take at least 2 Military cards.',
      0, 2, 2,
      'Set at least 2 Military cards, keep every card, then tap Draw.',
      {
        onEnter: (t) => {
          oppDraft(t);
          oppPlay(t, 'aksum_spearmen');
          oppPlay(t, 'aksum_spearmen');
          t.opp({ type: 'endTurn' });
        },
      },
    ),
    {
      text: 'That is Carthage: cheap armies, raids that steal Progress, and strikes at the buildings a rival depends on. In Age IV, Blockade throws every enemy trade building into Unrest and takes 3 more Prosperity.',
    },
  ],
};

// ------------------------------------------------------------------ Sumer

const sumer: Lesson = {
  id: 'sumer-walls',
  civ: 'sumer',
  opponent: 'kush',
  title: 'Canal and Tablet',
  summary: 'Read the decks with your scribes, dig Irrigation Canals into the Age of Uruk, hold its great walls and Rebuild the City.',
  setup: (t) => {
    t.edit((st) => { st.phase = 'draft'; const p = st.players[0]; p.progress = 6; p.prosperity = 7; });
    t.build(0, 'farm');
    t.unit(0, 'sumer_wagon');
    stack(t, 0, 'civ', 'sumer_canals');
    stack(t, 0, 'mil', 'sumer_uruk');
    t.edit((st) => { st.players[0].peek = { civ: 'sumer_canals', mil: 'sumer_uruk' }; });
    t.build(1, 'kush_cattle');
    t.unit(1, 'kush_archers');
    t.unit(1, 'kush_archers');
  },
  steps: [
    {
      text: 'Sumer holds the near bank with a Farmland and a Battle Wagon. Across the river, Kush has two Archers. Each turn you refill to 6 cards, choosing how many come from the Civilization and Military decks.',
    },
    draftStep(
      'Other civilizations pick blind. Your Scribes, the Sumer trait, read the top card of each deck first. Look: Irrigation Canals on Civilization, Walls of Uruk on Military. You want both, so take at least 1 from each deck.',
      1, 1, 3,
      'Set at least 1 Civilization and 1 Military card, keep every card, then tap Draw.',
      { highlight: [{ kind: 'button', name: 'draft' }] },
    ),
    playStep(
      'Your Age bar is at 6 of 8. Irrigation Canals give 2 Progress and make each of your Farms produce +1 Food. They need a Farm, and you have one. Dig them.',
      'sumer_canals',
      'Play Irrigation Canals.',
    ),
    playStep(
      'Uruk, Age II! Stronger cards joined both decks and you gained 2 Momentum. Now raise the Walls of Uruk: a fort with 10 Integrity. Damage that gets past your blockers hits the walls before your city.',
      'sumer_uruk',
      'Play Walls of Uruk.',
    ),
    endTurnStep('Your city is ready. End your turn and see what Kush does.'),
    {
      text: 'Kush sends both Archers at your city: 3 Strength each with their bow trait, 6 in all. Block with your Battle Wagon. It strikes with 4 (3, +1 for holding the riverbank), enough to drop both Archers.',
      onEnter: (t) => {
        oppDraft(t);
        t.opp({ type: 'attack', unitUids: unitUids(t.state, 1), target: { kind: 'city' } });
      },
      expect: (a, st) => a.type === 'respond' && !a.reactionUid && unitUids(st, 0, 'sumer_wagon').every((u) => a.blockerUids.includes(u)),
      solution: (st) => ({ type: 'respond', blockerUids: unitUids(st, 0, 'sumer_wagon') }),
      hint: 'Choose your Battle Wagon as a blocker, play no reaction, then confirm.',
      highlight: [{ kind: 'unit', cardId: 'sumer_wagon', owner: 'me' }, { kind: 'button', name: 'respond' }],
    },
    draftStep(
      'Both Archers fell. Their 6 Strength broke your Wagon, and the last 3 hit the Walls of Uruk, not your city. Holding earned 1 Momentum. New turn: your Scribes see a Granary on Civilization and Militia on Military. Take at least 1 Civilization card for that Granary.',
      1, 0, 1,
      'Set at least 1 Civilization card, keep every card, then tap Draw.',
      {
        onEnter: (t) => {
          t.opp({ type: 'endTurn' });
          stack(t, 0, 'civ', 'granary');
          stack(t, 0, 'mil', 'militia');
          t.edit((st) => { st.players[0].peek = { civ: 'granary', mil: 'militia' }; });
        },
      },
    ),
    signatureStep(
      'You have 3 Momentum. Rebuild the City, the Sumer Signature, fully repairs all your buildings, ends their Unrest and adds 3 Stability. Restore the walls.',
      'Tap the Signature button: Rebuild the City.',
    ),
    {
      text: 'The Walls of Uruk stand whole again and your Stability rose from 22 to 25. That is Sumer: read the decks, feed the city with canals, and outlast every assault.',
    },
  ],
};

// ------------------------------------------------------------------ Inca

const inca: Lesson = {
  id: 'inca-road',
  civ: 'inca',
  opponent: 'carthage',
  title: 'Road and Terrace',
  summary: 'Shrug off a Carthaginian raid with your storehouses, lay the Qhapaq Ñan, and use Mountain Logistics to strike twice.',
  setup: (t) => {
    t.edit((st) => {
      st.active = 1; // Carthage moves first in this lesson
      const p = st.players[0]; p.progress = 5; p.momentum = 1;
      st.players[1].progress = 3;
      st.log = [{ turn: st.turn, player: null, text: 'Rival (Carthage) moves first.' }];
    });
    t.build(0, 'inca_terraces', 'village');
    stack(t, 0, 'civ', 'inca_road', 'inca_qullqa');
    stack(t, 0, 'mil', 'inca_slingers');
    t.build(1, 'carth_post');
    t.unit(1, 'raiders');
    t.unit(1, 'raiders');
  },
  steps: [
    {
      text: 'Carthage strikes first. Two River Raiders are crossing at your city: 4 Strength, and each Raider that gets through steals 2 Progress. You have no army yet, so the raid will land.',
      onEnter: (t) => t.opp({ type: 'attack', unitUids: unitUids(t.state, 1), target: { kind: 'city' } }),
    },
    {
      text: 'Qullqa Storehouses, the Inca trait, halve the Progress you lose to raids and fallen buildings. Watch: the Raiders should take 4 Progress, but you lose only 2. Let the attack through.',
      expect: (a) => a.type === 'respond' && !a.reactionUid,
      solution: () => ({ type: 'respond', blockerUids: [] }),
      hint: 'You have no blockers. Confirm without blocking.',
      highlight: [{ kind: 'button', name: 'respond' }],
    },
    draftStep(
      'Your city fell to 18 Stability and your Progress to 3. At the start of your turn your Village grew it back to 4. Now refill to 6 cards, choosing blind from both decks. You need growth and a striking force: take at least 2 Civilization and 1 Military.',
      2, 1, 2,
      'Set at least 2 Civilization and 1 Military card, keep every card, then tap Draw.',
      { onEnter: (t) => t.opp({ type: 'endTurn' }) },
    ),
    playStep(
      'You drew the Qhapaq Ñan, the great Andean road. It gives 2 Progress and +1 Prosperity each turn, and your units can attack the turn they are deployed. Lay it.',
      'inca_road',
      'Play Qhapaq Ñan.',
    ),
    playStep(
      'Progress 6 of 8. Qullqa Storehouses give 2 more Progress now and 2 every turn after. Build them and Cusco grows into a kingdom.',
      'inca_qullqa',
      'Play Qullqa Storehouses.',
    ),
    playStep(
      'Kingdom of Cusco, Age II! Stronger cards joined both decks and you gained 2 Momentum. Deploy Slingers. Thanks to the road they can cross at once.',
      'inca_slingers',
      'Play Slingers.',
    ),
    {
      text: 'Carthage’s Raiders are still worn out from their crossing, so they cannot block. Hit the city for Stability, or a building to tear down what feeds Carthage. Send your Slingers at the Tyrian Trading Post: 2 damage against 3 Integrity.',
      expect: (a, st) => isAttackOn(a, st, 'carth_post', ['inca_slingers']),
      solution: (st) => attackBuilding(st, 'carth_post', ['inca_slingers']),
      hint: 'Select your Slingers, then tap the Tyrian Trading Post on the far bank.',
      highlight: [{ kind: 'unit', cardId: 'inca_slingers', owner: 'me' }, { kind: 'building', cardId: 'carth_post', owner: 'opp' }],
    },
    signatureStep(
      'The Trading Post is cracked but standing, and the hit gave you 1 Momentum: 4 now. Mountain Logistics, the Inca Signature, costs 3. It heals and readies all your units, gives +3 Prosperity and draws a card from each deck.',
      'Tap the Signature button: Mountain Logistics.',
    ),
    {
      text: 'Your Slingers are ready again. Finish the Trading Post.',
      expect: (a, st) => isAttackOn(a, st, 'carth_post', ['inca_slingers']),
      solution: (st) => attackBuilding(st, 'carth_post', ['inca_slingers']),
      hint: 'Select your Slingers, then tap the Tyrian Trading Post.',
      highlight: [{ kind: 'unit', cardId: 'inca_slingers', owner: 'me' }, { kind: 'building', cardId: 'carth_post', owner: 'opp' }],
    },
    {
      text: 'The Trading Post falls: Carthage loses 1 Stability, 1 Progress and a Prosperity each turn. That is the Inca: storehouses blunt every raid, and roads carry the army to strike where it hurts.',
    },
  ],
};


// ------------------------------------------------------------------ Norse

const norse: Lesson = {
  id: 'norse-keel',
  civ: 'norse',
  opponent: 'sumer',
  title: 'Keel and Shield Wall',
  summary: 'Land Longship Raiders the turn they are built, plunder Sumer across the river, and finish with a Summer Raid.',
  setup: (t) => {
    t.edit((st) => { st.phase = 'draft'; st.players[0].progress = 7; st.players[0].prosperity = 6; st.players[1].progress = 5; });
    stack(t, 0, 'civ', 'norse_fishing');
    stack(t, 0, 'mil', 'norse_raiders');
    t.build(1, 'farm', 'sumer_reeds');
  },
  steps: [
    {
      text: 'The Norse hold the near bank; Sumer’s farms and reed houses lie across the river, with nobody guarding them. The Norse win by speed: Longship Raiders are Swift, so they sail the turn they are built, and your trait, Longships, lets Raiders that get through carry off 1 Prosperity as plunder.',
    },
    draftStep(
      'Refill your hand to 6, choosing blind from each deck. You want growth and a ship: take at least 1 of each.',
      1, 1, 2,
      'Set at least 1 Civilization and 1 Military card, keep every card, then tap Draw.',
    ),
    playStep(
      'Your Age bar stands at 7 of 8. Fishing Grounds cost 1 Prosperity, give +1 Progress and make 2 Food every turn: food for your people and your crews. Build them.',
      'norse_fishing',
      'Play Fishing Grounds.',
    ),
    playStep(
      'Market Towns, Age II: stronger cards joined your decks and you gained 2 Momentum. Now launch Longship Raiders. Most units must wait a turn after they are built; yours can sail at once.',
      'norse_raiders',
      'Play Longship Raiders.',
    ),
    {
      text: 'Sumer’s bank is empty. Send the Raiders across at Sumer’s city.',
      expect: (a, st) => a.type === 'attack' && a.target.kind === 'city' && unitUids(st, 0, 'norse_raiders').every((u) => a.unitUids.includes(u)),
      solution: (st) => ({ type: 'attack', unitUids: unitUids(st, 0, 'norse_raiders'), target: { kind: 'city' } }),
      hint: 'Select your Longship Raiders, then tap Attack their city.',
      highlight: [{ kind: 'unit', cardId: 'norse_raiders', owner: 'me' }, { kind: 'button', name: 'attackCity' }],
    },
    {
      text: 'The raid got through: Sumer lost 2 Stability, 2 Progress to your Raiders, and 1 Prosperity in plunder that is now yours. The hit also earned you 1 Momentum, so you have 3.',
    },
    signatureStep(
      'Summer Raid, the Norse Signature, costs 3 Momentum: the rival loses 2 Progress and you gain 2 Prosperity. Use it while their bank is open.',
      'Tap the Signature button: Summer Raid.',
    ),
    endTurnStep('End your turn. Fast raids leave your own bank thin, so watch what Sumer does with its turn.'),
    draftStep(
      'Sumer built Reed Houses and guarded nothing. That is the Norse rhythm: strike, plunder, and grow on what you take. Later Ages bring Shield-Wall Freemen to hold your shore, Huscarls, and the Trelleborg ring fortress. Pick your cards.',
      0, 0, 1,
      'Pick any mix and tap Draw.',
      {
        onEnter: (t) => {
          oppDraft(t);
          oppPlay(t, 'sumer_reeds');
          t.opp({ type: 'endTurn' });
        },
      },
    ),
    {
      text: 'Raiders are fragile (2 Strength) and archers beat them. Pick your targets where the rival is weak, probe for hidden traps with a single ship, and keep enough Fishing Grounds to feed your crews.',
    },
  ],
};

export const LESSONS: Lesson[] = [kush, aksum, carthage, sumer, inca, norse];
