import { getCard, getCiv, type Action, type CivId, type GameState } from '@pm/engine';
import { buildingUid, handUid, isPlay, unitUids, type Lesson, type Step, type TutorApi } from './tutorial';

/*
 * The three layers of the game, taught for every civilization with its own
 * cards: Build (food, people and work), Army (who beats whom, mixed and
 * massed) and Mischief (traps, probes). Generated from small per-civ tables
 * so every civilization gets all three.
 */

const FARM: Record<CivId, string> = { kush: 'kush_cattle', aksum: 'aksum_fields', carthage: 'farm', sumer: 'farm', inca: 'inca_terraces', norse: 'norse_fishing' };
const ARCHER: Record<CivId, string> = { kush: 'kush_archers', aksum: 'archers', carthage: 'archers', sumer: 'archers', inca: 'inca_slingers', norse: 'archers' };
const RIVAL: Record<CivId, CivId> = { kush: 'carthage', aksum: 'carthage', carthage: 'sumer', sumer: 'carthage', inca: 'carthage', norse: 'carthage' };
const RIDER: Record<CivId, string> = { kush: 'carth_cavalry', aksum: 'carth_cavalry', carthage: 'sumer_wagon', sumer: 'carth_cavalry', inca: 'carth_cavalry', norse: 'carth_cavalry' };
const name = (id: string) => getCard(id).name;
const civName = (c: CivId) => getCiv(c).name;

const need = (st: GameState) => Math.max(0, 6 - st.players[0].hand.length);
function oppDraft(t: TutorApi) {
  const n = Math.max(0, 6 - t.state.players[1].hand.length);
  t.opp({ type: 'draft', civ: Math.ceil(n / 2), mil: Math.floor(n / 2) });
}

const play = (text: string, cardId: string, extra: Partial<Step> = {}): Step => ({
  text,
  expect: (a, st) => isPlay(a, st, cardId),
  solution: (st) => ({ type: 'play', uid: handUid(st, 0, cardId) }),
  hint: `Play ${name(cardId)} from your hand.`,
  highlight: [{ kind: 'hand', cardId }],
  ...extra,
});
const endTurn = (text: string, extra: Partial<Step> = {}): Step => ({
  text,
  expect: (a) => a.type === 'endTurn',
  solution: () => ({ type: 'endTurn' }),
  hint: 'Tap End turn.',
  highlight: [{ kind: 'button', name: 'endTurn' }],
  ...extra,
});
const respondNone = (text: string, extra: Partial<Step> = {}): Step => ({
  text,
  expect: (a) => a.type === 'respond' && !a.reactionUid,
  solution: () => ({ type: 'respond', blockerUids: [] }),
  hint: 'Tap Done without choosing a reaction.',
  highlight: [{ kind: 'button', name: 'respond' }],
  ...extra,
});
const draft = (text: string, extra: Partial<Step> = {}): Step => ({
  text,
  expect: (a) => a.type === 'draft' && !(a.discard?.length),
  solution: (st) => { const n = need(st); return { type: 'draft', civ: Math.ceil(n / 2), mil: Math.floor(n / 2) }; },
  hint: 'Pick any mix and tap Draw.',
  highlight: [{ kind: 'button', name: 'draft' }],
  ...extra,
});

// ------------------------------------------------------------------ Build: food, people and work

