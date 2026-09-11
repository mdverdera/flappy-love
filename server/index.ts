// ─── WebSocket Server ─────────────────────────────────────────────────────────
// Standalone Node.js WS server.
// Local dev:  npx tsx server/index.ts
// Production: deployed on Railway — WS attaches to an HTTP server so Railway's
//             health-check (GET /) works and PORT env var is respected.

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { ClientMessage } from './types';
import {
  setSendFn,
  createPlayer,
  removePlayer,
  checkRateLimit,
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  handlePlayerState,
  handlePlayerGameOver,
  handleRematch,
} from './RoomManager';

// Railway injects PORT; fall back to WS_PORT for local dev, then 3001
const PORT = parseInt(process.env.PORT ?? process.env.WS_PORT ?? '3001', 10);

// HTTP server — satisfies Railway's health-check on GET /
const http = createServer((req: IncomingMessage, res: ServerResponse) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('FlappyLove WS OK');
});

const wss = new WebSocketServer({ server: http });

// Map from player ID → WebSocket
const sockets = new Map<string, WebSocket>();
// Map from WebSocket → player ID  (reverse lookup)
const socketIds = new WeakMap<WebSocket, string>();

// Register the send function with RoomManager
setSendFn((playerId: string, msg: object) => {
  const ws = sockets.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
});

wss.on('connection', (ws: WebSocket) => {
  const playerId = uuidv4();
  sockets.set(playerId, ws);
  socketIds.set(ws, playerId);
  createPlayer(playerId);

  ws.on('message', (raw: Buffer | string) => {
    const id = socketIds.get(ws);
    if (!id) return;

    // Rate limiting
    if (!checkRateLimit(id)) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Rate limit exceeded' }));
      return;
    }

    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw.toString()) as ClientMessage;
    } catch {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid message format' }));
      return;
    }

    switch (msg.type) {
      case 'CREATE_ROOM': {
        if (!msg.nickname?.trim()) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Nickname required' }));
          return;
        }
        createRoom(id, msg.nickname);
        break;
      }

      case 'JOIN_ROOM': {
        if (!msg.nickname?.trim()) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Nickname required' }));
          return;
        }
        if (!msg.roomCode?.trim()) {
          ws.send(JSON.stringify({ type: 'ERROR', message: 'Room code required' }));
          return;
        }
        joinRoom(id, msg.roomCode, msg.nickname);
        break;
      }

      case 'LEAVE_ROOM': {
        leaveRoom(id);
        break;
      }

      case 'START_GAME': {
        startGame(id);
        break;
      }

      case 'PLAYER_STATE': {
        if (typeof msg.y !== 'number' || typeof msg.vy !== 'number' ||
            typeof msg.score !== 'number' || typeof msg.roundId !== 'string') return;
        handlePlayerState(id, msg.y, msg.vy, msg.score, msg.roundId);
        break;
      }

      case 'PLAYER_GAME_OVER': {
        if (typeof msg.score !== 'number' || typeof msg.roundId !== 'string') return;
        handlePlayerGameOver(id, msg.score, msg.lovePoints ?? 0, msg.roundId);
        break;
      }

      case 'REQUEST_REMATCH': {
        handleRematch(id);
        break;
      }

      case 'PING': {
        ws.send(JSON.stringify({ type: 'PONG', ts: msg.ts }));
        break;
      }

      default: {
        // Unknown message — ignore silently
        break;
      }
    }
  });

  ws.on('close', () => {
    const id = socketIds.get(ws);
    if (id) {
      removePlayer(id);
      sockets.delete(id);
    }
  });

  ws.on('error', (err: Error) => {
    console.error('[WS] socket error', err.message);
  });
});

http.listen(PORT, () => {
  console.log(`[FlappyLove WS] Server listening on port ${PORT}`);
});

wss.on('error', (err: Error) => {
  console.error('[WS] Server error:', err);
});
