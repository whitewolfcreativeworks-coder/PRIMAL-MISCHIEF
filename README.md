# Primal Mischief

**Build civilizations. Dismantle theirs.**

A turn-based civilization card battler for the browser, designed mobile-first
for iPad. Two civilizations face each other across a river. Every turn you
choose, blind, how many cards to draw from your **Civilization** deck (growth)
and your **Military** deck (armies, forts, tactics, reactions). Grow through
five Ages to a Golden Age, or cross the river and break your rival’s city.

- 5 civilizations, each with two decks across five Ages: **Kush, Aksum, Carthage, Sumer, Inca**
- Riverbank cities that visibly grow with each Age
- Hologram battles over the river: every card you play is acted out
- Reactions on your rival’s turn: ambush, retreat, turn the tide, treaty, foil, mirror
- AI opponent (easy / normal / hard), private online rooms, and an Academy lesson per civilization
- No timers, no purchases, no blockchain

## Play locally

Requires Node.js 20+.

```bash
npm install
npm run dev            # client at http://localhost:5173 (play vs AI)
npm run dev:server     # (second terminal) game server for online play on :8787
```

Open `http://<your-computer's-LAN-IP>:5173` on an iPad on the same Wi-Fi to
play on the tablet. For online play, both devices must reach the server;
the client automatically talks to port 8787 on the same host in dev.

### Single-file offline edition (vs computer, no server)

```bash
node scripts/build-standalone.mjs   # → apps/client/dist-standalone/primal-mischief.html
```

One ~740 KB HTML file with everything inlined. Open it in any browser,
including Safari on iPad. Online play is hidden in this edition.

### Production build (single process)

```bash
npm run build
npm start              # serves the game and WebSocket server on :8787
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Docker, hosting options,
GitHub Pages and costs.

## How to play (short)

1. Each turn you collect Prosperity and pay your army’s upkeep.
2. Refill your hand to 6, choosing how many cards come from each deck.
3. Play Civilization cards for Progress; a full bar advances your Age and
   puts stronger cards into both decks.
4. Deploy units, then send them across the river at the rival’s city or one
   of their buildings. Defenders get +1 Strength on their own bank.
5. On your rival’s turn, block and play one reaction.
6. Win by completing Age V (Golden Age) or bringing the rival’s Stability to 0.

Full rules: [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md).

## Development

```bash
npm test               # engine rules tests + real-socket server tests
npm run typecheck
npm run simulate -- 20 normal   # AI-vs-AI balance report
```

| Path | What |
|---|---|
| `packages/engine` | Deterministic rules engine, card data, AI, protocol |
| `apps/client` | Vite + React client |
| `apps/server` | Authoritative WebSocket server |
| `docs/` | Design, architecture, history notes, deployment, dev report |

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Historical grounding: [docs/HISTORY_NOTES.md](docs/HISTORY_NOTES.md)
- Development report: [docs/DEVELOPMENT_REPORT.md](docs/DEVELOPMENT_REPORT.md)
- Licences and attribution: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

© Primal Mischief. All rights reserved. Third-party components are used
under their own licences (see THIRD_PARTY_NOTICES.md).
