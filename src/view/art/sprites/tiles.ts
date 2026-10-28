// Texturas de terreno: terra em camadas por profundidade, pedras arredondadas,
// túnel com bordas sombreadas, grama, entulho, rachaduras e escotilha.

import Phaser from 'phaser';
import { rand } from '../../../core/rng';
import { P, shade } from '../palette';
import { makeTexture, type Pix } from '../pixel';

export const TILE = 16;

/** Camadas de solo: quanto mais fundo, mais escuro e mais frio. */
const BANDS = [
  { base: 0x63402a, light: 0x7d5232, dark: 0x4a2f1d, fleck: P.clay },
  { base: 0x52341f, light: 0x684429, dark: 0x3b2618, fleck: 0x7d5232 },
  { base: 0x40291c, light: 0x553621, dark: 0x2c1c15, fleck: 0x5f4a3e },
  { base: 0x33231f, light: 0x45302a, dark: 0x221719, fleck: 0x5a4a5e },
];

export function bandOf(row: number): number {
  return Math.min(BANDS.length - 1, Math.floor(row / 4));
}

/** Terra. `trans`: primeira linha de uma camada nova (mistura com a de cima). */
export function dirtKey(scene: Phaser.Scene, variant: number, row: number): string {
  const band = bandOf(row);
  const v = variant % 4;
  const trans = row > 0 && row % 4 === 0 && band > 0 ? 1 : 0;
  return makeTexture(scene, `t_dirt_${v}_${band}_${trans}`, TILE, TILE, (p) => {
    const b = BANDS[band];
    p.rect(0, 0, TILE, TILE, b.base);
    if (trans) {
      // Pontilhado de transição com a camada de cima.
      const up = BANDS[band - 1];
      for (let y = 0; y < 6; y++) for (let x = 0; x < TILE; x++) if ((x + y) % 2 === 0 && y < 6 - ((x * 3) % 4)) p.px(x, y, up.base);
    }
    soil(p, b, 50 + v * 37 + band * 11);
    if (v === 1) pebble(p, 3, 9, P.rockLight);
    if (v === 3) pebble(p, 10, 4, P.paperDark);
    if (v === 2 && band === 0) {
      // Raízes perto da superfície.
      for (let i = 0; i < 9; i++) p.px(5 + Math.round(Math.sin(i) * 1.5), 2 + i, P.clay);
      p.px(7, 6, P.clay);
      p.px(8, 7, P.clay);
    }
  });
}

/** Torrões em relevo: um ponto claro com sombra embaixo. */
function soil(p: Pix, b: { light: number; dark: number; fleck: number }, seed: number): void {
  const s = { rng: seed };
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(rand(s) * 15);
    const y = Math.floor(rand(s) * 15);
    const big = rand(s) < 0.4;
    p.rect(x, y, big ? 2 : 1, 1, b.light);
    p.rect(x, y + 1, big ? 2 : 1, 1, b.dark);
  }
  for (let i = 0; i < 3; i++) p.px(Math.floor(rand(s) * 16), Math.floor(rand(s) * 16), b.fleck);
}

function pebble(p: Pix, x: number, y: number, c: number): void {
  p.rect(x + 1, y, 2, 1, P.ink);
  p.rect(x, y + 1, 4, 1, P.ink);
  p.rect(x + 1, y + 2, 2, 1, P.ink);
  p.rect(x + 1, y + 1, 2, 1, c);
}

/** Pedra arredondada (elipse) com contorno, brilho e sombra; tom muda com a profundidade. */
function stone(p: Pix, x: number, y: number, w: number, h: number, band: number): void {
  const base = [0x7a7480, 0x6a6672, 0x5a5664, 0x4c4858][band];
  const lightC = [0x9a96a2, 0x88849a, 0x75728a, 0x625e74][band];
  const darkC = [0x55505c, 0x4a4652, 0x3e3a48, 0x33303c][band];
  const cx = x + w / 2 - 0.5;
  const cy = y + h / 2 - 0.5;
  const inside = (px: number, py: number, grow: number) => ((px - cx) / (w / 2 + grow)) ** 2 + ((py - cy) / (h / 2 + grow)) ** 2 <= 1;
  for (let py = y - 1; py <= y + h; py++) {
    for (let px = x - 1; px <= x + w; px++) {
      if (inside(px, py, 0)) {
        const shadeSide = (px - cx) / w + (py - cy) / h;
        p.px(px, py, shadeSide < -0.35 ? lightC : shadeSide > 0.3 ? darkC : base);
      } else if (inside(px, py, 0.9)) p.px(px, py, 0x1a1418);
    }
  }
  p.px(Math.round(cx - w / 4), Math.round(cy - h / 4), lightC);
}

/** Pedras espalhadas, com posição e tamanho sorteados por variante (sem padrão de grade). */
export function rockKey(scene: Phaser.Scene, variant: number, row = 8): string {
  const v = variant % 6;
  const band = bandOf(row);
  return makeTexture(scene, `t_rock3_${v}_${band}`, TILE, TILE, (p) => {
    const b = BANDS[band];
    p.rect(0, 0, TILE, TILE, b.base);
    soil(p, b, 400 + v * 7 + band);
    const s = { rng: 1234 + v * 97 + band * 13 };
    const n = v < 2 ? 1 : v < 4 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const w = n === 1 ? 10 + Math.floor(rand(s) * 4) : n === 2 ? 6 + Math.floor(rand(s) * 4) : 4 + Math.floor(rand(s) * 3);
      const h = Math.max(3, w - 2 - Math.floor(rand(s) * 3));
      const x = 1 + Math.floor(rand(s) * (15 - w));
      const y = 1 + Math.floor(rand(s) * (15 - h));
      stone(p, x, y, w, h, band);
    }
  });
}

