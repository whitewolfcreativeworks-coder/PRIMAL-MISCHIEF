import { describe, expect, it } from 'vitest';
import {
  actingPlayer, applyAction, chooseAction, CIVS, createGame, getCard, getCiv, HIDDEN_CARD, incomeOf, progressNeeded,
  RuleError, validateData, viewFor, workingBuildings, cityLedger, type CivId, type GameState, type PlayerId,
} from '../src/index';
import { playOut } from './simulate';

// ---------------------------------------------------------------- helpers

function fresh(a: CivId = 'kush', b: CivId = 'sumer', seed = 42): GameState {
  return createGame(seed, [{ name: 'Ana', civ: a }, { name: 'Bo', civ: b }], 0).state;
}
/** Skip the draft and give player 0 plenty of Prosperity. */
function ready(st: GameState, prosperity = 20): GameState {
  st.phase = 'main';
  st.players[0].prosperity = prosperity;
  return st;
}
let n = 1000;
function give(st: GameState, pid: PlayerId, cardId: string): string { const uid = `x${n++}`; st.players[pid].hand.push({ uid, cardId }); return uid; }
function build(st: GameState, pid: PlayerId, cardId: string): string { const uid = `b${n++}`; st.players[pid].buildings.push({ uid, cardId, damage: 0, bonusIntegrity: 0, unrest: 0 }); return uid; }
function unit(st: GameState, pid: PlayerId, cardId: string, isReady = true): string { const uid = `u${n++}`; st.players[pid].units.push({ uid, cardId, damage: 0, ready: isReady, attacked: false, blocked: false, buff: 0 }); return uid; }
/** End player 0's turn and auto-draft for player 1, returning to a state where player 1 is in main. */
function attackAndResolve(st: GameState, attackers: string[], target: { kind: 'city' } | { kind: 'building'; uid: string }, respond: { reactionUid?: string; blockerUids: string[] } = { blockerUids: [] }) {
  const s = applyAction(st, 0, { type: 'attack', unitUids: attackers, target }).state;
  return applyAction(s, 1, { type: 'respond', ...respond });
}

// ---------------------------------------------------------------- data & setup

describe('data', () => {
  it('every civilization deck is valid', () => expect(validateData()).toEqual([]));
  it('every civilization has its own card in every Age of both decks', () => {
    for (const c of CIVS) for (const f of ['civ', 'mil'] as const) c.decks[f].forEach((tier) => expect(tier.some((id) => getCard(id).civ === c.id)).toBe(true));
  });
});

describe('setup and draft', () => {
  it('starts in the draft with empty hands and compensates the second player', () => {
    const st = fresh();
    expect(st.phase).toBe('draft');
    expect(st.players[0].hand.length).toBe(0);
    expect(st.players[0].prosperity).toBe(4); // 3 base + 1 spare Food from the land, sold
    expect(st.players[1].prosperity).toBe(1);
    expect(st.players[1].momentum).toBe(1);
    expect(st.players[0].piles.civ.every((c) => getCard(c.cardId).age === 1)).toBe(true);
  });
  it('picks any mix of the two decks, blind, up to six', () => {
    let st = fresh();
    expect(() => applyAction(st, 0, { type: 'play', uid: 'x' })).toThrow(/Pick your cards/);
    expect(() => applyAction(st, 0, { type: 'draft', civ: 2, mil: 2 })).toThrow(/exactly 6/);
    st = applyAction(st, 0, { type: 'draft', civ: 5, mil: 1 }).state;
    expect(st.phase).toBe('main');
    const fams = st.players[0].hand.map((c) => getCard(c.cardId).family);
    expect(fams.filter((f) => f === 'civ').length).toBe(5);
    expect(fams.filter((f) => f === 'mil').length).toBe(1);
    expect(() => applyAction(st, 0, { type: 'draft', civ: 0, mil: 0 })).toThrow(/already picked/);
  });
  it('can discard before picking, and refills only what is missing', () => {
    let st = applyAction(fresh(), 0, { type: 'draft', civ: 6, mil: 0 }).state;
    st.players[0].hand = st.players[0].hand.slice(0, 4); // as if two were played
    st.phase = 'draft';
    const toss = st.players[0].hand[0].uid;
    st = applyAction(st, 0, { type: 'draft', civ: 0, mil: 3, discard: [toss] }).state;
    expect(st.players[0].hand.length).toBe(6);
    expect(st.players[0].hand.some((c) => c.uid === toss)).toBe(false);
  });
  it('Sumer’s scribes see the top card of each deck, and only they do', () => {
    const st = createGame(3, [{ name: 'S', civ: 'sumer' }, { name: 'K', civ: 'kush' }], 0).state;
    expect(st.players[0].peek?.civ).toBe(st.players[0].piles.civ[0].cardId);
    expect(viewFor(st, 0).players[0].peek?.mil).toBe(st.players[0].piles.mil[0].cardId);
    expect(viewFor(st, 1).players[0].peek).toBeNull();
    expect(fresh().players[0].peek).toBeNull(); // Kush has no scribes
  });
  it('same seed produces identical games', () => {
    expect(JSON.stringify(playOut(7, 'aksum', 'inca'))).toEqual(JSON.stringify(playOut(7, 'aksum', 'inca')));
  });
});

