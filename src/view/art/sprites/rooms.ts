// Interiores das salas, gerados por tipo, tamanho e equipamento. Cada sala tem
// casca de concreto (teto, piso, paredes), parede de fundo com gradiente, luz
// de teto e móveis próprios.

import Phaser from 'phaser';
import type { EquipmentId, RoomType } from '../../../core/state';
import { P, shade } from '../palette';
import { makeTexture, type Pix } from '../pixel';
import { TILE } from './tiles';

const WALL: Record<RoomType, number> = {
  dorm: 0x5a4a6e, generator: 0x45485a, panel: 0x2e3346, vent: 0x4a5560,
  greenhouse: 0x2f5a3a, kitchen: 0x8a7a62, reservoir: 0x2a4470, corridor: 0x3a3238,
};

export function roomKey(scene: Phaser.Scene, type: RoomType, wTiles: number, hTiles: number, eq: EquipmentId | null, entrance = false): string {
  const key = `r2_${type}_${wTiles}x${hTiles}_${eq ?? 'x'}_${entrance ? 1 : 0}`;
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  return makeTexture(scene, key, W, H, (p) => {
    if (type === 'corridor') corridor(p, W, H, eq, entrance);
    else {
      shell(p, W, H, WALL[type], type !== 'greenhouse');
      DRAW[type](p, W, H, eq);
    }
  });
}

/** Linha do piso (y do topo do piso). */
const floorY = (H: number) => H - 4;

function shell(p: Pix, W: number, H: number, wall: number, lamp: boolean): void {
  // Parede de fundo com gradiente vertical e emendas de painel.
  const top = 4;
  const bottom = floorY(H);
  const span = bottom - top;
  for (let y = top; y < bottom; y++) {
    const f = 0.72 + 0.28 * Math.min(1, (y - top) / (span * 0.6));
    p.hline(3, y, W - 6, shade(wall, f));
  }
  for (let x = 3 + 16; x < W - 4; x += 16) {
    p.vline(x, top, span, shade(wall, 0.8));
    p.vline(x + 1, top, span, shade(wall, 1.1));
  }
  p.rect(3, bottom - 2, W - 6, 2, shade(wall, 0.6));
  // Teto de concreto com rebites.
  p.rect(0, 0, W, 4, P.ink);
  p.rect(1, 1, W - 2, 3, P.rock);
  p.hline(1, 1, W - 2, P.rockLight);
  for (let x = 4; x < W - 3; x += 8) p.px(x, 2, P.rockDark);
  p.hline(3, 4, W - 6, shade(wall, 0.5));
  // Piso.
  p.rect(0, bottom, W, H - bottom, P.ink);
  p.rect(1, bottom, W - 2, 3, P.rockDark);
  p.hline(1, bottom, W - 2, P.rockLight);
  // Paredes laterais.
  p.rect(0, 0, 1, H, P.ink);
  p.rect(W - 1, 0, 1, H, P.ink);
  p.rect(1, 1, 2, bottom - 1, P.rock);
  p.vline(1, 1, bottom - 1, P.rockLight);
  p.rect(W - 3, 1, 2, bottom - 1, P.rock);
  p.vline(W - 2, 1, bottom - 1, P.rockDark);
  if (lamp) ceilingLamp(p, Math.floor(W / 2), bottom);
}

/** Luminária com cone de luz quente até o chão. */
function ceilingLamp(p: Pix, cx: number, bottom: number): void {
  p.rect(cx - 3, 4, 6, 2, P.ink);
  p.rect(cx - 2, 4, 4, 1, P.rockLight);
  p.rect(cx - 2, 6, 4, 1, P.yellow);
  for (let y = 7; y < bottom; y++) {
    const half = 2 + Math.floor((y - 7) * 0.6);
    p.rect(cx - half, y, half * 2, 1, P.yellow, 0.07);
  }
}

type Drawer = (p: Pix, W: number, H: number, eq: EquipmentId | null) => void;

