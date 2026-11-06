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
│   ├── src/art/skyline.tsx Procedural riverbank skylines per civilization and Age
│   ├── src/holo/           Three.js hologram theater: shader, miniatures, scenes
│   ├── src/game/tutorial.ts, lessons.ts  Academy lesson framework + lessons
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

**Update (v0.2):** Three.js is now used for one focused job — the hologram
theater (`src/holo/`). The table, cards and text stay DOM/CSS for
readability; Three.js renders only while a scene plays, so idle cost is
zero. Scenes are built from the engine's presentation events (`combat`,
`scheme`, `buildingRaised`, `buildingDestroyed`, `signature`,
`gameOver`), which carry enough detail (who fought, who fell, which
reaction) to stage the action. The original rationale below still applies
to the board itself.

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

## Hologram theater (v0.4: a running holographic movie)

Every card that is played is acted out over the river by small hologram
people of the right culture. The rule that keeps it honest: **scenes are
built only from engine events**, so whatever the rules decide is what
the hologram shows. When cards or rules change, the scenes follow.

- **Events carry the facts.** `combat` events list every attacking and
  blocking card in order, with `attackerFates` (survived, or fell to
  `tower`, `ambush`, `retreat` or `melee`) and `blockerFates`. Schemes and
  signatures are paired with the `unitDestroyed` events that follow them,
  so a volley drops exactly the units the engine removed.
- `holo/figures.ts`: articulated people (hips, spine, neck, shoulders,
  elbows, knees, hands), each with a procedural pose library: walk, march,
  run, wade, sneak, charge, thrust, swing, shoot, sling, throw, block,
  push, pull, row, carry, hammer, dig, harvest, cheer, dance, bow, command,
  ride, cower, stagger and fall. `OUTFITS` dresses each civilization and
  role: Kushite bowmen, Sumerian fleece kilts with tall shields, Inca
  unku tunics with mace and sling, Carthaginian crests, Aksumite round
  shields.
- `holo/vehicles.ts`: horses, elephants (riders, swinging trunk),
  Sumerian onager battle wagons, a roofed siege ram whose crew push it,
  galleys and traders with rowing oars, donkey, camel and llama pack
  trains, and a stone sledge.
- `holo/arch.ts`: a separate architecture kit per culture. Kushite pylons,
  steep pyramids and deffufa; Aksumite stelae and "monkey-head" walls;
  Punic podium temples and the cothon; Sumerian niched mudbrick and
  ziggurats; Inca polygonal masonry, terraces and qullqa. It provides
  `archBuilding(card, civ)` and `archCity(civ, age)`.
- `holo/director.ts`: **casting and timelines.** `castFor(card, civ)`
  derives who appears from the card's own data (keywords, strength, art)
  with a small override table. For example, ranged troops become archers,
  or slingers for the Inca, and siege becomes a ram with crew. No horses or
  elephants are cast for the Inca. An `Actor` plays a timeline of beats
  (`do(at, act, {to, dur, face})`), and a `Troupe` holds a scene's actors
  and missiles (arrows, sling stones, javelins, torches).
- `holo/vignettes.ts`: the scenes.
  - The battle covers every branch: towers, ambush, shield wall,
    feigned retreat, turn the tide, treaty, breaching walls and raids.
  - Schemes are staged by what the card does (fire, sabotage, theft,
    volleys, sack, blockade, landing), each with its hit, foiled and
    mirrored versions.
  - Construction crews are chosen from building tags: farmers, masons
    with a stone sledge, merchants with pack animals, ships at harbours.
  - Also: deployments, tactics, a new Age, each civilization's signature,
    collapse and victory.
- `holo/theater.ts`: renderer, camera framing (`stage.frame`) and bloom
  (three's `UnrealBloomPass`, composited with `mix-blend-mode: screen`).
- `holo/gallery.ts` and the **Hologram Theater** screen (from the title
  screen, or `?theater=kush`) play every scene for any civilization.
  `apps/client/test/holograms.test.ts` runs every scene for every
  civilization headlessly. It checks that every unit is cast and every
  building has architecture.

**Adding a card:** nothing extra is needed for it to appear. Units are
cast from their keywords, buildings get a crew from their tags, and
hostile tactics get a scene from their effects. Bespoke looks go in
`CAST_OVERRIDES` (director) or `arch.ts`.

## Academy

`game/tutorial.ts` runs a lesson: a scripted board, steps that explain
(info) or ask for one move (do), scripted rival moves, and a `solution` per
step. `apps/client/test/lessons.test.ts` plays every lesson through its
solutions and checks off-script moves are refused.

## v0.3 rules model

Game state now tracks, per player: `age`, `progress`, `prosperity`,
`stability`, `momentum`, two face-down `piles` and two `discards` (one per
deck), and Sumer’s `peek`. A turn has a `draft` phase before `main`. Decks are
defined per civilization as five Age tiers per deck (`CivDef.decks`); entering
an Age rebuilds both piles from the live tiers. `validateData()` checks every
tier on startup in tests.
