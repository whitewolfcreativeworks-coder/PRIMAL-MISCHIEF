// Wire protocol shared by the client and the authoritative multiplayer server.
import type { Action, CivId, GameEvent, GameState, PlayerId } from './types';

export type ClientMsg =
  | { t: 'create'; name: string; civ: CivId; deck?: string[] }
  | { t: 'join'; code: string; name: string; civ: CivId; deck?: string[] }
  | { t: 'resume'; code: string; token: string }
  | { t: 'action'; seq: number; action: Action }
  | { t: 'leave' }
  | { t: 'ping' };

export type ServerMsg =
  | { t: 'joined'; code: string; seat: PlayerId; token: string }
  | { t: 'waiting'; code: string }
  | { t: 'state'; view: GameState; events: GameEvent[]; seat: PlayerId; opponentConnected: boolean; ackSeq: number }
  | { t: 'opponent'; connected: boolean }
  | { t: 'error'; message: string; seq?: number; fatal?: boolean }
  | { t: 'pong' };

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