const DRAW: Record<Exclude<RoomType, 'corridor'>, Drawer> = {
  dorm: (p, W, H, eq) => {
    const fy = floorY(H);
    // Pôster e prateleira de livros.
    p.rect(6, 8, 9, 8, P.ink);
    p.rect(7, 9, 7, 6, P.paper);
    p.rect(8, 10, 2, 4, P.red);
    p.rect(11, 11, 2, 3, P.blue);
    p.rect(W - 18, 10, 13, 1, P.dirtLight);
    const books = [P.red, P.teal, P.yellow, P.purple, P.green, P.orange];
    books.forEach((c, i) => p.rect(W - 17 + i * 2, 6 + (i % 2), 1, 4 - (i % 2), c));
    // Tapete.
    p.rect(14, fy - 1, W - 28, 1, P.redDark);
    p.rect(16, fy - 1, W - 32, 1, P.red);
    const blankets = [P.red, P.blue, P.green, P.purple, P.orange, P.teal];
    const beds = Math.max(1, Math.floor((W - 8) / 20));
    for (let i = 0; i < beds; i++) {
      const bx = 5 + i * 20 + (beds === 1 ? 8 : 0);
      bed(p, bx, fy - 7, blankets[i % blankets.length]);
      if (eq === 'beliche') {
        bed(p, bx, fy - 16, blankets[(i + 3) % blankets.length]);
        p.vline(bx, fy - 17, 17, P.dirt);
        p.vline(bx + 15, fy - 17, 17, P.dirt);
      }
    }
  },
  generator: (p, W, H, eq) => {
    const fy = floorY(H);
    // Faixa de perigo no chão.
    for (let x = 3; x < W - 3; x += 4) {
      p.rect(x, fy - 1, 2, 1, P.yellow);
      p.rect(x + 2, fy - 1, 2, 1, P.ink);
    }
    // Bloco do motor.
    const mx = 5;
    const mw = W - 17;
    const my = fy - 17;
    p.rect(mx, my, mw, 16, P.ink);
    p.rect(mx + 1, my + 1, mw - 2, 14, P.orange);
    p.rect(mx + 1, my + 10, mw - 2, 5, P.orangeDark);
    p.hline(mx + 1, my + 1, mw - 2, 0xf4a860);
    for (let x = mx + 3; x < mx + mw - 3; x += 3) p.vline(x, my + 11, 3, shade(P.orangeDark, 0.7));
    // Cilindros.
    for (let i = 0; i < 3; i++) {
      const cx = mx + 4 + i * 6;
      p.rect(cx, my - 4, 4, 5, P.ink);
      p.rect(cx + 1, my - 3, 2, 4, P.rockLight);
    }
    // Volante.
    p.circle(mx + mw - 6, my + 6, 4, P.ink);
    p.circle(mx + mw - 6, my + 6, 3, P.rock);
    p.px(mx + mw - 6, my + 6, P.ink);
    p.hline(mx + mw - 9, my + 6, 7, P.rockDark);
    // Escapamento até o teto.
    p.rect(W - 10, 4, 5, fy - 4, P.ink);
    p.rect(W - 9, 4, 3, fy - 4, P.rockDark);
    p.vline(W - 9, 4, fy - 4, P.rockLight);
    // Painelzinho com luzes.
    p.rect(W - 11, 8, 3, 6, P.ink);
    p.px(W - 10, 9, P.green);
    p.px(W - 10, 11, P.red);
    if (eq === 'catalisador') {
      p.rect(mx + 22, my - 6, 7, 6, P.ink);
      p.rect(mx + 23, my - 5, 5, 4, P.teal);
      p.hline(mx + 23, my - 5, 5, P.white);
    }
  },
  panel: (p, W, H, eq) => {
    const fy = floorY(H);
    // Armário com duas portas e fileiras de chaves.
    p.rect(4, 8, W - 8, fy - 8, P.ink);
    p.rect(5, 9, W - 10, fy - 10, P.rock);
    p.vline(Math.floor(W / 2), 9, fy - 10, P.ink);
    p.hline(5, 9, W - 10, P.rockLight);
    for (let y = 11; y < fy - 3; y += 4) {
      for (let x = 7; x < W - 6; x += 3) {
        if (x === Math.floor(W / 2)) continue;
        p.rect(x, y, 2, 2, P.ink);
        p.px(x, y + ((x + y) % 2), (x + y) % 3 ? P.paper : P.yellow);
      }
    }
    // Placa de perigo.
    p.rect(Math.floor(W / 2) - 3, 5, 7, 1, P.ink);
    p.rect(Math.floor(W / 2) - 2, 4, 5, 1, P.yellow);
    // Cabos pendurados.
    p.vline(6, 4, 4, P.red);
    p.vline(8, 4, 5, P.yellow);
    p.vline(W - 7, 4, 4, P.blue);
    if (eq === 'regulador') {
      p.rect(W - 12, fy - 9, 8, 8, P.ink);
      p.rect(W - 11, fy - 8, 6, 6, P.teal);
      p.px(W - 8, fy - 6, P.yellow);
    }
  },
  vent: (p, W, H, eq) => {
    const fy = floorY(H);
    const cx = Math.floor(W / 2);
    const cy = Math.floor((4 + fy) / 2) + 1;
    const r = Math.min(W, fy - 4) / 2 - 2;
    // Dutos subindo até o teto.
    p.rect(cx - 3, 4, 6, cy - r - 2, P.rockLight);
    p.vline(cx - 3, 4, cy - r - 2, P.ink);
    p.vline(cx + 2, 4, cy - r - 2, P.rockDark);
    // Carcaça redonda.
    p.circle(cx, cy, r + 1, P.ink);
    p.circle(cx, cy, r, P.rockLight);
    p.circle(cx, cy, r - 1, P.rock);
    p.circle(cx, cy, r - 2, 0x14101a);
    // Grades laterais.
    for (let y = 8; y < fy - 3; y += 3) {
      p.hline(3, y, 3, P.rockDark);
      p.hline(W - 6, y, 3, P.rockDark);
    }
    if (eq === 'filtro') {
      p.rect(3, fy - 7, 7, 7, P.ink);
      p.rect(4, fy - 6, 5, 5, P.white);
      p.hline(4, fy - 4, 5, P.skyLight);
    }
  },
  greenhouse: (p, W, H, eq) => {
    const fy = floorY(H);
    // Cano de irrigação.
    p.hline(3, 12, W - 6, P.teal);
    p.hline(3, 13, W - 6, shade(P.teal, 0.6));
    // Lâmpadas de cultivo com brilho roxo.
    const lamps = eq === 'lampada' ? Math.floor(W / 9) : Math.floor(W / 16);
    for (let i = 0; i < lamps; i++) {
      const x = 5 + Math.floor(((W - 14) * i) / Math.max(1, lamps - 1));
      p.rect(x, 4, 5, 2, P.ink);
      p.rect(x + 1, 6, 3, 1, P.pink);
      for (let y = 7; y < fy; y++) p.rect(x - Math.floor((y - 7) / 3), y, 5 + Math.floor((y - 7) / 3) * 2, 1, P.purple, 0.06);
    }
    // Canteiros com plantas variadas.
    for (let x = 4; x < W - 10; x += 12) {
      p.rect(x, fy - 5, 11, 5, P.ink);
      p.rect(x + 1, fy - 4, 9, 3, P.dirt);
      p.hline(x + 1, fy - 4, 9, P.dirtLight);
      for (let k = 0; k < 3; k++) plant(p, x + 2 + k * 3, fy - 5, (x + k * 5) % 4);
    }
  },
  kitchen: (p, W, H, eq) => {
    const fy = floorY(H);
    // Azulejos no alto da parede.
    for (let y = 5; y < fy - 12; y += 3) for (let x = 3 + ((y / 3) % 2) * 3; x < W - 3; x += 6) p.rect(x, y, 3, 3, P.paper);
    // Bancada, fogão e panelas.
    p.rect(3, fy - 9, W - 6, 9, P.ink);
    p.rect(4, fy - 8, W - 8, 8, P.dirt);
    p.hline(4, fy - 8, W - 8, P.dirtLight);
    for (let x = 8; x < W - 8; x += 8) p.vline(x, fy - 7, 7, P.dirtDark);
    p.rect(6, fy - 9, 12, 2, P.rockLight);
    p.rect(7, fy - 14, 6, 5, P.ink);
    p.rect(8, fy - 13, 4, 3, P.orange);
    p.hline(7, fy - 14, 6, P.rockLight);
    p.rect(14, fy - 11, 4, 2, P.rockDark);
    // Utensílios pendurados.
    p.vline(22, 5, 4, P.rockLight);
    p.rect(21, 9, 3, 2, P.rockLight);
    p.vline(26, 5, 5, P.rockLight);
    if (eq === 'freezer') {
      p.rect(W - 12, fy - 18, 9, 18, P.ink);
      p.rect(W - 11, fy - 17, 7, 16, P.white);
      p.hline(W - 11, fy - 10, 7, P.rockLight);
      p.vline(W - 5, fy - 15, 3, P.rockDark);
    } else {
      // Prateleira com latas.
      p.hline(W - 16, fy - 18, 12, P.dirtLight);
      for (let x = W - 15; x < W - 5; x += 3) {
        p.rect(x, fy - 22, 2, 4, P.red);
        p.px(x, fy - 21, P.white);
      }
    }
  },
  reservoir: (p, W, H, eq) => {
    const fy = floorY(H);
    // Tanque de vidro (o nível da água é desenhado por cima, dinâmico).
    p.rect(4, 6, W - 8, fy - 6, P.ink);
    p.rect(5, 7, W - 10, fy - 8, 0x182a4a);
    p.rect(6, 8, 1, fy - 12, P.skyLight);
    for (let x = 10; x < W - 6; x += 8) {
      p.px(x, 7, P.rockLight);
      p.px(x, fy - 2, P.rockLight);
    }
    // Cano e registro.
    p.rect(W - 4, 10, 2, fy - 12, P.rockDark);
    p.circle(W - 4, 14, 2, P.red);
    if (eq === 'bomba') {
      p.rect(W - 14, fy - 9, 9, 9, P.ink);
      p.rect(W - 13, fy - 8, 7, 7, P.orange);
      p.hline(W - 13, fy - 8, 7, 0xf4a860);
    }
  },
};

