'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_X, PLAYER_SIZE, MOTIVATIONAL_MESSAGES } from '@/game/constants';
import { createInitialState, tick, MAX_LIVES } from '@/game/engine';
import {
  drawBackground, drawObstacle, drawCollectible,
  drawParticles, drawPlayer, drawHUD, drawCountdown,
} from '@/game/renderer';
import type { GameSnapshot } from '@/game/types';
import type { PlayerInfo } from '@/multiplayer/types';

// ─── High-score persistence ────────────────────────────────────────────────

function getBestScore(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem('flappylove_best') ?? '0', 10);
}

function setBestScore(score: number) {
  if (typeof window === 'undefined') return;
  const prev = getBestScore();
  if (score > prev) localStorage.setItem('flappylove_best', String(score));
}

// ─── GameCanvas ────────────────────────────────────────────────────────────

// Optional multiplayer props — absent in solo mode
export interface GameCanvasMultiplayerProps {
  multiplayerMode?: boolean;
  roundId?: string;
  remotePlayers?: PlayerInfo[];
  remoteStates?: Record<string, { y: number; vy: number; score: number }>;
  onMultiplayerGameOver?: (score: number, lovePoints: number) => void;
  onSendState?: (y: number, vy: number, score: number) => void;
  /** Called when the player clicks "🌐 Multiplayer" from the solo menu */
  onGoMultiplayer?: () => void;
}

// Throttle state broadcasts — send at most once per STATE_SEND_INTERVAL ms
const STATE_SEND_INTERVAL = 100; // 10 Hz

