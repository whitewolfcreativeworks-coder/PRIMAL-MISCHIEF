import { describe, expect, it } from 'vitest';
import {
  actingPlayer, applyAction, chooseAction, CIVS, createGame, getCard, incomeOf, RuleError, validateDeck,
  viewFor, workingBuildings, HIDDEN_CARD, type GameState, type PlayerId,
} from '../src/index';
import { playOut } from './simulate';

// ---------------------------------------------------------------- helpers

function fresh(seed = 42): GameState {
  return createGame(seed, [{ name: 'Ana', civ: 'kush' }, { name: 'Bo', civ: 'sumer' }], 0).state;
}

let uidN = 1000;
/** Put a specific card into a player's hand for a test. */
function give(st: GameState, pid: PlayerId, cardId: string): string {
  const uid = `x${uidN++}`;
  st.players[pid].hand.push({ uid, cardId });
  return uid;
}
function build(st: GameState, pid: PlayerId, cardId: string): string {
  const uid = `b${uidN++}`;
  st.players[pid].buildings.push({ uid, cardId, damage: 0, bonusIntegrity: 0, unrest: 0 });
  return uid;
}
function unit(st: GameState, pid: PlayerId, cardId: string, ready = true): string {
  const uid = `u${uidN++}`;
  st.players[pid].units.push({ uid, cardId, damage: 0, ready, attacked: false, blocked: false, buff: 0 });
  return uid;
}

// ---------------------------------------------------------------- tests

describe('data', () => {
  it('every starter deck is legal', () => {
    for (const c of CIVS) expect(validateDeck(c.id, c.starterDeck)).toEqual([]);
  });
  it('rejects foreign civ cards, wrong sizes and too many copies', () => {
    const d = [...CIVS[0].starterDeck];
    expect(validateDeck('kush', d.slice(1)).length).toBeGreaterThan(0);
    d[0] = 'sumer_ziggurat';
    expect(validateDeck('kush', d).some((e) => e.includes('another civilization'))).toBe(true);
    const many = Array(24).fill('farm');
    expect(validateDeck('kush', many).some((e) => e.includes('Too many'))).toBe(true);
  });
  it('every card referenced by effects exists', () => {
    for (const c of CIVS) for (const id of c.starterDeck) expect(() => getCard(id)).not.toThrow();
  });
});

describe('setup and determinism', () => {
  it('same seed produces identical games', () => {
    const a = playOut(7, 'aksum', 'inca');
    const b = playOut(7, 'aksum', 'inca');
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });
  it('deals opening hands and compensates the second player', () => {
    const st = fresh();
    expect(st.players[0].hand.length).toBe(5);
    expect(st.players[1].hand.length).toBe(6);
    expect(st.players[1].momentum).toBe(1);
    expect(st.players[0].goods).toBe(3);
  });
});

describe('turn rules', () => {
  it('rejects acting out of turn and unaffordable cards', () => {
    const st = fresh();
    expect(() => applyAction(st, 1, { type: 'endTurn' })).toThrow(RuleError);
    st.players[0].goods = 0;
    const u = give(st, 0, 'temple');
    expect(() => applyAction(st, 0, { type: 'play', uid: u })).toThrow(/Goods/);
  });
  it('reactions cannot be played in the main phase', () => {
    const st = fresh();
    const u = give(st, 0, 'shieldWall');
    expect(() => applyAction(st, 0, { type: 'play', uid: u })).toThrow(/opponent/);
  });
  it('playing two cards of the same suit chains for Momentum', () => {
    const st = fresh();
    st.players[0].goods = 10;
    const a = give(st, 0, 'farm'), b = give(st, 0, 'festival');
    let s = applyAction(st, 0, { type: 'play', uid: a }).state;
    s = applyAction(s, 0, { type: 'play', uid: b }).state;
    expect(s.players[0].momentum).toBe(1);
    // Festival's own chain bonus (+2 Stability) also fired.
    expect(s.players[0].stability).toBe(22);
  });
  it('income arrives at turn start', () => {
    const st = fresh();
    build(st, 1, 'farm'); build(st, 1, 'quarry');
    const s = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(s.active).toBe(1);
    expect(s.players[1].goods).toBe(4); // base 3 + quarry 1
    expect(s.players[1].food).toBe(4); // 2 start + farm 2
  });
});

