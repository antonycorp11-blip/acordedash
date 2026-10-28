// Mundo em alta resolução: solo contínuo com pedras, túneis, céu e superfície
// de cada fase (pôr do sol, explosão, céu tóxico) e a torre da entrada.

import type { RunState } from '../../core/state';
import { DUG, ROCK } from '../../core/state';
import { t } from '../text';
import { box, circle, css, ellipse, glow, light, line, poly, rr, seeded, stone, vgrad, type Ctx } from './hd';

export const TILE_W = 16;

export type SkyMood = 'tarde' | 'explosao' | 'toxico';

export function skyMood(run: RunState): SkyMood {
  if (run.phase === 'countdown') return 'explosao';
  if (run.phase === 'survival' || run.phase === 'ended') return 'toxico';
  return 'tarde';
}

// ------------------------------------------------------------------ solo

/** Desenha o subsolo inteiro (largura W, altura H, em unidades do mundo). */
export function drawGround(c: Ctx, run: RunState, W: number, H: number): void {
  const T = TILE_W;
  c.fillStyle = vgrad(c, 0, H, [[0, 0x6e4a2e], [0.25, 0x553722], [0.6, 0x3f2a1d], [1, 0x261914]]);
  c.fillRect(0, 0, W, H);
  // Estratos ondulados.
  const r = seeded(91);
  for (let k = 1; k < 7; k++) {
    const y0 = (H / 7) * k;
    c.beginPath();
    c.moveTo(0, y0);
    for (let x = 0; x <= W; x += 8) c.lineTo(x, y0 + Math.sin(x * 0.04 + k) * 2.5 + Math.sin(x * 0.11 + k * 2) * 1.2);
    c.strokeStyle = css(0x1a100c, 0.18);
    c.lineWidth = 1.2;
    c.stroke();
  }
  // Grãos de terra claros e escuros.
  for (let i = 0; i < 2200; i++) {
    const x = r() * W;
    const y = r() * H;
    const depth = y / H;
    const s = 0.3 + r() * 0.8;
    ellipse(c, x, y, s, s * 0.7, css(r() < 0.5 ? light(0x6e4a2e, 0.25 - depth * 0.3) : 0x1a100c, 0.25 + r() * 0.25));
  }
  // Pedrinhas soltas.
  for (let i = 0; i < 140; i++) {
    const x = r() * W;
    const y = 4 + r() * (H - 4);
    stone(c, x, y, 1 + r() * 1.8, 0.8 + r() * 1.2, light(0x6a625c, -(y / H) * 0.35), i);
  }
  // Pedras grandes nas células de rocha.
  for (let y = 0; y < run.height; y++) {
    for (let x = 0; x < run.width; x++) {
      if (run.terrain[y * run.width + x] !== ROCK) continue;
      const rr2 = seeded(x * 7919 + y * 104729);
      const n = rr2() < 0.5 ? 1 : 2;
      for (let k = 0; k < n; k++) {
        const rx = (n === 1 ? 6 : 4) + rr2() * 2.5;
        const ry = rx * (0.65 + rr2() * 0.25);
        const cx = x * T + 8 + (rr2() - 0.5) * 6;
        const cy = y * T + 8 + (rr2() - 0.5) * 6;
        stone(c, cx, cy, rx, ry, light(0x7a706a, -(y / run.height) * 0.4), x * 31 + y * 17 + k);
      }
    }
  }
  // Sombra suave em volta das salas (escavação).
  c.save();
  c.shadowColor = 'rgba(10,6,4,0.75)';
  c.shadowBlur = 24;
  for (const room of run.rooms) {
    rr(c, room.x * T - 1, room.y * T - 1, room.w * T + 2, room.h * T + 2, 2);
    c.fillStyle = css(0x1a100c, 0.9);
    c.fill();
  }
  c.restore();
  // Túneis abertos que não são sala.
  const covered = new Set<number>();
  for (const room of run.rooms) for (let yy = room.y; yy < room.y + room.h; yy++) for (let xx = room.x; xx < room.x + room.w; xx++) covered.add(yy * run.width + xx);
  const dug = (x: number, y: number) => x >= 0 && y >= 0 && x < run.width && y < run.height && run.terrain[y * run.width + x] === DUG && !covered.has(y * run.width + x);
  for (let y = 0; y < run.height; y++) {
    for (let x = 0; x < run.width; x++) {
      if (!dug(x, y)) continue;
      const px = x * T;
      const py = y * T;
      c.fillStyle = vgrad(c, py, py + T, [[0, 0x150d0a], [1, 0x241712]]);
      c.fillRect(px - 0.2, py - 0.2, T + 0.4, T + 0.4);
      // Bordas: sombra no teto, chão de terra solta.
      if (!dug(x, y - 1)) {
        c.fillStyle = css(0x000000, 0.45);
        c.fillRect(px, py, T, 2);
        line(c, [[px, py], [px + T, py]], 0x7d5232, 0.7);
      }
      if (!dug(x, y + 1)) {
        c.fillStyle = vgrad(c, py + T - 3, py + T, [[0, 0x4a2f1d], [1, 0x6e4a2e]]);
        c.beginPath();
        c.moveTo(px, py + T);
        for (let k = 0; k <= 4; k++) c.lineTo(px + (k * T) / 4, py + T - 2 - Math.sin(x * 3 + k) * 0.8);
        c.lineTo(px + T, py + T);
        c.fill();
      }
      if (!dug(x - 1, y)) {
        c.fillStyle = css(0x000000, 0.35);
        c.fillRect(px, py, 1.5, T);
      }
      if (!dug(x + 1, y)) {
        c.fillStyle = css(0x000000, 0.35);
        c.fillRect(px + T - 1.5, py, 1.5, T);
      }
    }
  }
}

