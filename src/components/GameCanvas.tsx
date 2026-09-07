'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, MOTIVATIONAL_MESSAGES } from '@/game/constants';
import { createInitialState, tick, MAX_LIVES } from '@/game/engine';
import {
  drawBackground, drawObstacle, drawCollectible,
  drawParticles, drawPlayer, drawHUD, drawCountdown,
} from '@/game/renderer';
import type { GameSnapshot } from '@/game/types';

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

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GameSnapshot>(createInitialState());
  const flapRef = useRef(false);
  const lastTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  const lastObstacleSpawnRef = useRef<number>(0);

  const [screen, setScreen] = useState<'MENU' | 'COUNTDOWN' | 'PLAYING' | 'GAME_OVER'>('MENU');
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
            ctx.scale(dpr, dpr);
          }
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

      // Scale canvas to fill container
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== CANVAS_WIDTH * dpr || canvas.height !== CANVAS_HEIGHT * dpr) {
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        ctx.scale(dpr, dpr);
      }

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
      drawPlayer(ctx, s.player);
      drawHUD(ctx, s.score, s.lovePoints, s.hugotMeter, s.stage, s.maxHugotTriggered, s.maxHugotTimer, pausedRef.current, s.player.lives, MAX_LIVES);

      // Check game over
      if (s.gameState === 'GAME_OVER') {
        setBestScore(s.score);
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

  // Cleanup on unmount
  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  // ── Prevent scroll on touch ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const prevent = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener('touchstart', prevent, { passive: false });
    canvas.addEventListener('touchmove', prevent, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', prevent);
      canvas.removeEventListener('touchmove', prevent);
    };
  }, []);

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
        onTouchStart={handleFlap}
      />

      {/* MENU overlay */}
      {screen === 'MENU' && (
        <MenuOverlay
          bestScore={bestScore}
          onPlay={startGame}
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

      {/* Pause button (only during play) */}
      {screen === 'PLAYING' && (
        <button
          className="absolute top-2 right-2 z-10 text-white bg-black/30 rounded-full w-9 h-9 flex items-center justify-center text-lg leading-none hover:bg-black/50 transition"
          onClick={togglePause}
          onTouchStart={e => { e.preventDefault(); togglePause(); }}
          aria-label="Pause"
          style={{ touchAction: 'none' }}
        >
          {paused ? '▶' : '⏸'}
        </button>
      )}
    </div>
  );
}

// ─── Menu Overlay ──────────────────────────────────────────────────────────

function MenuOverlay({ bestScore, onPlay }: { bestScore: number; onPlay: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-between pb-10 pt-12 rounded-xl"
      style={{ background: 'linear-gradient(180deg, rgba(20,0,40,0.82) 0%, rgba(80,0,40,0.75) 100%)' }}>
      {/* Title */}
      <div className="text-center">
        <div className="text-5xl mb-1">💕</div>
        <h1 className="text-4xl font-black text-white tracking-tight" style={{ textShadow: '0 2px 12px #ff4d6d' }}>
          FLAPPY LOVE
        </h1>
        <p className="text-pink-200 text-sm mt-2 font-medium">Keep flying. Collect hearts. Avoid the hugot.</p>
        {bestScore > 0 && (
          <p className="text-yellow-300 text-xs mt-1">🏆 Best: {bestScore}</p>
        )}
      </div>

      {/* How to play snippet */}
      <div className="bg-white/10 rounded-xl px-6 py-4 text-center text-white text-sm leading-loose mx-4">
        <p className="font-bold text-pink-300 mb-1">How to Play</p>
        <p>🖱 Click &nbsp;|&nbsp; ⎵ Space &nbsp;|&nbsp; 👆 Tap</p>
        <p className="text-pink-200">to flap upward</p>
        <p className="mt-1 text-xs text-white/70">Collect ❤️ &nbsp; Avoid 💔 obstacles &nbsp; Survive!</p>
      </div>

      {/* Play button */}
      <button
        className="px-12 py-4 rounded-full text-white text-xl font-black shadow-lg transition active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
          boxShadow: '0 4px 20px rgba(255,77,109,0.5)',
        }}
        onClick={onPlay}
      >
        ❤️ PLAY
      </button>

      {/* Credits */}
      <div className="text-center px-4">
        <p className="text-white/40 text-xs leading-relaxed">
          Made with 💕 for my unexpected friends in
        </p>
        <p className="text-pink-300/70 text-xs font-semibold tracking-wide">
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
