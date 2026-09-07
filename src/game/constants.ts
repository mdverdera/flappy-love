// Constants for Flappy Love game

export const CANVAS_WIDTH = 480;
export const CANVAS_HEIGHT = 640;

// Player
export const PLAYER_X = 80;
export const PLAYER_SIZE = 32;
export const GRAVITY = 0.45;
export const FLAP_VELOCITY = -8.5;
export const MAX_FALL_SPEED = 12;
export const MAX_RISE_SPEED = -12;

// Obstacles
export const OBSTACLE_WIDTH = 60;
export const BASE_OBSTACLE_SPEED = 2.8;
export const OBSTACLE_SPAWN_INTERVAL = 1600; // ms between spawns
export const BASE_GAP_HEIGHT = 180;

// Collectibles
export const COLLECTIBLE_RADIUS = 14;

// Stages (score thresholds)
export const STAGE_THRESHOLDS = [0, 300, 700, 1300, 2200, 3500];

// Colors
export const COLORS = {
  heartRed: '#ff4d6d',
  heartPink: '#ff85a1',
  heartLight: '#ffc2d1',
  heartDark: '#c9184a',
  hugotBlue: '#4cc9f0',
  collectGold: '#ffd60a',
  collectGreen: '#80ed99',
  white: '#ffffff',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.45)',
};

// Obstacle emoji / labels
export const OBSTACLE_LABELS: Record<string, string> = {
  BROKEN_HEART: '💔',
  LEFT_ON_READ: '📱',
  JUST_FRIENDS: '💬',
  OVERTHINKING: '☁️',
  OLD_MEMORIES: '📸',
  THIRD_WHEEL: '👫',
  JEALOUSY_FLAME: '🔥',
  COLD_REPLY: '🧊',
  NO_SIGNAL: '📵',
  MIXED_SIGNALS: '❓',
  K_MESSAGE: '🅺',
  FRIEND_ZONE: '🚧',
};

export const OBSTACLE_COLORS: Record<string, [string, string]> = {
  BROKEN_HEART:    ['#ff4d6d', '#c9184a'],
  LEFT_ON_READ:    ['#4361ee', '#3a0ca3'],
  JUST_FRIENDS:    ['#4cc9f0', '#4895ef'],
  OVERTHINKING:    ['#adb5bd', '#6c757d'],
  OLD_MEMORIES:    ['#f4a261', '#e76f51'],
  THIRD_WHEEL:     ['#a8dadc', '#457b9d'],
  JEALOUSY_FLAME:  ['#fb8500', '#e85d04'],
  COLD_REPLY:      ['#90e0ef', '#0077b6'],
  NO_SIGNAL:       ['#6c757d', '#343a40'],
  MIXED_SIGNALS:   ['#c77dff', '#7b2d8b'],
  K_MESSAGE:       ['#dee2e6', '#6c757d'],
  FRIEND_ZONE:     ['#ffb703', '#fb8500'],
};

// Stage background configs
export const STAGE_BACKGROUNDS = [
  { sky: ['#ff9a3c', '#ffcb47', '#ff6b6b'], ground: '#b5451b', label: '🌅 Sunset Sky' },
  { sky: ['#ffb7c5', '#ffd6e0', '#ff8fab'], ground: '#c77dff', label: '🌸 Cherry Blossom' },
  { sky: ['#03045e', '#023e8a', '#0077b6'], ground: '#1b4332', label: '🌙 Night Sky' },
  { sky: ['#4a4e69', '#22223b', '#2b2d42'], ground: '#212529', label: '🌧️ Rainy City' },
  { sky: ['#240046', '#3c096c', '#5a189a'], ground: '#10002b', label: '✨ Dream Sky' },
];

// Funny motivational messages
export const MOTIVATIONAL_MESSAGES = [
  'Keep flying ❤️',
  "Don't give up!",
  'You got this!',
  'Keep going!',
  'Almost!',
  'Oops!',
  'One more try!',
  'Hugot Level: MAX',
  'Stay strong! 💪',
  'You can do it!',
  'So close! 😅',
  'Believe in yourself!',
];
