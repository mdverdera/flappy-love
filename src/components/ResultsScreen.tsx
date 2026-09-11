'use client';

import React from 'react';
import type { MultiplayerState } from '@/multiplayer/types';

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

interface Props {
  mp: MultiplayerState;
  onRematch: () => void;
  onLeave: () => void;
}

export default function ResultsScreen({ mp, onRematch, onLeave }: Props) {
  const { results, playerId, isHost } = mp;

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl overflow-y-auto"
      style={{ background: 'rgba(10,0,20,0.93)' }}
    >
      <div className="flex flex-col items-center gap-5 px-5 py-8 w-full max-w-sm">
        {/* Title */}
        <div className="text-center">
          <div className="text-4xl mb-1">🏆</div>
          <h2 className="text-2xl font-black text-white" style={{ textShadow: '0 2px 10px #ffd60a' }}>
            ROUND RESULTS
          </h2>
        </div>

        {/* Leaderboard */}
        <div className="w-full flex flex-col gap-2">
          {results.map((r, i) => {
            const isSelf = r.playerId === playerId;
            const medal = RANK_MEDALS[i] ?? `${r.rank}️⃣`;
            return (
              <div
                key={r.playerId}
                className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{
                  background: isSelf
                    ? 'rgba(255,77,109,0.22)'
                    : i === 0
                      ? 'rgba(255,214,10,0.12)'
                      : 'rgba(255,255,255,0.06)',
                  border: isSelf ? '1.5px solid rgba(255,77,109,0.5)' : '1.5px solid transparent',
                }}
              >
                <span className="text-2xl w-8 text-center">{medal}</span>
                <span className="text-xl">{r.color}</span>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm leading-tight">
                    {r.nickname}
                    {isSelf && <span className="text-pink-300 text-xs ml-1">(you)</span>}
                  </p>
                  <p className="text-white/50 text-xs">❤️ {r.lovePoints} love</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-black">{r.score.toLocaleString()}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Your score callout */}
        {(() => {
          const self = results.find(r => r.playerId === playerId);
          if (!self) return null;
          return (
            <div
              className="w-full text-center rounded-xl py-3 px-4"
              style={{ background: 'rgba(255,77,109,0.1)', border: '1px solid rgba(255,77,109,0.3)' }}
            >
              <p className="text-pink-300 text-sm">
                ❤️ Your score: <strong className="text-white">{self.score.toLocaleString()}</strong>
                &nbsp;·&nbsp; Rank #{self.rank}
              </p>
            </div>
          );
        })()}

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full">
          {isHost ? (
            <button
              className="py-3 rounded-full text-white font-black text-base"
              style={{
                background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
                boxShadow: '0 4px 18px rgba(255,77,109,0.45)',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={onRematch}
            >
              🔄 Rematch
            </button>
          ) : (
            <p className="text-center text-white/40 text-sm py-2">
              ⏳ Waiting for host to start rematch…
            </p>
          )}
          <button
            className="py-3 rounded-full font-semibold text-sm"
            style={{
              background: 'transparent',
              border: '1.5px solid rgba(255,255,255,0.2)',
              color: 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
            }}
            onClick={onLeave}
          >
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