// ------------------------------------------------------------------ céu

export function drawSky(c: Ctx, mood: SkyMood, W: number, H: number, entranceXs: number[]): void {
  const palettes: Record<SkyMood, [number, number][]> = {
    tarde: [[0, 0x2e2f6a], [0.35, 0x6a4a86], [0.62, 0xd07a6a], [0.85, 0xf2a860], [1, 0xf6c878]],
    explosao: [[0, 0x3a1010], [0.3, 0x8a2a1a], [0.6, 0xe0602a], [0.85, 0xf6a040], [1, 0xffd070]],
    toxico: [[0, 0x141c14], [0.35, 0x2a3a22], [0.7, 0x5a7a32], [1, 0x9aba4a]],
  };
  c.fillStyle = vgrad(c, -40, H, palettes[mood]);
  c.fillRect(-60, -60, W + 120, H + 60);
  const r = seeded(7);
  if (mood === 'tarde') {
    glow(c, W * 0.82, H * 0.62, 40, 0xffe0a0, 0.55);
    circle(c, W * 0.82, H * 0.62, 9, 0xffd27a, null);
    for (let i = 0; i < 5; i++) cloud(c, r() * W, 8 + r() * 22, 18 + r() * 16, 0xf2b08a, 0.55);
  } else if (mood === 'explosao') {
    mushroom(c, W * 0.6, H - 10, 1.4);
  } else {
    for (let i = 0; i < 7; i++) cloud(c, r() * W, 4 + r() * 26, 22 + r() * 20, 0x2a3424, 0.7);
    mushroom(c, W * 0.66, H - 8, 0.7, true);
  }
  // Montanhas em duas camadas.
  const mtn: Record<SkyMood, [number, number]> = { tarde: [0x5a4a7a, 0x46385e], explosao: [0x6a2a24, 0x4a1c18], toxico: [0x2a3a26, 0x1e2a1c] };
  ridge(c, W, H - 14, 16, mtn[mood][0], 0.025, 3);
  // Cidade em ruínas.
  skyline(c, W, H - 8, mood === 'tarde' ? 0x3a3048 : mood === 'explosao' ? 0x3a1612 : 0x161e14, 11);
  ridge(c, W, H - 6, 6, mtn[mood][1], 0.06, 9);
  // Chão da superfície com capim seco.
  c.fillStyle = vgrad(c, H - 6, H, [[0, mood === 'toxico' ? 0x5a5a2a : 0xb07a3a], [1, 0x6e4a2e]]);
  c.fillRect(-10, H - 6, W + 20, 6);
  for (let x = 0; x < W; x += 1.3) {
    const h = 1 + r() * 3;
    line(c, [[x, H - 5], [x + (r() - 0.5) * 1.5, H - 5 - h]], mood === 'toxico' ? 0x8a9a4a : 0xd09a50, 0.45, 0.9);
  }
  // Árvores secas, cerca, carro enferrujado e a placa.
  const avoid = (x: number) => entranceXs.some((e) => Math.abs(e - x) < 30);
  for (const tx of [W * 0.06, W * 0.2, W * 0.47, W * 0.9]) if (!avoid(tx)) deadTree(c, tx, H - 5, 14 + r() * 6, r);
  fence(c, W * 0.25, W * 0.42, H - 5, avoid);
  if (!avoid(W * 0.12)) car(c, W * 0.12, H - 5);
  sign(c, W - 34, H - 5, t(mood === 'toxico' ? 'sign.survival' : 'sign.build'), mood === 'toxico' ? '☢' : '☺');
}