export default function GameCanvas({
  multiplayerMode = false,
  roundId,
  remotePlayers = [],
  remoteStates = {},
  onMultiplayerGameOver,
  onSendState,
  onGoMultiplayer,
}: GameCanvasMultiplayerProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameSnapshot>(createInitialState());
  const flapRef = useRef(false);
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastObstacleSpawnRef = useRef<number>(0);
  const lastStateSendRef = useRef<number>(0);
  // Keep latest mp props accessible inside rAF loop without stale closures
  const mpRef = useRef({ multiplayerMode, roundId, remoteStates, remotePlayers, onMultiplayerGameOver, onSendState });
  useEffect(() => {
    mpRef.current = { multiplayerMode, roundId, remoteStates, remotePlayers, onMultiplayerGameOver, onSendState };
  });

  // Pre-size the canvas immediately on mount so it's never 0×0 while the rAF loop is starting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  const [screen, setScreen] = useState<'MENU' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER'>(multiplayerMode ? 'PLAYING' : 'MENU');
  const countdownRef = useRef<number>(5); // counts 5→0 then launches
  const [finalScore, setFinalScore] = useState(0);
  const [finalLove, setFinalLove] = useState(0);
  const [finalHugot, setFinalHugot] = useState(0);
  const [bestScore, setBestScoreState] = useState(() =>
    typeof window !== 'undefined' ? getBestScore() : 0
  );
  const [motivMsg, setMotivMsg] = useState('');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  // Keep pausedRef in sync
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // ── Countdown loop ───────────────────────────────────────────────────────
  const startCountdown = useCallback((onDone: () => void) => {
    countdownRef.current = 5;
    const startTime = performance.now();

    function countLoop(now: number) {
      const elapsed = (now - startTime) / 1000; // seconds elapsed
      const remaining = 5 - elapsed;            // counts 5 → 0

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          if (canvas.width !== CANVAS_WIDTH * dpr || canvas.height !== CANVAS_HEIGHT * dpr) {
            canvas.width = CANVAS_WIDTH * dpr;
            canvas.height = CANVAS_HEIGHT * dpr;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          drawBackground(ctx, 0, 0, now);
          drawCountdown(ctx, remaining);
        }
      }

      if (remaining <= -0.6) {
        onDone();
        return;
      }
      rafRef.current = requestAnimationFrame(countLoop);
    }

    rafRef.current = requestAnimationFrame(countLoop);
  }, []);

  // ── Game loop ────────────────────────────────────────────────────────────
  const startLoop = useCallback(() => {
    lastTimeRef.current = performance.now();
    lastObstacleSpawnRef.current = 0;

    function loop(now: number) {
      const dt = Math.min(now - lastTimeRef.current, 50); // cap at 50ms
      lastTimeRef.current = now;

      const canvas = canvasRef.current;
      if (!canvas) { rafRef.current = requestAnimationFrame(loop); return; }
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      // Resize canvas if DPR or dimensions changed (e.g. orientation change).
      // Always use setTransform (not scale) to avoid cumulative multiplications.
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== CANVAS_WIDTH * dpr || canvas.height !== CANVAS_HEIGHT * dpr) {
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (!pausedRef.current) {
        // Tick logic
        const flap = flapRef.current;
        flapRef.current = false; // consume flap

        stateRef.current = tick(stateRef.current, {
          dt,
          flap,
          lastObstacleSpawn: lastObstacleSpawnRef.current,
          setLastObstacleSpawn: (t) => { lastObstacleSpawnRef.current = t; },
        });
      }

      // Render
      const s = stateRef.current;
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      drawBackground(ctx, s.stage, s.bgPhase, s.time);
      s.obstacles.forEach(o => drawObstacle(ctx, o, s.time));
      s.collectibles.forEach(c => drawCollectible(ctx, c, s.time));
      drawParticles(ctx, s.particles);

      // Draw remote player ghosts (multiplayer only) — before local player so local is on top
      const { multiplayerMode: isMp, remotePlayers: rPlayers, remoteStates: rStates } = mpRef.current;
      if (isMp && rPlayers && rStates) {
        for (const rp of rPlayers) {
          const rs = rStates[rp.id];
          if (rs) {
            drawRemoteGhost(ctx, rs.y, rp.color, rp.nickname);
          }
        }
      }

      drawPlayer(ctx, s.player);
      drawHUD(ctx, s.score, s.lovePoints, s.hugotMeter, s.stage, s.maxHugotTriggered, s.maxHugotTimer, pausedRef.current, s.player.lives, MAX_LIVES);

      // Throttled state broadcast (multiplayer)
      if (isMp && mpRef.current.onSendState && now - lastStateSendRef.current > STATE_SEND_INTERVAL) {
        lastStateSendRef.current = now;
        mpRef.current.onSendState(s.player.y, s.player.vy, s.score);
      }

      // Check game over
      if (s.gameState === 'GAME_OVER') {
        setBestScore(s.score);
        if (isMp && mpRef.current.onMultiplayerGameOver) {
          // In multiplayer: notify server, keep canvas visible (shell shows results)
          mpRef.current.onMultiplayerGameOver(s.score, s.lovePoints);
          cancelAnimationFrame(rafRef.current);
          return;
        }
        setFinalScore(s.score);
        setFinalLove(s.lovePoints);
        setFinalHugot(Math.round(s.hugotMeter));
        setBestScoreState(getBestScore());
        setMotivMsg(MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);
        setScreen('GAME_OVER');
        cancelAnimationFrame(rafRef.current);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const stopLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Start / restart game ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    stateRef.current = createInitialState();
    flapRef.current = false;
    lastObstacleSpawnRef.current = 0;
    setPaused(false);
    pausedRef.current = false;
    setBestScoreState(getBestScore());
    stopLoop();
    setScreen('COUNTDOWN');
    startCountdown(() => {
      setScreen('PLAYING');
      startLoop();
    });
  }, [startCountdown, startLoop, stopLoop]);

  // ── Multiplayer: auto-start loop when mounted in multiplayer mode ──────────
  useEffect(() => {
    if (multiplayerMode) {
      stateRef.current = createInitialState();
      flapRef.current = false;
      lastObstacleSpawnRef.current = 0;
      lastStateSendRef.current = 0;
      // screen is already initialized to 'PLAYING' when multiplayerMode=true
      startLoop();
    }
    return () => stopLoop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multiplayerMode]);

  // ── Input handling ──────────────────────────────────────────────────────
  const handleFlap = useCallback(() => {
    if (screen === 'MENU' || screen === 'COUNTDOWN' || screen === 'GAME_OVER') return;
    if (pausedRef.current) {
      setPaused(false);
      return;
    }
    flapRef.current = true;
  }, [screen]);

  const togglePause = useCallback(() => {
    if (screen !== 'PLAYING') return;
    if (countdownRef.current > 0) return;
    setPaused(p => !p);
  }, [screen]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleFlap();
      }
      if (e.code === 'Escape') togglePause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleFlap, togglePause]);

  // Cleanup on unmount (solo mode — multiplayer cleanup is in the multiplayerMode effect)
  useEffect(() => {
    if (!multiplayerMode) return () => stopLoop();
  }, [multiplayerMode, stopLoop]);

  // ── Prevent scroll on touch + native flap handler ────────────────────────
  // We use a native (non-passive) touchstart listener so that:
  //   1. e.preventDefault() suppresses scroll/zoom on iOS/Android.
  //   2. handleFlap fires reliably — React's synthetic onTouchStart can be
  //      swallowed on iOS Safari when a passive:false native listener also
  //      calls preventDefault() on the same element.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      handleFlap();
    };
    const preventMove = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener('touchstart', onTouch, { passive: false });
    canvas.addEventListener('touchmove', preventMove, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouch);
      canvas.removeEventListener('touchmove', preventMove);
    };
  }, [handleFlap]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative select-none" style={{ width: CANVAS_WIDTH, maxWidth: '100%' }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
          cursor: screen === 'PLAYING' ? 'none' : 'default',
          touchAction: 'none',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
        onClick={handleFlap}
      />

      {/* MENU overlay */}
      {screen === 'MENU' && (
        <MenuOverlay
          bestScore={bestScore}
          onPlay={startGame}
          onMultiplayer={onGoMultiplayer}
        />
      )}

      {/* GAME OVER overlay */}
      {screen === 'GAME_OVER' && (
        <GameOverOverlay
          score={finalScore}
          love={finalLove}
          hugot={finalHugot}
          best={bestScore}
          message={motivMsg}
          onPlayAgain={startGame}
          onMenu={() => setScreen('MENU')}
        />
      )}

      {/* Pause button (solo only — no pausing in multiplayer) */}
      {screen === 'PLAYING' && !multiplayerMode && (
        <button
          aria-label={paused ? 'Resume' : 'Pause'}
          onClick={togglePause}
          onTouchStart={e => { e.preventDefault(); togglePause(); }}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            touchAction: 'none',
          }}
        >
          {paused ? '▶' : '⏸'}
        </button>
      )}
    </div>
  );
}

