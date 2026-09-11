'use client';

import React, { useEffect, useRef, useCallback, useState, useReducer } from 'react';
import { MultiplayerClient } from '@/multiplayer/client';
import type { MultiplayerState, ServerMessage, PlayerInfo, RoundResult } from '@/multiplayer/types';
import { INITIAL_MULTIPLAYER_STATE } from '@/multiplayer/types';
import GameCanvas from './GameCanvas';
import LobbyScreen from './LobbyScreen';
import ResultsScreen from './ResultsScreen';
import ConnectionBadge from './ConnectionBadge';
import { CANVAS_WIDTH } from '@/game/constants';

// ── Reducer ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CONNECTED'; connected: boolean }
  | { type: 'ROOM_CREATED'; roomCode: string; playerId: string; color: string; nickname: string }
  | { type: 'ROOM_JOINED'; roomCode: string; playerId: string; color: string; players: PlayerInfo[]; isHost: boolean; nickname: string }
  | { type: 'PLAYER_JOINED'; player: PlayerInfo }
  | { type: 'PLAYER_LEFT'; playerId: string; newHostId?: string }
  | { type: 'COUNTDOWN'; value: number }
  | { type: 'GAME_START'; roundId: string; seed: number; startTime: number }
  | { type: 'REMOTE_STATE'; playerId: string; y: number; vy: number; score: number }
  | { type: 'REMOTE_GAME_OVER'; playerId: string; score: number; lovePoints: number }
  | { type: 'ROUND_END'; results: RoundResult[] }
  | { type: 'BACK_TO_LOBBY'; players: PlayerInfo[]; hostId: string }
  | { type: 'SET_ERROR'; message: string | null }
  | { type: 'LEAVE_ROOM' }
  | { type: 'GO_SOLO' };

function reducer(state: MultiplayerState, action: Action): MultiplayerState {
  switch (action.type) {
    case 'SET_CONNECTED':
      return { ...state, connected: action.connected };

    case 'ROOM_CREATED':
      return {
        ...state,
        screen: 'LOBBY',
        roomCode: action.roomCode,
        playerId: action.playerId,
        color: action.color as MultiplayerState['color'],
        isHost: true,
        nickname: action.nickname,
        players: [{
          id: action.playerId,
          nickname: action.nickname,
          color: action.color as PlayerInfo['color'],
          isHost: true,
          isAlive: true,
        }],
        error: null,
      };

    case 'ROOM_JOINED':
      return {
        ...state,
        screen: 'LOBBY',
        roomCode: action.roomCode,
        playerId: action.playerId,
        color: action.color as MultiplayerState['color'],
        isHost: action.isHost,
        nickname: action.nickname,
        players: action.players,
        error: null,
      };

    case 'PLAYER_JOINED': {
      const already = state.players.some(p => p.id === action.player.id);
      return {
        ...state,
        players: already ? state.players : [...state.players, action.player],
      };
    }

    case 'PLAYER_LEFT': {
      const newPlayers = state.players.filter(p => p.id !== action.playerId);
      const newIsHost = action.newHostId ? action.newHostId === state.playerId : state.isHost;
      // Update host flag in player list
      const updatedPlayers = newPlayers.map(p => ({
        ...p,
        isHost: action.newHostId ? p.id === action.newHostId : p.isHost,
      }));
      return {
        ...state,
        players: updatedPlayers,
        isHost: newIsHost,
      };
    }

    case 'COUNTDOWN':
      return { ...state, screen: 'COUNTDOWN', countdownValue: action.value };

    case 'GAME_START':
      return {
        ...state,
        screen: 'PLAYING',
        roundId: action.roundId,
        roundSeed: action.seed,
        roundStartTime: action.startTime,
        countdownValue: null,
        remoteStates: {},
      };

    case 'REMOTE_STATE': {
      return {
        ...state,
        remoteStates: {
          ...state.remoteStates,
          [action.playerId]: { y: action.y, vy: action.vy, score: action.score },
        },
      };
    }

    case 'REMOTE_GAME_OVER': {
      const updatedPlayers = state.players.map(p =>
        p.id === action.playerId ? { ...p, isAlive: false } : p
      );
      return { ...state, players: updatedPlayers };
    }

    case 'ROUND_END':
      return { ...state, screen: 'RESULTS', results: action.results };

    case 'BACK_TO_LOBBY': {
      const updatedPlayers = action.players.map(p => ({
        ...p,
        isHost: p.id === action.hostId,
      }));
      return {
        ...state,
        screen: 'LOBBY',
        players: updatedPlayers,
        isHost: action.hostId === state.playerId,
        roundId: null,
        roundSeed: null,
        roundStartTime: null,
        results: [],
        remoteStates: {},
        countdownValue: null,
        error: null,
      };
    }

    case 'SET_ERROR':
      return { ...state, error: action.message };

    case 'LEAVE_ROOM':
      return {
        ...INITIAL_MULTIPLAYER_STATE,
        connected: state.connected,
        screen: 'LOBBY',
      };

    case 'GO_SOLO':
      return { ...INITIAL_MULTIPLAYER_STATE, connected: state.connected, screen: 'MENU' };

    default:
      return state;
  }
}

