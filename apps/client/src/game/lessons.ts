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
      text: 'Both attackers fell and your city is untouched. Repelling attacks and playing reactions earns Momentum. Your rival ends their turn…',
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

export const LESSONS: Lesson[] = [kush];