function buildLesson(civ: CivId): Lesson {
  const farm = FARM[civ];
  return {
    id: `${civ}-build`,
    civ,
    opponent: RIVAL[civ],
    title: `${civName(civ)}: building a city`,
    summary: 'Farms feed Villages, Villages give Workers, workplaces need Workers. See why the mix matters, and why one Farm feeding everything is a risk.',
    setup: (t) => {
      t.edit((st) => { st.players[0].prosperity = 12; st.players[1].prosperity = 10; });
      t.give(0, 'village', 'village', farm, 'quarry');
      t.unit(1, 'spearmen');
    },
    steps: [
      {
        text: 'A city is a chain. Farms make Food. Villages eat Food and give Workers and Progress. Workplaces such as Quarries, Markets and Temples need a Worker each. Your land alone makes 1 Food, and your city has 1 Worker per Age. The Food and Workers chip on your bar shows what is spare; tap it any time to open the city ledger.',
      },
      play('Build a Village. It eats 1 Food (your land’s) and gives a Worker and +1 Progress each turn. Before you play any building, the card shows what it will do for your city.', 'village'),
      play('Now build the second Village. Watch the card’s preview: there is no Food left for it.', 'village'),
      {
        text: 'The second Village is hungry: dimmed, with a Food flag. It gives no Worker and no Progress until something feeds it. Two Villages and no Farm grows nothing extra.',
        highlight: [{ kind: 'building', cardId: 'village', owner: 'me' }],
      },
      play(`Build ${name(farm)}. It makes 2 Food: both Villages eat, and 1 is spare. Spare Food sells for 1 Prosperity at the start of your turn, or feeds a soldier.`, farm),
      play('You have Workers to spare. Build a Quarry: it needs one Worker and makes Prosperity. A working Farm, a fed Village and a staffed workplace together make a complete settlement: +1 Progress every turn.', 'quarry'),
      {
        text: 'One settlement. Compare two layouts: two Farms and one Village is rich in Food (room for an army) but grows slowly. One Farm and two Villages grows fast but has no Food to spare. Three of the same building is a specialty: three Farms make a Breadbasket (+1 Food each), three Villages a Crowded City (+1 Progress), three Quarries a Stone City. Strong, but easy to break.',
      },
      endTurn('Now see the risk of one Farm feeding everything. End your turn.'),
      respondNone(`${civName(RIVAL[civ])} sets fire to your ${name(farm)}. You have no answer in hand this time; tap Done and watch.`, {
        onEnter: (t) => {
          oppDraft(t);
          // The fire is set to take this Farm down whatever its Integrity.
          t.edit((st) => { const b = st.players[0].buildings.find((x) => x.cardId === farm); if (b) b.damage = Math.max(0, (getCard(farm).integrity ?? 3) - 3); });
          t.give(1, 'arson');
          const hand = t.state.players[1].hand;
          t.opp({ type: 'play', uid: hand[hand.length - 1].uid, targetUid: buildingUid(t.state, 0, farm) });
        },
      }),
      {
        text: 'The Farm is gone, so one Village goes hungry: it stops giving a Worker and Progress, and your Quarry may stand idle with nobody to run it. Burning one Farm stopped a whole chain. Spread your Farms, keep a Granary, or hide a trap under the Farm you cannot lose.',
        onEnter: (t) => t.opp({ type: 'endTurn' }),
      },
    ],
  };
}

// ------------------------------------------------------------------ Army: who beats whom

function armyLesson(civ: CivId): Lesson {
  const archer = ARCHER[civ], rider = RIDER[civ];
  return {
    id: `${civ}-army`,
    civ,
    opponent: RIVAL[civ],
    title: `${civName(civ)}: who beats whom`,
    summary: 'Spears stop riders, riders run down archers, archers cut down spears. Block with the right soldiers, then attack with a mixed army.',
    setup: (t) => {
      t.edit((st) => { st.players[0].prosperity = 8; });
      t.build(0, FARM[civ], 'farm');
      t.unit(0, 'eliteGuard');
      t.unit(0, archer);
      t.unit(0, 'militia');
      t.unit(1, rider);
    },
    steps: [
      {
        text: `Every soldier has a role, shown on its card. A soldier facing a role it beats fights with +2 Strength. Spears beat riders. Riders beat archers and shields. Archers beat spears. ${civName(RIVAL[civ])} has ${name(rider)} across the river: a rider.`,
        highlight: [{ kind: 'unit', cardId: rider, owner: 'opp' }],
      },
      endTurn('Keep your soldiers home and end your turn. The riders are coming.'),
      {
        text: `${name(rider)} crosses at your city. Block with your Elite Guard: they are spears, and spears beat riders, so they fight with +2, and +1 more for holding the riverbank. Your ${name(archer)} would be the wrong choice: riders beat archers.`,
        onEnter: (t) => {
          oppDraft(t);
          t.opp({ type: 'attack', unitUids: unitUids(t.state, 1), target: { kind: 'city' } });
        },
        expect: (a, st) => a.type === 'respond' && unitUids(st, 0, 'eliteGuard').every((u) => a.blockerUids.includes(u)) && !unitUids(st, 0, archer).some((u) => a.blockerUids.includes(u)),
        solution: (st) => ({ type: 'respond', blockerUids: unitUids(st, 0, 'eliteGuard') }),
        hint: 'Choose only your Elite Guard as blocker, then confirm.',
        highlight: [{ kind: 'unit', cardId: 'eliteGuard', owner: 'me' }, { kind: 'button', name: 'respond' }],
      },
      draft('The right blocker turned the charge. Now it is your turn: pick your cards.', { onEnter: (t) => t.opp({ type: 'endTurn' }) }),
      {
        text: `Their bank is empty. Send all three of your soldiers: Elite Guard (spear), ${name(archer)} (archer) and Militia (shield). Three different roles attacking together is a mixed army: +2 to the whole attack. Three of one role would be a massed formation instead: archers loose a volley, spears form a hedgehog, riders charge.`,
        expect: (a, st) => a.type === 'attack' && a.target.kind === 'city' && unitUids(st, 0).every((u) => a.unitUids.includes(u)),
        solution: (st) => ({ type: 'attack', unitUids: unitUids(st, 0), target: { kind: 'city' } }),
        hint: 'Select all three of your soldiers, then tap Attack their city.',
        highlight: [{ kind: 'button', name: 'attackCity' }],
      },
      {
        text: 'Remember the link: soldiers eat Food every turn, after your Villages. Your Food chip shows how many more you can feed. A big army on few Farms starves and deserts, weakest first.',
      },
    ],
  };
}