function corridor(p: Pix, W: number, H: number, eq: EquipmentId | null, entrance: boolean): void {
  p.rect(0, 0, W, H, 0x2e272c);
  for (let y = 0; y < H; y += 4) p.hline(2, y, W - 4, 0x352d33);
  p.rect(0, 0, 2, H, P.rock);
  p.vline(0, 0, H, P.ink);
  p.rect(W - 2, 0, 2, H, P.rockDark);
  p.vline(W - 1, 0, H, P.ink);
  // Escada de mão.
  p.vline(4, 0, H, P.dirtLight);
  p.vline(W - 5, 0, H, P.dirt);
  for (let y = 2; y < H; y += 4) p.hline(4, y, W - 8, P.dirtLight);
  // Arandela.
  p.rect(W - 4, 5, 2, 2, P.yellow);
  if (eq === 'escora') {
    p.rect(1, 0, 2, H, P.clay);
    p.rect(W - 3, 0, 2, H, P.clay);
    p.hline(1, 0, W - 2, P.clay);
  }
  if (entrance) {
    p.rect(0, 0, W, 2, P.rockLight);
    p.rect(3, 0, W - 6, 1, P.yellow);
  }
}

function bed(p: Pix, x: number, y: number, blanket: number): void {
  p.rect(x, y + 2, 16, 6, P.ink);
  p.rect(x + 1, y + 3, 14, 3, P.paperDark);
  p.rect(x + 1, y + 2, 4, 2, P.white);
  p.rect(x + 5, y + 2, 10, 3, blanket);
  p.hline(x + 5, y + 2, 10, shade(blanket, 1.3));
  p.rect(x + 1, y + 6, 14, 1, P.dirt);
  p.vline(x, y, 8, P.dirt);
  p.vline(x + 15, y + 2, 6, P.dirt);
}

