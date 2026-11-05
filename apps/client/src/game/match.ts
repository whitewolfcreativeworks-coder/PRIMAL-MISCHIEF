import {
  actingPlayer, AI_ACTIONS_PER_TURN, applyAction, chooseAction, createGame, viewFor,
  type Action, type ClientMsg, type CivId, type Difficulty, type GameEvent, type GameState, type PlayerId, type ServerMsg,
} from '@pm/engine';

export type MatchStatus = 'live' | 'connecting' | 'waiting' | 'reconnecting' | 'closed' | 'error';

export interface Snapshot {
  view: GameState | null; // what this seat is allowed to see
  me: PlayerId;
  events: GameEvent[]; // events from the most recent change, for animation
  eventSeq: number;
  status: MatchStatus;
  opponentConnected: boolean;
  online: boolean;
  roomCode?: string;
  error?: string; // transient rule error message
  errorSeq: number;
  thinking: boolean; // opponent (AI or human) is acting
}

type Listener = () => void;

abstract class Match {
  protected listeners = new Set<Listener>();
  snapshot: Snapshot;
  constructor(online: boolean) {
    this.snapshot = { view: null, me: 0, events: [], eventSeq: 0, status: 'connecting', opponentConnected: true, online, errorSeq: 0, thinking: false };
  }
  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getSnapshot = () => this.snapshot;
  protected set(patch: Partial<Snapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach((l) => l()); }
  protected fail(message: string) { this.set({ error: message, errorSeq: this.snapshot.errorSeq + 1 }); }
  abstract send(action: Action): void;
  abstract dispose(): void;
}

// ============================================================ local vs AI

export interface LocalSetup {
  seed: number;
  human: { name: string; civ: CivId; deck: string[] };
  ai: { name: string; civ: CivId };
  difficulty: Difficulty;
  pace: number; // 0 = instant, 1 = normal, 2 = slow
}

export class LocalMatch extends Match {
  private state: GameState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private aiCount = 0;
  private aiTurn = -1;
  constructor(private setup: LocalSetup) {
    super(false);
    const humanFirst = setup.seed % 2 === 0;
    const r = createGame(setup.seed, [
      { name: setup.human.name, civ: setup.human.civ, deck: setup.human.deck },
      { name: setup.ai.name, civ: setup.ai.civ },
    ], humanFirst ? 0 : 1);
    this.state = r.state;
    this.publish(r.events);
    this.scheduleAI();
  }
  private publish(events: GameEvent[]) {
    this.set({
      view: viewFor(this.state, 0), events, eventSeq: this.snapshot.eventSeq + 1, status: 'live',
      thinking: actingPlayer(this.state) === 1,
    });
  }
  send(action: Action) {
    try {
      const r = applyAction(this.state, 0, action);
      this.state = r.state;
      this.publish(r.events);
      this.scheduleAI();
    } catch (e) { this.fail((e as Error).message); }
  }
  setPace(p: number) { this.setup.pace = p; }
  private scheduleAI() {
    if (this.timer) clearTimeout(this.timer);
    if (actingPlayer(this.state) !== 1) return;
    const base = this.state.phase === 'response' ? 500 : 750;
    this.timer = setTimeout(() => this.stepAI(), base * this.setup.pace + 60);
  }
  private stepAI() {
    this.timer = null;
    if (actingPlayer(this.state) !== 1) return;
    if (this.state.turn !== this.aiTurn) { this.aiTurn = this.state.turn; this.aiCount = 0; }
    let action: Action = chooseAction(this.state, 1, this.setup.difficulty);
    if (this.state.phase === 'main' && ++this.aiCount > AI_ACTIONS_PER_TURN) action = { type: 'endTurn' };
    try {
      const r = applyAction(this.state, 1, action);
      this.state = r.state;
      this.publish(r.events);
    } catch (e) {
      console.error('AI produced an illegal action', action, e);
      const fallback: Action = this.state.phase === 'response' ? { type: 'respond', blockerUids: [] } : { type: 'endTurn' };
      const r = applyAction(this.state, 1, fallback);
      this.state = r.state;
      this.publish(r.events);
    }
    this.scheduleAI();
  }
  dispose() { if (this.timer) clearTimeout(this.timer); this.listeners.clear(); }
}

