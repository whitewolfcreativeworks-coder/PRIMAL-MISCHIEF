# Architecture

```
primal-mischief/
├── packages/engine/      Pure TypeScript rules engine — shared by everything
│   ├── src/types.ts        State, actions, events (all plain JSON)
│   ├── src/cards/          Card + civilization data (declarative)
│   ├── src/engine.ts       createGame / applyAction (the only way state changes)
│   ├── src/legal.ts        Legal-move helpers for UI and AI
│   ├── src/view.ts         Redaction: what a given seat may see
│   ├── src/ai.ts           Heuristic AI opponent (easy / normal / hard)
│   ├── src/protocol.ts     WebSocket message types
│   └── test/               Vitest rules tests + AI-vs-AI balance simulator
├── apps/client/          Vite + React browser client (mobile/iPad first)
│   ├── src/game/match.ts   LocalMatch (vs AI, in-browser) and OnlineMatch (WebSocket)
│   ├── src/ui/             Board, cards, menus, deck builder, lobby
│   ├── src/art/motifs.tsx  Procedural SVG card art and civ emblems (original)
│   └── src/audio.ts        Synthesized Web Audio cues (no audio assets)
└── apps/server/          Node authoritative game server (ws)
    ├── src/server.ts       Rooms, seats, validation, redaction, reconnection
    └── test/               Real-socket integration tests
```

## Core idea: one deterministic reducer

`applyAction(state, player, action) → { state, events }` is pure. It clones
the input, validates, mutates the clone and returns it with a list of
presentation **events** (`buildingRaised`, `reaction`, `reversed`,
`buildingDestroyed`…). All randomness comes from a seeded PRNG stored in the
state, so a seed plus an action list replays a match exactly (tested).

Because the engine is pure and dependency-free, the same code:

- runs the **local AI match** in the browser (`LocalMatch`),
- runs on the **server** as the single source of truth (`apps/server`),
- powers the **AI**, which simulates candidate moves through it,
- drives the **tests** and the **balance simulator**.

Clients animate from the `events` array rather than diffing states.

## Why not boardgame.io / a game engine?

Researched candidates (Nov 2026):

| Option | Licence | Verdict |
|---|---|---|
| **boardgame.io** | MIT | Good fit conceptually, but the latest npm release is still 0.50.2 (2023). Pinning a core dependency on an unmaintained framework for a commercial product is a risk; our needs (one reducer, response windows, redaction) are ~1k lines we fully control. Its design (pure moves, `playerView` redaction) inspired ours. |
| **Babylon.js / Three.js** | Apache-2.0 / MIT | Excellent, but a full 3D runtime is heavy for iPad Safari and not required for a card-forward tabletop. Deferred (see roadmap). |
| **PixiJS** | MIT | Fast 2D canvas, but the UI is text-heavy (rules, tooltips, accessibility); DOM + CSS gives sharper text, native touch and screen-reader labels for free. |
| **Godot** | MIT | Strong engine, but web exports are large and Safari support is weaker than plain web; would split the codebase from the server rules. |
| **React 19 + Vite 8** | MIT | Chosen. Mature, tiny runtime cost here (111 KB gzipped total), fast iteration. |
| **ws** | MIT | Chosen for the server: minimal, battle-tested WebSocket library. Socket.IO was unnecessary weight. |
| **Vitest** | MIT | Chosen for tests. |

The "3D" feel comes from CSS perspective on the tabletop, upright building
tiles, layered lighting and event-driven animations (rise, fracture,
charge, reversal banner). This keeps 60 fps on tablets and keeps text crisp.
A Three.js diorama layer can be added later behind the same event stream.

## Multiplayer model

- **Server-authoritative.** Clients send *intents* (`{t:'action', seq,
  action}`); the server applies them with the engine and rejects illegal
  ones with a `RuleError` message.
- **Redaction.** The server holds the only full state and sends each seat
  `viewFor(state, seat)`: opponent hand → placeholders (unless revealed by
  Spy Network), both deck orders hidden, RNG zeroed. Tested at the engine
  and the socket level.
- **Private rooms.** 5-character codes from an unambiguous alphabet
  (no 0/O/1/I/L) generated with `crypto.randomInt`. Invite links use
  `?room=CODE`.
- **Seats and reconnection.** Each seat receives a random 144-bit token,
  stored in the browser's localStorage. A reload or network drop resumes
  with `{t:'resume', code, token}`; the client reconnects with exponential
  backoff. Opening the same seat elsewhere kicks the older socket.
- **Duplicates / replays.** Every action carries a per-seat increasing
  `seq`; anything ≤ the last seen seq is ignored and the client resynced.
- **Inactivity.** If the acting player is idle for `IDLE_TIMEOUT_SECONDS`
  (default 10 min) the server auto-passes (no response / end turn). This is
  operational housekeeping, deliberately separate from game rules: there
  is no competitive speed mechanic.
- **Abuse limits.** 32 KB max message, 30 messages/second per socket,
  sanitized names, deck validation on the server.
- **Response windows.** Always opened for attacks and hostile schemes,
  even when the defender has nothing to play, so the attacker cannot infer
  the defender's hand from timing. The client auto-passes locally when it
  has no legal response.

Rooms live in memory. A restart ends live matches — acceptable for private
rooms; a persistence layer (e.g. SQLite/Redis) is on the roadmap before
public matchmaking.

## AI

`chooseAction(state, seat, difficulty)` enumerates legal plays and attack
groupings, simulates each through the engine and scores the result with a
hand-tuned evaluation (Stability, Legacy, economy, working buildings, army,
exposure to the opponent's army, famine risk).

- **Easy:** greedy with noise; assumes no blocks.
- **Normal:** greedy; assumes the defender blocks optimally.
- **Hard:** for the top candidates, plays out the rest of the turn and
  picks the best line.

Difficulty changes decision quality only; the AI never gets extra
resources. It does not read the opponent's hidden hand: attack previews
assume the best *blocks* (public information) and no reaction, and its
evaluation counts hand size, not undrawn card identities. The same AI runs
on redacted views in the multiplayer tests, demonstrating it needs no
hidden information.

## Adding content

- **A card:** add a `CardDef` to `cards/common.ts` or `cards/civs.ts`
  using existing `Effect` ops; add an art motif key (or reuse one).
- **A civilization:** add a `CivDef` (palette, signature, 24-card starter
  deck) plus its cards, an emblem in `motifs.tsx`, a `HISTORY_NOTES.md`
  entry, then run `npm test` and `npm run simulate`.
- **A new mechanic:** add an `Effect` op or `Passive` in `types.ts` and
  handle it in `engine.ts`. Keep effects finite and non-recursive.
