// Renderer — draws everything onto the Canvas 2D context
import type { Obstacle, Collectible, Particle, Player } from './types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SIZE,
  OBSTACLE_LABELS, OBSTACLE_COLORS, STAGE_BACKGROUNDS,
} from './constants';

// ─── Helpers ────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function lerpColor(c1: string, c2: string, t: number) {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  const r = Math.round(lerp(a.r, b.r, t));
  const g = Math.round(lerp(a.g, b.g, t));
  const bl = Math.round(lerp(a.b, b.b, t));
  return `rgb(${r},${g},${bl})`;
}

// ─── Background ─────────────────────────────────────────────────────────────

export function drawBackground(ctx: CanvasRenderingContext2D, stage: number, bgPhase: number, time: number) {
  const s1 = Math.min(stage, STAGE_BACKGROUNDS.length - 1);
  const s2 = Math.min(stage + 1, STAGE_BACKGROUNDS.length - 1);
  const t = bgPhase % 1;

  const bg1 = STAGE_BACKGROUNDS[s1];
  const bg2 = STAGE_BACKGROUNDS[s2];

  // Sky gradient (3 stops)
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT - 60);
  for (let i = 0; i < 3; i++) {
    const c = lerpColor(bg1.sky[i], bg2.sky[i], t);
    grad.addColorStop(i / 2, c);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT - 60);

  // Parallax clouds
  drawClouds(ctx, time, stage);

  // Chocolate Hills (parallax, two layers)
  drawChocolateHills(ctx, time, stage);

  // Ground strip
  const groundColor = lerpColor(bg1.ground, bg2.ground, t);
  ctx.fillStyle = groundColor;
  ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 60);

  // Province town landmarks on the ground
  drawProvinceTown(ctx, time);

  // Ground detail line
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, CANVAS_HEIGHT - 60, CANVAS_WIDTH, 4);
}

