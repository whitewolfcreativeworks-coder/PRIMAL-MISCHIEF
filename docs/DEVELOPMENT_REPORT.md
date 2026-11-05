# Development report — initial cycle (v0.1, November 2026)

## 1. What was built

A complete, playable vertical slice:

- A deterministic rules engine with civilization building, cascading
  building dependencies, Unrest, famine, mercenary wages, combat with
  blockers/walls/siege, six reactions, chains and Momentum, Signatures,
  two victory paths and a turn-limit fallback.
- A browser client: title, civilization select, deck builder, human-vs-AI
  matches, online lobby with private rooms and invite links, rules primer,
  chronicle log, settings (animation speed, mute).
- An authoritative WebSocket server that also serves the client.
- 50 cards and 5 civilization emblems with original procedural SVG art,
  synthesized sound, and a premium tabletop presentation.

## 2. Playable civilizations

Kingdom of Kush, Kingdom of Aksum, Carthage, Sumer, Inca — each with a
distinct play style, 5–6 unique cards, a Signature ability and a 24-card
starter deck. Reasoning and history: `GAME_DESIGN.md` §9,
`HISTORY_NOTES.md`. The other 17 candidates are documented for expansion.

## 3. Mechanics implemented

Building tags and requirements with fixpoint support (cascades); Unrest;
food upkeep and famine; Wage desertion; Goods carry-over; walls; Ranged,
Siege, Swift, Raider keywords; exhaustion (attackers can't block next
turn); response windows with one reaction (Shield Wall, Ambush, Feigned
Retreat, Turn the Tide, Vigilant Watch, Mirror the Scheme); suit chains and
chain bonuses; set-style Legacy (Great Stele) and Goods (Mint); Spy Network
hand reveal; Momentum with Signature and Rally; Conquest and Legacy
victories; deck validation (24 cards, copy limits, civ restrictions).

Not implemented (considered, deferred): capturing buildings, building
upgrades into higher structures, optional real-time momentum bonuses
(deliberately omitted — no speed mechanics at all).

## 4. Technologies selected

React 19 + Vite 8 (client), `ws` (server), Vitest, TypeScript, esbuild,
self-hosted OFL fonts. All runtime dependencies MIT or OFL. A custom pure
reducer replaces boardgame.io (unmaintained since 2023). No 3D engine yet:
CSS perspective and event-driven animation instead. Full comparison:
`ARCHITECTURE.md`.

## 5. Launch and play

```bash
npm install
npm run dev          # http://localhost:5173 — play vs AI
npm run dev:server   # second terminal — enables online play
# or: npm run build && npm start  → everything on :8787
```

## 6. AI opponent — working

Easy / normal / hard. Legal-move enumeration plus simulation through the
engine and a heuristic evaluation; hard adds a rest-of-turn lookahead. No
resource cheats, no reading hidden hands. It builds economies, defends with
blockers and reactions, sabotages key supports and attacks weak points.
Verified to always produce legal actions and finish every match.

## 7. Online multiplayer — working for private rooms

Server-authoritative; create room → 5-letter code / invite link → join on
another device; per-seat redacted views; reconnection with seat tokens;
duplicate-submission protection; idle auto-pass; flood limits; deck
validation server-side.

Verified: socket-level tests (7) including a full match between two real
networked clients each acting only on its own redacted view, plus a
two-browser Playwright test (create → invite link → join → alternating
turns → reload → resume). Not yet: public matchmaking, accounts,
persistence across server restarts, load testing, a live public deployment
(none was created; no URL is claimed).

## 8. Mobile / iPad — designed for, partially verified

Touch-only interactions (tap to select/target/block; no hover or keyboard
needed), 40px+ tap targets, safe-area insets, `dvh` layout, landscape and
portrait layouts, container-query card text, iOS audio unlock on first
touch, Add-to-Home-Screen manifest, `prefers-reduced-motion` support.

Verified in headless **Chrome** at 1366×1024 (iPad Pro landscape),
820×1180 (portrait) and 844×390 (phone landscape) with touch emulation.
**Not verified on a physical iPad or in Safari/WebKit** — that is the most
important manual check remaining.

## 9. Tests and results

| Suite | Result |
|---|---|
| Engine rules (`packages/engine/test`) | 27/27 pass — data validity, determinism, turn rules, chains, dependency cascades, Unrest, famine, wages, combat, exhaustion, all reactions, siege, victories, redaction, Spy reveal, AI legality |
| Server (`apps/server/test`) | 7/7 pass — rooms, hidden info, illegal/out-of-turn/duplicate actions, decks, reconnection, forged tokens, flood throttling, full networked match |
| Typecheck | engine, client, server clean |
| Balance simulation | 400 normal + 160 hard AI games (see GAME_DESIGN §10) |
| Browser play-tests | Playwright + Chrome: 14-turn AI match with no page errors; two-browser online match with resume |

## 10. Known limitations

- **Balance under strong play:** the hard AI favours Inca (73%) and
  Carthage (69%); Sumer wins only 20%. Normal-AI results are 43–60% for
  all five. Needs human play-testing.
- Not tested on real iPad Safari.
- Hand cards are small on phones; full text is read by tapping a card.
- Rooms are in memory; a server restart ends live matches.
- Opponent's response window: when you attack the AI it answers almost
  instantly, so there is little suspense; online, the window waits for the
  human defender.
- Destroyed-building animation plays at the end of the row rather than the
  building's exact slot.
- No accounts, collection, matchmaking, rankings or spectators yet.
- Art is procedural vector illustration — clean and consistent, but not
  painted "premium" artwork.

## 11. Recommended next steps

1. Play-test on an iPad in Safari; fix any WebKit layout or audio issues.
2. Human balance sessions focused on Sumer and on cheap Swift aggression.
3. Deploy the single-process server (Render/Fly/VPS) to try real
   cross-network matches; add basic monitoring.
4. Persist rooms (SQLite or Redis) so matches survive restarts.
5. Add 2–3 civilizations from the roster (Egypt, Han China, Maya are
   strong, distinct candidates) — data-only work.
6. Optional Three.js diorama layer driven by the existing event stream,
   kept behind a performance toggle.
7. Commission or develop painted art to replace the procedural motifs on
   rare and wonder cards.
8. Accounts and saved decks, then public matchmaking.