// ---------------------------------------------------------------- growth

describe('Progress and the five Ages', () => {
  it('Civilization cards add Progress; a full bar advances the Age and strengthens both decks', () => {
    const st = ready(fresh());
    st.players[0].progress = progressNeeded(1) - 1;
    const r = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'festival') }); // +2
    const p = r.state.players[0];
    expect(p.age).toBe(2);
    expect(p.progress).toBe(1); // overflow carries
    expect(p.momentum).toBe(2);
    expect(r.events.some((e) => e.type === 'ageUp' && e.age === 2 && e.name === getCiv('kush').ages[1])).toBe(true);
    expect(p.piles.civ.some((c) => getCard(c.cardId).age === 2)).toBe(true);
    expect(p.piles.mil.some((c) => getCard(c.cardId).age === 2)).toBe(true);
  });
  it('cards two Ages old retire from the decks', () => {
    const st = ready(fresh());
    st.players[0].age = 2;
    st.players[0].progress = progressNeeded(2) - 1;
    const p = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'festival') }).state.players[0];
    expect(p.age).toBe(3);
    expect([...p.piles.civ, ...p.piles.mil].every((c) => getCard(c.cardId).age >= 2)).toBe(true);
  });
  it('completing Age V is a Golden Age victory', () => {
    const st = ready(fresh());
    st.players[0].age = 5;
    st.players[0].progress = progressNeeded(5) - 2;
    const s = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'festival') }).state;
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(s.winReason).toMatch(/Golden Age/);
  });
  it('growth buildings add Progress at the start of each turn', () => {
    const st = ready(fresh());
    build(st, 1, 'village'); build(st, 1, 'temple');
    const s = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(s.players[1].progress).toBe(2);
  });
});

// ---------------------------------------------------------------- economy & structure