function drawClouds(ctx: CanvasRenderingContext2D, time: number, stage: number) {
  const clouds = [
    { speed: 0.3, y: 80, size: 40, opacity: 0.6 },
    { speed: 0.5, y: 140, size: 28, opacity: 0.4 },
    { speed: 0.2, y: 200, size: 55, opacity: 0.3 },
    { speed: 0.4, y: 60,  size: 35, opacity: 0.5 },
  ];

  const nightAlpha = stage >= 2 ? Math.min((stage - 2) / 2, 1) : 0;

  clouds.forEach((c, i) => {
    const x = ((CANVAS_WIDTH + 120 - ((time * c.speed * 0.04) % (CANVAS_WIDTH + 120))) + i * 130) % (CANVAS_WIDTH + 120) - 60;
    ctx.globalAlpha = c.opacity * (1 - nightAlpha * 0.7);
    ctx.fillStyle = stage >= 2 ? '#e0e0ff' : '#ffffff';
    drawCloud(ctx, x, c.y, c.size);
    ctx.globalAlpha = 1;
  });

  // Stars at night
  if (stage >= 2) {
    ctx.globalAlpha = Math.min((stage - 2) / 2, 0.9);
    drawStars(ctx, time);
    ctx.globalAlpha = 1;
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.arc(x + r * 0.8, y - r * 0.3, r * 0.7, 0, Math.PI * 2);
  ctx.arc(x + r * 1.5, y, r * 0.8, 0, Math.PI * 2);
  ctx.fill();
}

const STAR_POSITIONS = Array.from({ length: 40 }, (_, i) => ({
  x: ((i * 137.5) % CANVAS_WIDTH),
  y: ((i * 97.3) % (CANVAS_HEIGHT - 120)),
  size: 1 + (i % 3),
  twinkleOffset: i * 0.7,
}));

function drawStars(ctx: CanvasRenderingContext2D, time: number) {
  STAR_POSITIONS.forEach(star => {
    const twinkle = 0.5 + 0.5 * Math.sin(time * 0.002 + star.twinkleOffset);
    ctx.globalAlpha *= twinkle;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}


// ─── Province Town Landmarks ──────────────────────────────────────────────────
//
// Typical Philippine province municipality scene scrolling along the ground:
// churches with bell towers, carabaos, school buildings, nipa huts, coconut trees.
// Two "tracks" tile across a wide strip so the scene never feels empty.

type LandmarkType = 'CHURCH' | 'SCHOOL' | 'CARABAO' | 'NIPA_HUT' | 'COCONUT' | 'LAMP_POST';

interface Landmark {
  type: LandmarkType;
  relX: number; // position within tile (0–1 of tileW)
}

const TOWN_TILE_W = CANVAS_WIDTH * 3; // one seamless tile width
const TOWN_SPEED  = 0.022;             // px per ms — slightly faster than far hills

// Pre-built sequence of landmarks, spaced naturally along the tile
const TOWN_LANDMARKS: Landmark[] = [
  { type: 'LAMP_POST',  relX: 0.04 },
  { type: 'NIPA_HUT',   relX: 0.10 },
  { type: 'COCONUT',    relX: 0.17 },
  { type: 'CARABAO',    relX: 0.24 },
  { type: 'LAMP_POST',  relX: 0.30 },
  { type: 'SCHOOL',     relX: 0.37 },
  { type: 'COCONUT',    relX: 0.48 },
  { type: 'LAMP_POST',  relX: 0.52 },
  { type: 'CHURCH',     relX: 0.58 },
  { type: 'CARABAO',    relX: 0.70 },
  { type: 'NIPA_HUT',   relX: 0.76 },
  { type: 'LAMP_POST',  relX: 0.82 },
  { type: 'COCONUT',    relX: 0.88 },
  { type: 'CARABAO',    relX: 0.94 },
];

function drawProvinceTown(ctx: CanvasRenderingContext2D, time: number) {
  const offsetX = -(time * TOWN_SPEED % TOWN_TILE_W);
  const groundY = CANVAS_HEIGHT - 60; // top of ground strip

  ctx.save();
  // Clip so nothing draws above the ground strip
  ctx.beginPath();
  ctx.rect(0, groundY - 80, CANVAS_WIDTH, 80 + 60);
  ctx.clip();

  for (let tile = 0; tile <= 1; tile++) {
    const tileX = offsetX + tile * TOWN_TILE_W;
    TOWN_LANDMARKS.forEach(lm => {
      const x = tileX + lm.relX * TOWN_TILE_W;
      if (x < -120 || x > CANVAS_WIDTH + 120) return; // off-screen skip
      switch (lm.type) {
        case 'CHURCH':    drawChurch(ctx, x, groundY);   break;
        case 'SCHOOL':    drawSchool(ctx, x, groundY);   break;
        case 'CARABAO':   drawCarabao(ctx, x, groundY);  break;
        case 'NIPA_HUT':  drawNipaHut(ctx, x, groundY);  break;
        case 'COCONUT':   drawCoconut(ctx, x, groundY);  break;
        case 'LAMP_POST': drawLampPost(ctx, x, groundY); break;
      }
    });
  }

  ctx.restore();
}

// ── Church with bell tower ─────────────────────────────────────────────────

function drawChurch(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  const baseH = 52;
  const baseW = 46;
  const bx    = x - baseW / 2;
  const by    = groundY - baseH;

  // Main nave body
  ctx.fillStyle = '#f5f0e8';
  ctx.strokeStyle = '#c8b89a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(bx, by, baseW, baseH);
  ctx.fill(); ctx.stroke();

  // Façade arched entrance
  ctx.fillStyle = '#7a5c2e';
  ctx.beginPath();
  ctx.roundRect(bx + baseW * 0.35, by + baseH * 0.55, baseW * 0.3, baseH * 0.45, [4, 4, 0, 0]);
  ctx.fill();

  // Window (arched, stained-glass hint)
  ctx.fillStyle = '#7ec8e3';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(bx + baseW * 0.32, by + baseH * 0.2, baseW * 0.36, baseH * 0.28, [6, 6, 0, 0]);
  ctx.fill(); ctx.stroke();

  // Bell tower (left)
  const tw = 14;
  const th = 44;
  const tx = bx - tw + 4;
  const ty = by - th + 8;
  ctx.fillStyle = '#ede8dc';
  ctx.strokeStyle = '#c8b89a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(tx, ty, tw, th);
  ctx.fill(); ctx.stroke();

  // Bell tower belfry opening
  ctx.fillStyle = '#5a4020';
  ctx.beginPath();
  ctx.roundRect(tx + 2, ty + 6, tw - 4, th * 0.35, [3, 3, 0, 0]);
  ctx.fill();

  // Bell tower pyramid roof
  ctx.fillStyle = '#8b7355';
  ctx.beginPath();
  ctx.moveTo(tx - 3,      ty + 2);
  ctx.lineTo(tx + tw / 2, ty - 14);
  ctx.lineTo(tx + tw + 3, ty + 2);
  ctx.closePath();
  ctx.fill();

  // Cross on top
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tx + tw / 2, ty - 14);
  ctx.lineTo(tx + tw / 2, ty - 22);
  ctx.moveTo(tx + tw / 2 - 4, ty - 18);
  ctx.lineTo(tx + tw / 2 + 4, ty - 18);
  ctx.stroke();

  // Main roof (gable)
  ctx.fillStyle = '#a0522d';
  ctx.beginPath();
  ctx.moveTo(bx - 4,           by);
  ctx.lineTo(x,                by - 14);
  ctx.lineTo(bx + baseW + 4,   by);
  ctx.closePath();
  ctx.fill();

  // Label
  drawLandmarkLabel(ctx, x, groundY - baseH - 26, '⛪');
}

// ── School building ────────────────────────────────────────────────────────

function drawSchool(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  const w = 56;
  const h = 40;
  const bx = x - w / 2;
  const by = groundY - h;

  // Main block
  ctx.fillStyle = '#fffde7';
  ctx.strokeStyle = '#bdb76b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(bx, by, w, h);
  ctx.fill(); ctx.stroke();

  // Roof
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.moveTo(bx - 4,     by);
  ctx.lineTo(x,          by - 12);
  ctx.lineTo(bx + w + 4, by);
  ctx.closePath();
  ctx.fill();

  // Windows (3 across)
  ctx.fillStyle = '#90caf9';
  ctx.strokeStyle = '#5c8db8';
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const wx = bx + 6 + i * 17;
    ctx.beginPath();
    ctx.rect(wx, by + 8, 10, 12);
    ctx.fill(); ctx.stroke();
  }

  // Door
  ctx.fillStyle = '#5d4037';
  ctx.beginPath();
  ctx.roundRect(bx + w / 2 - 5, by + h - 16, 10, 16, [2, 2, 0, 0]);
  ctx.fill();

  // Flag pole
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bx + w + 6, by - 12);
  ctx.lineTo(bx + w + 6, groundY);
  ctx.stroke();
  // Flag
  ctx.fillStyle = '#1565c0';
  ctx.beginPath();
  ctx.rect(bx + w + 7, by - 12, 12, 5);
  ctx.fill();
  ctx.fillStyle = '#c62828';
  ctx.beginPath();
  ctx.rect(bx + w + 7, by - 7, 12, 5);
  ctx.fill();

  drawLandmarkLabel(ctx, x, groundY - h - 14, '🏫');
}

