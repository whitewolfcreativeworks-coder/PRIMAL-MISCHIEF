# Deployment

## Option A — one Node service (recommended)

The server bundles to a single file and also serves the built client, so
one process gives you the whole game at `https://your-host/` with
WebSockets at `/ws`.

```bash
npm ci
npm run build          # builds apps/client/dist and apps/server/dist/server.js
PORT=8787 npm start    # node apps/server/dist/server.js
```

Or with Docker:

```bash
docker build -t primal-mischief .
docker run -p 8787:8787 primal-mischief
```

Any host that runs a long-lived Node process and allows WebSockets works
(Render, Fly.io, Railway, a small VPS). Health check: `GET /healthz`.

Put it behind HTTPS (most platforms do this automatically); the client then
uses `wss://` on the same origin with no configuration.

## Option B — GitHub Pages client + separate server

GitHub Pages can host the static client but **cannot run the multiplayer
server**. Single-player vs AI works entirely on Pages.

1. Deploy the server (Option A) somewhere, note its URL.
2. In the GitHub repo: *Settings → Pages → Source: GitHub Actions*.
3. *Settings → Variables → Actions*: add `PM_SERVER_URL` =
   `wss://your-server.example.com/ws`.
4. Run the **Deploy client to GitHub Pages** workflow.

Players can also override the server URL in the lobby under "Server".

## Configuration

See `.env.example`. All settings are environment variables; there are no
secrets or API keys anywhere in the client or server.

## Hosting requirements and cost

The server is light: in-memory rooms, one small JSON message per action
(each state message is a few KB). A single small instance (≈0.5 vCPU,
256–512 MB RAM) should comfortably serve hundreds of concurrent private
rooms; this has **not** been load-tested yet.

Indicative pricing checked November 2026 (verify before committing):

- **Render:** free web services work but sleep after 15 minutes without
  traffic and take about a minute to wake — fine for testing, poor for a
  friend waiting on an invite. The smallest paid always-on instance is
  $7/month (0.5 CPU, 512 MB) on the free "Hobby" workspace.
- **Fly.io / Railway / a VPS:** similar small-instance tiers in the
  low single-digit to ~$10/month range; check current pricing pages.
- **GitHub Pages:** free for the static client.

Bandwidth for a card game is negligible at small scale.

## Not yet in place (before a public launch)

- Persistent room storage (matches currently end if the server restarts).
- Accounts / authentication (seat tokens are per-room only).
- Horizontal scaling (rooms are pinned to one process).
- Load testing and monitoring.