function plant(p: Pix, x: number, y: number, kind: number): void {
  const h = 5 + kind;
  p.vline(x + 1, y - h, h, P.greenDark);
  p.rect(x, y - h + 1, 1, 2, P.green);
  p.rect(x + 2, y - h + 3, 1, 2, P.green);
  p.rect(x - 1, y - 3, 2, 1, P.grassLight);
  if (kind === 0) p.rect(x, y - h - 1, 3, 2, P.grassLight);
  if (kind === 1) p.px(x + 2, y - h + 1, P.red);
  if (kind === 2) p.px(x, y - h, P.yellow);
  if (kind === 3) {
    p.px(x + 2, y - 4, P.red);
    p.px(x, y - 6, P.red);
  }
}

/** Hélice do ventilador (gira como sprite). */
export function fanKey(scene: Phaser.Scene, size: number): string {
  return makeTexture(scene, `fan2_${size}`, size, size, (p) => {
    const c = (size - 1) / 2;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      for (let r = 2; r < c; r += 0.5) {
        const w = 0.25 + r * 0.06;
        for (let k = -w; k <= w; k += 0.05) {
          const ang = a + k + r * 0.04;
          p.px(Math.round(c + Math.cos(ang) * r), Math.round(c + Math.sin(ang) * r), r > c - 1.5 ? P.rockDark : P.rockLight);
        }
      }
    }
    p.circle(Math.round(c), Math.round(c), 2, P.ink);
    p.px(Math.round(c), Math.round(c), P.yellow);
  });
}

/** Cobertura de sala desmoronada. */
export function collapsedKey(scene: Phaser.Scene, wTiles: number, hTiles: number): string {
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  return makeTexture(scene, `r2_collapsed_${wTiles}x${hTiles}`, W, H, (p) => {
    p.rect(0, 0, W, H, 0x2a2226);
    // Teto caído em diagonal, entulho e vergalhão.
    for (let x = 0; x < W; x++) {
      const y = Math.round(2 + (x / W) * (H * 0.45));
      p.rect(x, y, 1, 3, P.rock);
      p.px(x, y, P.rockLight);
      p.px(x, y + 3, P.ink);
    }
    for (let x = 2; x < W - 6; x += 6) {
      const y = H - 7 - (x % 4);
      p.rect(x, y, 6, 5, P.ink);
      p.rect(x + 1, y + 1, 4, 3, (x / 6) % 2 ? P.rock : P.dirt);
      p.px(x + 1, y + 1, P.rockLight);
    }
    p.hline(3, H - 10, W - 8, P.orangeDark);
    p.rect(0, 0, 1, H, P.ink);
    p.rect(W - 1, 0, 1, H, P.ink);
  });
}
