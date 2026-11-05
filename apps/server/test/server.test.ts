import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { actingPlayer, chooseAction, HIDDEN_CARD, type ClientMsg, type GameState, type ServerMsg } from '@pm/engine';
import { startServer } from '../src/server';

let srv: Awaited<ReturnType<typeof startServer>>;
let url = '';

beforeAll(async () => {
  srv = await startServer({ port: 0, staticDir: null, log: () => {}, idleTimeoutMs: 60_000, maxMessagesPerSecond: 10_000 });
  url = `ws://127.0.0.1:${srv.port}/ws`;
});
afterAll(async () => { await srv.close(); });

/** A tiny test client that records every server message. */
class Client {
  ws: WebSocket;
  msgs: ServerMsg[] = [];
  consumed = new Set<number>();
  seq = 0;
  private waiters: { pred: (m: ServerMsg) => boolean; ok: (m: ServerMsg) => void }[] = [];
  constructor() {
    this.ws = new WebSocket(url);
    this.ws.on('message', (d) => {
      const m = JSON.parse(String(d)) as ServerMsg;
      this.msgs.push(m);
      const idx = this.msgs.length - 1;
      const w = this.waiters.find((x) => x.pred(m));
      if (w) { this.consumed.add(idx); this.waiters = this.waiters.filter((x) => x !== w); w.ok(m); }
    });
  }
  open() { return new Promise<void>((ok) => this.ws.once('open', () => ok())); }
  send(m: ClientMsg) { this.ws.send(JSON.stringify(m)); }
  next<T extends ServerMsg['t']>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 4000): Promise<Extract<ServerMsg, { t: T }>> {
    const p = (m: ServerMsg) => m.t === t && pred(m as never);
    const idx = this.msgs.findIndex((m, i) => !this.consumed.has(i) && p(m));
    if (idx >= 0) { this.consumed.add(idx); return Promise.resolve(this.msgs[idx] as never); }
    return new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error(`timeout waiting for ${t}`)), ms);
      this.waiters.push({ pred: p, ok: (m) => { clearTimeout(timer); ok(m as never); } });
    });
  }
  lastState(): GameState { const s = [...this.msgs].reverse().find((m) => m.t === 'state'); return (s as Extract<ServerMsg, { t: 'state' }>).view; }
  act(action: ClientMsg extends infer _ ? Extract<ClientMsg, { t: 'action' }>['action'] : never) { this.send({ t: 'action', seq: ++this.seq, action }); }
  close() { this.ws.close(); }
}

async function startMatch() {
  const a = new Client(); await a.open();
  a.send({ t: 'create', name: 'Ana', civ: 'kush' });
  const joinedA = await a.next('joined');
  await a.next('waiting');
  const b = new Client(); await b.open();
  const stA = a.next('state');
  b.send({ t: 'join', code: joinedA.code, name: 'Bo', civ: 'sumer' });
  const joinedB = await b.next('joined');
  await b.next('state');
  await stA;
  return { a, b, code: joinedA.code, tokenA: joinedA.token, tokenB: joinedB.token };
}