describe('dependencies (structural instability)', () => {
  it('a destroyed farm takes its barracks and granary offline', () => {
    const st = fresh();
    const farm = build(st, 1, 'farm');
    const barracks = build(st, 1, 'barracks');
    const granary = build(st, 1, 'granary');
    expect(workingBuildings(st.players[1]).has(barracks)).toBe(true);
    st.players[0].goods = 10;
    const arson = give(st, 0, 'arson');
    let s = applyAction(st, 0, { type: 'play', uid: arson, targetUid: farm }).state;
    const r = applyAction(s, 1, { type: 'respond', blockerUids: [] });
    s = r.state;
    expect(s.players[1].buildings.some((b) => b.uid === farm)).toBe(false);
    const w = workingBuildings(s.players[1]);
    expect(w.has(barracks)).toBe(false);
    expect(w.has(granary)).toBe(false);
    expect(r.events.filter((e) => e.type === 'supportLost').length).toBe(2);
    expect(s.players[1].stability).toBe(19); // losing a building shakes the city
  });
  it('unrest disables a building temporarily and then wears off', () => {
    const st = fresh();
    const market = build(st, 1, 'market');
    const road = build(st, 1, 'road');
    st.players[0].goods = 10;
    const sab = give(st, 0, 'saboteurs');
    let s = applyAction(st, 0, { type: 'play', uid: sab, targetUid: road }).state;
    s = applyAction(s, 1, { type: 'respond', blockerUids: [] }).state;
    expect(workingBuildings(s.players[1]).has(market)).toBe(false); // road in unrest -> market unsupported
    // Two of the owner's turns later it is working again.
    for (let i = 0; i < 4; i++) s = applyAction(s, s.active, { type: 'endTurn' }).state;
    expect(workingBuildings(s.players[1]).has(market)).toBe(true);
  });
  it('famine costs stability and deserters unless a granary stands', () => {
    const st = fresh();
    unit(st, 1, 'spearmen'); unit(st, 1, 'spearmen'); unit(st, 1, 'spearmen');
    st.players[1].food = 0;
    let s = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(s.players[1].stability).toBe(18);
    expect(s.players[1].units.length).toBe(2);
    const st2 = fresh();
    unit(st2, 1, 'spearmen'); unit(st2, 1, 'spearmen'); unit(st2, 1, 'spearmen');
    build(st2, 1, 'inca_qullqa');
    st2.players[1].food = 0;
    expect(incomeOf(st2.players[1]).netFood).toBeLessThan(0);
    s = applyAction(st2, 0, { type: 'endTurn' }).state;
    expect(s.players[1].stability).toBe(20);
    expect(s.players[1].units.length).toBe(3);
  });
  it('unpaid mercenaries desert', () => {
    const st = createGame(1, [{ name: 'A', civ: 'sumer' }, { name: 'C', civ: 'carthage' }], 0).state;
    unit(st, 1, 'carth_mercs');
    st.players[1].goods = 0;
    const s = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(s.players[1].units.length).toBe(0);
  });
});

