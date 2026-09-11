// ─── Client-side multiplayer types ────────────────────────────────────────────
// Mirrors server/types.ts for the browser bundle.
// Keep in sync with server/types.ts.

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

// ── Messages CLIENT → SERVER ──────────────────────────────────────────────────

export type ClientMessage =
  | { type: 'CREATE_ROOM'; nickname: string }
  | { type: 'JOIN_ROOM';   nickname: string; roomCode: string }
  | { type: 'LEAVE_ROOM' }
  | { type: 'START_GAME' }
  | { type: 'PLAYER_STATE'; y: number; vy: number; score: number; roundId: string }
  | { type: 'PLAYER_GAME_OVER'; score: number; lovePoints: number; roundId: string }
  | { type: 'REQUEST_REMATCH' }
  | { type: 'PING'; ts: number };

// ── Messages SERVER → CLIENT ──────────────────────────────────────────────────

export type ServerMessage =
  | { type: 'ROOM_CREATED';   roomCode: string; playerId: string; color: PlayerColor }
  | { type: 'ROOM_JOINED';    roomCode: string; playerId: string; color: PlayerColor; players: PlayerInfo[]; isHost: boolean }
  | { type: 'PLAYER_JOINED';  player: PlayerInfo }
  | { type: 'PLAYER_LEFT';    playerId: string; newHostId?: string }
  | { type: 'LOBBY_STATE';    players: PlayerInfo[]; hostId: string }
  | { type: 'COUNTDOWN';      value: number }
  | { type: 'GAME_START';     roundId: string; seed: number; startTime: number }
  | { type: 'REMOTE_STATE';   playerId: string; y: number; vy: number; score: number }
  | { type: 'REMOTE_GAME_OVER'; playerId: string; score: number; lovePoints: number }
  | { type: 'ROUND_END';      results: RoundResult[] }
  | { type: 'BACK_TO_LOBBY';  players: PlayerInfo[]; hostId: string }
  | { type: 'ERROR';          message: string }
  | { type: 'PONG';           ts: number };

// ── App-level multiplayer state ───────────────────────────────────────────────

export type MultiplayerScreen =
  | 'MENU'
  | 'LOBBY'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'RESULTS';

export interface MultiplayerState {
  screen: MultiplayerScreen;
  // Connection
  connected: boolean;
  // Self
  playerId: string | null;
  nickname: string;
  color: PlayerColor | null;
  isHost: boolean;
  // Room
  roomCode: string | null;
  players: PlayerInfo[];
  // Round
  roundId: string | null;
  roundSeed: number | null;
  roundStartTime: number | null;
  countdownValue: number | null;
  // Results
  results: RoundResult[];
  // Remote player Y positions (for rendering ghosts)
  remoteStates: Record<string, { y: number; vy: number; score: number }>;
  // Error
  error: string | null;
}

export const INITIAL_MULTIPLAYER_STATE: MultiplayerState = {
  screen: 'MENU',
  connected: false,
  playerId: null,
  nickname: '',
  color: null,
  isHost: false,
  roomCode: null,
  players: [],
  roundId: null,
  roundSeed: null,
  roundStartTime: null,
  countdownValue: null,
  results: [],
  remoteStates: {},
  error: null,
};
