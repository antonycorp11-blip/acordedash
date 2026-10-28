// Salas em alta definição: moldura de vigas de aço aparafusadas, mãos-francesas
// de madeira, parede de concreto iluminada, lâmpadas penduradas e mobília
// própria de cada tipo. Tudo em unidades do mundo (tile = 16).

import Phaser from 'phaser';
import type { EquipmentId, RoomType } from '../../../core/state';
import { box, circle, css, ellipse, glow, hdTexture, hgrad, light, line, poly, rr, seeded, stone, vgrad, type Ctx } from '../hd';

export const TILE = 16;
const INK = 0x14101c;
export const COL = 2.4;
export const CEIL = 2.8;
export const FLOOR = 3;

const WALL: Record<RoomType, number> = {
  dorm: 0x8a7a62, generator: 0x76736c, panel: 0x6e7480, vent: 0x748078,
  greenhouse: 0x728262, kitchen: 0x947e5e, reservoir: 0x6a7a8e, corridor: 0x4a4440,
};

export function roomKey(scene: Phaser.Scene, type: RoomType, wTiles: number, hTiles: number, eq: EquipmentId | null, entrance = false): string {
  const key = `hd_${type}_${wTiles}x${hTiles}_${eq ?? 'x'}_${entrance ? 1 : 0}`;
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  return hdTexture(scene, key, W, H, (c) => {
    if (type === 'corridor') corridor(c, W, H, eq, entrance);
    else {
      wall(c, W, H, WALL[type]);
      DRAW[type](c, W, H, eq);
      frame(c, W, H);
      lamps(c, W, type === 'greenhouse' ? 0 : W > 40 ? 2 : 1, H);
    }
  });
}

const floorY = (H: number) => H - FLOOR;

function wall(c: Ctx, W: number, H: number, base: number): void {
  c.fillStyle = vgrad(c, 0, H, [[0, light(base, -0.3)], [0.35, base], [0.8, light(base, -0.05)], [1, light(base, -0.35)]]);
  c.fillRect(0, 0, W, H);
  // Luz quente no centro da parede.
  glow(c, W / 2, H * 0.45, Math.max(W, H) * 0.6, 0xffc070, 0.22);
  // Painéis de concreto e manchas.
  for (let x = 12; x < W; x += 12) line(c, [[x, CEIL], [x, floorY(H)]], light(base, -0.3), 0.35, 0.7);
  line(c, [[0, H * 0.55], [W, H * 0.55]], light(base, -0.25), 0.3, 0.5);
  const r = seeded(W * 13 + H);
  for (let i = 0; i < W / 3; i++) ellipse(c, r() * W, CEIL + r() * (H - CEIL - FLOOR), 0.8 + r() * 2, 0.5 + r(), css(light(base, r() < 0.5 ? -0.2 : 0.12), 0.35));
  // Rodapé escuro.
  c.fillStyle = css(0x000000, 0.25);
  c.fillRect(0, floorY(H) - 2, W, 2);
}

function steel(c: Ctx, x: number, y: number, w: number, h: number, horizontal: boolean): void {
  const g = horizontal
    ? vgrad(c, y, y + h, [[0, 0x7a808a], [0.3, 0x4e535c], [1, 0x2e3238]])
    : hgrad(c, x, x + w, [[0, 0x6a707a], [0.4, 0x4e535c], [1, 0x2e3238]]);
  box(c, x, y, w, h, g, 0.3, INK, 0.5);
}

function plate(c: Ctx, x: number, y: number, s: number): void {
  box(c, x, y, s, s, vgrad(c, y, y + s, [[0, 0x6a707a], [1, 0x3a3e46]]), 0.4, INK, 0.4);
  const d = s * 0.22;
  for (const [px, py] of [[x + d, y + d], [x + s - d, y + d], [x + d, y + s - d], [x + s - d, y + s - d]]) circle(c, px, py, 0.35, 0x9aa0aa, null);
}

function brace(c: Ctx, x: number, y: number, dir: 1 | -1): void {
  const len = 6;
  poly(c, [[x, y], [x + dir * 1.6, y], [x + dir * (len + 1.6), y + len], [x + dir * len, y + len + 0.2]], vgrad(c, y, y + len, [[0, 0x8a5e36], [1, 0x5e3e22]]), INK, 0.4);
}