describe('combat and counterplay', () => {
  function attackSetup() {
    const st = fresh();
    const a1 = unit(st, 0, 'spearmen'), a2 = unit(st, 0, 'spearmen');
    return { st, a1, a2 };
  }
  it('unblocked attacks damage the city and earn Momentum', () => {
    const { st, a1, a2 } = attackSetup();
    let s = applyAction(st, 0, { type: 'attack', unitUids: [a1, a2], target: { kind: 'city' } }).state;
    expect(s.phase).toBe('response');
    expect(actingPlayer(s)).toBe(1);
    expect(() => applyAction(s, 0, { type: 'endTurn' })).toThrow();
    s = applyAction(s, 1, { type: 'respond', blockerUids: [] }).state;
    expect(s.players[1].stability).toBe(16);
    expect(s.players[0].momentum).toBe(1);
  });
  it('walls absorb damage before the city', () => {
    const { st, a1, a2 } = attackSetup();
    const w = build(st, 1, 'walls');
    let s = applyAction(st, 0, { type: 'attack', unitUids: [a1, a2], target: { kind: 'city' } }).state;
    s = applyAction(s, 1, { type: 'respond', blockerUids: [] }).state;
    expect(s.players[1].stability).toBe(20);
    expect(s.players[1].buildings.find((b) => b.uid === w)!.damage).toBe(4);
  });
  it('blockers trade damage and attackers are exhausted for blocking', () => {
    const { st, a1, a2 } = attackSetup();
    const d = unit(st, 1, 'spearmen');
    let s = applyAction(st, 0, { type: 'attack', unitUids: [a1], target: { kind: 'city' } }).state;
    s = applyAction(s, 1, { type: 'respond', blockerUids: [d] }).state;
    expect(s.players[1].stability).toBe(20);
    expect(s.players[1].momentum).toBeGreaterThanOrEqual(1);
    // The attacker now passes; on the next turn a1 (exhausted) cannot block but a2 can.
    s = applyAction(s, 0, { type: 'endTurn' }).state;
    const enemy = unit(s, 1, 'militia');
    let t = applyAction(s, 1, { type: 'attack', unitUids: [enemy], target: { kind: 'city' } }).state;
    expect(() => applyAction(t, 0, { type: 'respond', blockerUids: [a1] })).toThrow(/exhausted/);
    expect(() => applyAction(t, 0, { type: 'respond', blockerUids: [a2] })).not.toThrow();
  });
  it('Feigned Retreat cancels an attack entirely', () => {
    const { st, a1, a2 } = attackSetup();
    st.players[1].goods = 5;
    const r = give(st, 1, 'feignedRetreat');
    let s = applyAction(st, 0, { type: 'attack', unitUids: [a1, a2], target: { kind: 'city' } }).state;
    s = applyAction(s, 1, { type: 'respond', reactionUid: r, blockerUids: [] }).state;
    expect(s.players[1].stability).toBe(20);
    expect(s.players[1].goods).toBe(3);
  });
  it('Turn the Tide sends excess damage back to the attacker', () => {
    const st = fresh();
    const a = unit(st, 0, 'militia');
    const d1 = unit(st, 1, 'spearmen'), d2 = unit(st, 1, 'spearmen');
    st.players[1].goods = 5;
    const r = give(st, 1, 'turnTheTide');
    let s = applyAction(st, 0, { type: 'attack', unitUids: [a], target: { kind: 'city' } }).state;
    s = applyAction(s, 1, { type: 'respond', reactionUid: r, blockerUids: [d1, d2] }).state;
    // blockers deal (2+2)*2 = 8; militia has 2 hp; 6 strikes back.
    expect(s.players[0].stability).toBe(14);
    expect(s.players[0].units.length).toBe(0);
  });
  it('Mirror the Scheme turns sabotage back on its caster', () => {
    const st = fresh();
    const myTemple = build(st, 0, 'temple');
    const theirFarm = build(st, 1, 'farm');
    st.players[0].goods = 10; st.players[1].goods = 5;
    const arson = give(st, 0, 'arson');
    const m = give(st, 1, 'mirror');
    let s = applyAction(st, 0, { type: 'play', uid: arson, targetUid: theirFarm }).state;
    const res = applyAction(s, 1, { type: 'respond', reactionUid: m, blockerUids: [] });
    s = res.state;
    expect(s.players[1].buildings.find((b) => b.uid === theirFarm)!.damage).toBe(0);
    expect(s.players[0].buildings.some((b) => b.uid === myTemple)).toBe(false); // 3 damage destroys a temple
    expect(res.events.some((e) => e.type === 'reversed')).toBe(true);
  });
  it('a reaction cannot answer the wrong kind of threat', () => {
    const { st, a1 } = attackSetup();
    st.players[1].goods = 5;
    const w = give(st, 1, 'vigilantWatch');
    const s = applyAction(st, 0, { type: 'attack', unitUids: [a1], target: { kind: 'city' } }).state;
    expect(() => applyAction(s, 1, { type: 'respond', reactionUid: w, blockerUids: [] })).toThrow(/cannot answer/);
  });
  it('siege engines hit buildings harder', () => {
    const st = fresh();
    const ram = unit(st, 0, 'ram');
    const t = build(st, 1, 'sumer_ziggurat');
    let s = applyAction(st, 0, { type: 'attack', unitUids: [ram], target: { kind: 'building', uid: t } }).state;
    s = applyAction(s, 1, { type: 'respond', blockerUids: [] }).state;
    expect(s.players[1].buildings.find((b) => b.uid === t)!.damage).toBe(4);
  });
});

