// Game Engine — pure logic, no rendering
import type {
  GameSnapshot, Player, Obstacle, Collectible, Particle,
  ObstacleType, CollectibleType,
} from './types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  PLAYER_X, PLAYER_SIZE,
  GRAVITY, FLAP_VELOCITY, MAX_FALL_SPEED,
  OBSTACLE_WIDTH, BASE_OBSTACLE_SPEED, OBSTACLE_SPAWN_INTERVAL, BASE_GAP_HEIGHT,
  COLLECTIBLE_RADIUS,
  STAGE_THRESHOLDS,
} from './constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let _nextId = 1;
function nextId() { return _nextId++; }

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function rectOverlap(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ─── Obstacle spawn ───────────────────────────────────────────────────────────

const OBSTACLE_TYPES: ObstacleType[] = [
  'BROKEN_HEART', 'LEFT_ON_READ', 'JUST_FRIENDS', 'OVERTHINKING',
  'OLD_MEMORIES', 'THIRD_WHEEL', 'JEALOUSY_FLAME', 'COLD_REPLY',
  'NO_SIGNAL', 'MIXED_SIGNALS', 'K_MESSAGE', 'FRIEND_ZONE',
];

function pickObstacleType(stage: number): ObstacleType {
  // Introduce more types gradually
  const available = OBSTACLE_TYPES.slice(0, Math.min(4 + stage * 2, OBSTACLE_TYPES.length));
  return available[Math.floor(Math.random() * available.length)];
}

function spawnObstacle(stage: number, now: number): Obstacle {
  const gapH = Math.max(BASE_GAP_HEIGHT - stage * 10, 100);
  const margin = 80;
  const gapY = rand(margin + gapH / 2, CANVAS_HEIGHT - 60 - margin - gapH / 2);
  const type = pickObstacleType(stage);

  // Certain obstacle types oscillate
  const oscillating: ObstacleType[] = ['OVERTHINKING', 'MIXED_SIGNALS', 'JEALOUSY_FLAME'];
  const moveAmp = oscillating.includes(type) ? rand(20, 55) : 0;
  const moveFreq = oscillating.includes(type) ? rand(0.8, 1.8) : 0;

  return {
    id: nextId(),
    type,
    x: CANVAS_WIDTH + OBSTACLE_WIDTH / 2,
    gapY,
    gapH,
    w: OBSTACLE_WIDTH,
    passed: false,
    moveAmp,
    moveFreq,
    spawnTime: now,
  };
}

// ─── Collectible spawn ────────────────────────────────────────────────────────

const COLLECTIBLE_TYPES: CollectibleType[] = ['SMALL_HEART', 'BIG_HEART', 'LOVE_LETTER', 'STAR', 'BUTTERFLY', 'EXTRA_LIFE'];
const COLLECTIBLE_WEIGHTS = [32, 22, 14, 10, 10, 12]; // EXTRA_LIFE bumped to 12%

function pickCollectibleType(): CollectibleType {
  const total = COLLECTIBLE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < COLLECTIBLE_TYPES.length; i++) {
    r -= COLLECTIBLE_WEIGHTS[i];
    if (r <= 0) return COLLECTIBLE_TYPES[i];
  }
  return 'SMALL_HEART';
}

function spawnCollectible(gapY: number, gapH: number): Collectible {
  // Keep the collectible inside the gap with a small margin so it's never inside a pillar
  const margin = COLLECTIBLE_RADIUS + 8;
  const minY = gapY - gapH / 2 + margin;
  const maxY = gapY + gapH / 2 - margin;
  // If the gap is too tight to fit safely, just place it at the center
  const y = maxY > minY ? rand(minY, maxY) : gapY;
  return {
    id: nextId(),
    type: pickCollectibleType(),
    x: CANVAS_WIDTH + 60,
    y,
    radius: COLLECTIBLE_RADIUS,
    collected: false,
    bobPhase: Math.random() * Math.PI * 2,
  };
}

// ─── Particle factories ───────────────────────────────────────────────────────

