// Interiores das salas, gerados por tipo, tamanho e equipamento.

import Phaser from 'phaser';
import type { EquipmentId, RoomType } from '../../../core/state';
import { P, shade } from '../palette';
import { makeTexture, type Pix } from '../pixel';
import { TILE } from './tiles';

const WALL: Record<RoomType, number> = {
  dorm: P.dusk, generator: P.rockDark, panel: P.night, vent: P.rock,
  greenhouse: P.greenDark, kitchen: P.paperDark, reservoir: P.blueDark, corridor: P.shadow,
};

export function roomKey(scene: Phaser.Scene, type: RoomType, wTiles: number, hTiles: number, eq: EquipmentId | null, entrance = false): string {
  const key = `r_${type}_${wTiles}x${hTiles}_${eq ?? 'x'}_${entrance ? 1 : 0}`;
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  return makeTexture(scene, key, W, H, (p) => {
    shell(p, W, H, WALL[type]);
    DRAW[type](p, W, H, eq, entrance);
  });
}

/** Paredes, teto e piso comuns a todas as salas. */
function shell(p: Pix, W: number, H: number, wall: number): void {
  p.rect(0, 0, W, H, wall);
  p.speckle(2, 2, W - 4, H - 4, [shade(wall, 0.85), shade(wall, 1.12)], 0.08, W * 31 + H);
  p.rect(0, 0, W, 2, P.ink);
  p.rect(0, 2, W, 1, shade(wall, 0.6));
  p.rect(0, H - 3, W, 3, P.rockDark);
  p.hline(0, H - 3, W, P.rockLight);
  p.rect(0, 0, 2, H, P.ink);
  p.rect(W - 2, 0, 2, H, P.ink);
  // Lâmpada de teto.
  const lx = Math.floor(W / 2) - 2;
  p.rect(lx, 2, 4, 2, P.rockLight);
  p.rect(lx + 1, 4, 2, 1, P.yellow);
}

type Drawer = (p: Pix, W: number, H: number, eq: EquipmentId | null, entrance: boolean) => void;

const DRAW: Record<RoomType, Drawer> = {
  dorm: (p, W, H, eq) => {
    // Papel de parede listrado e um pôster motivacional (de outro coach).
    for (let x = 4; x < W - 4; x += 4) p.vline(x, 4, H - 10, shade(P.dusk, 1.15));
    p.box(W - 14, 6, 9, 7, P.paper, P.ink);
    p.rect(W - 12, 8, 5, 1, P.red);
    p.rect(W - 12, 10, 4, 1, P.ink);
    const colors = [P.red, P.blue, P.green, P.purple, P.orange, P.teal];
    const beds = Math.max(1, Math.floor((W - 6) / 14));
    for (let i = 0; i < beds; i++) {
      const bx = 3 + i * 14;
      bed(p, bx, H - 9, colors[i % colors.length]);
      if (eq === 'beliche') {
        bed(p, bx, H - 17, colors[(i + 3) % colors.length]);
        p.vline(bx, H - 17, 14, P.dirtLight);
        p.vline(bx + 11, H - 17, 14, P.dirtLight);
      }
    }
  },
  generator: (p, W, H, eq) => {
    // Faixas de perigo e a máquina.
    for (let x = 2; x < W - 2; x += 6) {
      p.rect(x, 3, 3, 2, P.yellow);
      p.rect(x + 3, 3, 3, 2, P.ink);
    }
    const mx = 6;
    const mw = W - 16;
    p.box(mx, H - 20, mw, 17, P.orange, P.ink);
    p.rect(mx + 2, H - 18, mw - 4, 3, P.orangeDark);
    p.rect(mx + 3, H - 12, mw - 6, 1, P.orangeDark);
    for (let x = mx + 4; x < mx + mw - 4; x += 4) p.vline(x, H - 9, 5, P.orangeDark);
    // Manômetro.
    p.circle(mx + mw - 7, H - 14, 3, P.ink);
    p.circle(mx + mw - 7, H - 14, 2, P.paper);
    p.px(mx + mw - 6, H - 15, P.red);
    // Escapamento.
    p.box(W - 9, 5, 5, H - 8, P.rock, P.ink);
    p.rect(W - 8, 8, 3, 1, P.rockLight);
    if (eq === 'catalisador') {
      p.box(mx + 3, H - 26, 8, 6, P.teal, P.ink);
      p.rect(mx + 5, H - 24, 4, 1, P.white);
    }
  },
  panel: (p, W, H, eq) => {
    const cw = W - 8;
    p.box(4, 6, cw, H - 9, P.rock, P.ink);
    for (let y = 9; y < H - 6; y += 5) {
      for (let x = 7; x < 4 + cw - 3; x += 4) {
        p.rect(x, y, 2, 3, P.ink);
        p.px(x, y + ((x + y) % 2), P.paper);
      }
    }
    // Cabos saindo pelo teto.
    p.vline(8, 2, 4, P.red);
    p.vline(11, 2, 4, P.yellow);
    p.vline(W - 9, 2, 4, P.blue);
    if (eq === 'regulador') {
      p.box(W - 13, H - 12, 8, 7, P.teal, P.ink);
      p.circle(W - 9, H - 9, 1, P.yellow);
    }
  },
  vent: (p, W, H, eq) => {
    // Moldura do ventilador (a hélice gira por cima, como sprite separado).
    const cx = Math.floor(W / 2);
    const cy = Math.floor(H / 2);
    const r = Math.min(W, H) / 2 - 4;
    p.circle(cx, cy, r + 1, P.ink);
    p.circle(cx, cy, r, P.rockDark);
    p.circle(cx, cy, r - 2, P.tunnel);
    // Dutos.
    p.rect(2, 6, 4, H - 12, P.rockLight);
    p.rect(W - 6, 6, 4, H - 12, P.rockLight);
    for (let y = 8; y < H - 6; y += 3) {
      p.hline(2, y, 4, P.rockDark);
      p.hline(W - 6, y, 4, P.rockDark);
    }
    if (eq === 'filtro') {
      p.box(cx - 4, 3, 8, 5, P.white, P.ink);
      p.hline(cx - 3, 5, 6, P.skyLight);
    }
  },
  greenhouse: (p, W, H, eq) => {
    // Lâmpadas roxas e canteiros.
    const lamps = eq === 'lampada' ? 6 : 3;
    for (let i = 0; i < lamps; i++) {
      const x = 4 + Math.floor(((W - 10) * i) / Math.max(1, lamps - 1));
      p.rect(x, 3, 4, 2, P.purple);
      p.rect(x, 5, 4, 1, P.pink);
    }
    for (let x = 3; x < W - 6; x += 9) {
      p.box(x, H - 9, 8, 6, P.dirt, P.ink);
      plant(p, x + 3, H - 9, (x * 13) % 3);
    }
  },
  kitchen: (p, W, H, eq) => {
    // Azulejo xadrez, fogão, prateleira com latas.
    for (let y = 5; y < H - 4; y += 4) for (let x = 2 + ((y / 4) % 2) * 4; x < W - 2; x += 8) p.rect(x, y, 4, 4, P.paper);
    p.box(4, H - 13, 14, 10, P.rockLight, P.ink);
    p.rect(6, H - 12, 4, 1, P.ink);
    p.rect(11, H - 12, 4, 1, P.ink);
    p.box(6, H - 19, 8, 6, P.orange, P.ink);
    p.rect(7, H - 18, 6, 1, P.yellow);
    p.hline(W - 20, 9, 16, P.dirtLight);
    for (let x = W - 19; x < W - 5; x += 4) {
      p.box(x, 5, 3, 4, P.red, P.ink);
      p.px(x + 1, 6, P.white);
    }
    if (eq === 'freezer') {
      p.box(W - 12, H - 17, 9, 14, P.white, P.ink);
      p.vline(W - 5, H - 13, 3, P.rockDark);
    }
  },
  reservoir: (p, W, H, eq) => {
    // Tanque de vidro (a altura da água é desenhada por cima, dinâmica).
    p.box(4, 5, W - 8, H - 8, P.blueDark, P.ink);
    p.rect(6, 7, 2, H - 14, P.skyLight);
    for (let x = 8; x < W - 8; x += 6) p.vline(x, 5, H - 8, shade(P.blueDark, 0.8));
    if (eq === 'bomba') {
      p.box(W - 12, H - 12, 8, 9, P.orange, P.ink);
      p.vline(W - 8, 2, H - 14, P.rockLight);
    }
  },
  corridor: (p, W, H, eq, entrance) => {
    // Escada de mão.
    p.vline(4, 2, H - 4, P.dirtLight);
    p.vline(W - 5, 2, H - 4, P.dirtLight);
    for (let y = 4; y < H - 3; y += 3) p.hline(4, y, W - 8, P.dirtLight);
    if (eq === 'escora') {
      p.rect(2, 2, 2, H - 4, P.clay);
      p.rect(W - 4, 2, 2, H - 4, P.clay);
      p.rect(2, 2, W - 4, 2, P.clay);
    }
    if (entrance) {
      p.rect(0, 0, W, 2, P.rockLight);
      p.rect(5, 0, W - 10, 1, P.yellow);
    }
  },
};