describe('economy and structural instability', () => {
  it('the army eats Food after the city; the hungry desert, strongest fed first', () => {
    const st = ready(fresh());
    build(st, 1, 'farm');
    unit(st, 1, 'spearmen'); unit(st, 1, 'grandArmy');
    st.players[1].prosperity = 0;
    // Land 1 + Farm 2 = 3 Food; Grand Army eats 2 and Spearmen 1: all fed, nothing spare.
    expect(incomeOf(st.players[1])).toMatchObject({ prosperity: 3, upkeep: 3, food: 3, foodShort: 0 });
    const s = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(s.players[1].units.length).toBe(2);
    expect(s.players[1].prosperity).toBe(3);
    const st2 = ready(fresh());
    unit(st2, 1, 'grandArmy'); unit(st2, 1, 'grandArmy'); unit(st2, 1, 'spearmen');
    st2.players[1].prosperity = 0;
    // Only the land's 1 Food: both Grand Armies go hungry and desert; the Spearmen eat.
    expect(applyAction(st2, 0, { type: 'endTurn' }).state.players[1].units.map((u) => u.cardId)).toEqual(['spearmen']);
  });
  it('farms feed villages first; fed villages give workers; workplaces need workers', () => {
    const st = ready(fresh());
    const p = st.players[0];
    const v1 = build(st, 0, 'village'), v2 = build(st, 0, 'village');
    // Land 1 Food: one Village eats, the other goes hungry.
    let L = cityLedger(p);
    expect(L.hungry).toEqual([v2]);
    const farm = build(st, 0, 'farm');
    L = cityLedger(p);
    expect(L.hungry).toEqual([]);
    expect(L.forArmy).toBe(1); // 3 Food, 2 eaten
    // Age I: the city itself has 1 Worker, each fed Village 1 more: 3 workplaces can run, the 4th stands idle.
    const q = [0, 1, 2, 3].map(() => build(st, 0, 'quarry'));
    L = cityLedger(p);
    expect(L.workers).toBe(3);
    expect(L.idle.length).toBe(1);
    expect(L.working.has(q[3]) || L.working.has(q[0])).toBe(true);
    void v1; void farm;
  });
  it('a complete settlement earns Progress; three of a kind earns its specialty', () => {
    const st = ready(fresh());
    const p = st.players[0];
    build(st, 0, 'farm'); build(st, 0, 'village'); build(st, 0, 'quarry');
    expect(cityLedger(p).sets).toBe(1);
    expect(incomeOf(p).growth).toBe(1 + 1); // Village +1, one settlement +1
    build(st, 0, 'farm'); build(st, 0, 'farm');
    const L = cityLedger(p);
    expect(L.specialties).toContain('breadbasket');
    expect(L.food).toBe(1 + 3 * 2 + 3); // land + three Farms + Breadbasket
  });
  it('granaries keep spare Food for a hungry turn', () => {
    let st = ready(fresh());
    build(st, 1, 'farm'); build(st, 1, 'granary');
    st = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(st.players[1].stored).toBe(2); // 3 Food, nothing eaten: 2 kept, 1 sold
  });
  it('Unrest on a Road takes the Market that depends on it offline', () => {
    const st = ready(fresh());
    const road = build(st, 1, 'road');
    const market = build(st, 1, 'market');
    let s = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'saboteurs'), targetUid: road }).state;
    const r = applyAction(s, 1, { type: 'respond', blockerUids: [] });
    s = r.state;
    expect(workingBuildings(s.players[1]).has(market)).toBe(false);
    expect(r.events.some((e) => e.type === 'supportLost' && e.uid === market)).toBe(true);
  });
  it('a fallen building costs Stability and Progress; Inca storehouses halve the Progress', () => {
    const st = ready(fresh());
    st.players[1].progress = 5;
    const t = build(st, 1, 'temple'); // Age III card: -3 Progress
    let s = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'arson'), targetUid: t }).state;
    s = applyAction(s, 1, { type: 'respond', blockerUids: [] }).state;
    s = applyAction(s, 0, { type: 'play', uid: give(s, 0, 'arson'), targetUid: t }).state; // temple has 4 integrity: second arson finishes it
    const r = applyAction(s, 1, { type: 'respond', blockerUids: [] });
    expect(r.state.players[1].progress).toBe(2);
    expect(r.state.players[1].stability).toBe(21);
    const inca = ready(fresh('kush', 'inca'));
    inca.players[1].progress = 5;
    const t2 = build(inca, 1, 'farm'); // Age I: -1 Progress, halved to 0
    const s2 = attackAndResolve(inca, [unit(inca, 0, 'eliteGuard')], { kind: 'building', uid: t2 }).state;
    expect(s2.players[1].buildings.length).toBe(0);
    expect(s2.players[1].progress).toBe(5);
  });
});

// ---------------------------------------------------------------- combat

