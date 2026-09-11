'use client';

import React, { useState, useCallback } from 'react';
import type { MultiplayerState, PlayerInfo } from '@/multiplayer/types';
import ConnectionBadge from './ConnectionBadge';

// ── Shared styles ────────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
  boxShadow: '0 4px 16px rgba(255,77,109,0.4)',
  border: 'none',
  borderRadius: '9999px',
  color: '#fff',
  fontWeight: 900,
  fontSize: 15,
  padding: '11px 28px',
  cursor: 'pointer',
  width: '100%',
  transition: 'opacity 0.15s',
};

const btnSecondary: React.CSSProperties = {
  background: 'transparent',
  border: '1.5px solid rgba(255,255,255,0.25)',
  borderRadius: '9999px',
  color: 'rgba(255,255,255,0.65)',
  fontWeight: 600,
  fontSize: 13,
  padding: '9px 28px',
  cursor: 'pointer',
  width: '100%',
  transition: 'background 0.15s',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.08)',
  border: '1.5px solid rgba(255,255,255,0.2)',
  borderRadius: 10,
  color: '#fff',
  fontSize: 15,
  padding: '9px 12px',
  outline: 'none',
  boxSizing: 'border-box',
};

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 14,
  padding: '18px 20px',
  width: '100%',
  maxWidth: 340,
  boxSizing: 'border-box',
};

// ── Sub-screens ──────────────────────────────────────────────────────────────

type View = 'HOME' | 'CREATE' | 'JOIN' | 'LOBBY';

interface Props {
  mp: MultiplayerState;
  connected: boolean;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (nickname: string, roomCode: string) => void;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onPlaySolo: () => void;
}

export default function LobbyScreen({
  mp, connected, onCreateRoom, onJoinRoom, onStartGame, onLeaveRoom, onPlaySolo,
}: Props) {
  // 'CREATE' and 'JOIN' are local navigation states; once we have a roomCode we always show LOBBY
  const [localView, setLocalView] = useState<'HOME' | 'CREATE' | 'JOIN'>('HOME');
  const view: View = mp.roomCode ? 'LOBBY' : localView;
  const setView = (v: View) => { if (v !== 'LOBBY') setLocalView(v as 'HOME' | 'CREATE' | 'JOIN'); };

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(180deg, rgba(20,0,40,0.95) 0%, rgba(80,0,40,0.90) 100%)',
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Top bar — fixed height, never squashed */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px 6px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <ConnectionBadge connected={connected} />
        <button
          style={{ ...btnSecondary, width: 'auto', padding: '4px 14px', fontSize: 11 }}
          onClick={onPlaySolo}
        >
          🎮 Solo
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px 20px 24px',
        gap: 16,
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 40 }}>💕</div>
          <h1 style={{
            margin: '4px 0 2px',
            fontSize: 28,
            fontWeight: 900,
            color: '#fff',
            textShadow: '0 2px 12px #ff4d6d',
            letterSpacing: '-0.5px',
          }}>
            FLAPPY LOVE
          </h1>
          <p style={{ color: '#fbcfe8', fontSize: 12, margin: 0 }}>Multiplayer Mode</p>
        </div>

        {/* Error banner */}
        {mp.error && (
          <div style={{
            background: 'rgba(200,0,50,0.35)',
            border: '1px solid #ff4d6d',
            borderRadius: 10,
            padding: '8px 16px',
            color: '#fca5a5',
            fontSize: 13,
            width: '100%',
            maxWidth: 340,
            textAlign: 'center',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}>
            ⚠️ {mp.error}
          </div>
        )}

        {view === 'HOME' && (
          <HomeView
            connected={connected}
            onCreate={() => setView('CREATE')}
            onJoin={() => setView('JOIN')}
          />
        )}

        {view === 'CREATE' && (
          <CreateView
            connected={connected}
            onBack={() => setView('HOME')}
            onSubmit={onCreateRoom}
          />
        )}

        {view === 'JOIN' && (
          <JoinView
            connected={connected}
            onBack={() => setView('HOME')}
            onSubmit={onJoinRoom}
          />
        )}

        {view === 'LOBBY' && mp.roomCode && (
          <LobbyView
            mp={mp}
            onStartGame={onStartGame}
            onLeaveRoom={() => { onLeaveRoom(); setView('HOME'); }}
          />
        )}
      </div>
    </div>
  );
}

// ── HOME ─────────────────────────────────────────────────────────────────────

