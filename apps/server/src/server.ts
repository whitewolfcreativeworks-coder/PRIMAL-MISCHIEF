import { randomBytes, randomInt } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { WebSocket, WebSocketServer } from 'ws';
import {
  actingPlayer, applyAction, createGame, isCivId, other, RuleError, viewFor,
  ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH,
  type Action, type ClientMsg, type CivId, type GameEvent, type GameState, type PlayerId, type ServerMsg,
} from '@pm/engine';

/*
 * Authoritative game server. Clients send intents; the server validates every
 * action with the shared rules engine, owns the only full copy of the state
 * (including hands, both draw piles and the RNG), and sends each seat a redacted view.
 */

export interface ServerOptions {
  port?: number;
  host?: string;
  staticDir?: string | null; // serve the built client from here (single-deploy option)
  idleTimeoutMs?: number; // auto-pass for an acting player who stays idle this long
  roomTtlMs?: number; // empty or finished rooms are removed after this
  maxMessagesPerSecond?: number; // per-socket flood protection (default 30)
  log?: (msg: string) => void;
}

interface Seat {
  name: string;
  civ: CivId;
  token: string;
  socket: WebSocket | null;
  lastSeq: number;
}

interface Room {
  code: string;
  seats: [Seat, Seat | null];
  state: GameState | null;
  lastEvents: GameEvent[];
  createdAt: number;
  touchedAt: number;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

const cleanName = (n: unknown) => (typeof n === 'string' ? n.replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 20) : '') || 'Player';