function spawnCollectParticles(x: number, y: number, type: CollectibleType): Particle[] {
  const colors: Record<CollectibleType, string> = {
    SMALL_HEART: '#ff4d6d',
    BIG_HEART: '#c9184a',
    LOVE_LETTER: '#ff85a1',
    STAR: '#ffd60a',
    BUTTERFLY: '#a8dadc',
    EXTRA_LIFE: '#ff4d6d',
  };
  const labels: Record<CollectibleType, string> = {
    SMALL_HEART: '+1',
    BIG_HEART: '+5',
    LOVE_LETTER: '💌 +10',
    STAR: '⭐',
    BUTTERFLY: '🦋',
    EXTRA_LIFE: '+❤️',
  };
  const color = colors[type];
  const particles: Particle[] = [];
  // Text pop-up
  particles.push({ x, y: y - 10, vx: 0, vy: -1.5, life: 1, color, size: 18, text: labels[type] });
  // Burst circles
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    particles.push({
      x, y, vx: Math.cos(angle) * rand(1.5, 3.5), vy: Math.sin(angle) * rand(1.5, 3.5),
      life: 1, color, size: rand(3, 7),
    });
  }

  // Love-letter: extra romantic heart shower
  if (type === 'LOVE_LETTER') {
    const heartEmojis = ['💕', '💖', '💗', '💓', '💝'];
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: x + rand(-20, 20),
        y: y + rand(-10, 10),
        vx: rand(-2.5, 2.5),
        vy: rand(-3.5, -1.2),
        life: 1,
        color: '#ff85a1',
        size: rand(14, 20),
        text: heartEmojis[Math.floor(Math.random() * heartEmojis.length)],
      });
    }
    // Big "IN LOVE!" text burst
    particles.push({ x, y: y - 30, vx: 0, vy: -0.8, life: 1, color: '#ff4d6d', size: 22, text: '💘 In Love!' });
  }

  return particles;
}

function spawnHitParticles(x: number, y: number): Particle[] {
  const particles: Particle[] = [];
  particles.push({ x, y, vx: 0, vy: -1, life: 1, color: '#ff4d6d', size: 22, text: '💔' });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const speed = rand(2, 6);
    particles.push({
      x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      life: 1, color: i % 2 === 0 ? '#ff4d6d' : '#c9184a', size: rand(4, 9),
    });
  }
  return particles;
}

// ─── Initial state ────────────────────────────────────────────────────────────

export const MAX_LIVES = 3;

const IN_LOVE_DURATION = 4; // seconds the in-love effect lasts

export function createInitialState(): GameSnapshot {
  return {
    player: {
      x: PLAYER_X,
      y: CANVAS_HEIGHT / 2,
      vy: 0,
      rotation: 0,
      wingPhase: 0,
      isDead: false,
      deathTimer: 0,
      invincible: false,
      invincibleTimer: 0,
      lives: MAX_LIVES,
      hitFlashTimer: 0,
      inLoveTimer: 0,
    },
    obstacles: [],
    collectibles: [],
    particles: [],
    score: 0,
    lovePoints: 0,
    hugotMeter: 0,
    distance: 0,
    stage: 0,
    gameState: 'PLAYING',
    bgPhase: 0,
    time: 0,
    maxHugotTriggered: false,
    maxHugotTimer: 0,
  };
}

// ─── Main tick ────────────────────────────────────────────────────────────────

interface TickInput {
  dt: number;               // delta time in ms
  flap: boolean;            // flap input this tick
  lastObstacleSpawn: number;
  setLastObstacleSpawn: (t: number) => void;
}