describe('combat across the river', () => {
  it('unblocked attacks hit the city and earn Momentum', () => {
    const st = ready(fresh());
    const s = attackAndResolve(st, [unit(st, 0, 'spearmen'), unit(st, 0, 'spearmen')], { kind: 'city' }).state;
    expect(s.players[1].stability).toBe(18);
    expect(s.players[0].momentum).toBe(1);
  });
  it('blockers hold the riverbank with +1 Strength', () => {
    const st = ready(fresh());
    const a = unit(st, 0, 'spearmen');
    const d = unit(st, 1, 'militia'); // 1 str +1 riverbank = 2: kills nothing (spearmen hp 3) — but 2 dmg lands
    const r = attackAndResolve(st, [a], { kind: 'city' }, { blockerUids: [d] });
    const c = r.events.find((e) => e.type === 'combat')!;
    expect(r.state.players[0].units[0].damage).toBe(2);
    expect(c.type === 'combat' && c.dealt).toBe(0); // militia hp 2 absorbs all but... spearmen str 2 kills militia exactly, nothing left over
  });
  it('towers and walls protect the city', () => {
    const st = ready(fresh());
    build(st, 1, 'watchtower');
    const w = build(st, 1, 'walls');
    const r = attackAndResolve(st, [unit(st, 0, 'eliteGuard')], { kind: 'city' });
    const s = r.state;
    expect(s.players[1].stability).toBe(22);
    expect(s.players[1].buildings.find((b) => b.uid === w)!.damage).toBe(4);
    expect(r.events.find((e) => e.type === 'combat')).toMatchObject({ towerHits: 1, wallAbsorbed: 4 });
  });
  it('raiders steal Progress when they get through', () => {
    const st = ready(fresh());
    st.players[1].progress = 6;
    const r = attackAndResolve(st, [unit(st, 0, 'raiders')], { kind: 'city' });
    expect(r.state.players[1].progress).toBe(4);
    expect(r.events.find((e) => e.type === 'combat')).toMatchObject({ progressRaided: 2 });
  });
  it('the combat event names exactly who fell, and to what', () => {
    const st = ready(fresh());
    build(st, 1, 'watchtower');
    const a1 = unit(st, 0, 'militia'), a2 = unit(st, 0, 'eliteGuard');
    const d = unit(st, 1, 'militia');
    st.players[1].prosperity = 5;
    const amb = give(st, 1, 'ambush');
    const r = attackAndResolve(st, [a1, a2], { kind: 'city' }, { reactionUid: amb, blockerUids: [d] });
    const c = r.events.find((e) => e.type === 'combat');
    expect(c && c.type === 'combat' && c.attackerFates[0]).toBe('ambush'); // militia (hp 2): the tower's arrow wounds it, the ambush finishes it
    if (!c || c.type !== 'combat') throw new Error('no combat');
    expect(c.attackerFates.length).toBe(2);
    expect(c.attackerFates.filter(Boolean).length).toBe(c.attackersLost);
    expect(c.blockerFates.filter(Boolean).length).toBe(c.blockersLost);
  });
  it('exhausted attackers cannot block on the next turn', () => {
    let st = ready(fresh());
    const a = unit(st, 0, 'spearmen');
    st = attackAndResolve(st, [a], { kind: 'city' }).state;
    st = applyAction(st, 0, { type: 'endTurn' }).state;
    st = applyAction(st, 1, { type: 'draft', civ: 6, mil: 0 }).state;
    const e = unit(st, 1, 'militia');
    const s = applyAction(st, 1, { type: 'attack', unitUids: [e], target: { kind: 'city' } }).state;
    expect(() => applyAction(s, 0, { type: 'respond', blockerUids: [a] })).toThrow(/exhausted/);
  });
});

describe('roles, matchups and formations', () => {
  const fight = (atk: string[], blk: string[]) => {
    const st = ready(fresh());
    const a = atk.map((c) => unit(st, 0, c)), b = blk.map((c) => unit(st, 1, c));
    const r = attackAndResolve(st, a, { kind: 'city' }, { blockerUids: b });
    const c = r.events.find((e) => e.type === 'combat');
    if (!c || c.type !== 'combat') throw new Error('no combat');
    return { c, st: r.state };
  };
  it('a unit facing a role it beats fights with +2', () => {
    // Numidian Horse (rider, 3) into Archers (archer): +2. Spearmen (spear) into the horse: +2 back.
    expect(fight(['carth_cavalry'], ['archers']).c).toMatchObject({ power: 5, tactics: { attackerMatch: 1, blockerMatch: 0 } });
    expect(fight(['carth_cavalry'], ['spearmen']).c).toMatchObject({ power: 3, tactics: { attackerMatch: 0, blockerMatch: 1 } });
  });
  it('a mixed army of three roles gets +2; no matchups against an empty bank', () => {
    const { c } = fight(['spearmen', 'archers', 'carth_cavalry'], []);
    expect(c.tactics).toMatchObject({ mixed: true, attackerMatch: 0 });
    expect(c.power).toBe(2 + 3 + 3 + 2); // Kush bowmen make the archers 3
  });
  it('massed archers loose a volley before the clash', () => {
    const { c } = fight(['archers', 'archers', 'kush_archers'], ['militia']);
    expect(c.tactics).toMatchObject({ attackerMassed: 'archer', volley: { attacker: 1, blocker: 0 } });
  });
  it('every unit has a role; the Inca have no riders', () => {
    expect(validateData()).toEqual([]);
    for (const id of getCiv('inca').decks.mil.flat()) if (getCard(id).kind === 'unit') expect(getCard(id).role).not.toBe('rider');
  });
});

