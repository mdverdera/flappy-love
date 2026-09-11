// ─── RoomManager ──────────────────────────────────────────────────────────────
// In-memory room + player management. No database — rooms are ephemeral.

import { randomUUID } from 'crypto';
import type { Room, ServerPlayer, PlayerInfo, RoundResult, PlayerColor } from './types';
import { PLAYER_COLORS } from './types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
const ROOM_CODE_LENGTH = 4;
const MAX_PLAYERS_PER_ROOM = 6;
const ROUND_DURATION_MS = 60_000;         // 60 s default round timer
const EMPTY_ROOM_TTL_MS = 30_000;         // remove room 30 s after last player leaves
const RATE_LIMIT_WINDOW_MS = 1_000;       // 1-second sliding window
const RATE_LIMIT_MAX_MESSAGES = 30;       // max messages per window
const MAX_IMPOSSIBLE_SCORE = 99_999;      // reject obviously cheated scores

// ── In-memory stores ──────────────────────────────────────────────────────────

const rooms = new Map<string, Room>();
const players = new Map<string, ServerPlayer>();

// WS send callback type — avoids importing ws here
type SendFn = (playerId: string, msg: object) => void;

let _send: SendFn = () => {};

export function setSendFn(fn: SendFn) {
  _send = fn;
}

function send(playerId: string, msg: object) {
  _send(playerId, msg);
}

function broadcast(room: Room, msg: object, excludeId?: string) {
  for (const id of room.players.keys()) {
    if (id !== excludeId) send(id, msg);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  let code: string;
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

function pickColor(room: Room): PlayerColor {
  const used = new Set([...room.players.values()].map(p => p.color));
  return PLAYER_COLORS.find(c => !used.has(c)) ?? PLAYER_COLORS[0];
}

function toPlayerInfo(p: ServerPlayer, hostId: string): PlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    color: p.color,
    isHost: p.id === hostId,
    isAlive: p.isAlive,
  };
}

function lobbyPlayers(room: Room): PlayerInfo[] {
  return [...room.players.values()].map(p => toPlayerInfo(p, room.hostId));
}

function checkRoundEnd(room: Room) {
  const alive = [...room.players.values()].filter(p => p.isAlive);
  if (alive.length === 0) {
    endRound(room);
  }
}

function endRound(room: Room) {
  if (room.status !== 'PLAYING' && room.status !== 'COUNTDOWN') return;
  if (room.roundTimer) { clearTimeout(room.roundTimer); room.roundTimer = null; }

  room.status = 'RESULTS';

  const results: RoundResult[] = [...room.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      playerId: p.id,
      nickname: p.nickname,
      color: p.color,
      score: p.score,
      lovePoints: p.lovePoints,
      rank: i + 1,
    }));

  broadcast(room, { type: 'ROUND_END', results });
}