export function tick(state: GameSnapshot, input: TickInput): GameSnapshot {
  if (state.gameState !== 'PLAYING') return state;

  const { dt, flap } = input;
  const dtFactor = dt / 16.67; // normalize to ~60fps

  let {
    player, obstacles, collectibles, particles,
    distance, stage,
    bgPhase, time,
  } = state;
  const { score, lovePoints, hugotMeter, maxHugotTriggered, maxHugotTimer } = state;

  // Clone mutable arrays
  obstacles = [...obstacles];
  collectibles = [...collectibles];
  particles = [...particles];

  time += dt;

  // ── Player physics ──────────────────────────────────────────────────────────
  player = { ...player };

  if (player.isDead) {
    player.deathTimer = Math.min(player.deathTimer + dt * 0.001, 1);
    if (player.deathTimer >= 1) {
      return { ...state, player, gameState: 'GAME_OVER', time };
    }
    return { ...state, player, particles: updateParticles(particles, dtFactor), time };
  }

  // Hit-flash timer (brief stun after losing a life)
  if (player.hitFlashTimer > 0) {
    player.hitFlashTimer = Math.max(0, player.hitFlashTimer - dt * 0.001);
  }

  // Flap
  if (flap) {
    player.vy = FLAP_VELOCITY;
    player.wingPhase = 0; // reset wing flap
  }

  // Gravity
  player.vy = Math.min(player.vy + GRAVITY * dtFactor, MAX_FALL_SPEED);
  player.y += player.vy * dtFactor;

  // Wing animation
  player.wingPhase += dtFactor * 3;

  // Rotation: tilt up when rising, down when falling
  const targetRot = Math.max(-0.4, Math.min(0.5, player.vy * 0.06));
  player.rotation += (targetRot - player.rotation) * 0.15 * dtFactor;

  // Invincibility / star timer
  if (player.invincible) {
    player.invincibleTimer -= dt * 0.001;
    if (player.invincibleTimer <= 0) {
      player.invincible = false;
      player.invincibleTimer = 0;
    }
  }

  // In-love timer (love letter effect)
  if (player.inLoveTimer > 0) {
    player.inLoveTimer = Math.max(0, player.inLoveTimer - dt * 0.001);
  }

  // ── Boundary collision ───────────────────────────────────────────────────────
  const ps = PLAYER_SIZE * 0.38; // hitbox radius (slightly smaller than visual)
  if (player.y - ps < 0 || player.y + ps > CANVAS_HEIGHT - 60) {
    if (!player.invincible) {
      const result = loseLife(player, particles);
      player = result.player;
      particles = result.particles;
      if (player.isDead) {
        return { ...state, player, particles, time };
      }
    }
    // Bounce off boundaries
    player.y = Math.max(ps, Math.min(CANVAS_HEIGHT - 60 - ps, player.y));
    player.vy *= -0.5;
  }

  // ── Obstacle speed & spawn ───────────────────────────────────────────────────
  const speed = (BASE_OBSTACLE_SPEED + stage * 0.4) * dtFactor;

  // Spawn
  const spawnInterval = Math.max(OBSTACLE_SPAWN_INTERVAL - stage * 100, 900);
  if (time - input.lastObstacleSpawn > spawnInterval) {
    const newObs = spawnObstacle(stage, time);
    obstacles.push(newObs);
    input.setLastObstacleSpawn(time);

    // Spawn collectible inside the gap of this obstacle
    if (Math.random() < 0.55) {
      collectibles.push(spawnCollectible(newObs.gapY, newObs.gapH));
    }
  }

  // Move & remove
  obstacles = obstacles
    .map(o => ({ ...o, x: o.x - speed }))
    .filter(o => o.x > -OBSTACLE_WIDTH);

  // ── Obstacle collision & scoring ─────────────────────────────────────────────
  let newScore = score;
  let newHugot = hugotMeter;

  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const gapY = obs.gapY + Math.sin((time - obs.spawnTime) * obs.moveFreq * 0.001) * obs.moveAmp;
    const topH = gapY - obs.gapH / 2;
    const botY = gapY + obs.gapH / 2;

    // Score: passed center of obstacle
    if (!obs.passed && obs.x < PLAYER_X) {
      obstacles[i] = { ...obs, passed: true };
      newScore += 10 + stage * 5;
      newHugot = Math.min(newHugot + 5, 100);
    }

    // Collision (skip if invincible or mid-hit-flash stun)
    if (!player.invincible && player.hitFlashTimer <= 0) {
      const hitTop = rectOverlap(
        player.x - ps, player.y - ps, ps * 2, ps * 2,
        obs.x - obs.w / 2, 0, obs.w, topH,
      );
      const hitBot = rectOverlap(
        player.x - ps, player.y - ps, ps * 2, ps * 2,
        obs.x - obs.w / 2, botY, obs.w, CANVAS_HEIGHT,
      );
      if (hitTop || hitBot) {
        const result = loseLife(player, particles);
        player = result.player;
        particles = result.particles;
        newHugot = Math.min(newHugot + 15, 100);
        if (player.isDead) {
          return { ...state, player, obstacles, collectibles, particles, score: newScore, lovePoints, hugotMeter: newHugot, distance, stage, bgPhase, time, maxHugotTriggered, maxHugotTimer };
        }
        // Still alive — break out of obstacle loop so we don't double-hit
        break;
      }
    }
  }

  // ── Collectibles ──────────────────────────────────────────────────────────────
  const LOVE_VALUES: Record<CollectibleType, number> = {
    SMALL_HEART: 1, BIG_HEART: 5, LOVE_LETTER: 10, STAR: 0, BUTTERFLY: 0, EXTRA_LIFE: 0,
  };
  let newLove = lovePoints;

  collectibles = collectibles.map(c => {
    if (c.collected) return c;
    const moved = { ...c, x: c.x - speed };
    // Collect radius check
    const dx = player.x - moved.x;
    const dy = player.y - moved.y;
    if (Math.sqrt(dx * dx + dy * dy) < ps + moved.radius) {
      particles.push(...spawnCollectParticles(moved.x, moved.y, moved.type));
      newLove += LOVE_VALUES[moved.type];
      if (moved.type === 'STAR') {
        player = { ...player, invincible: true, invincibleTimer: 5 };
      }
      if (moved.type === 'EXTRA_LIFE' && player.lives < MAX_LIVES) {
        player = { ...player, lives: player.lives + 1 };
      }
      if (moved.type === 'LOVE_LETTER') {
        player = { ...player, inLoveTimer: IN_LOVE_DURATION };
      }
      return { ...moved, collected: true };
    }
    return moved;
  }).filter(c => c.x > -40);

  // ── Distance & stage ──────────────────────────────────────────────────────────
  distance += speed;
  newScore += Math.floor(dtFactor * 0.5); // passive score per frame

  const newStage = STAGE_THRESHOLDS.findLastIndex(t => newScore >= t);
  if (newStage !== stage) {
    stage = newStage;
  }
  bgPhase = newScore / 400; // smooth background transition

  // ── Hugot meter ───────────────────────────────────────────────────────────────
  // Passive hugot gain when flying near obstacles
  obstacles.forEach(obs => {
    const gapY = obs.gapY + Math.sin((time - obs.spawnTime) * obs.moveFreq * 0.001) * obs.moveAmp;
    const distToCenter = Math.abs(player.y - gapY);
    const halfGap = obs.gapH / 2;
    if (Math.abs(player.x - obs.x) < obs.w && distToCenter > halfGap * 0.6) {
      newHugot = Math.min(newHugot + 0.05 * dtFactor, 100);
    }
  });

  // Max hugot trigger
  let newMaxHugot = maxHugotTriggered;
  let newMaxHugotTimer = maxHugotTimer;
  if (newHugot >= 100 && !maxHugotTriggered) {
    newMaxHugot = true;
    newMaxHugotTimer = 0;
    // Give temporary invincibility as reward
    player = { ...player, invincible: true, invincibleTimer: 3 };
    newHugot = 0; // reset meter
  }
  if (newMaxHugot) {
    newMaxHugotTimer += dt * 0.001;
    if (newMaxHugotTimer > 3) {
      newMaxHugot = false;
      newMaxHugotTimer = 0;
    }
  }

  // ── Particles ────────────────────────────────────────────────────────────────
  particles = updateParticles(particles, dtFactor);

  return {
    player,
    obstacles,
    collectibles,
    particles,
    score: newScore,
    lovePoints: newLove,
    hugotMeter: newHugot,
    distance,
    stage,
    gameState: 'PLAYING',
    bgPhase,
    time,
    maxHugotTriggered: newMaxHugot,
    maxHugotTimer: newMaxHugotTimer,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HIT_STUN_SECONDS = 2; // seconds of post-hit invincibility

/**
 * Deduct one life.
 * - If lives > 1: survive with brief stun-invincibility and a hit-flash.
 * - If lives === 1: trigger actual death animation (isDead = true).
 */
function loseLife(player: Player, particles: Particle[]): { player: Player; particles: Particle[] } {
  const newParticles = [...particles, ...spawnHitParticles(player.x, player.y)];
  const newLives = player.lives - 1;

  if (newLives <= 0) {
    // Final life — play death animation then game over
    return {
      player: { ...player, lives: 0, isDead: true, deathTimer: 0, vy: -5 },
      particles: newParticles,
    };
  }

  // Still has lives — stun briefly, grant invincibility window
  return {
    player: {
      ...player,
      lives: newLives,
      hitFlashTimer: HIT_STUN_SECONDS,
      invincible: true,
      invincibleTimer: HIT_STUN_SECONDS,
      vy: -4, // small bounce
    },
    particles: newParticles,
  };
}

function updateParticles(particles: Particle[], dtFactor: number): Particle[] {
  return particles
    .map(p => ({
      ...p,
      x: p.x + p.vx * dtFactor,
      y: p.y + p.vy * dtFactor,
      vy: p.vy + 0.1 * dtFactor, // gravity on particles
      life: p.life - 0.018 * dtFactor,
    }))
    .filter(p => p.life > 0);
}

// ─── Input flap (used externally) ────────────────────────────────────────────
export function shouldFlap(flapPending: boolean): boolean {
  return flapPending;
}