function cloud(c: Ctx, x: number, y: number, w: number, color: number, a: number): void {
  for (let i = 0; i < 5; i++) ellipse(c, x + (i - 2) * w * 0.18, y + Math.abs(i - 2) * 1.2, w * 0.22, w * 0.12, css(color, a));
}

function mushroom(c: Ctx, x: number, base: number, s: number, faded = false): void {
  const a = faded ? 0.5 : 1;
  glow(c, x, base - 30 * s, 60 * s, faded ? 0x9aba4a : 0xffb040, faded ? 0.25 : 0.7);
  c.fillStyle = vgrad(c, base - 30 * s, base, [[0, faded ? 0x3a4a2a : 0xf08a30], [1, faded ? 0x2a3020 : 0x8a3a1a]]);
  c.globalAlpha = a;
  c.fillRect(x - 5 * s, base - 30 * s, 10 * s, 30 * s);
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * Math.PI;
    ellipse(c, x + Math.cos(ang) * 18 * s, base - 34 * s - Math.sin(ang) * 6 * s, 9 * s, 6 * s, css(faded ? 0x4a5a32 : mixHot(i), a));
  }
  ellipse(c, x, base - 38 * s, 16 * s, 8 * s, css(faded ? 0x5a6a3a : 0xffd070, a));
  c.globalAlpha = 1;
}

function mixHot(i: number): number {
  return [0xf6a040, 0xe0602a, 0xffc060][i % 3];
}

function ridge(c: Ctx, W: number, base: number, amp: number, color: number, f: number, seed: number): void {
  c.beginPath();
  c.moveTo(-20, base + 20);
  for (let x = -20; x <= W + 20; x += 3) {
    const y = base - amp * (0.5 + 0.35 * Math.sin(x * f + seed) + 0.2 * Math.sin(x * f * 2.6 + seed * 3));
    c.lineTo(x, y);
  }
  c.lineTo(W + 20, base + 20);
  c.closePath();
  c.fillStyle = css(color);
  c.fill();
}

function skyline(c: Ctx, W: number, base: number, color: number, seed: number): void {
  const r = seeded(seed);
  let x = -10;
  while (x < W + 10) {
    const w = 6 + r() * 12;
    const h = 6 + r() * 20;
    c.fillStyle = css(color);
    c.beginPath();
    c.moveTo(x, base);
    c.lineTo(x, base - h);
    // Topo quebrado.
    c.lineTo(x + w * 0.3, base - h + r() * 3);
    c.lineTo(x + w * 0.55, base - h - r() * 2);
    c.lineTo(x + w * 0.8, base - h + 2 + r() * 4);
    c.lineTo(x + w, base - h * (0.6 + r() * 0.3));
    c.lineTo(x + w, base);
    c.fill();
    // Janelas vazias.
    for (let wy = base - h + 4; wy < base - 2; wy += 3) for (let wx = x + 1.5; wx < x + w - 2; wx += 3) if (r() < 0.45) {
      c.fillStyle = css(light(color, 0.25), 0.8);
      c.fillRect(wx, wy, 1, 1.4);
    }
    x += w + r() * 4;
  }
}

function deadTree(c: Ctx, x: number, base: number, h: number, r: () => number): void {
  const col = 0x2a1c18;
  const branch = (x0: number, y0: number, len: number, ang: number, w: number, d: number) => {
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    line(c, [[x0, y0], [x1, y1]], col, w);
    if (d <= 0) return;
    branch(x1, y1, len * 0.7, ang - 0.4 - r() * 0.3, w * 0.65, d - 1);
    branch(x1, y1, len * 0.65, ang + 0.4 + r() * 0.3, w * 0.65, d - 1);
  };
  branch(x, base, h * 0.5, -Math.PI / 2 + (r() - 0.5) * 0.2, 1.6, 3);
}

function fence(c: Ctx, x0: number, x1: number, base: number, avoid: (x: number) => boolean): void {
  for (let x = x0; x <= x1; x += 6) {
    if (avoid(x)) continue;
    box(c, x, base - 8, 1.2, 8, 0x5a4030, 0.2, 0x1a1210, 0.3);
  }
  for (const y of [base - 6.5, base - 3.5]) {
    c.beginPath();
    c.moveTo(x0, y);
    for (let x = x0; x <= x1; x += 6) c.quadraticCurveTo(x + 3, y + 0.8, x + 6, y);
    c.strokeStyle = css(0x3a3030, 0.8);
    c.lineWidth = 0.35;
    c.stroke();
  }
}