function HomeView({ connected, onCreate, onJoin }: { connected: boolean; onCreate: () => void; onJoin: () => void }) {
  return (
    <>
      <div style={card}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button style={btnPrimary} onClick={onCreate} disabled={!connected}>
            ✨ Create Game
          </button>
          <button style={btnSecondary} onClick={onJoin} disabled={!connected}>
            🚪 Join Game
          </button>
        </div>
        {!connected && (
          <p style={{ color: '#fca5a5', fontSize: 11, textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            Connecting to server…
          </p>
        )}
      </div>

      {/* How to play — compact, below the buttons */}
      <div style={{
        ...card,
        padding: '12px 16px',
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        lineHeight: 1.6,
        textAlign: 'center',
      }}>
        <p style={{ color: '#f9a8d4', fontWeight: 700, marginBottom: 4, marginTop: 0, fontSize: 11 }}>
          HOW TO PLAY
        </p>
        <p style={{ margin: '0 0 2px' }}>🖱 Click &nbsp;·&nbsp; ⎵ Space &nbsp;·&nbsp; 👆 Tap to flap</p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          Collect ❤️ &nbsp; Avoid 💔 obstacles &nbsp; Survive!
        </p>
      </div>
    </>
  );
}

// ── CREATE ────────────────────────────────────────────────────────────────────

function CreateView({ connected, onBack, onSubmit }: { connected: boolean; onBack: () => void; onSubmit: (n: string) => void }) {
  const [nickname, setNickname] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim()) onSubmit(nickname.trim());
  }, [nickname, onSubmit]);

  return (
    <div style={card}>
      <h2 className="text-white font-bold text-lg mb-4 text-center">Create Room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-pink-200 text-xs mb-1 block">Your Nickname</label>
          <input
            style={inputStyle}
            placeholder="Enter nickname…"
            value={nickname}
            maxLength={20}
            onChange={e => setNickname(e.target.value)}
            autoFocus
          />
        </div>
        <button style={btnPrimary} type="submit" disabled={!connected || !nickname.trim()}>
          ❤️ Create Room
        </button>
        <button style={btnSecondary} type="button" onClick={onBack}>
          ← Back
        </button>
      </form>
    </div>
  );
}

// ── JOIN ──────────────────────────────────────────────────────────────────────

function JoinView({ connected, onBack, onSubmit }: { connected: boolean; onBack: () => void; onSubmit: (n: string, code: string) => void }) {
  const [nickname, setNickname] = useState('');
  const [code, setCode] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (nickname.trim() && code.trim()) onSubmit(nickname.trim(), code.trim().toUpperCase());
  }, [nickname, code, onSubmit]);

  return (
    <div style={card}>
      <h2 className="text-white font-bold text-lg mb-4 text-center">Join Room</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div>
          <label className="text-pink-200 text-xs mb-1 block">Room Code</label>
          <input
            style={{ ...inputStyle, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700, fontSize: 20 }}
            placeholder="e.g. 7K4P"
            value={code}
            maxLength={4}
            onChange={e => setCode(e.target.value.toUpperCase())}
            autoFocus
          />
        </div>
        <div>
          <label className="text-pink-200 text-xs mb-1 block">Your Nickname</label>
          <input
            style={inputStyle}
            placeholder="Enter nickname…"
            value={nickname}
            maxLength={20}
            onChange={e => setNickname(e.target.value)}
          />
        </div>
        <button style={btnPrimary} type="submit" disabled={!connected || !nickname.trim() || code.length < 4}>
          🚪 Join
        </button>
        <button style={btnSecondary} type="button" onClick={onBack}>
          ← Back
        </button>
      </form>
    </div>
  );
}

// ── LOBBY ─────────────────────────────────────────────────────────────────────

function LobbyView({ mp, onStartGame, onLeaveRoom }: { mp: MultiplayerState; onStartGame: () => void; onLeaveRoom: () => void }) {
  const canStart = mp.isHost && mp.players.length >= 1;

  return (
    <div style={{ ...card, maxWidth: 340 }}>
      {/* Room code */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <p style={{ color: '#f9a8d4', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 4px' }}>Love Room</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, margin: '0 0 6px' }}>Share this code:</p>
        <div style={{
          display: 'inline-block',
          fontWeight: 900,
          fontSize: 34,
          letterSpacing: '0.22em',
          color: '#fff',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '6px 20px',
          textShadow: '0 0 20px rgba(255,77,109,0.6)',
        }}>
          {mp.roomCode}
        </div>
      </div>

      {/* Player list */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <p style={{ color: '#fbcfe8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Players</p>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>{mp.players.length}/6</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mp.players.map(p => (
            <PlayerRow key={p.id} player={p} isSelf={p.id === mp.playerId} />
          ))}
        </div>
      </div>

      {/* Status / start */}
      {mp.isHost ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            style={{ ...btnPrimary, opacity: canStart ? 1 : 0.5 }}
            onClick={onStartGame}
            disabled={!canStart}
          >
            ❤️ Start Game
          </button>
          {mp.players.length < 2 && (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, margin: 0 }}>
              Share the code to invite more players!
            </p>
          )}
        </div>
      ) : (
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 13, padding: '6px 0', margin: 0 }}>
          ⏳ Waiting for host to start…
        </p>
      )}

      <button style={{ ...btnSecondary, marginTop: 8 }} onClick={onLeaveRoom}>
        Leave Room
      </button>
    </div>
  );
}

function PlayerRow({ player, isSelf }: { player: PlayerInfo; isSelf: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 8,
      padding: '7px 10px',
      background: isSelf ? 'rgba(255,77,109,0.18)' : 'rgba(255,255,255,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{player.color}</span>
        <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
          {player.nickname}
          {isSelf && <span style={{ color: '#f9a8d4', fontSize: 11, marginLeft: 4 }}>(you)</span>}
        </span>
      </div>
      {player.isHost && (
        <span style={{ color: '#fde047', fontSize: 11, fontWeight: 700 }}>👑 HOST</span>
      )}
    </div>
  );
}
