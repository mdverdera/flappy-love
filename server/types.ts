// ─── Shared WebSocket message protocol ────────────────────────────────────────
// Used by both server and client (client imports from src/multiplayer/types.ts
// which mirrors this file).

// ── Directions ────────────────────────────────────────────────────────────────

/** Messages the CLIENT sends to the SERVER */
export type ClientMessage =
  | { type: 'CREATE_ROOM'; nickname: string }
  | { type: 'JOIN_ROOM';   nickname: string; roomCode: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_STATE'; y: number; vy: number; score: number; roundId: string }
  | { type: 'PLAYER_GAME_OVER'; score: number; lovePoints: number; roundId: string }
  | { type: 'REQUEST_REMATCH' }
  | { type: 'PING'; ts: number };

/** Messages the SERVER sends to the CLIENT */
export type ServerMessage =
  | { type: 'ROOM_CREATED';   roomCode: string; playerId: string; color: string }
  | { type: 'ROOM_JOINED';    roomCode: string; playerId: string; color: string; players: PlayerInfo[]; isHost: boolean }
  | { type: 'PLAYER_JOINED';  player: PlayerInfo }
  | { type: 'PLAYER_LEFT';    playerId: string; newHostId?: string }
  | { type: 'LOBBY_STATE';    players: PlayerInfo[]; hostId: string }
  | { type: 'COUNTDOWN';      value: number }           // 3, 2, 1, 0 (0 = FLY!)
  | { type: 'GAME_START';     roundId: string; seed: number; startTime: number }
  | { type: 'REMOTE_STATE';   playerId: string; y: number; vy: number; score: number }
  | { type: 'REMOTE_GAME_OVER'; playerId: string; score: number; lovePoints: number }
  | { type: 'ROUND_END';      results: RoundResult[] }
  | { type: 'BACK_TO_LOBBY';  players: PlayerInfo[]; hostId: string }
  | { type: 'ERROR';          message: string }
  | { type: 'PONG';           ts: number };

// ── Shared data shapes ────────────────────────────────────────────────────────

export type PlayerColor = '❤️' | '💙' | '💜' | '💚' | '🧡' | '💛';

export const PLAYER_COLORS: PlayerColor[] = ['❤️', '💙', '💜', '💚', '🧡', '💛'];

export interface PlayerInfo {
  id: string;
  nickname: string;
  color: PlayerColor;
  isHost: boolean;
  isAlive: boolean;
}

export interface RoundResult {
  playerId: string;
  nickname: string;
  color: PlayerColor;
  score: number;
  lovePoints: number;
  rank: number;
}

// ── Room state (server-side only) ─────────────────────────────────────────────

export type RoomStatus = 'LOBBY' | 'COUNTDOWN' | 'PLAYING' | 'RESULTS';

export interface Room {
  code: string;
  hostId: string;
  status: RoomStatus;
  players: Map<string, ServerPlayer>;
  roundId: string | null;
  roundSeed: number | null;
  roundStartTime: number | null;
  roundTimer: NodeJS.Timeout | null;
  emptyTimer: NodeJS.Timeout | null;
  createdAt: number;
}

export interface ServerPlayer {
  id: string;
  nickname: string;
  color: PlayerColor;
  roomCode: string | null;
  isAlive: boolean;
  score: number;
  lovePoints: number;
  lastState: { y: number; vy: number } | null;
  lastMessageAt: number;
  messageCount: number;        // rolling count for rate-limit
  messageWindowStart: number;  // start of current rate-limit window
}