export function tunnelKey(scene: Phaser.Scene): string {
  return makeTexture(scene, 't_tunnel', TILE, TILE, (p) => {
    p.rect(0, 0, TILE, TILE, 0x1e1519);
    const s = { rng: 77 };
    for (let i = 0; i < 6; i++) p.px(Math.floor(rand(s) * 16), Math.floor(rand(s) * 16), 0x2a1f22);
  });
}

/** Bordas de túnel: sombra do teto, piso de terra e laterais. */
export function edgeKey(scene: Phaser.Scene, side: 'n' | 's' | 'w' | 'e'): string {
  return makeTexture(scene, `t_edge_${side}`, TILE, TILE, (p) => {
    if (side === 'n') {
      p.rect(0, 0, TILE, 1, BANDS[1].light);
      p.rect(0, 1, TILE, 1, P.ink, 0.8);
      p.rect(0, 2, TILE, 2, P.ink, 0.45);
      p.rect(0, 4, TILE, 2, P.ink, 0.2);
    } else if (side === 's') {
      p.rect(0, 13, TILE, 3, BANDS[1].dark);
      p.rect(0, 13, TILE, 1, BANDS[1].light);
      p.px(4, 12, BANDS[1].dark);
      p.px(11, 12, BANDS[1].dark);
    } else {
      const x0 = side === 'w' ? 0 : TILE - 3;
      p.rect(x0, 0, 3, TILE, P.ink, 0.35);
      p.rect(side === 'w' ? 0 : TILE - 1, 0, 1, TILE, P.ink, 0.5);
    }
  });
}

export function grassKey(scene: Phaser.Scene, ash: boolean, variant = 0): string {
  const v = variant % 3;
  return makeTexture(scene, `t_grass_${ash ? 1 : 0}_${v}`, TILE, 8, (p) => {
    const s = { rng: 900 + v };
    if (ash) {
      p.rect(0, 5, TILE, 3, 0x4a4048);
      p.rect(0, 5, TILE, 1, P.ash);
      for (let x = 1; x < TILE; x += 3 + (x % 2)) p.vline(x, 2 + Math.floor(rand(s) * 3), 3, 0x3a3238);
      if (v === 1) p.px(9, 4, P.orange);
      return;
    }
    p.rect(0, 5, TILE, 3, P.greenDark);
    for (let x = 0; x < TILE; x++) {
      const hgt = 2 + Math.floor(rand(s) * 4);
      p.vline(x, 6 - hgt + 1, hgt, x % 3 === 0 ? P.grassLight : P.grass);
    }
    if (v === 2) {
      p.px(5, 1, P.yellow);
      p.px(12, 2, P.pink);
    }
  });
}

export function rubbleKey(scene: Phaser.Scene, variant: number): string {
  const v = variant % 3;
  return makeTexture(scene, `t_rubble_${v}`, TILE, TILE, (p) => {
    p.rect(0, 0, TILE, TILE, 0x2e2428);
    soil(p, BANDS[2], 900 + v * 13);
    stone(p, 1 + v, 7, 7, 6, 2);
    stone(p, 8, 2 + v, 7, 6, 2);
    p.rect(3, 3, 3, 2, P.rockDark);
    // Vergalhão torto.
    p.hline(6, 13, 6, P.orangeDark);
    p.px(12, 12, P.orangeDark);
  });
}

/** Rachaduras em três níveis, para sobrepor à sala. */
export function crackKey(scene: Phaser.Scene, level: number): string {
  return makeTexture(scene, `t_crack_${level}`, 32, 16, (p) => {
    const paths: [number, number][][] = [
      [[3, 0], [5, 3], [4, 6], [7, 9]],
      [[20, 0], [18, 4], [21, 7], [19, 11], [22, 15]],
      [[30, 2], [27, 5], [28, 8]],
      [[10, 16], [12, 12], [11, 9], [14, 6]],
    ];
    const n = Math.min(paths.length, level + 1);
    for (let i = 0; i < n; i++) {
      const path = paths[i];
      for (let k = 0; k < path.length - 1; k++) {
        const [x0, y0] = path[k];
        const [x1, y1] = path[k + 1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let st = 0; st <= steps; st++) {
          const x = Math.round(x0 + ((x1 - x0) * st) / steps);
          const y = Math.round(y0 + ((y1 - y0) * st) / steps);
          p.px(x, y, P.ink);
          p.px(x + 1, y, shade(P.paperDark, 0.6), 0.5);
        }
      }
    }
  });
}

/** Escotilha da entrada, aberta ou fechada. */
export function hatchKey(scene: Phaser.Scene, open: boolean): string {
  return makeTexture(scene, `t_hatch_${open ? 1 : 0}`, TILE + 6, 10, (p) => {
    // Gola de concreto.
    p.rect(0, 7, TILE + 6, 3, P.ink);
    p.rect(1, 7, TILE + 4, 2, P.rock);
    p.hline(1, 7, TILE + 4, P.rockLight);
    if (open) {
      // Tampa levantada de lado.
      p.rect(0, 0, 5, 8, P.ink);
      p.rect(1, 1, 3, 6, P.rockLight);
      p.px(2, 2, P.yellow);
      p.px(2, 5, P.yellow);
    } else {
      p.rect(2, 4, TILE + 2, 4, P.ink);
      p.rect(3, 5, TILE, 2, P.rockLight);
      p.rect(5, 5, 3, 1, P.yellow);
      p.rect(TILE - 2, 5, 3, 1, P.yellow);
      p.rect(9, 2, 4, 3, P.ink);
      p.rect(10, 3, 2, 1, P.rock);
    }
  });
}