describe('victory', () => {
  it('conquest when stability reaches zero', () => {
    const st = fresh();
    st.players[1].stability = 2;
    const a = unit(st, 0, 'spearmen');
    let s = applyAction(st, 0, { type: 'attack', unitUids: [a], target: { kind: 'city' } }).state;
    s = applyAction(s, 1, { type: 'respond', blockerUids: [] }).state;
    expect(s.phase).toBe('over');
    expect(s.winner).toBe(0);
    expect(() => applyAction(s, 0, { type: 'endTurn' })).toThrow();
  });
  it('legacy victory at the start of a turn', () => {
    const st = fresh();
    st.players[1].legacy = 19;
    build(st, 1, 'temple');
    const s = applyAction(st, 0, { type: 'endTurn' }).state;
    expect(s.winner).toBe(1);
    expect(s.winReason).toMatch(/Legacy/);
  });
  it('every AI-vs-AI match terminates with a winner', () => {
    for (let i = 0; i < 10; i++) {
      const civs = CIVS.map((c) => c.id);
      const st = playOut(300 + i, civs[i % 5], civs[(i + 2) % 5], i % 3 === 0 ? 'hard' : i % 3 === 1 ? 'easy' : 'normal');
      expect(st.phase).toBe('over');
      expect(st.winner === 0 || st.winner === 1).toBe(true);
    }
  });
});

describe('hidden information', () => {
  it('views hide the opponent hand, both deck orders and the RNG', () => {
    const st = fresh();
    const v = viewFor(st, 0);
    expect(v.players[0].hand.every((c) => c.cardId !== HIDDEN_CARD)).toBe(true);
    expect(v.players[1].hand.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    expect(v.players[0].deck.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    expect(v.rng).toBe(0);
    expect(JSON.stringify(v)).not.toContain(st.players[1].hand[0].uid);
  });
  it('Spy Network reveals the opponent hand only to its caster, until end of turn', () => {
    const st = fresh();
    st.players[0].goods = 5;
    const spy = give(st, 0, 'spy');
    let s = applyAction(st, 0, { type: 'play', uid: spy }).state;
    expect(viewFor(s, 0).players[1].hand.some((c) => c.cardId !== HIDDEN_CARD)).toBe(true);
    expect(viewFor(s, null).players[1].hand.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    s = applyAction(s, 0, { type: 'endTurn' }).state;
    expect(viewFor(s, 0).players[1].hand.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
  });
  it('AI always produces a legal action', () => {
    let st = createGame(99, [{ name: 'A', civ: 'carthage' }, { name: 'B', civ: 'aksum' }]).state;
    for (let i = 0; i < 400 && st.phase !== 'over'; i++) {
      const pid = actingPlayer(st)!;
      const a = chooseAction(st, pid, 'normal');
      st = applyAction(st, pid, a).state; // throws if illegal
    }
    expect(st.phase).toBe('over');
  });
});