describe('reactions and reversals', () => {
  it('Feigned Retreat and Treaty cancel an attack', () => {
    const st = ready(fresh());
    st.players[1].prosperity = 5;
    const fr = give(st, 1, 'feignedRetreat');
    const s = attackAndResolve(st, [unit(st, 0, 'spearmen')], { kind: 'city' }, { reactionUid: fr, blockerUids: [] }).state;
    expect(s.players[1].stability).toBe(22);
    const st2 = ready(fresh('kush', 'aksum'));
    st2.players[1].prosperity = 5;
    st2.players[0].prosperity = 0;
    const tr = give(st2, 1, 'aksum_treaty');
    const s2 = attackAndResolve(st2, [unit(st2, 0, 'spearmen')], { kind: 'city' }, { reactionUid: tr, blockerUids: [] }).state;
    expect(s2.players[1].stability).toBe(22);
    expect(s2.players[0].prosperity).toBe(3);
  });
  it('Turn the Tide sends excess damage back across the river', () => {
    const st = ready(fresh());
    const a = unit(st, 0, 'militia');
    const d1 = unit(st, 1, 'spearmen'), d2 = unit(st, 1, 'spearmen');
    st.players[1].prosperity = 5;
    const tide = give(st, 1, 'turnTheTide');
    const s = attackAndResolve(st, [a], { kind: 'city' }, { reactionUid: tide, blockerUids: [d1, d2] }).state;
    // blockers (2+1)+(2+1)=6, doubled = 12; militia hp 2; 10 crashes back.
    expect(s.players[0].stability).toBe(12);
  });
  it('Mirror the Scheme turns sabotage on its caster; Vigilant Watch foils it', () => {
    const st = ready(fresh());
    st.players[0].progress = 5;
    st.players[1].progress = 5;
    st.players[1].prosperity = 5;
    const m = give(st, 1, 'mirror');
    let s = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'raidStores') }).state;
    const r = applyAction(s, 1, { type: 'respond', reactionUid: m, blockerUids: [] });
    expect(r.state.players[1].progress).toBe(5);
    expect(r.state.players[0].progress).toBe(2);
    expect(r.events.some((e) => e.type === 'reversed')).toBe(true);
    const st2 = ready(fresh());
    st2.players[1].prosperity = 5;
    const w = give(st2, 1, 'vigilantWatch');
    s = applyAction(st2, 0, { type: 'play', uid: give(st2, 0, 'sack') }).state;
    expect(applyAction(s, 1, { type: 'respond', reactionUid: w, blockerUids: [] }).state.players[1].stability).toBe(22);
  });
  it('a reaction cannot answer the wrong kind of threat', () => {
    const st = ready(fresh());
    st.players[1].prosperity = 5;
    const w = give(st, 1, 'vigilantWatch');
    const s = applyAction(st, 0, { type: 'attack', unitUids: [unit(st, 0, 'spearmen')], target: { kind: 'city' } }).state;
    expect(() => applyAction(s, 1, { type: 'respond', reactionUid: w, blockerUids: [] })).toThrow(/cannot answer/);
  });
});