function frame(c: Ctx, W: number, H: number): void {
  steel(c, 0, 0, COL, H, false);
  steel(c, W - COL, 0, COL, H, false);
  steel(c, 0, 0, W, CEIL, true);
  steel(c, 0, floorY(H), W, FLOOR, true);
  // Chapa xadrez do piso.
  for (let x = 1; x < W - 1; x += 2.2) line(c, [[x, floorY(H) + 1.1], [x + 0.9, floorY(H) + 0.6]], 0x8a909a, 0.25, 0.6);
  brace(c, COL, CEIL, 1);
  brace(c, W - COL, CEIL, -1);
  plate(c, -0.3, -0.3, 3.6);
  plate(c, W - 3.3, -0.3, 3.6);
  plate(c, -0.3, H - 3.6, 3.6);
  plate(c, W - 3.3, H - 3.6, 3.6);
  for (let x = 16; x < W - 8; x += 16) plate(c, x - 1.6, -0.3, 3.2);
}

function lamps(c: Ctx, W: number, n: number, H: number): void {
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? W / 2 : W * (0.3 + 0.4 * i);
    // Cone de luz quente.
    const g = c.createLinearGradient(0, CEIL, 0, floorY(H));
    g.addColorStop(0, css(0xffd27a, 0.32));
    g.addColorStop(1, css(0xffd27a, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(x - 1.5, CEIL + 3);
    c.lineTo(x + 1.5, CEIL + 3);
    c.lineTo(x + 11, floorY(H));
    c.lineTo(x - 11, floorY(H));
    c.closePath();
    c.fill();
    line(c, [[x, CEIL], [x, CEIL + 2]], 0x1a1614, 0.4);
    box(c, x - 1.2, CEIL + 1.6, 2.4, 0.9, 0x3a3632, 0.3, null);
    glow(c, x, CEIL + 3.2, 6, 0xffd27a, 0.6);
    circle(c, x, CEIL + 3.2, 1.1, 0xfff2c0, 0x8a6a2a, 0.25);
  }
}

type Drawer = (c: Ctx, W: number, H: number, eq: EquipmentId | null) => void;

const DRAW: Record<Exclude<RoomType, 'corridor'>, Drawer> = {
  dorm: (c, W, H, eq) => {
    const fy = floorY(H);
    // Pôster e armário.
    box(c, 6, 7, 6, 7.5, 0xe8dcc0, 0.3, INK, 0.35);
    box(c, 7, 8, 4, 3, 0x4a7ad0, 0.2, null);
    circle(c, 9, 12.5, 1, 0xe0573a, null);
    box(c, W - 9, fy - 15, 6, 15, vgrad(c, fy - 15, fy, [[0, 0x6a7a7a], [1, 0x4a5858]]), 0.5, INK, 0.45);
    for (let y = fy - 13; y < fy - 10; y += 1) line(c, [[W - 8, y], [W - 4, y]], 0x2a3434, 0.3);
    circle(c, W - 4.4, fy - 7, 0.4, 0xd0d0d0, null);
    const beds = Math.max(1, Math.floor((W - 14) / 17));
    for (let i = 0; i < beds; i++) {
      const bx = 4 + i * 17;
      bed(c, bx, fy, i);
      if (eq === 'beliche') bed(c, bx, fy - 9, i + 3, true);
    }
    box(c, W - 14, fy - 3.5, 4, 3.5, 0x8a6a40, 0.3, INK, 0.35);
  },
  generator: (c, W, H, eq) => {
    const fy = floorY(H);
    // Faixa de perigo no piso.
    c.save();
    rr(c, 4, fy - 1.4, W - 8, 1.4, 0.2);
    c.clip();
    for (let x = 2; x < W; x += 2.4) poly(c, [[x, fy], [x + 1.2, fy - 1.4], [x + 2.4, fy - 1.4], [x + 1.2, fy]], 0xf4c84a, null);
    c.restore();
    // Canos até o teto.
    box(c, W - 10, CEIL, 2.2, fy - 14 - CEIL, hgrad(c, W - 10, W - 7.8, [[0, 0x8a909a], [1, 0x4a4e56]]), 0.3, INK, 0.35);
    box(c, 7, CEIL, 1.6, 6, 0x7a3a2a, 0.3, INK, 0.35);
    // Motor.
    const mx = 5;
    const mw = W - 13;
    box(c, mx, fy - 14, mw, 13, vgrad(c, fy - 14, fy - 1, [[0, 0x5e6470], [1, 0x34383f]]), 1.2, INK, 0.6);
    box(c, mx + 2, fy - 12, mw * 0.45, 6, vgrad(c, fy - 12, fy - 6, [[0, 0xf09a50], [1, 0xc4622b]]), 0.6, INK, 0.4);
    // Grade da ventoinha do motor.
    circle(c, mx + mw - 6, fy - 7.5, 4.4, 0x2a2e34, INK, 0.5);
    for (let i = 0; i < 4; i++) line(c, [[mx + mw - 10, fy - 9.5 + i * 1.3], [mx + mw - 2, fy - 9.5 + i * 1.3]], 0x6a707a, 0.35);
    // Mostradores e etiqueta de perigo.
    circle(c, mx + 4, fy - 3.5, 1.4, 0xe8e4d8, INK, 0.35);
    line(c, [[mx + 4, fy - 3.5], [mx + 4.8, fy - 4.3]], 0xe0573a, 0.3);
    circle(c, mx + 8, fy - 3.5, 1.4, 0xe8e4d8, INK, 0.35);
    poly(c, [[mx + mw * 0.3, fy - 11.4], [mx + mw * 0.3 + 2, fy - 8], [mx + mw * 0.3 - 2, fy - 8]], 0xf4c84a, INK, 0.3);
    // Cabos no chão.
    c.beginPath();
    c.moveTo(mx + mw, fy - 2);
    c.quadraticCurveTo(W - 4, fy + 0.4, W - 3, fy - 6);
    c.strokeStyle = css(0x1a1a1e);
    c.lineWidth = 0.7;
    c.stroke();
    if (eq === 'catalisador') box(c, mx + mw * 0.55, fy - 19, 4, 5, vgrad(c, fy - 19, fy - 14, [[0, 0x6ad0d0], [1, 0x2a8080]]), 0.8, INK, 0.4);
  },
  panel: (c, W, H, eq) => {
    const fy = floorY(H);
    // Telão com mapa verde.
    box(c, 5, 6, W - 10, 9, 0x1a2a22, 0.6, INK, 0.5);
    c.save();
    rr(c, 5.6, 6.6, W - 11.2, 7.8, 0.4);
    c.clip();
    c.fillStyle = vgrad(c, 6, 15, [[0, 0x1e5a3a], [1, 0x0e3a24]]);
    c.fillRect(5, 6, W - 10, 9);
    for (let x = 6; x < W - 5; x += 2) line(c, [[x, 6], [x, 15]], 0x2a7a4a, 0.15, 0.6);
    const r = seeded(W);
    for (let i = 0; i < 6; i++) ellipse(c, 7 + r() * (W - 14), 8 + r() * 5, 1.5 + r() * 2.5, 0.8 + r(), css(0x6ad08a, 0.7));
    c.restore();
    // Mesa com monitores e quadro de disjuntores.
    box(c, 4, fy - 6, W - 8, 1.4, vgrad(c, fy - 6, fy - 4.6, [[0, 0x8a6a44], [1, 0x5a4028]]), 0.3, INK, 0.4);
    line(c, [[6, fy - 4.6], [6, fy]], 0x3a2c1c, 0.6);
    line(c, [[W - 6, fy - 4.6], [W - 6, fy]], 0x3a2c1c, 0.6);
    for (const mx of [7, W - 13]) {
      box(c, mx, fy - 11, 6, 4.5, 0x1a1e24, 0.4, INK, 0.4);
      box(c, mx + 0.6, fy - 10.4, 4.8, 3.3, 0x2a7a8a, 0.2, null);
      line(c, [[mx + 3, fy - 6.5], [mx + 3, fy - 6]], 0x1a1e24, 0.6);
    }
    // Disjuntores na base (os LEDs piscam por cima).
    box(c, 5, fy - 4, W - 10, 3.6, 0x3a4052, 0.3, INK, 0.35);
    if (eq === 'regulador') box(c, W / 2 - 2.5, fy - 11.5, 5, 5, vgrad(c, fy - 11.5, fy - 6.5, [[0, 0x6ad0d0], [1, 0x2a8080]]), 0.6, INK, 0.4);
  },
  vent: (c, W, H, eq) => {
    const fy = floorY(H);
    const cx = W / 2;
    const cy = (CEIL + fy) / 2 + 0.5;
    // Canos verdes de oxigênio.
    box(c, 3.5, CEIL, 1.8, fy - CEIL, hgrad(c, 3.5, 5.3, [[0, 0x8ad06a], [1, 0x3a7a3a]]), 0.4, INK, 0.35);
    box(c, 3.5, CEIL + 4, cx - 6, 1.6, vgrad(c, CEIL + 4, CEIL + 5.6, [[0, 0x8ad06a], [1, 0x3a7a3a]]), 0.4, INK, 0.35);
    // Carcaça com abertura redonda (a hélice gira por cima).
    box(c, cx - 9, cy - 9, 18, 18, vgrad(c, cy - 9, cy + 9, [[0, 0x9aa0a8], [1, 0x5a5e66]]), 2, INK, 0.6);
    circle(c, cx, cy, 7.2, 0x2a2e34, INK, 0.5);
    circle(c, cx, cy, 6.4, 0x0e1014, null);
    for (const [px, py] of [[cx - 7.6, cy - 7.6], [cx + 7.6, cy - 7.6], [cx - 7.6, cy + 7.6], [cx + 7.6, cy + 7.6]]) circle(c, px, py, 0.5, 0xc8ccd4, null);
    circle(c, cx + 6.5, cy - 8.5, 0.7, 0x6ad06a, null);
    if (eq === 'filtro') box(c, W - 6.5, fy - 9, 4, 9, vgrad(c, fy - 9, fy, [[0, 0xf2f2f2], [1, 0xb8c0c8]]), 0.6, INK, 0.4);
  },
  greenhouse: (c, W, H, eq) => {
    const fy = floorY(H);
    const tiers = [fy - 13.5, fy - 2];
    const bars = eq === 'lampada' ? 4 : 2;
    // Barras de luz de cultivo.
    for (let i = 0; i < bars; i++) {
      const x = 5 + ((W - 10) / bars) * i + 1;
      const w = (W - 10) / bars - 2;
      glow(c, x + w / 2, CEIL + 2, 14, 0xf2ffe0, 0.35);
      box(c, x, CEIL + 1, w, 1.4, 0xf8fff0, 0.6, 0x5a6a5a, 0.3);
    }
    for (const ty of tiers) {
      // Prateleira hidropônica com folhas fartas.
      box(c, 4, ty, W - 8, 1.6, vgrad(c, ty, ty + 1.6, [[0, 0xd8dcd8], [1, 0x8a908a]]), 0.3, INK, 0.4);
      line(c, [[5, ty + 1.6], [5, ty + (ty === tiers[0] ? 11.5 : 2)]], 0x6a706a, 0.6);
      line(c, [[W - 5, ty + 1.6], [W - 5, ty + (ty === tiers[0] ? 11.5 : 2)]], 0x6a706a, 0.6);
      const r = seeded(Math.round(ty * 7 + W));
      for (let x = 6; x < W - 6; x += 1.6) {
        const h = 3 + r() * 3.5;
        for (let k = 0; k < 3; k++) {
          const lx = x + (r() - 0.5) * 2;
          const ly = ty - r() * h;
          c.beginPath();
          c.ellipse(lx, ly, 1.3, 0.8, (r() - 0.5) * 1.6, 0, Math.PI * 2);
          c.fillStyle = css([0x4a9a3a, 0x6abf4a, 0x8ad86a][Math.floor(r() * 3)]);
          c.fill();
          c.strokeStyle = css(0x1e4a1e, 0.6);
          c.lineWidth = 0.2;
          c.stroke();
        }
        if (r() < 0.12) circle(c, x, ty - 2 - r() * 2, 0.6, 0xe0573a, null);
      }
    }
  },
  kitchen: (c, W, H, eq) => {
    const fy = floorY(H);
    // Azulejos claros atrás da bancada.
    for (let y = fy - 13; y < fy - 6; y += 2) for (let x = 4; x < W - 12; x += 2) box(c, x, y, 1.9, 1.9, (x + y) % 4 < 2 ? 0xe8e0cc : 0xd0c8b4, 0.2, null);
    // Bancada com armários.
    box(c, 3.5, fy - 6.5, W - 15, 6.5, vgrad(c, fy - 6.5, fy, [[0, 0x8a6a40], [1, 0x5a4028]]), 0.4, INK, 0.45);
    box(c, 3, fy - 7.2, W - 14, 1.2, 0xc8c4b8, 0.3, INK, 0.4);
    for (let x = 7; x < W - 13; x += 5) line(c, [[x, fy - 5.6], [x, fy - 0.6]], 0x3a2c1c, 0.3);
    // Fogão com panela fumegando.
    box(c, 6, fy - 9, 5, 2, 0x3a3e46, 0.3, INK, 0.35);
    box(c, 6.5, fy - 12, 4, 3, vgrad(c, fy - 12, fy - 9, [[0, 0xf09a50], [1, 0xb0521f]]), 0.8, INK, 0.4);
    // Prateleira com latas e potes.
    line(c, [[W - 30, fy - 16], [W - 15, fy - 16]], 0x7a5a36, 0.8);
    for (let x = W - 29; x < W - 16; x += 2.4) box(c, x, fy - 19, 1.8, 2.8, [0xe0573a, 0xf4c84a, 0x6abf5a][Math.round(x) % 3], 0.3, INK, 0.25);
    // Geladeira (freezer maior quando equipado).
    const fw = eq === 'freezer' ? 9 : 7;
    box(c, W - fw - 3, fy - 17, fw, 17, vgrad(c, fy - 17, fy, [[0, 0xf2f2ee], [1, 0xb8bcb8]]), 1, INK, 0.5);
    line(c, [[W - fw - 3, fy - 10], [W - 3, fy - 10]], 0x8a8e8a, 0.35);
    line(c, [[W - fw - 1.5, fy - 15], [W - fw - 1.5, fy - 12]], 0x6a6e6a, 0.5);
    if (eq === 'freezer') box(c, W - fw - 1, fy - 8.5, fw - 4, 1.2, 0x8ad0ff, 0.3, null);
  },
  reservoir: (c, W, H, eq) => {
    const fy = floorY(H);
    // Cano com registro.
    box(c, W - 6, CEIL, 2, fy - CEIL, hgrad(c, W - 6, W - 4, [[0, 0x8a909a], [1, 0x4a4e56]]), 0.3, INK, 0.35);
    circle(c, W - 5, CEIL + 6, 2, 0xd0453a, INK, 0.4);
    line(c, [[W - 7, CEIL + 6], [W - 3, CEIL + 6]], 0x8a2a2a, 0.4);
    // Tanque de vidro (a água é desenhada por cima, com o nível real).
    box(c, 5, 5, W - 13, fy - 5.5, 0x16263a, 2, INK, 0.6);
    c.save();
    rr(c, 5.5, 5.5, W - 14, fy - 6.5, 1.6);
    c.clip();
    c.fillStyle = hgrad(c, 5, W - 8, [[0, 0x1e3a5a], [0.5, 0x16263a], [1, 0x0e1a2a]]);
    c.fillRect(5, 5, W - 13, fy);
    c.restore();
    for (const yy of [9, fy - 4]) box(c, 4.4, yy, W - 11.8, 1.4, 0x6a707a, 0.3, INK, 0.35);
    if (eq === 'bomba') box(c, W - 12, fy - 7, 6, 7, vgrad(c, fy - 7, fy, [[0, 0xf09a50], [1, 0xb0521f]]), 1, INK, 0.45);
  },
};

function bed(c: Ctx, x: number, fy: number, k: number, upper = false): void {
  const y = fy - 6;
  const blanket = [0x4a7a3a, 0x3a6a8a, 0x8a4a3a, 0x6a5a8a][k % 4];
  if (!upper) {
    line(c, [[x, y - 3], [x, fy]], 0x3a4a3a, 0.7);
    line(c, [[x + 14, y + 1], [x + 14, fy]], 0x3a4a3a, 0.7);
  }
  box(c, x, y + 1.5, 14.5, 2.5, 0x3a4a3a, 0.3, INK, 0.4);
  box(c, x + 0.5, y - 0.2, 13.5, 2.2, 0xe8e4d8, 0.6, INK, 0.35);
  box(c, x + 1, y - 1.4, 3.6, 2, 0xf8f6f0, 0.8, INK, 0.3);
  box(c, x + 4.4, y - 0.8, 9.4, 2.6, vgrad(c, y - 0.8, y + 1.8, [[0, light(blanket, 0.25)], [1, blanket]]), 0.6, INK, 0.35);
}

function corridor(c: Ctx, W: number, H: number, eq: EquipmentId | null, entrance: boolean): void {
  c.fillStyle = vgrad(c, 0, H, [[0, 0x3e3834], [1, 0x2e2a26]]);
  c.fillRect(0, 0, W, H);
  for (let y = 4; y < H; y += 8) line(c, [[2, y], [W - 2, y]], 0x24201c, 0.3, 0.6);
  // Esteios de madeira nas laterais.
  box(c, 0, 0, 2.2, H, hgrad(c, 0, 2.2, [[0, 0x8a5e36], [1, 0x5e3e22]]), 0.2, INK, 0.35);
  box(c, W - 2.2, 0, 2.2, H, hgrad(c, W - 2.2, W, [[0, 0x8a5e36], [1, 0x5e3e22]]), 0.2, INK, 0.35);
  if (eq === 'escora') for (let y = 2; y < H; y += 8) poly(c, [[2.2, y], [W - 2.2, y + 6], [W - 2.2, y + 7.2], [2.2, y + 1.2]], 0x7a5232, INK, 0.3);
  // Escada de madeira.
  line(c, [[5, 0], [5, H]], 0x9a6a3a, 0.9);
  line(c, [[W - 5, 0], [W - 5, H]], 0x9a6a3a, 0.9);
  for (let y = 2; y < H; y += 3.2) line(c, [[5, y], [W - 5, y]], 0xb07a44, 0.7);
  if (entrance) {
    box(c, -0.5, -0.5, W + 1, 2, 0x8a8478, 0.3, INK, 0.4);
  } else {
    glow(c, W - 3.5, 6, 5, 0xffd27a, 0.45);
    circle(c, W - 3.5, 6, 0.7, 0xfff2c0, null);
  }
}

/** Hélice do ventilador (gira como sprite); `r` em unidades do mundo. */
export function fanKey(scene: Phaser.Scene, r: number): string {
  return hdTexture(scene, `hdfan_${r}`, r * 2, r * 2, (c) => {
    c.translate(r, r);
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.beginPath();
      c.ellipse(0, -r * 0.5, r * 0.22, r * 0.48, 0.35, 0, Math.PI * 2);
      c.fillStyle = vgrad(c, -r, 0, [[0, 0xc8ccd4], [1, 0x7a808a]]);
      c.fill();
      c.strokeStyle = css(INK);
      c.lineWidth = 0.35;
      c.stroke();
    }
    circle(c, 0, 0, r * 0.2, 0x3a3e46, INK, 0.35);
  });
}

/** Sala desmoronada: entulho, viga torta, poeira. */
export function collapsedKey(scene: Phaser.Scene, wTiles: number, hTiles: number): string {
  const W = wTiles * TILE;
  const H = hTiles * TILE;
  return hdTexture(scene, `hd_collapsed_${wTiles}x${hTiles}`, W, H, (c) => {
    c.fillStyle = vgrad(c, 0, H, [[0, 0x2a2420], [1, 0x1a1512]]);
    c.fillRect(0, 0, W, H);
    const r = seeded(W * 3 + H);
    poly(c, [[0, 2], [W * 0.6, H * 0.45], [W * 0.6, H * 0.45 + 3], [0, 5]], 0x4e535c, INK, 0.5);
    for (let i = 0; i < W / 3; i++) stone(c, r() * W, H - 3 - r() * H * 0.45, 2 + r() * 3, 1.5 + r() * 2, 0x6a625c, i);
    line(c, [[W * 0.3, H - 6], [W * 0.8, H - 10]], 0xb0521f, 0.7);
  });
}
