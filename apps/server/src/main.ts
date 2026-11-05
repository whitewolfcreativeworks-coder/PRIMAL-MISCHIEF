import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './server';

// Configuration via environment variables (see .env.example).
const here = dirname(fileURLToPath(import.meta.url));
const guess = [resolve(here, '../../client/dist'), resolve(process.cwd(), 'apps/client/dist')].find((p) => existsSync(p));
const staticDir = process.env.STATIC_DIR ?? guess ?? null;

void startServer({
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '0.0.0.0',
  staticDir: process.env.SERVE_CLIENT === 'false' ? null : staticDir,
  idleTimeoutMs: Number(process.env.IDLE_TIMEOUT_SECONDS ?? 600) * 1000,
  roomTtlMs: Number(process.env.ROOM_TTL_MINUTES ?? 30) * 60 * 1000,
});