describe('multiplayer server', () => {
  it('creates a private room and starts a match when the second player joins', async () => {
    const { a, b, code } = await startMatch();
    expect(code).toMatch(/^[A-Z0-9]{5}$/);
    const va = a.lastState(), vb = b.lastState();
    expect(va.players[0].civ).toBe('kush');
    expect(vb.players[1].civ).toBe('sumer');
    a.close(); b.close();
  });

  it('never sends a seat its opponent’s hand, deck order or RNG', async () => {
    const { a, b } = await startMatch();
    const va = a.lastState();
    expect(va.players[1].hand.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    expect(va.players[0].hand.every((c) => c.cardId !== HIDDEN_CARD)).toBe(true);
    expect(va.players.every((p) => [...p.piles.civ, ...p.piles.mil].every((c) => c.cardId === HIDDEN_CARD))).toBe(true);
    expect(va.rng).toBe(0);
    const vb = b.lastState();
    expect(vb.players[0].hand.every((c) => c.cardId === HIDDEN_CARD)).toBe(true);
    a.close(); b.close();
  });

  it('rejects out-of-turn and illegal actions, and ignores duplicate submissions', async () => {
    const { a, b } = await startMatch();
    const st = a.lastState();
    const idle = st.active === 0 ? b : a;
    const active = st.active === 0 ? a : b;
    idle.act({ type: 'endTurn' });
    expect((await idle.next('error')).message).toMatch(/not your turn/i);
    active.act({ type: 'play', uid: 'nope' });
    expect((await active.next('error')).message).toMatch(/Pick your cards/i); // a turn starts with the blind pick
    active.act({ type: 'draft', civ: 3, mil: 3 });
    await active.next('state', (m) => m.view.phase === 'main');
    active.act({ type: 'play', uid: 'nope' });
    expect((await active.next('error')).message).toMatch(/not in your hand/i);
    // Replay the same seq: server resyncs without applying twice.
    const turnBefore = active.lastState().turn;
    active.send({ t: 'action', seq: active.seq, action: { type: 'endTurn' } });
    await active.next('state');
    expect(active.lastState().turn).toBe(turnBefore);
    a.close(); b.close();
  });

  it('throttles message floods', async () => {
    const c = new Client(); await c.open();
    for (let i = 0; i < 12_000; i++) c.send({ t: 'ping' });
    expect((await c.next('error')).message).toMatch(/Too many/);
    c.close();
  });

  it('rejects unknown civilizations and unknown rooms', async () => {
    const c = new Client(); await c.open();
    c.send({ t: 'create', name: 'X', civ: 'atlantis' as never });
    expect((await c.next('error')).message).toMatch(/Unknown civilization/);
    c.send({ t: 'join', code: 'ZZZZZ', name: 'X', civ: 'kush' });
    expect((await c.next('error')).message).toMatch(/No room/);
    c.close();
  });

  it('lets a player reconnect with their seat token and continue', async () => {
    const { a, b, code, tokenA } = await startMatch();
    const lost = b.next('opponent', (m) => !m.connected);
    a.close();
    await lost;
    const a2 = new Client(); await a2.open();
    const back = b.next('opponent', (m) => m.connected);
    a2.send({ t: 'resume', code, token: tokenA });
    await a2.next('joined');
    const s = await a2.next('state');
    expect(s.seat).toBe(0);
    await back;
    // A wrong token is refused.
    const evil = new Client(); await evil.open();
    evil.send({ t: 'resume', code, token: 'guess' });
    expect((await evil.next('error')).fatal).toBe(true);
    a2.close(); b.close(); evil.close();
  });

  it('plays a complete match between two networked clients', async () => {
    const { a, b } = await startMatch();
    const clients = [a, b];
    let st = a.lastState();
    for (let i = 0; i < 1500 && st.phase !== 'over'; i++) {
      const pid = actingPlayer(st)!;
      const c = clients[pid];
      const sig = (v: GameState) => `${v.turn}|${v.phase}|${v.log.length}|${v.players[0].stability}|${v.players[1].stability}`;
      for (let w = 0; w < 200 && sig(c.lastState()) !== sig(st); w++) await new Promise((r) => setTimeout(r, 5));
      const view = c.lastState();
      // Each client decides from its own redacted view only.
      const action = chooseAction(view, pid, 'easy');
      c.msgs.forEach((_, j) => c.consumed.add(j));
      const expected = c.seq + 1;
      const done = c.next('state', (m) => m.ackSeq === expected, 4000).catch(() => null);
      c.act(action);
      const got = await done;
      if (!got) throw new Error(`no state after ${JSON.stringify(action)}: ${JSON.stringify(c.msgs.at(-1))}`);
      st = got.view;
    }
    expect(st.phase).toBe('over');
    a.close(); b.close();
  }, 60_000);
});