// ─── Menu Overlay ──────────────────────────────────────────────────────────

function MenuOverlay({ bestScore, onPlay, onMultiplayer }: {
  bestScore: number;
  onPlay: () => void;
  onMultiplayer?: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '24px 24px 20px',
      boxSizing: 'border-box',
      background: 'linear-gradient(180deg, rgba(20,0,40,0.88) 0%, rgba(80,0,40,0.82) 100%)',
      borderRadius: 12,
    }}>
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44, lineHeight: 1 }}>💕</div>
        <h1 style={{
          margin: '5px 0 3px',
          fontSize: 34,
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-1px',
          textShadow: '0 2px 12px #ff4d6d',
        }}>
          FLAPPY LOVE
        </h1>
        <p style={{ color: '#fbcfe8', fontSize: 13, margin: 0, fontWeight: 500 }}>
          Keep flying. Collect hearts. Avoid the hugot.
        </p>
        {bestScore > 0 && (
          <p style={{ color: '#fde047', fontSize: 12, marginTop: 3, marginBottom: 0 }}>
            🏆 Best: {bestScore}
          </p>
        )}
      </div>

      {/* How to play */}
      <div style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: '11px 18px',
        textAlign: 'center',
        width: '100%',
        maxWidth: 300,
        boxSizing: 'border-box',
      }}>
        <p style={{ color: '#f9a8d4', fontWeight: 700, fontSize: 12, margin: '0 0 4px' }}>How to Play</p>
        <p style={{ color: '#fff', fontSize: 13, margin: '0 0 1px' }}>
          🖱 Click &nbsp;·&nbsp; ⎵ Space &nbsp;·&nbsp; 👆 Tap
        </p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, margin: 0 }}>
          Collect ❤️ &nbsp; Avoid 💔 obstacles &nbsp; Survive!
        </p>
      </div>

      {/* Play button */}
      <button
        style={{
          background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
          boxShadow: '0 4px 20px rgba(255,77,109,0.5)',
          border: 'none',
          borderRadius: 9999,
          color: '#fff',
          fontSize: 20,
          fontWeight: 900,
          padding: '13px 48px',
          cursor: 'pointer',
        }}
        onClick={onPlay}
      >
        ❤️ PLAY
      </button>

      {/* Multiplayer button (shown when accessed from multiplayer shell) */}
      {onMultiplayer && (
        <button
          style={{
            background: 'transparent',
            border: '1.5px solid rgba(255,255,255,0.25)',
            borderRadius: 9999,
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 28px',
            cursor: 'pointer',
          }}
          onClick={onMultiplayer}
        >
          🌐 Multiplayer
        </button>
      )}

      {/* Credits */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, margin: '0 0 1px' }}>
          Made with 💕 for my unexpected friends in
        </p>
        <p style={{ color: 'rgba(249,168,212,0.6)', fontSize: 11, fontWeight: 600, margin: 0 }}>
          Amulung, Cagayan 🌿
        </p>
      </div>
    </div>
  );
}