describe('hidden traps', () => {
  const trapAt = (st: GameState, pid: PlayerId, cardId: string, at: string) => { const uid = `t${n++}`.replace('t', 'k'); st.players[pid].traps.push({ uid, cardId, at }); return uid; };
  it('tucks a card from hand under a building or the city, up to three per spot', () => {
    let st = ready(fresh());
    const farm = build(st, 0, 'farm');
    const cards = [0, 1, 2, 3].map(() => give(st, 0, 'militia'));
    for (const c of cards.slice(0, 3)) st = applyAction(st, 0, { type: 'tuck', uid: c, at: farm }).state;
    expect(() => applyAction(st, 0, { type: 'tuck', uid: cards[3], at: farm })).toThrow(/At most 3/);
    expect(() => applyAction(st, 0, { type: 'tuck', uid: cards[3], at: 'nowhere' })).toThrow(/buildings or your city/);
    st = applyAction(st, 0, { type: 'tuck', uid: cards[3], at: 'city' }).state;
    expect(st.players[0].traps.length).toBe(4);
    expect(st.players[0].hand.some((c) => cards.includes(c.uid))).toBe(false);
  });
  it('the rival sees how many traps, never which or where — and the log does not tell', () => {
    let st = ready(fresh());
    const farm = build(st, 0, 'farm');
    const r = applyAction(st, 0, { type: 'tuck', uid: give(st, 0, 'ambush'), at: farm });
    st = r.state;
    const v = viewFor(st, 1);
    expect(v.players[0].traps).toEqual([{ uid: 'x0-0', cardId: HIDDEN_CARD, at: HIDDEN_CARD }]);
    expect(viewFor(st, 0).players[0].traps[0].cardId).toBe('ambush');
    expect(JSON.stringify(r.events)).not.toMatch(/ambush|farm/);
    expect(st.log.at(-1)!.text).not.toMatch(/Ambush|Farm/);
  });
  it('a garrison bursts out and fights, then leaves; a snare hits every attacker; braces soak damage', () => {
    const st = ready(fresh());
    trapAt(st, 1, 'spearmen', 'city');
    trapAt(st, 1, 'arson', 'city');
    trapAt(st, 1, 'farm', 'city'); // Age I civ card: braces 2
    const a1 = unit(st, 0, 'eliteGuard'), a2 = unit(st, 0, 'militia');
    const r = attackAndResolve(st, [a1, a2], { kind: 'city' });
    const c = r.events.find((e) => e.type === 'combat');
    if (!c || c.type !== 'combat') throw new Error('no combat');
    expect(r.events.some((e) => e.type === 'trapSprung')).toBe(true);
    expect(c.trap!.roles.sort()).toEqual(['brace', 'garrison', 'snare']);
    expect(c.trap!.snare).toBe(1);
    expect(c.blockerCards).toEqual(['spearmen']);
    expect(c.blockerFromTrap).toEqual([true]);
    expect(r.state.players[1].traps.length).toBe(0);
    expect(r.state.players[1].units.length).toBe(0); // the garrison left the field
    // Militia (hp 2) dies to the snare + garrison; Elite Guard (4 str) kills the 3-str... whatever gets through is braced by 2
    expect(c.attackerFates[1]).not.toBeNull();
    expect(r.state.players[1].stability).toBe(22 - c.dealt);
  });
  it('trap reactions fire for free; a trap Feigned Retreat calls the attack off', () => {
    const st = ready(fresh());
    trapAt(st, 1, 'feignedRetreat', 'city');
    st.players[1].prosperity = 0;
    const r = attackAndResolve(st, [unit(st, 0, 'spearmen')], { kind: 'city' });
    const c = r.events.find((e) => e.type === 'combat');
    expect(c).toMatchObject({ cancelled: true, reaction: 'feignedRetreat' });
    expect(r.state.players[1].stability).toBe(22);
  });
  it('traps only spring where the attack lands, and unsprung ones return to the decks', () => {
    let st = ready(fresh());
    const farm = build(st, 1, 'farm');
    trapAt(st, 1, 'ambush', farm);
    st = attackAndResolve(st, [unit(st, 0, 'spearmen')], { kind: 'city' }).state;
    expect(st.players[1].traps.length).toBe(1);
    const pile = st.players[1].piles.mil.length;
    st = applyAction(st, 0, { type: 'endTurn' }).state; // player 1's turn: their own traps come home
    expect(st.players[1].traps.length).toBe(0);
    expect(st.players[1].piles.mil.length).toBe(pile + 1);
  });
  it('a probe sets off the traps so the main attack walks in clean', () => {
    let st = ready(fresh());
    const farm = build(st, 1, 'farm');
    trapAt(st, 1, 'spearmen', farm); trapAt(st, 1, 'ambush', farm);
    const probe = unit(st, 0, 'militia'), main = unit(st, 0, 'eliteGuard');
    st = attackAndResolve(st, [probe], { kind: 'building', uid: farm }).state;
    expect(st.players[1].traps.length).toBe(0);
    expect(st.struck).toEqual([farm]);
    const r = attackAndResolve(st, [main], { kind: 'building', uid: farm });
    const c = r.events.find((e) => e.type === 'combat');
    expect(c).toMatchObject({ trap: null, targetDestroyed: true });
  });
  it('traps catch schemes: soldiers foil Arson, a Mirror sends it home, a brace soaks it', () => {
    const scheme = (trapCard: string) => {
      const st = ready(fresh());
      const temple = build(st, 1, 'temple');
      build(st, 0, 'market');
      trapAt(st, 1, trapCard, temple);
      const s = applyAction(st, 0, { type: 'play', uid: give(st, 0, 'arson'), targetUid: temple }).state;
      return applyAction(s, 1, { type: 'respond', blockerUids: [] });
    };
    expect(scheme('militia').events.find((e) => e.type === 'scheme')).toMatchObject({ outcome: 'foiled' });
    expect(scheme('mirror').events.find((e) => e.type === 'scheme')).toMatchObject({ outcome: 'mirrored' });
    const braced = scheme('palace'); // Age IV: braces 5 — Arson's 3 is fully soaked
    expect(braced.events.find((e) => e.type === 'scheme')).toMatchObject({ outcome: 'hit', trap: { absorbed: 3 } });
    expect(braced.state.players[1].buildings[0].damage).toBe(0);
  });
  it('the AI never peeks at hidden traps', () => {
    const st = ready(fresh());
    trapAt(st, 1, 'ambush', 'city');
    const masked = viewFor(st, 0);
    expect(masked.players[1].traps[0].cardId).toBe(HIDDEN_CARD);
  });
});

