# Primal Mischief

**Build civilizations. Dismantle theirs.**

A turn-based civilization-building card battler for the browser, designed
mobile-first for iPad. Choose a historical civilization, raise a city whose
buildings depend on one another, then outmanoeuvre your rival with armies,
sabotage and reversals — against the computer or a friend online.

- 5 civilizations: **Kush, Aksum, Carthage, Sumer, Inca**
- 50 cards with original procedural artwork
- Two victory paths: Conquest and Legacy
- Reactions during your opponent's turn: ambush, retreat, *Turn the Tide*, *Mirror the Scheme*
- AI opponent (easy / normal / hard) and private online rooms
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

### Production build (single process)

```bash
npm run build
npm start              # serves the game and WebSocket server on :8787
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Docker, hosting options,
GitHub Pages and costs.

## How to play (short)

1. Each turn you gain Goods, Food and Legacy, then draw.
2. Spend Goods on buildings, units and actions. Buildings support each
   other — Markets need Roads, Barracks need Farms. Knock out a support
   and the whole chain stops.
3. Tap glowing units, then the enemy city or a building, to attack.
   Units that attack can't block on the next enemy turn.
4. When attacked or schemed against, choose blockers and optionally one
   Reaction.
5. Play same-suit cards in a row to **chain** for Momentum; spend it on
   your civilization's Signature.
6. Win by reducing the rival's Stability to 0, or by reaching 20 Legacy.

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