// ── Carabao (water buffalo) ────────────────────────────────────────────────
// Drawn as a simple silhouette side view

function drawCarabao(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  ctx.save();
  ctx.translate(x, groundY);

  const col = '#3d2b1f';
  ctx.fillStyle = col;

  // Body — large rounded rectangle
  ctx.beginPath();
  ctx.ellipse(-6, -16, 22, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.beginPath();
  ctx.ellipse(14, -22, 7, 9, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.ellipse(22, -26, 8, 6, 0.1, 0, Math.PI * 2);
  ctx.fill();

  // Snout
  ctx.fillStyle = '#5c3d2a';
  ctx.beginPath();
  ctx.ellipse(29, -24, 5, 4, 0.2, 0, Math.PI * 2);
  ctx.fill();

  // Nostril
  ctx.fillStyle = '#1a0f0a';
  ctx.beginPath();
  ctx.arc(31, -23, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(24, -27, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0f0a';
  ctx.beginPath();
  ctx.arc(24.5, -27, 1.1, 0, Math.PI * 2);
  ctx.fill();

  // Horns (the iconic wide swept horns)
  ctx.strokeStyle = '#6b4c30';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  // Left horn (far side)
  ctx.beginPath();
  ctx.moveTo(18, -30);
  ctx.bezierCurveTo(10, -42, 2, -44, -2, -38);
  ctx.stroke();
  // Right horn
  ctx.beginPath();
  ctx.moveTo(22, -31);
  ctx.bezierCurveTo(26, -44, 34, -46, 36, -38);
  ctx.stroke();

  // Legs (4 short thick legs)
  ctx.fillStyle = col;
  const legs = [-18, -8, 2, 12];
  legs.forEach(lx => {
    ctx.beginPath();
    ctx.rect(lx - 3, -6, 6, 14);
    ctx.fill();
    // Hoof
    ctx.fillStyle = '#1a0f0a';
    ctx.beginPath();
    ctx.rect(lx - 3, 7, 6, 3);
    ctx.fill();
    ctx.fillStyle = col;
  });

  // Tail
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-28, -18);
  ctx.bezierCurveTo(-34, -12, -34, -6, -30, -2);
  ctx.stroke();

  ctx.restore();
  drawLandmarkLabel(ctx, x, groundY - 46, '🐃');
}

// ── Nipa Hut ───────────────────────────────────────────────────────────────

function drawNipaHut(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  const w = 36;
  const h = 28;
  const bx = x - w / 2;
  const by = groundY - h;

  // Stilts (bahay kubo sits on posts)
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const sx of [bx + 4, x, bx + w - 4]) {
    ctx.beginPath();
    ctx.moveTo(sx, groundY);
    ctx.lineTo(sx, by + h - 2);
    ctx.stroke();
  }

  // Wall
  ctx.fillStyle = '#D4A96A';
  ctx.strokeStyle = '#A07040';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(bx, by, w, h);
  ctx.fill(); ctx.stroke();

  // Bamboo wall lines
  ctx.strokeStyle = '#A07040';
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(bx + i * (w / 5), by);
    ctx.lineTo(bx + i * (w / 5), by + h);
    ctx.stroke();
  }

  // Thatched roof (steep A-frame)
  ctx.fillStyle = '#8B6914';
  ctx.beginPath();
  ctx.moveTo(bx - 8,     by + 2);
  ctx.lineTo(x,          by - 20);
  ctx.lineTo(bx + w + 8, by + 2);
  ctx.closePath();
  ctx.fill();

  // Roof texture lines
  ctx.strokeStyle = '#6B4F10';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const ry = by + 2 - i * 5;
    const halfW = (i / 4) * (w / 2 + 8);
    ctx.beginPath();
    ctx.moveTo(x - halfW, ry + 2);
    ctx.lineTo(x + halfW, ry + 2);
    ctx.stroke();
  }

  // Door
  ctx.fillStyle = '#5D3A1A';
  ctx.beginPath();
  ctx.roundRect(x - 5, by + h - 14, 10, 14, [2, 2, 0, 0]);
  ctx.fill();

  drawLandmarkLabel(ctx, x, groundY - h - 24, '🏠');
}