function bed(p: Pix, x: number, y: number, blanket: number): void {
  p.box(x, y + 2, 12, 5, P.dirtLight, P.ink);
  p.rect(x + 1, y + 1, 4, 2, P.white);
  p.rect(x + 4, y + 2, 7, 2, blanket);
  p.vline(x, y, 6, P.dirt);
}

function plant(p: Pix, x: number, y: number, kind: number): void {
  p.vline(x + 1, y - 6, 6, P.greenDark);
  p.rect(x - 1, y - 5, 2, 2, P.green);
  p.rect(x + 2, y - 4, 2, 2, P.green);
  if (kind === 0) p.rect(x, y - 8, 3, 2, P.grassLight);
  if (kind === 1) p.px(x + 1, y - 7, P.red);
  if (kind === 2) p.rect(x - 1, y - 7, 2, 1, P.yellow);
}

/** Hélice do ventilador (gira como sprite). */
export function fanKey(scene: Phaser.Scene, size: number): string {
  return makeTexture(scene, `fan_${size}`, size, size, (p) => {
    const c = size / 2;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      for (let r = 2; r < c - 1; r++) {
        const w = 1.5 + r * 0.25;
        for (let k = -w; k <= w; k += 0.5) {
          const ang = a + (k / r) * 0.9;
          p.px(c + Math.cos(ang) * r, c + Math.sin(ang) * r, r > c - 3 ? P.ink : P.rockLight);
        }
      }
    }
    p.circle(c, c, 2, P.ink);
    p.px(c, c, P.yellow);
  });
}

/** Cobertura de sala desmoronada. */
export function collapsedKey(scene: Phaser.Scene, wTiles: number, hTiles: number): string {
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  return makeTexture(scene, `r_collapsed_${wTiles}x${hTiles}`, W, H, (p) => {
    p.rect(0, 0, W, H, P.shadow);
    p.speckle(0, 0, W, H, [P.rock, P.rockDark, P.dirt, P.ash, P.dirtDark], 0.55, W * 7 + H * 3);
    for (let x = 2; x < W - 6; x += 7) p.box(x, H - 7 - (x % 5), 6, 5, P.rock, P.ink);
    p.box(Math.floor(W / 2) - 6, 2, 10, 3, P.dirtLight, P.ink);
  });
}