describe('civilization traits', () => {
  it('Kush archers hit harder; Carthage deploys units cheaper; Aksum harbors trade', () => {
    const k = ready(fresh('kush', 'sumer'));
    const archer = unit(k, 0, 'archers');
    const s = attackAndResolve(k, [archer], { kind: 'city' }).state;
    expect(s.players[1].stability).toBe(19);
    const c = ready(fresh('carthage', 'sumer'), 3);
    expect(applyAction(c, 0, { type: 'play', uid: give(c, 0, 'eliteGuard') }).state.players[0].prosperity).toBe(0); // 4 - 1 = 3
    const kk = ready(fresh('kush', 'sumer'), 3);
    expect(() => applyAction(kk, 0, { type: 'play', uid: give(kk, 0, 'eliteGuard') })).toThrow(/Prosperity/);
    const a = fresh('aksum', 'kush');
    build(a, 0, 'aksum_adulis');
    expect(incomeOf(a.players[0]).prosperity).toBe(3 + 1 + 1 + 1); // base + Adulis + trade + spare Food
  });
});

describe('victory and hidden information', () => {
  it('conquest when Stability reaches zero', () => {
    const st = ready(fresh());
    st.players[1].stability = 2;
    const s = attackAndResolve(st, [unit(st, 0, 'spearmen')], { kind: 'city' }).state;
    expect(s.winner).toBe(0);
    expect(() => applyAction(s, 0, { type: 'endTurn' })).toThrow(RuleError);
  });
  it('views hide piles and the opponent hand', () => {
    const st = applyAction(fresh(), 0, { type: 'draft', civ: 3, mil: 3 }).state;
    const v = viewFor(st, 1);
    expect(v.players[0].hand.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    expect(v.players[0].piles.civ.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    expect(v.players[0].piles.civ.length).toBe(st.players[0].piles.civ.length);
    expect(viewFor(st, 0).players[0].hand.every((c) => c.cardId !== HIDDEN_CARD)).toBe(true);
  });
  it('the AI always plays legal moves and every match ends', () => {
    for (let i = 0; i < 6; i++) {
      const civs = CIVS.map((c) => c.id);
      const st = playOut(300 + i, civs[i % 5], civs[(i + 2) % 5], i % 3 === 0 ? 'hard' : i % 3 === 1 ? 'easy' : 'normal');
      expect(st.phase).toBe('over');
    }
    let st = createGame(99, [{ name: 'A', civ: 'carthage' }, { name: 'B', civ: 'aksum' }]).state;
    for (let i = 0; i < 1500 && st.phase !== 'over'; i++) {
      const pid = actingPlayer(st)!;
      st = applyAction(st, pid, chooseAction(viewFor(st, pid), pid, 'normal')).state; // decides from its own view only
    }
    expect(st.phase).toBe('over');
  }, 60_000);
});