// ── Coconut Tree ───────────────────────────────────────────────────────────

function drawCoconut(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  // Trunk (slightly curved)
  ctx.strokeStyle = '#8B5E3C';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.bezierCurveTo(x + 4, groundY - 20, x - 3, groundY - 35, x + 2, groundY - 52);
  ctx.stroke();

  // Ring marks on trunk
  ctx.strokeStyle = '#6B4520';
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 5; i++) {
    const ty = groundY - i * 9;
    ctx.beginPath();
    ctx.moveTo(x - 3, ty);
    ctx.lineTo(x + 4, ty);
    ctx.stroke();
  }

  // Fronds (5 curved palm leaves)
  const fronds = [
    { angle: -0.5, len: 30 },
    { angle:  0.3, len: 28 },
    { angle:  1.1, len: 32 },
    { angle: -1.4, len: 26 },
    { angle: -0.1, len: 34 },
  ];
  const topX = x + 2;
  const topY = groundY - 52;

  fronds.forEach(f => {
    const ex = topX + Math.cos(f.angle) * f.len;
    const ey = topY + Math.sin(f.angle) * f.len * 0.5 - 4;
    const mx = topX + Math.cos(f.angle) * f.len * 0.5 - Math.sin(f.angle) * 6;
    const my = topY + Math.sin(f.angle) * f.len * 0.25 - 8;

    // Frond midrib
    ctx.strokeStyle = '#4a7c3f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(mx, my, ex, ey);
    ctx.stroke();

    // Leaflets (feathery)
    ctx.strokeStyle = '#5a9448';
    ctx.lineWidth = 1;
    for (let j = 1; j <= 5; j++) {
      const t2 = j / 6;
      const lx = topX + (ex - topX) * t2;
      const ly = topY + (ey - topY) * t2 + (my - topY) * 4 * t2 * (1 - t2);
      const perp = f.angle + Math.PI / 2;
      const leafLen = 8 * Math.sin(t2 * Math.PI);
      ctx.beginPath();
      ctx.moveTo(lx - Math.cos(perp) * leafLen, ly - Math.sin(perp) * leafLen);
      ctx.lineTo(lx + Math.cos(perp) * leafLen, ly + Math.sin(perp) * leafLen);
      ctx.stroke();
    }
  });

  // Coconuts (2–3 clustered at crown)
  ctx.fillStyle = '#5C3D1A';
  [[topX - 4, topY + 3], [topX + 5, topY + 6], [topX, topY + 8]].forEach(([cx2, cy2]) => {
    ctx.beginPath();
    ctx.arc(cx2, cy2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── Street Lamp Post ───────────────────────────────────────────────────────

function drawLampPost(ctx: CanvasRenderingContext2D, x: number, groundY: number) {
  // Pole
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - 38);
  ctx.stroke();

  // Curved arm
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, groundY - 38);
  ctx.bezierCurveTo(x, groundY - 44, x + 10, groundY - 46, x + 14, groundY - 44);
  ctx.stroke();

  // Lamp head
  ctx.fillStyle = '#f5e642';
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x + 14, groundY - 43, 6, 4, 0, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();

  // Warm glow halo
  ctx.save();
  const glow = ctx.createRadialGradient(x + 14, groundY - 43, 0, x + 14, groundY - 43, 14);
  glow.addColorStop(0, 'rgba(255,240,100,0.25)');
  glow.addColorStop(1, 'rgba(255,240,100,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x + 14, groundY - 43, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ── Shared tiny label ─────────────────────────────────────────────────────

function drawLandmarkLabel(ctx: CanvasRenderingContext2D, x: number, y: number, emoji: string) {
  ctx.font = '11px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(emoji, x, y);
}


// ─── Chocolate Hills ─────────────────────────────────────────────────────────
//
// The Chocolate Hills of Bohol, Philippines — dozens of near-perfect conical
// hills that turn chocolate-brown in the dry season. Two parallax layers:
//   • Far layer  (slow scroll, smaller, darker)  — looks distant
//   • Near layer (faster scroll, taller, greener) — sits just above the ground

// Deterministic hill data so hills are always the same (no Random per frame)
const FAR_HILLS = Array.from({ length: 18 }, (_, i) => ({
  // spread across 2× canvas width so the tile loops seamlessly
  cx: (i / 18) * CANVAS_WIDTH * 2 + 30,
  // vary width 55–110 and height 60–110
  rw: 55 + (i * 37) % 55,
  rh: 60 + (i * 53) % 50,
}));

const NEAR_HILLS = Array.from({ length: 14 }, (_, i) => ({
  cx: (i / 14) * CANVAS_WIDTH * 2 + 15,
  rw: 70 + (i * 43) % 60,
  rh: 80 + (i * 61) % 60,
}));

function drawChocolateHills(ctx: CanvasRenderingContext2D, time: number, stage: number) {
  // In dry season (stage 0-1) tops are chocolate brown; wet season (stage 2+) they're lush green
  const dryT = Math.max(0, 1 - stage * 0.6); // 1 = fully dry, 0 = fully green

  // Far layer colours
  const farTop    = lerpColor('#7a5c2e', '#4a7c3f', 1 - dryT); // brown ↔ dark green
  const farShadow = lerpColor('#5a3e18', '#2d5a28', 1 - dryT);
  const farBase   = lerpColor('#6b8f3a', '#3d6b2a', 1 - dryT);

  // Near layer colours (always slightly greener at base)
  const nearTop    = lerpColor('#8c6b35', '#5a9448', 1 - dryT);
  const nearShadow = lerpColor('#6b4f1f', '#3a6b30', 1 - dryT);
  const nearBase   = lerpColor('#7aaa3a', '#4a8f2a', 1 - dryT);

  const groundY = CANVAS_HEIGHT - 60; // top of ground strip

  // ── Far layer ──
  const farSpeed = time * 0.018; // slow
  const farTileW = CANVAS_WIDTH * 2;
  const farOffsetX = -(farSpeed % farTileW);

  ctx.save();
  for (let tile = 0; tile <= 1; tile++) {
    const tileX = farOffsetX + tile * farTileW;
    FAR_HILLS.forEach(h => {
      const cx = tileX + h.cx;
      const baseY = groundY + 4; // sit slightly below ground line
      drawHillCone(ctx, cx, baseY, h.rw, h.rh, farTop, farShadow, farBase);
    });
  }
  ctx.restore();

  // ── Near layer ──
  const nearSpeed = time * 0.032; // faster parallax
  const nearTileW = CANVAS_WIDTH * 2;
  const nearOffsetX = -(nearSpeed % nearTileW);

  ctx.save();
  for (let tile = 0; tile <= 1; tile++) {
    const tileX = nearOffsetX + tile * nearTileW;
    NEAR_HILLS.forEach(h => {
      const cx = tileX + h.cx;
      const baseY = groundY + 4;
      drawHillCone(ctx, cx, baseY, h.rw, h.rh, nearTop, nearShadow, nearBase);
    });
  }
  ctx.restore();
}

/**
 * Draws one chocolate-hill cone.
 * The hill is an ellipse, top-half only, with a left-side shadow and a
 * radial gradient that mimics the sunlit/shaded cone look.
 */
function drawHillCone(
  ctx: CanvasRenderingContext2D,
  cx: number, baseY: number,
  rw: number, rh: number,
  topColor: string, shadowColor: string, baseColor: string,
) {
  const peakY = baseY - rh;

  // Fill the body with a radial gradient (lit top-left, dark right)
  const grad = ctx.createRadialGradient(cx - rw * 0.25, peakY + rh * 0.25, rh * 0.05, cx, baseY, rh * 1.1);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.55, baseColor);
  grad.addColorStop(1, shadowColor);

  ctx.fillStyle = grad;

  // Draw the upper half of an ellipse (the iconic rounded dome shape)
  ctx.beginPath();
  ctx.ellipse(cx, baseY, rw, rh, 0, Math.PI, 0); // upper arc
  ctx.closePath();
  ctx.fill();

  // Subtle dark shadow on the right flank
  const shadowGrad = ctx.createLinearGradient(cx, baseY, cx + rw, baseY);
  shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(cx, baseY, rw, rh, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}


// ─── Player (Heart Character) ─────────────────────────────────────────────

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player) {
  if (player.isDead && player.deathTimer > 0.8) return; // already faded

  const { x, y, rotation, wingPhase, isDead, deathTimer, invincible, invincibleTimer, hitFlashTimer } = player;
  const s = PLAYER_SIZE;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Death shake
  if (isDead) {
    const shake = Math.sin(deathTimer * 30) * 4 * (1 - deathTimer);
    ctx.translate(shake, 0);
    ctx.globalAlpha = Math.max(0, 1 - deathTimer);
  }

  // Hit-flash: rapid red blink when just lost a life
  if (hitFlashTimer > 0) {
    const blink = Math.sin(hitFlashTimer * 30) > 0;
    ctx.globalAlpha = blink ? 0.3 : 1.0;
  }

  // Star invincibility: golden aura + fast shimmer
  if (invincible && hitFlashTimer <= 0) {
    const flash = Math.sin(invincibleTimer * 20) > 0;
    ctx.globalAlpha = flash ? 0.55 : 1.0;

    ctx.save();
    const auraR = s * 0.9 + Math.sin(invincibleTimer * 8) * 4;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Wings
  const wingFlap = Math.sin(wingPhase * 0.12) * 0.6; // -0.6 to +0.6 radians
  drawWing(ctx, -s * 0.7, -s * 0.1, -1, wingFlap, s);
  drawWing(ctx, s * 0.7, -s * 0.1, 1, wingFlap, s);

  // Heart body
  drawHeart(ctx, 0, 0, s);

  // Face
  drawFace(ctx, 0, s * 0.1, isDead);

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawWing(ctx: CanvasRenderingContext2D, ox: number, oy: number, dir: number, flap: number, s: number) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(dir * (0.3 + flap));
  ctx.fillStyle = '#ffc2d1';
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(0, 0, s * 0.45, s * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wing tip shimmer
  ctx.fillStyle = '#ffe0eb';
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.ellipse(dir * s * 0.15, -s * 0.05, s * 0.2, s * 0.1, 0.3 * dir, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const s = size * 0.52;
  ctx.save();
  ctx.translate(cx, cy);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.save();
  ctx.scale(1, 0.5);
  ctx.translate(s * 0.1, s * 1.8);
  heartPath(ctx, 0, 0, s * 0.9);
  ctx.fill();
  ctx.restore();

  // Main heart
  const grad = ctx.createRadialGradient(-s * 0.2, -s * 0.3, s * 0.05, 0, 0, s);
  grad.addColorStop(0, '#ff85a1');
  grad.addColorStop(0.6, '#ff4d6d');
  grad.addColorStop(1, '#c9184a');
  ctx.fillStyle = grad;
  heartPath(ctx, 0, 0, s);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.25, -s * 0.3, s * 0.25, s * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function heartPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.3);
  ctx.bezierCurveTo(cx - s * 0.05, cy - s * 0.1, cx - s, cy - s * 0.4, cx - s, cy - s * 0.1);
  ctx.bezierCurveTo(cx - s, cy + s * 0.35, cx, cy + s * 0.75, cx, cy + s);
  ctx.bezierCurveTo(cx, cy + s * 0.75, cx + s, cy + s * 0.35, cx + s, cy - s * 0.1);
  ctx.bezierCurveTo(cx + s, cy - s * 0.4, cx + s * 0.05, cy - s * 0.1, cx, cy + s * 0.3);
}

function drawFace(ctx: CanvasRenderingContext2D, cx: number, cy: number, isDead: boolean) {
  const s = PLAYER_SIZE * 0.52;
  // Eyes
  if (isDead) {
    // X eyes
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (const ex of [-s * 0.35, s * 0.35]) {
      ctx.beginPath();
      ctx.moveTo(cx + ex - 4, cy - s * 0.1 - 4);
      ctx.lineTo(cx + ex + 4, cy - s * 0.1 + 4);
      ctx.moveTo(cx + ex + 4, cy - s * 0.1 - 4);
      ctx.lineTo(cx + ex - 4, cy - s * 0.1 + 4);
      ctx.stroke();
    }
    // Sad mouth
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.3, s * 0.25, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    // Cute dot eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - s * 0.35, cy - s * 0.1, 4.5, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.35, cy - s * 0.1, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d2d2d';
    ctx.beginPath();
    ctx.arc(cx - s * 0.32, cy - s * 0.1, 2.5, 0, Math.PI * 2);
    ctx.arc(cx + s * 0.38, cy - s * 0.1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Blush
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ff85a1';
    ctx.beginPath();
    ctx.ellipse(cx - s * 0.55, cy + s * 0.05, 5, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + s * 0.55, cy + s * 0.05, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Smile
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy + s * 0.2, s * 0.22, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
}

// ─── Obstacles ────────────────────────────────────────────────────────────

export function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle, time: number) {
  const gapY = obs.gapY + Math.sin((time - obs.spawnTime) * obs.moveFreq * 0.001) * obs.moveAmp;
  const topH = gapY - obs.gapH / 2;
  const botY = gapY + obs.gapH / 2;
  const botH = CANVAS_HEIGHT - 60 - botY;

  const [c1, c2] = OBSTACLE_COLORS[obs.type] ?? ['#888', '#444'];

  // Draw top pillar
  drawPillar(ctx, obs.x, 0, obs.w, topH, c1, c2, 'top', obs.type);
  // Draw bottom pillar
  drawPillar(ctx, obs.x, botY, obs.w, botH, c1, c2, 'bottom', obs.type);
}

function drawPillar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  c1: string, c2: string,
  pos: 'top' | 'bottom',
  type: string,
) {
  if (h <= 0) return;

  // Body gradient
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;

  // Rounded edges on the gap side
  const radius = 8;
  ctx.beginPath();
  if (pos === 'top') {
    ctx.rect(x, y, w, h - radius);
    ctx.roundRect(x, h - radius * 2, w, radius * 2, [0, 0, radius, radius]);
  } else {
    ctx.roundRect(x, y, w, radius * 2, [radius, radius, 0, 0]);
    ctx.rect(x, y + radius, w, h - radius);
  }
  ctx.fill();

  // Edge shade
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(x, y, 4, h);
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x + w - 4, y, 4, h);

  // Emoji label on the gap-facing cap
  const emoji = OBSTACLE_LABELS[type] ?? '?';
  const emojiY = pos === 'top' ? y + h - 28 : y + 8;
  if (h > 24) {
    ctx.font = '22px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(emoji, x + w / 2, emojiY);
  }
}

// ─── Collectibles ─────────────────────────────────────────────────────────

export function drawCollectible(ctx: CanvasRenderingContext2D, item: Collectible, time: number) {
  if (item.collected) return;
  const bob = Math.sin(time * 0.003 + item.bobPhase) * 4;
  const { x, y, type } = item;

  ctx.save();
  ctx.translate(x, y + bob);

  switch (type) {
    case 'SMALL_HEART': drawSmallHeart(ctx); break;
    case 'BIG_HEART': drawBigHeart(ctx); break;
    case 'LOVE_LETTER': drawLoveLetter(ctx); break;
    case 'STAR': drawStarCollectible(ctx, time); break;
    case 'BUTTERFLY': drawButterfly(ctx, time); break;
  }

  ctx.restore();
}

function drawSmallHeart(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#ff4d6d';
  heartPath(ctx, 0, -8, 10);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-3, -10, 3, 2, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBigHeart(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(-4, -10, 2, 0, 0, 18);
  grad.addColorStop(0, '#ff85a1');
  grad.addColorStop(1, '#c9184a');
  ctx.fillStyle = grad;
  heartPath(ctx, 0, -12, 16);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-5, -13, 5, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawLoveLetter(ctx: CanvasRenderingContext2D) {
  // Envelope
  ctx.fillStyle = '#ffeaa7';
  ctx.strokeStyle = '#fdcb6e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-14, -10, 28, 20, 3);
  ctx.fill();
  ctx.stroke();
  // Flap
  ctx.fillStyle = '#fab1a0';
  ctx.beginPath();
  ctx.moveTo(-14, -10);
  ctx.lineTo(0, 4);
  ctx.lineTo(14, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Heart seal
  ctx.fillStyle = '#e17055';
  heartPath(ctx, 0, -4, 5);
  ctx.fill();
}

function drawStarCollectible(ctx: CanvasRenderingContext2D, time: number) {
  const spin = time * 0.003;
  ctx.save();
  ctx.rotate(spin);
  ctx.fillStyle = '#ffd60a';
  ctx.shadowColor = '#ffd60a';
  ctx.shadowBlur = 10;
  starPath(ctx, 0, 0, 14, 6, 5);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawButterfly(ctx: CanvasRenderingContext2D, time: number) {
  const flap = Math.sin(time * 0.008) * 0.5;
  ctx.save();
  // Left wing
  ctx.save();
  ctx.scale(-1 - Math.abs(flap), 1);
  ctx.fillStyle = '#a8dadc';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(-6, -4, 10, 8, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Right wing
  ctx.save();
  ctx.scale(1 + Math.abs(flap), 1);
  ctx.fillStyle = '#457b9d';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(6, -4, 10, 8, -0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Body
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
  }
  ctx.closePath();
}

// ─── Particles ────────────────────────────────────────────────────────────

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    if (p.text) {
      ctx.font = `bold ${Math.round(p.size)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
}

// ─── HUD ──────────────────────────────────────────────────────────────────

function drawLivesHUD(ctx: CanvasRenderingContext2D, lives: number, maxLives: number) {
  const heartW = 18;
  const gap    = 4;
  const totalW = maxLives * heartW + (maxLives - 1) * gap;
  const startX = (CANVAS_WIDTH - totalW) / 2;
  const y      = 20;

  for (let i = 0; i < maxLives; i++) {
    const hx = startX + i * (heartW + gap) + heartW / 2;
    const full = i < lives;

    ctx.save();
    ctx.globalAlpha = full ? 1 : 0.25;

    // Mini heart shape
    const s = heartW * 0.42;
    ctx.fillStyle = full ? '#ff4d6d' : '#888';

    ctx.beginPath();
    ctx.moveTo(hx, y + s * 0.3);
    ctx.bezierCurveTo(hx - s * 0.05, y - s * 0.1, hx - s, y - s * 0.4, hx - s, y - s * 0.1);
    ctx.bezierCurveTo(hx - s, y + s * 0.35, hx, y + s * 0.75, hx, y + s);
    ctx.bezierCurveTo(hx, y + s * 0.75, hx + s, y + s * 0.35, hx + s, y - s * 0.1);
    ctx.bezierCurveTo(hx + s, y - s * 0.4, hx + s * 0.05, y - s * 0.1, hx, y + s * 0.3);
    ctx.fill();

    // Highlight on full hearts
    if (full) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(hx - s * 0.25, y - s * 0.05, s * 0.25, s * 0.13, -0.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}


export function drawHUD(
  ctx: CanvasRenderingContext2D,
  score: number,
  lovePoints: number,
  hugotMeter: number,
  stage: number,
  maxHugotTriggered: boolean,
  maxHugotTimer: number,
  paused: boolean,
  lives: number,
  maxLives: number,
) {
  // Semi-transparent top bar
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, 48);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px system-ui, sans-serif';
  ctx.textBaseline = 'middle';

  // Score (left)
  ctx.textAlign = 'left';
  ctx.fillText(`🏆 ${score}`, 12, 24);

  // Lives — row of hearts, center-bottom of HUD
  drawLivesHUD(ctx, lives, maxLives);

  // Hugot meter (right)
  ctx.textAlign = 'right';
  const hugotColor = hugotMeter >= 100 ? '#ff4d6d' : hugotMeter >= 70 ? '#fb8500' : '#4cc9f0';
  ctx.fillStyle = hugotColor;
  ctx.fillText(`💔 ${Math.round(hugotMeter)}%`, CANVAS_WIDTH - 12, 24);

  // Stage label (bottom of HUD strip)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(STAGE_BACKGROUNDS[Math.min(stage, STAGE_BACKGROUNDS.length - 1)].label, CANVAS_WIDTH / 2, 42);

  // Love points — small, below stage label area (just inside the bar)
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`❤️ ${lovePoints} love`, 12, 42);

  // MAX HUGOT banner
  if (maxHugotTriggered) {
    const pulse = Math.abs(Math.sin(maxHugotTimer * 8));
    ctx.globalAlpha = Math.min(1, (1 - maxHugotTimer / 3)) * pulse;
    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💔 MAX HUGOT!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);
    ctx.globalAlpha = 1;
  }

  // Pause indicator
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('Tap / Click / Space to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 50);
  }
}

// ─── Countdown ────────────────────────────────────────────────────────────

export function drawCountdown(ctx: CanvasRenderingContext2D, value: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const isFly = value <= 0;
  // Display integer ceiling so 4.73 → "5", 0.1 → "1", ≤0 → FLY
  const displayNum = Math.ceil(value);
  const label = isFly ? '❤️ FLY!' : String(displayNum);
  // Pop-in scale: animate from big→normal each second (frac goes 0→1 each second)
  const frac = value % 1; // 0..1 within current second
  const scale = isFly
    ? 1 + Math.max(0, -value) * 0.4          // FLY! grows slightly
    : 1.5 - frac * 0.5;                       // each number starts big and shrinks in

  ctx.save();
  ctx.translate(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = 24;

  if (isFly) {
    ctx.fillStyle = '#ff4d6d';
    ctx.shadowColor = '#ff85a1';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(label, 0, 0);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.font = 'bold 100px system-ui, sans-serif';
    ctx.fillText(label, 0, 0);
  }

  ctx.shadowBlur = 0;
  ctx.restore();

  // Sub-label
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    isFly ? 'Tap / Click / Space to flap!' : 'Get ready…',
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2 + 70,
  );
}