export function startServer(opts: ServerOptions = {}): Promise<{ server: Server; port: number; close: () => Promise<void>; rooms: Map<string, Room> }> {
  const log = opts.log ?? ((m: string) => console.log(`[${new Date().toISOString()}] ${m}`));
  const idleTimeoutMs = opts.idleTimeoutMs ?? 10 * 60 * 1000;
  const roomTtlMs = opts.roomTtlMs ?? 30 * 60 * 1000;
  const rooms = new Map<string, Room>();
  const staticDir = opts.staticDir ? resolve(opts.staticDir) : null;

  // ---------------------------------------------------------------- http
  const http = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/healthz') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (!staticDir) { res.writeHead(404); res.end('Primal Mischief game server. WebSocket endpoint: /ws'); return; }
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(staticDir, p);
    if (!file.startsWith(staticDir)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file) || statSync(file).isDirectory()) { p = 'index.html'; file = join(staticDir, p); }
    if (!existsSync(file)) { res.writeHead(404); res.end('Client not built.'); return; }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': p.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    createReadStream(file).pipe(res);
  });

  // ---------------------------------------------------------------- ws
  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: 32 * 1024 });
  const seatOf = new WeakMap<WebSocket, { room: Room; seat: PlayerId }>();

  const send = (ws: WebSocket | null, msg: ServerMsg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

  function newCode(): string {
    for (;;) {
      let c = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) c += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
      if (!rooms.has(c)) return c;
    }
  }

  function pushState(room: Room, events: GameEvent[]) {
    if (!room.state) return;
    room.seats.forEach((seat, i) => {
      if (!seat) return;
      const opp = room.seats[other(i as PlayerId)];
      send(seat.socket, {
        t: 'state', view: viewFor(room.state!, i as PlayerId), events, seat: i as PlayerId,
        opponentConnected: !!opp?.socket, ackSeq: seat.lastSeq,
      });
    });
  }

  function armIdle(room: Room) {
    if (room.idleTimer) clearTimeout(room.idleTimer);
    room.idleTimer = null;
    if (!room.state || room.state.phase === 'over') return;
    room.idleTimer = setTimeout(() => {
      const st = room.state;
      if (!st || st.phase === 'over') return;
      const pid = actingPlayer(st)!;
      const action: Action = st.phase === 'response' ? { type: 'respond', blockerUids: [] } : { type: 'endTurn' };
      log(`room ${room.code}: seat ${pid} idle, auto-${action.type}`);
      act(room, pid, action);
    }, idleTimeoutMs);
  }

  function act(room: Room, pid: PlayerId, action: Action): string | null {
    if (!room.state) return 'The match has not started yet.';
    try {
      const r = applyAction(room.state, pid, action);
      room.state = r.state;
      room.lastEvents = r.events;
      room.touchedAt = Date.now();
      pushState(room, r.events);
      armIdle(room);
      if (r.state.phase === 'over') log(`room ${room.code}: finished, winner seat ${r.state.winner}`);
      return null;
    } catch (e) {
      if (e instanceof RuleError) return e.message;
      log(`room ${room.code}: engine error ${(e as Error).stack}`);
      return 'Server rules error.';
    }
  }

  function bind(ws: WebSocket, room: Room, seat: PlayerId) {
    const s = room.seats[seat]!;
    if (s.socket && s.socket !== ws) { send(s.socket, { t: 'error', message: 'Opened on another device.', fatal: true }); s.socket.close(); }
    s.socket = ws;
    seatOf.set(ws, { room, seat });
    room.touchedAt = Date.now();
    send(room.seats[other(seat)]?.socket ?? null, { t: 'opponent', connected: true });
  }

  function parseSetup(msg: { name?: unknown; civ?: unknown }): { error: string } | { name: string; civ: CivId } {
    if (!isCivId(msg.civ)) return { error: 'Unknown civilization.' };
    return { name: cleanName(msg.name), civ: msg.civ };
  }

  wss.on('connection', (ws) => {
    const limit = opts.maxMessagesPerSecond ?? 30;
    let budget = limit; // simple flood protection, refilled each second
    const refill = setInterval(() => { budget = limit; }, 1000);
    ws.on('close', () => {
      clearInterval(refill);
      const b = seatOf.get(ws);
      if (!b) return;
      const s = b.room.seats[b.seat];
      if (s && s.socket === ws) {
        s.socket = null;
        send(b.room.seats[other(b.seat)]?.socket ?? null, { t: 'opponent', connected: false });
      }
    });
    ws.on('message', (data) => {
      if (--budget < 0) { if (budget === -1) send(ws, { t: 'error', message: 'Too many messages — slow down.' }); return; }
      let msg: ClientMsg;
      try { msg = JSON.parse(String(data)); } catch { send(ws, { t: 'error', message: 'Malformed message.' }); return; }
      if (!msg || typeof msg !== 'object') return;
      const bound = seatOf.get(ws);
      switch (msg.t) {
        case 'ping': send(ws, { t: 'pong' }); return;
        case 'create': {
          if (bound) { send(ws, { t: 'error', message: 'Already in a room.' }); return; }
          const s = parseSetup(msg);
          if ('error' in s) { send(ws, { t: 'error', message: s.error }); return; }
          const room: Room = {
            code: newCode(), seats: [{ ...s, token: randomBytes(18).toString('base64url'), socket: null, lastSeq: 0 }, null],
            state: null, lastEvents: [], createdAt: Date.now(), touchedAt: Date.now(), idleTimer: null,
          };
          rooms.set(room.code, room);
          bind(ws, room, 0);
          send(ws, { t: 'joined', code: room.code, seat: 0, token: room.seats[0].token });
          send(ws, { t: 'waiting', code: room.code });
          log(`room ${room.code}: created (${s.civ})`);
          return;
        }
        case 'join': {
          if (bound) { send(ws, { t: 'error', message: 'Already in a room.' }); return; }
          const code = String(msg.code ?? '').toUpperCase().trim();
          const room = rooms.get(code);
          if (!room) { send(ws, { t: 'error', message: 'No room with that code.' }); return; }
          if (room.seats[1]) { send(ws, { t: 'error', message: 'That room is full.' }); return; }
          const s = parseSetup(msg);
          if ('error' in s) { send(ws, { t: 'error', message: s.error }); return; }
          room.seats[1] = { ...s, token: randomBytes(18).toString('base64url'), socket: null, lastSeq: 0 };
          bind(ws, room, 1);
          send(ws, { t: 'joined', code: room.code, seat: 1, token: room.seats[1].token });
          const [a, b] = room.seats as [Seat, Seat];
          const r = createGame(randomInt(1, 2 ** 31), [{ name: a.name, civ: a.civ }, { name: b.name, civ: b.civ }]);
          room.state = r.state;
          pushState(room, r.events);
          armIdle(room);
          log(`room ${room.code}: started ${a.civ} vs ${b.civ}`);
          return;
        }
        case 'resume': {
          const room = rooms.get(String(msg.code ?? '').toUpperCase());
          const seat = room?.seats.findIndex((s) => s && typeof msg.token === 'string' && s.token === msg.token) ?? -1;
          if (!room || seat < 0) { send(ws, { t: 'error', message: 'That match is no longer available.', fatal: true }); return; }
          bind(ws, room, seat as PlayerId);
          send(ws, { t: 'joined', code: room.code, seat: seat as PlayerId, token: room.seats[seat as PlayerId]!.token });
          if (room.state) {
            const opp = room.seats[other(seat as PlayerId)];
            send(ws, { t: 'state', view: viewFor(room.state, seat as PlayerId), events: [], seat: seat as PlayerId, opponentConnected: !!opp?.socket, ackSeq: room.seats[seat as PlayerId]!.lastSeq });
          } else send(ws, { t: 'waiting', code: room.code });
          return;
        }
        case 'action': {
          if (!bound) { send(ws, { t: 'error', message: 'Join a room first.' }); return; }
          const seat = bound.room.seats[bound.seat]!;
          const seq = Number(msg.seq);
          if (!Number.isInteger(seq)) { send(ws, { t: 'error', message: 'Bad sequence number.' }); return; }
          if (seq <= seat.lastSeq) { // duplicate/replayed submission: ignore and resync
            if (bound.room.state) send(ws, { t: 'state', view: viewFor(bound.room.state, bound.seat), events: [], seat: bound.seat, opponentConnected: !!bound.room.seats[other(bound.seat)]?.socket, ackSeq: seat.lastSeq });
            return;
          }
          seat.lastSeq = seq;
          const err = act(bound.room, bound.seat, msg.action);
          if (err) send(ws, { t: 'error', message: err, seq });
          return;
        }
        case 'leave': {
          if (!bound) return;
          const room = bound.room;
          if (room.state && room.state.phase !== 'over') act(room, bound.seat, { type: 'concede' });
          else if (!room.state) { rooms.delete(room.code); }
          seatOf.delete(ws);
          const s = room.seats[bound.seat];
          if (s) s.socket = null;
          send(room.seats[other(bound.seat)]?.socket ?? null, { t: 'opponent', connected: false });
          return;
        }
        default:
          send(ws, { t: 'error', message: 'Unknown message type.' });
      }
    });
  });

  // Housekeeping: drop rooms nobody is connected to after the TTL, and anything older than a day.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      const anyone = room.seats.some((s) => s?.socket);
      if ((!anyone && now - room.touchedAt > roomTtlMs) || now - room.createdAt > 24 * 3600 * 1000) {
        if (room.idleTimer) clearTimeout(room.idleTimer);
        rooms.delete(code);
        log(`room ${code}: removed`);
      }
    }
  }, Math.min(60_000, roomTtlMs));

  return new Promise((ok) => {
    http.listen(opts.port ?? 8787, opts.host ?? '0.0.0.0', () => {
      const addr = http.address();
      const port = typeof addr === 'object' && addr ? addr.port : opts.port ?? 8787;
      log(`Primal Mischief server on :${port}${staticDir ? ` serving ${staticDir}` : ''}`);
      ok({
        server: http, port, rooms,
        close: () => new Promise<void>((done) => {
          clearInterval(sweep);
          for (const r of rooms.values()) if (r.idleTimer) clearTimeout(r.idleTimer);
          for (const c of wss.clients) c.terminate();
          wss.close(() => http.close(() => done()));
        }),
      });
    });
  });
}