function scheduleEmptyRoomCleanup(code: string) {
  const room = rooms.get(code);
  if (!room) return;
  if (room.emptyTimer) clearTimeout(room.emptyTimer);
  room.emptyTimer = setTimeout(() => {
    if (rooms.get(code)?.players.size === 0) {
      rooms.delete(code);
    }
  }, EMPTY_ROOM_TTL_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createPlayer(id: string): ServerPlayer {
  const player: ServerPlayer = {
    id,
    nickname: '',
    color: '❤️',
    roomCode: null,
    isAlive: true,
    score: 0,
    lovePoints: 0,
    lastState: null,
    lastMessageAt: Date.now(),
    messageCount: 0,
    messageWindowStart: Date.now(),
  };
  players.set(id, player);
  return player;
}

export function getPlayer(id: string): ServerPlayer | undefined {
  return players.get(id);
}

export function removePlayer(id: string) {
  const player = players.get(id);
  if (!player) return;

  if (player.roomCode) {
    leaveRoom(id);
  }
  players.delete(id);
}

/** Returns true if the message should be processed (false = rate limited). */
export function checkRateLimit(playerId: string): boolean {
  const player = players.get(playerId);
  if (!player) return false;

  const now = Date.now();
  if (now - player.messageWindowStart > RATE_LIMIT_WINDOW_MS) {
    player.messageWindowStart = now;
    player.messageCount = 0;
  }
  player.messageCount++;
  player.lastMessageAt = now;

  return player.messageCount <= RATE_LIMIT_MAX_MESSAGES;
}

// ── Room operations ───────────────────────────────────────────────────────────

export function createRoom(playerId: string, nickname: string): Room | { error: string } {
  const player = players.get(playerId);
  if (!player) return { error: 'Unknown player' };

  // Clean up any existing room membership
  if (player.roomCode) leaveRoom(playerId);

  const code = generateRoomCode();
  const color = PLAYER_COLORS[0];

  player.nickname = nickname.slice(0, 20).trim();
  player.color = color;
  player.roomCode = code;
  player.isAlive = true;
  player.score = 0;
  player.lovePoints = 0;

  const room: Room = {
    code,
    hostId: playerId,
    status: 'LOBBY',
    players: new Map([[playerId, player]]),
    roundId: null,
    roundSeed: null,
    roundStartTime: null,
    roundTimer: null,
    emptyTimer: null,
    createdAt: Date.now(),
  };

  rooms.set(code, room);

  send(playerId, {
    type: 'ROOM_CREATED',
    roomCode: code,
    playerId,
    color,
  });

  return room;
}

export function joinRoom(playerId: string, roomCode: string, nickname: string): void {
  const player = players.get(playerId);
  if (!player) { send(playerId, { type: 'ERROR', message: 'Unknown player' }); return; }

  const code = roomCode.toUpperCase().trim();
  const room = rooms.get(code);

  if (!room) { send(playerId, { type: 'ERROR', message: 'Room not found' }); return; }
  if (room.status !== 'LOBBY') { send(playerId, { type: 'ERROR', message: 'Game already in progress' }); return; }
  if (room.players.size >= MAX_PLAYERS_PER_ROOM) { send(playerId, { type: 'ERROR', message: 'Room is full' }); return; }

  const trimmed = nickname.slice(0, 20).trim();
  if (!trimmed) { send(playerId, { type: 'ERROR', message: 'Nickname required' }); return; }

  // Duplicate nickname check
  for (const p of room.players.values()) {
    if (p.nickname.toLowerCase() === trimmed.toLowerCase()) {
      send(playerId, { type: 'ERROR', message: 'Nickname already taken' }); return;
    }
  }

  // Clean up existing room membership
  if (player.roomCode) leaveRoom(playerId);

  const color = pickColor(room);
  player.nickname = trimmed;
  player.color = color;
  player.roomCode = code;
  player.isAlive = true;
  player.score = 0;
  player.lovePoints = 0;
  room.players.set(playerId, player);

  send(playerId, {
    type: 'ROOM_JOINED',
    roomCode: code,
    playerId,
    color,
    players: lobbyPlayers(room),
    isHost: false,
  });

  // Notify others
  broadcast(room, { type: 'PLAYER_JOINED', player: toPlayerInfo(player, room.hostId) }, playerId);
}

export function leaveRoom(playerId: string) {
  const player = players.get(playerId);
  if (!player || !player.roomCode) return;

  const room = rooms.get(player.roomCode);
  player.roomCode = null;
  if (!room) return;

  room.players.delete(playerId);

  let newHostId: string | undefined;

  if (room.players.size === 0) {
    // Clean up timers
    if (room.roundTimer) clearTimeout(room.roundTimer);
    scheduleEmptyRoomCleanup(room.code);
  } else {
    // Host migration
    if (room.hostId === playerId) {
      newHostId = [...room.players.keys()][0];
      room.hostId = newHostId;
    }

    broadcast(room, { type: 'PLAYER_LEFT', playerId, newHostId });

    // If game in progress and everyone else is out, end the round
    if (room.status === 'PLAYING') {
      player.isAlive = false;
      checkRoundEnd(room);
    }
  }
}

export function startGame(playerId: string) {
  const player = players.get(playerId);
  if (!player || !player.roomCode) { send(playerId, { type: 'ERROR', message: 'Not in a room' }); return; }

  const room = rooms.get(player.roomCode);
  if (!room) return;
  if (room.hostId !== playerId) { send(playerId, { type: 'ERROR', message: 'Only the host can start' }); return; }
  if (room.status !== 'LOBBY') { send(playerId, { type: 'ERROR', message: 'Game already started' }); return; }
  if (room.players.size < 1) { send(playerId, { type: 'ERROR', message: 'Need at least 1 player' }); return; }

  room.status = 'COUNTDOWN';

  // Reset player state
  for (const p of room.players.values()) {
    p.isAlive = true;
    p.score = 0;
    p.lovePoints = 0;
    p.lastState = null;
  }

  // Countdown: 3, 2, 1, 0 (one per second)
  let count = 3;
  broadcast(room, { type: 'COUNTDOWN', value: count });

  const interval = setInterval(() => {
    count--;
    broadcast(room, { type: 'COUNTDOWN', value: count });

    if (count <= 0) {
      clearInterval(interval);

      // Generate round
      const roundId = randomUUID();
      const seed = Math.floor(Math.random() * 2_147_483_647);
      const startTime = Date.now() + 200; // 200ms buffer for message delivery

      room.roundId = roundId;
      room.roundSeed = seed;
      room.roundStartTime = startTime;
      room.status = 'PLAYING';

      broadcast(room, { type: 'GAME_START', roundId, seed, startTime });

      // Round timer — end round after ROUND_DURATION_MS
      room.roundTimer = setTimeout(() => endRound(room), ROUND_DURATION_MS);
    }
  }, 1000);
}

export function handlePlayerState(playerId: string, y: number, vy: number, score: number, roundId: string) {
  const player = players.get(playerId);
  if (!player || !player.roomCode) return;

  const room = rooms.get(player.roomCode);
  if (!room || room.status !== 'PLAYING' || room.roundId !== roundId) return;

  // Clamp score to sanity check (passive growth validation done client-side)
  player.lastState = { y, vy };
  if (score > 0 && score <= MAX_IMPOSSIBLE_SCORE) {
    player.score = score;
  }

  // Broadcast to other players in room
  broadcast(room, {
    type: 'REMOTE_STATE',
    playerId,
    y,
    vy,
    score,
  }, playerId);
}

export function handlePlayerGameOver(playerId: string, score: number, lovePoints: number, roundId: string) {
  const player = players.get(playerId);
  if (!player || !player.roomCode) return;

  const room = rooms.get(player.roomCode);
  if (!room || room.roundId !== roundId) return;

  player.isAlive = false;

  // Validate score reasonableness
  const clampedScore = Math.min(Math.max(0, score), MAX_IMPOSSIBLE_SCORE);
  const clampedLove = Math.min(Math.max(0, lovePoints), 9999);
  player.score = clampedScore;
  player.lovePoints = clampedLove;

  broadcast(room, {
    type: 'REMOTE_GAME_OVER',
    playerId,
    score: clampedScore,
    lovePoints: clampedLove,
  });

  if (room.status === 'PLAYING') {
    checkRoundEnd(room);
  }
}

export function handleRematch(playerId: string) {
  const player = players.get(playerId);
  if (!player || !player.roomCode) return;

  const room = rooms.get(player.roomCode);
  if (!room) return;
  if (room.hostId !== playerId) { send(playerId, { type: 'ERROR', message: 'Only the host can start a rematch' }); return; }
  if (room.status !== 'RESULTS') { send(playerId, { type: 'ERROR', message: 'Round not complete yet' }); return; }

  room.status = 'LOBBY';
  room.roundId = null;
  room.roundSeed = null;
  room.roundStartTime = null;

  for (const p of room.players.values()) {
    p.isAlive = true;
    p.score = 0;
    p.lovePoints = 0;
  }

  broadcast(room, {
    type: 'BACK_TO_LOBBY',
    players: lobbyPlayers(room),
    hostId: room.hostId,
  });
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function getRooms(): Map<string, Room> {
  return rooms;
}