// ============================================================ online

export function defaultServerUrl(): string {
  const env = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (env) return env;
  const { protocol, hostname, port, host } = window.location;
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  if (port === '5173' || port === '4173') return `${wsProto}//${hostname}:8787/ws`; // vite dev/preview -> local game server
  return `${wsProto}//${host}/ws`; // same-origin deployment (server also hosts the client)
}

const ROOM_KEY = 'pm.room';
export interface SavedRoom { code: string; token: string; url: string }
export function savedRoom(): SavedRoom | null {
  try { const r = localStorage.getItem(ROOM_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveRoom(r: SavedRoom | null) {
  try { if (r) localStorage.setItem(ROOM_KEY, JSON.stringify(r)); else localStorage.removeItem(ROOM_KEY); } catch { /* ignore */ }
}

export type OnlineIntent =
  | { kind: 'create'; name: string; civ: CivId; deck: string[] }
  | { kind: 'join'; code: string; name: string; civ: CivId; deck: string[] }
  | { kind: 'resume'; code: string; token: string };

export class OnlineMatch extends Match {
  private ws: WebSocket | null = null;
  private seq = 0;
  private token: string | null = null;
  private code: string | null = null;
  private retries = 0;
  private closedByUser = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  constructor(private url: string, private intent: OnlineIntent) {
    super(true);
    if (intent.kind === 'resume') { this.code = intent.code; this.token = intent.token; }
    this.connect();
  }
  private connect() {
    this.set({ status: this.snapshot.view ? 'reconnecting' : 'connecting' });
    let ws: WebSocket;
    try { ws = new WebSocket(this.url); } catch (e) { this.set({ status: 'error' }); this.fail(`Cannot reach server: ${(e as Error).message}`); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      if (this.code && this.token) this.raw({ t: 'resume', code: this.code, token: this.token });
      else if (this.intent.kind === 'create') this.raw({ t: 'create', name: this.intent.name, civ: this.intent.civ, deck: this.intent.deck });
      else if (this.intent.kind === 'join') this.raw({ t: 'join', code: this.intent.code, name: this.intent.name, civ: this.intent.civ, deck: this.intent.deck });
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => this.raw({ t: 'ping' }), 20000);
    };
    ws.onmessage = (ev) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      this.onMessage(msg);
    };
    ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.closedByUser || this.snapshot.status === 'closed') return;
      if (!this.token) { this.set({ status: 'error' }); this.fail('Could not connect to the game server.'); return; }
      const delay = Math.min(8000, 500 * 2 ** this.retries++);
      this.set({ status: 'reconnecting' });
      setTimeout(() => { if (!this.closedByUser) this.connect(); }, delay);
    };
  }
  private raw(m: ClientMsg) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'joined':
        this.code = m.code; this.token = m.token;
        saveRoom({ code: m.code, token: m.token, url: this.url });
        this.set({ me: m.seat, roomCode: m.code });
        break;
      case 'waiting':
        this.set({ status: 'waiting', roomCode: m.code });
        break;
      case 'state':
        this.seq = Math.max(this.seq, m.ackSeq);
        this.set({
          view: m.view, me: m.seat, events: m.events, eventSeq: this.snapshot.eventSeq + 1, status: 'live',
          opponentConnected: m.opponentConnected, thinking: actingPlayer(m.view) !== m.seat,
        });
        if (m.view.phase === 'over') saveRoom(null);
        break;
      case 'opponent':
        this.set({ opponentConnected: m.connected });
        break;
      case 'error':
        if (m.fatal) { saveRoom(null); this.closedByUser = true; this.set({ status: 'error' }); }
        this.fail(m.message);
        break;
      case 'pong': break;
    }
  }
  send(action: Action) {
    if (this.ws?.readyState !== WebSocket.OPEN) { this.fail('Not connected — reconnecting…'); return; }
    this.seq += 1;
    this.raw({ t: 'action', seq: this.seq, action });
  }
  leave() { this.raw({ t: 'leave' }); saveRoom(null); this.dispose(); }
  dispose() {
    this.closedByUser = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.ws?.close();
    this.listeners.clear();
  }
}

export type AnyMatch = LocalMatch | OnlineMatch;
