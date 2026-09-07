// Core game types for Flappy Love

export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Player {
  x: number;
  y: number;
  vy: number;       // vertical velocity
  rotation: number; // visual tilt
  wingPhase: number; // wing flap animation phase
  isDead: boolean;
  deathTimer: number;
  invincible: boolean;
  invincibleTimer: number;
  lives: number;      // remaining lives (starts at 3)
  hitFlashTimer: number; // >0 while showing hit-flash (not full death)
  inLoveTimer: number;   // >0 after collecting a love letter (seconds)
}

export type ObstacleType =
  | 'BROKEN_HEART'
  | 'LEFT_ON_READ'
  | 'JUST_FRIENDS'
  | 'OVERTHINKING'
  | 'OLD_MEMORIES'
  | 'THIRD_WHEEL'
  | 'JEALOUSY_FLAME'
  | 'COLD_REPLY'
  | 'NO_SIGNAL'
  | 'MIXED_SIGNALS'
  | 'K_MESSAGE'
  | 'FRIEND_ZONE';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  gapY: number;     // center Y of the gap
  gapH: number;     // height of the gap
  w: number;
  passed: boolean;
  moveAmp: number;  // vertical oscillation amplitude
  moveFreq: number; // oscillation frequency
  spawnTime: number; // timestamp when spawned (for oscillation)
}

export type CollectibleType = 'SMALL_HEART' | 'BIG_HEART' | 'LOVE_LETTER' | 'STAR' | 'BUTTERFLY' | 'EXTRA_LIFE';

export interface Collectible {
  id: number;
  type: CollectibleType;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
  bobPhase: number; // bobbing animation
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;     // 0–1
  color: string;
  size: number;
  text?: string;    // optional text particle
}

export interface GameSnapshot {
  player: Player;
  obstacles: Obstacle[];
  collectibles: Collectible[];
  particles: Particle[];
  score: number;
  lovePoints: number;
  hugotMeter: number;  // 0–100
  distance: number;
  stage: number;
  gameState: GameState;
  bgPhase: number;
  time: number;         // elapsed ms
  maxHugotTriggered: boolean;
  maxHugotTimer: number;
}