function car(c: Ctx, x: number, base: number): void {
  box(c, x - 13, base - 7, 26, 5, vgrad(c, base - 7, base - 2, [[0, 0x9a4a2a], [1, 0x5a2a1a]]), 1.5, 0x1a1210, 0.5);
  poly(c, [[x - 8, base - 7], [x - 4, base - 11.5], [x + 5, base - 11.5], [x + 9, base - 7]], 0x7a3a22, 0x1a1210, 0.5);
  poly(c, [[x - 6.5, base - 7.3], [x - 3.5, base - 10.5], [x, base - 10.5], [x, base - 7.3]], 0x2a3040, null);
  circle(c, x - 8, base - 2, 2.2, 0x1a1a1e, 0x0a0a0c, 0.4);
  circle(c, x + 8, base - 2, 2.2, 0x1a1a1e, 0x0a0a0c, 0.4);
}

function sign(c: Ctx, x: number, base: number, text: string, symbol: string): void {
  box(c, x - 1, base - 16, 2, 16, 0x5a4030, 0.3, 0x1a1210, 0.4);
  box(c, x + 13, base - 14, 2, 14, 0x5a4030, 0.3, 0x1a1210, 0.4);
  c.save();
  c.translate(x + 7, base - 17);
  c.rotate(-0.12);
  box(c, -14, -7, 30, 13, vgrad(c, -7, 6, [[0, 0xc8a070], [1, 0x8a6a44]]), 1.2, 0x2a1c14, 0.6);
  for (const yy of [-3, 1.5]) line(c, [[-13, yy], [15, yy]], 0x6a4a2a, 0.3, 0.6);
  c.fillStyle = css(0x2a1c14);
  c.font = `3.4px 'Lilita One', Impact, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const words = text.split(' ');
  const half = Math.ceil(words.length / 2);
  c.fillText(words.slice(0, half).join(' '), 0, -2.6);
  c.fillText(words.slice(half).join(' '), 0, 1.8);
  c.font = `4px sans-serif`;
  c.fillText(symbol, 12, -3.5);
  c.restore();
}

// ------------------------------------------------------------------ torre da entrada

/** Torre de concreto sobre a entrada (largura 28, altura 40; base no chão). */
export function drawTower(c: Ctx, open: boolean, alarm: boolean): void {
  const W = 28;
  const H = 40;
  // Bloco de concreto com junta.
  box(c, 1, 4, W - 2, H - 4, vgrad(c, 4, H, [[0, 0x8a8478], [1, 0x5a5650]]), 1.5, 0x1a1614, 0.6);
  for (let y = 10; y < H; y += 7) line(c, [[1.5, y], [W - 1.5, y]], 0x3a3632, 0.35, 0.6);
  // Laje do topo e lâmpada.
  box(c, -1, 2, W + 2, 4, 0x6a665e, 0.8, 0x1a1614, 0.6);
  box(c, W / 2 - 2, -1, 4, 3, 0x3a3632, 0.6, 0x1a1614, 0.4);
  glow(c, W / 2, 0.5, 9, alarm ? 0xff3020 : 0xffd27a, 0.7);
  circle(c, W / 2, 0.5, 1.4, alarm ? 0xff5040 : 0xffe0a0, null);
  // Faixas de perigo.
  c.save();
  rr(c, 3, H - 12, 4, 10, 0.5);
  c.clip();
  for (let k = -4; k < 14; k += 3) poly(c, [[3, H - 12 + k], [7, H - 16 + k], [7, H - 14.5 + k], [3, H - 10.5 + k]], 0xf4c84a, null);
  c.restore();
  // Porta tipo cofre.
  const dx = W / 2 + 1.5;
  const dy = H - 13;
  box(c, dx - 7, dy - 7, 14, 17, 0x2a2826, 1, 0x1a1614, 0.6);
  if (open) {
    box(c, dx - 6, dy - 6, 12, 15, 0x0c0908, 0.6, null);
    poly(c, [[dx + 6, dy - 6], [dx + 10, dy - 4], [dx + 10, dy + 7], [dx + 6, dy + 9]], 0x7a766c, 0x1a1614, 0.5);
  } else {
    circle(c, dx, dy + 1.5, 6, 0x8a8478, 0x1a1614, 0.6);
    circle(c, dx, dy + 1.5, 4.4, 0x6e6a62, 0x1a1614, 0.4);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + 0.4;
      line(c, [[dx, dy + 1.5], [dx + Math.cos(a) * 3.4, dy + 1.5 + Math.sin(a) * 3.4]], 0x3a3632, 0.8);
    }
    circle(c, dx, dy + 1.5, 1.1, 0xf4c84a, 0x1a1614, 0.3);
  }
}