// ------------------------------------------------------------------ Mischief: traps and probes

function mischiefLesson(civ: CivId): Lesson {
  const farm = FARM[civ];
  return {
    id: `${civ}-mischief`,
    civ,
    opponent: RIVAL[civ],
    title: `${civName(civ)}: traps and probes`,
    summary: 'Hide a spare card under the building the rival wants, then learn to test their ground with a cheap unit before the real attack.',
    setup: (t) => {
      t.edit((st) => { st.players[0].prosperity = 6; });
      t.build(0, farm, 'village');
      t.give(0, 'spearmen');
      t.build(1, 'road', 'market');
      t.unit(1, 'spearmen');
      t.unit(0, 'militia');
      t.unit(0, 'spearmen');
      t.unit(0, 'spearmen');
      t.edit((st) => { for (const u of st.players[0].units) u.ready = false; });
    },
    steps: [
      {
        text: `Any card you do not need can be hidden face-down under one of your buildings or your city, up to 3 in one place. Your rival sees how many you hid, never what or where. If they hit that spot before your next turn, it springs. Soldiers burst out and fight, reactions fire for free, forts become walls, tactics snare the attackers, and Civilization cards brace the building.`,
      },
      {
        text: `${civName(RIVAL[civ])} is eyeing your ${name(farm)}. Tap the Spearmen card in your hand, choose Hide as a trap, and put it under your ${name(farm)}.`,
        expect: (a, st) => a.type === 'tuck' && a.at === buildingUid(st, 0, farm),
        solution: (st) => ({ type: 'tuck', uid: handUid(st, 0, 'spearmen'), at: buildingUid(st, 0, farm) }),
        hint: `Hide the Spearmen under your ${name(farm)}.`,
        highlight: [{ kind: 'hand', cardId: 'spearmen' }, { kind: 'building', cardId: farm, owner: 'me' }],
      },
      endTurn('End your turn and let them come.'),
      respondNone(`Their Spearmen cross at your ${name(farm)}. Do not block: tap Done and let the trap spring.`, {
        onEnter: (t) => {
          oppDraft(t);
          t.opp({ type: 'attack', unitUids: unitUids(t.state, 1), target: { kind: 'building', uid: buildingUid(t.state, 0, farm) } });
        },
      }),
      draft('Your hidden Spearmen burst out of the farm and held it. Now the rival hides a card of their own: their bar shows 1 hidden trap. Where? You cannot know. Pick your cards.', {
        onEnter: (t) => {
          t.edit((st) => { st.players[1].traps.push({ uid: `L${++st.uidCounter}`, cardId: 'ambush', at: buildingUid(st, 1, 'market') }); });
          t.opp({ type: 'endTurn' });
        },
      }),
      {
        text: 'You want their Market. A wise attacker probes first: send only your Militia at the Market. If a trap is there, it springs on the Militia, not on your army.',
        expect: (a, st) => a.type === 'attack' && a.target.kind === 'building' && a.target.uid === buildingUid(st, 1, 'market') && a.unitUids.length === 1 && unitUids(st, 0, 'militia').includes(a.unitUids[0]),
        solution: (st) => ({ type: 'attack', unitUids: unitUids(st, 0, 'militia'), target: { kind: 'building', uid: buildingUid(st, 1, 'market') } }),
        hint: 'Select only your Militia, then tap their Market.',
        highlight: [{ kind: 'unit', cardId: 'militia', owner: 'me' }, { kind: 'building', cardId: 'market', owner: 'opp' }],
        onEnter: (t) => t.edit((st) => { for (const u of st.players[0].units) u.ready = true; }),
      },
      {
        text: 'An Ambush was waiting: it cost you one Militia, and now it is spent. Send both Spearmen at the Market: the coast is clear.',
        expect: (a, st) => a.type === 'attack' && a.target.kind === 'building' && a.target.uid === buildingUid(st, 1, 'market') && unitUids(st, 0, 'spearmen').every((u) => a.unitUids.includes(u)),
        solution: (st): Action => ({ type: 'attack', unitUids: unitUids(st, 0, 'spearmen'), target: { kind: 'building', uid: buildingUid(st, 1, 'market') } }),
        hint: 'Select both Spearmen, then tap their Market.',
        highlight: [{ kind: 'unit', cardId: 'spearmen', owner: 'me' }, { kind: 'building', cardId: 'market', owner: 'opp' }],
      },
      {
        text: 'Probe, then strike. On defence, spread your traps or bluff with a single card so one probe cannot clear them all.',
      },
    ],
  };
}

const CIVS_ORDER: CivId[] = ['kush', 'aksum', 'carthage', 'sumer', 'inca', 'norse'];
export const LAYER_LESSONS: Lesson[] = CIVS_ORDER.flatMap((c) => [buildLesson(c), armyLesson(c), mischiefLesson(c)]);