// ── MultiplayerShell ──────────────────────────────────────────────────────────

export default function MultiplayerShell() {
  const [mp, dispatch] = useReducer(reducer, INITIAL_MULTIPLAYER_STATE);
  const clientRef = useRef<MultiplayerClient | null>(null);
  const [soloMode, setSoloMode] = useState(false);

  // Stores the nickname between send and server response
  const pendingNicknameRef = useRef('');

  // ── Connect once on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const client = new MultiplayerClient();
    clientRef.current = client;

    const offStatus = client.onStatus(connected => {
      dispatch({ type: 'SET_CONNECTED', connected });
    });

    const offMessage = client.onMessage((msg: ServerMessage) => {
      switch (msg.type) {
        case 'ROOM_CREATED':
          // nickname stored in pending ref — we pass it along via ref below
          dispatch({
            type: 'ROOM_CREATED',
            roomCode: msg.roomCode,
            playerId: msg.playerId,
            color: msg.color,
            nickname: pendingNicknameRef.current,
          });
          break;

        case 'ROOM_JOINED':
          dispatch({
            type: 'ROOM_JOINED',
            roomCode: msg.roomCode,
            playerId: msg.playerId,
            color: msg.color,
            players: msg.players,
            isHost: msg.isHost,
            nickname: pendingNicknameRef.current,
          });
          break;

        case 'PLAYER_JOINED':
          dispatch({ type: 'PLAYER_JOINED', player: msg.player });
          break;

        case 'PLAYER_LEFT':
          dispatch({ type: 'PLAYER_LEFT', playerId: msg.playerId, newHostId: msg.newHostId });
          break;

        case 'COUNTDOWN':
          dispatch({ type: 'COUNTDOWN', value: msg.value });
          break;

        case 'GAME_START':
          dispatch({ type: 'GAME_START', roundId: msg.roundId, seed: msg.seed, startTime: msg.startTime });
          break;

        case 'REMOTE_STATE':
          dispatch({ type: 'REMOTE_STATE', playerId: msg.playerId, y: msg.y, vy: msg.vy, score: msg.score });
          break;

        case 'REMOTE_GAME_OVER':
          dispatch({ type: 'REMOTE_GAME_OVER', playerId: msg.playerId, score: msg.score, lovePoints: msg.lovePoints });
          break;

        case 'ROUND_END':
          dispatch({ type: 'ROUND_END', results: msg.results });
          break;

        case 'BACK_TO_LOBBY':
          dispatch({ type: 'BACK_TO_LOBBY', players: msg.players, hostId: msg.hostId });
          break;

        case 'ERROR':
          dispatch({ type: 'SET_ERROR', message: msg.message });
          setTimeout(() => dispatch({ type: 'SET_ERROR', message: null }), 4000);
          break;

        default:
          break;
      }
    });

    client.connect();

    return () => {
      offStatus();
      offMessage();
      client.disconnect();
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleCreateRoom = useCallback((nickname: string) => {
    pendingNicknameRef.current = nickname;
    clientRef.current?.send({ type: 'CREATE_ROOM', nickname });
  }, []);

  const handleJoinRoom = useCallback((nickname: string, roomCode: string) => {
    pendingNicknameRef.current = nickname;
    clientRef.current?.send({ type: 'JOIN_ROOM', nickname, roomCode });
  }, []);

  const handleStartGame = useCallback(() => {
    clientRef.current?.send({ type: 'START_GAME' });
  }, []);

  const handleLeaveRoom = useCallback(() => {
    clientRef.current?.send({ type: 'LEAVE_ROOM' });
    dispatch({ type: 'LEAVE_ROOM' });
  }, []);

  const handleRematch = useCallback(() => {
    clientRef.current?.send({ type: 'REQUEST_REMATCH' });
  }, []);

  const handleGoSolo = useCallback(() => {
    if (mp.roomCode) clientRef.current?.send({ type: 'LEAVE_ROOM' });
    setSoloMode(true);
  }, [mp.roomCode]);

  const handleGameOver = useCallback((score: number, lovePoints: number) => {
    if (mp.roundId) {
      clientRef.current?.send({
        type: 'PLAYER_GAME_OVER',
        score,
        lovePoints,
        roundId: mp.roundId,
      });
    }
  }, [mp.roundId]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Solo mode: show standard GameCanvas; "🌐 Multiplayer" button lives inside the menu overlay
  if (soloMode) {
    return (
      <div className="relative select-none" style={{ width: CANVAS_WIDTH, maxWidth: '100%' }}>
        <GameCanvas onGoMultiplayer={() => setSoloMode(false)} />
      </div>
    );
  }

  // Multiplayer mode: show lobby / countdown overlay / game / results on top of canvas
  return (
    <div className="relative select-none" style={{ width: CANVAS_WIDTH, maxWidth: '100%' }}>
      {/* Countdown overlay — shown before game canvas mounts */}
      {mp.screen === 'COUNTDOWN' && (
        <CountdownPlaceholder value={mp.countdownValue} />
      )}

      {/* Game canvas — only mounted when actually playing (avoids gravity during countdown) */}
      {mp.screen === 'PLAYING' && (
        <GameCanvas
          multiplayerMode
          roundId={mp.roundId ?? undefined}
          remotePlayers={mp.players.filter(p => p.id !== mp.playerId)}
          remoteStates={mp.remoteStates}
          onMultiplayerGameOver={handleGameOver}
          onSendState={(y, vy, score) => {
            if (mp.roundId) {
              clientRef.current?.send({ type: 'PLAYER_STATE', y, vy, score, roundId: mp.roundId });
            }
          }}
        />
      )}

      {/* Lobby / menu screens */}
      {(mp.screen === 'MENU' || mp.screen === 'LOBBY') && (
        <div style={{
          width: '100%',
          height: 0,
          paddingBottom: `${(640 / 480) * 100}%`,
          position: 'relative',
          background: 'linear-gradient(135deg, #1a0030 0%, #3d0026 50%, #1a0030 100%)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <LobbyScreen
              mp={mp}
              connected={mp.connected}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onStartGame={handleStartGame}
              onLeaveRoom={handleLeaveRoom}
              onPlaySolo={handleGoSolo}
            />
          </div>
        </div>
      )}

      {/* Results screen */}
      {mp.screen === 'RESULTS' && (
        <div style={{
          width: '100%',
          height: 0,
          paddingBottom: `${(640 / 480) * 100}%`,
          position: 'relative',
          background: 'linear-gradient(135deg, #1a0030 0%, #3d0026 50%, #1a0030 100%)',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <ResultsScreen
              mp={mp}
              onRematch={handleRematch}
              onLeave={handleLeaveRoom}
            />
          </div>
        </div>
      )}

      {/* Connection badge (visible during play) */}
      {(mp.screen === 'PLAYING') && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 20 }}>
          <ConnectionBadge connected={mp.connected} />
        </div>
      )}
    </div>
  );
}

// ── Countdown placeholder ─────────────────────────────────────────────────────
// A standalone full-canvas-sized div shown INSTEAD of the game canvas during
// the server countdown. No game loop runs — no gravity, no player falling.

function CountdownPlaceholder({ value }: { value: number | null }) {
  const label = value === null ? '' : value <= 0 ? '❤️ FLY!' : String(value);

  return (
    <div
      style={{
        width: '100%',
        height: 0,
        paddingBottom: `${(640 / 480) * 100}%`,
        position: 'relative',
        background: 'linear-gradient(180deg, #1a0030 0%, #3d0026 60%, #1a0030 100%)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <div
          key={label}
          className="text-white font-black text-center"
          style={{
            fontSize: value !== null && value <= 0 ? 64 : 120,
            lineHeight: 1,
            textShadow: '0 0 40px rgba(255,77,109,0.9)',
            animation: 'countPop 0.35s ease-out',
          }}
        >
          {label}
        </div>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, margin: 0 }}>
          {value !== null && value <= 0 ? 'Tap / Click / Space to flap!' : 'Get ready…'}
        </p>
      </div>
      <style>{`
        @keyframes countPop {
          from { transform: scale(1.5); opacity: 0.3; }
          to   { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
