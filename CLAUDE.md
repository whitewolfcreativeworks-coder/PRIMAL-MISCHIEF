# Notes for AI agents and developers

- The rules engine (`packages/engine`) is the source of truth. All state
  changes go through `applyAction`; keep it pure and deterministic (use the
  state's RNG via `rng.ts`, never `Math.random`).
- Cards are data. Prefer adding an `Effect` op over special-casing a card.
- Never send full state to a client: the server must use `viewFor`.
- After changing cards or rules: `npm test` and `npm run simulate -- 20 normal`
  (and `8 hard`); update the balance table in `docs/GAME_DESIGN.md`.
- New dependencies or assets must be recorded in `THIRD_PARTY_NOTICES.md`
  with licence; no GPL/AGPL, no non-commercial or unlicensed assets.
- Historical content: follow `docs/HISTORY_NOTES.md` (dignity, hedged
  claims, no sacred iconography, no caricature).
- Target: iPad Safari, touch only. No hover-only or keyboard-only
  interactions; keep tap targets ≥ 40px.
- Every animation duration must scale with the CSS `--pace` variable.