// ─── Game Over Overlay ─────────────────────────────────────────────────────

function GameOverOverlay({
  score, love, hugot, best, message, onPlayAgain, onMenu,
}: {
  score: number; love: number; hugot: number; best: number;
  message: string;
  onPlayAgain: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl"
      style={{ background: 'rgba(10,0,20,0.88)' }}>
      <div className="text-5xl animate-bounce">💔</div>
      <h2 className="text-3xl font-black text-white" style={{ textShadow: '0 2px 10px #ff4d6d' }}>GAME OVER</h2>

      <div className="bg-white/10 rounded-xl px-8 py-4 text-center w-64">
        <p className="text-white text-lg font-bold">🏆 {score.toLocaleString()}</p>
        <p className="text-pink-300 text-sm">❤️ Love: {love} &nbsp;|&nbsp; 💔 Hugot: {hugot}%</p>
        {score >= best && score > 0 ? (
          <p className="text-yellow-300 text-sm font-bold mt-1">🎉 New Best!</p>
        ) : (
          <p className="text-white/50 text-xs mt-1">Best: {best.toLocaleString()}</p>
        )}
      </div>

      <p className="text-pink-200 italic text-sm px-8 text-center">&ldquo;{message}&rdquo;</p>

      <div className="flex flex-col gap-3 w-56">
        <button
          className="py-3 rounded-full text-white font-black text-base transition active:scale-95"
          style={{ background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)', boxShadow: '0 4px 18px rgba(255,77,109,0.5)' }}
          onClick={onPlayAgain}
        >
          ❤️ PLAY AGAIN
        </button>
        <button
          className="py-3 rounded-full text-white/70 font-semibold text-sm border border-white/20 hover:bg-white/10 transition"
          onClick={onMenu}
        >
          ← Back to Menu
        </button>
      </div>
    </div>
  );
}

// ─── Remote ghost renderer (Canvas 2D, not React) ─────────────────────────
// Draws other players as small semi-transparent hearts at the fixed X=80 column.

function drawRemoteGhost(
  ctx: CanvasRenderingContext2D,
  y: number,
  color: string,       // emoji color label e.g. '💙'
  nickname: string,
) {
  ctx.save();
  ctx.globalAlpha = 0.45;

  // Draw a small heart
  const s = PLAYER_SIZE * 0.7;
  ctx.translate(PLAYER_X, y);

  // Map emoji to a canvas fill color
  const fillMap: Record<string, string> = {
    '❤️': '#ff4d6d',
    '💙': '#4361ee',
    '💜': '#c77dff',
    '💚': '#80ed99',
    '🧡': '#fb8500',
    '💛': '#ffd60a',
  };
  const fill = fillMap[color] ?? '#ffffff';

  ctx.fillStyle = fill;
  ctx.beginPath();
  // Simple heart path scaled to s
  const w = s * 0.9;
  ctx.moveTo(0, -w * 0.15);
  ctx.bezierCurveTo(0, -w * 0.6, -w * 0.7, -w * 0.6, -w * 0.7, -w * 0.1);
  ctx.bezierCurveTo(-w * 0.7, w * 0.35, 0, w * 0.7, 0, w * 0.7);
  ctx.bezierCurveTo(0, w * 0.7, w * 0.7, w * 0.35, w * 0.7, -w * 0.1);
  ctx.bezierCurveTo(w * 0.7, -w * 0.6, 0, -w * 0.6, 0, -w * 0.15);
  ctx.fill();

  // Nickname label
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(s * 0.45)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(nickname.slice(0, 6), 0, s * 0.9);

  ctx.restore();
}
