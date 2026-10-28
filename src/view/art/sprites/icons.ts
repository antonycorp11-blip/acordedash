// Ícones de interface vetoriais e coloridos, desenhados numa caixa de 10×10
// unidades e gerados em ICON_RES× (40 px). Quem exibe divide a escala por ICON_RES.

import Phaser from 'phaser';
import { box, circle, css, ellipse, hdTexture, line, poly, rr, vgrad, type Ctx } from '../hd';

export const ICON_RES = 4;
const INK = 0x14101c;

const face = (fill: number, mouth: 'up' | 'flat' | 'down') => (c: Ctx) => {
  circle(c, 5, 5, 4.3, fill, INK, 0.6);
  ellipse(c, 3.8, 3.4, 1.2, 0.7, css(0xffffff, 0.35));
  ellipse(c, 3.6, 4.4, 0.5, 0.7, css(INK));
  ellipse(c, 6.4, 4.4, 0.5, 0.7, css(INK));
  c.beginPath();
  if (mouth === 'up') c.arc(5, 5.6, 1.7, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (mouth === 'down') c.arc(5, 8, 1.6, 1.2 * Math.PI, 1.8 * Math.PI);
  else {
    c.moveTo(3.6, 6.9);
    c.lineTo(6.4, 6.9);
  }
  c.strokeStyle = css(INK);
  c.lineWidth = 0.6;
  c.stroke();
};

const bolt = (c: Ctx) => poly(c, [[6, 0.5], [2, 5.6], [4.8, 5.6], [3.6, 9.5], [8.2, 3.8], [5.3, 3.8]], vgrad(c, 0, 10, [[0, 0xffe680], [1, 0xf0a020]]), INK, 0.5);

const DRAW: Record<string, (c: Ctx) => void> = {
  bolt,
  nobolt: (c) => {
    c.globalAlpha = 0.6;
    bolt(c);
    c.globalAlpha = 1;
    line(c, [[1.2, 1.2], [8.8, 8.8]], 0xd0453a, 1.4);
  },
  wind: (c) => {
    // Hélice de ventilação.
    for (let i = 0; i < 3; i++) {
      c.save();
      c.translate(5, 5);
      c.rotate((i * Math.PI * 2) / 3);
      c.beginPath();
      c.ellipse(0, -2.4, 1.5, 2.4, 0.3, 0, Math.PI * 2);
      c.fillStyle = css(0xa9d8f0);
      c.fill();
      c.strokeStyle = css(INK);
      c.lineWidth = 0.5;
      c.stroke();
      c.restore();
    }
    circle(c, 5, 5, 1, 0x5f6474, INK, 0.5);
  },
  food: (c) => {
    // Lata de comida com rótulo vermelho.
    box(c, 2.3, 1.6, 5.4, 7.4, vgrad(c, 1.6, 9, [[0, 0xe05a4a], [1, 0xa02a2a]]), 1.2);
    rr(c, 2.3, 3.4, 5.4, 3.6, 0);
    c.fillStyle = css(0xf2e6c9);
    c.fill();
    ellipse(c, 5, 1.8, 2.7, 0.8, css(0xc9c9d0), INK, 0.5);
    box(c, 3.6, 4.2, 2.8, 2, 0x6abf5a, 0.6, null);
  },
  water: (c) => {
    c.beginPath();
    c.moveTo(5, 0.6);
    c.bezierCurveTo(6.5, 3, 8.4, 4.8, 8.4, 6.3);
    c.arc(5, 6.3, 3.4, 0, Math.PI);
    c.bezierCurveTo(1.6, 4.8, 3.5, 3, 5, 0.6);
    c.fillStyle = vgrad(c, 0, 10, [[0, 0x8fd0ff], [1, 0x2a6ad0]]);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
    ellipse(c, 3.9, 6, 0.6, 1.2, css(0xffffff, 0.6));
  },
  gear: (c) => {
    c.save();
    c.translate(5, 5);
    for (let i = 0; i < 8; i++) {
      c.rotate(Math.PI / 4);
      box(c, -0.9, -4.6, 1.8, 2, 0x9aa0ae, 0.3, INK, 0.4);
    }
    c.restore();
    circle(c, 5, 5, 3.2, 0xb8bcc8, INK, 0.5);
    circle(c, 5, 5, 1.2, 0x3a3e48, INK, 0.4);
  },
  earth: (c) => {
    // Monte de terra.
    c.beginPath();
    c.moveTo(0.8, 8.8);
    c.quadraticCurveTo(2.5, 2.5, 5, 2.8);
    c.quadraticCurveTo(7.8, 2.6, 9.2, 8.8);
    c.closePath();
    c.fillStyle = vgrad(c, 2, 9, [[0, 0xa06a3c], [1, 0x5c3a22]]);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
    circle(c, 4, 5, 0.5, 0x7d5232, null);
    circle(c, 6.3, 6.6, 0.6, 0x7d5232, null);
  },
  happy: face(0x6abf5a, 'up'),
  meh: face(0xf4c84a, 'flat'),
  sad: face(0xe0573a, 'down'),
  sick: face(0x9ad06a, 'flat'),
  hurt: face(0xf4c84a, 'down'),
  alert: (c) => {
    poly(c, [[5, 0.6], [9.6, 9.2], [0.4, 9.2]], vgrad(c, 0, 10, [[0, 0xffd860], [1, 0xf0a020]]), INK, 0.6);
    box(c, 4.4, 3.4, 1.2, 3.4, INK, 0.5, null);
    circle(c, 5, 7.9, 0.65, INK, null);
  },
  pause: (c) => {
    box(c, 2.2, 1.8, 2, 6.4, 0xf2f0ea, 0.5, null);
    box(c, 5.8, 1.8, 2, 6.4, 0xf2f0ea, 0.5, null);
  },
  play: (c) => poly(c, [[2.6, 1.6], [8.2, 5], [2.6, 8.4]], 0xf2f0ea, null),
  ff2: (c) => {
    poly(c, [[1, 2], [5, 5], [1, 8]], 0xf2f0ea, null);
    poly(c, [[5, 2], [9, 5], [5, 8]], 0xf2f0ea, null);
  },
  ff4: (c) => {
    poly(c, [[0.4, 2], [3.6, 5], [0.4, 8]], 0xf2f0ea, null);
    poly(c, [[3.4, 2], [6.6, 5], [3.4, 8]], 0xf2f0ea, null);
    poly(c, [[6.4, 2], [9.6, 5], [6.4, 8]], 0xf2f0ea, null);
  },
  wrench: (c) => {
    c.save();
    c.translate(5, 5);
    c.rotate(-Math.PI / 4);
    box(c, -0.8, -1.5, 1.6, 6, 0xb8bcc8, 0.6, INK, 0.5);
    circle(c, 0, -2.6, 1.9, 0xb8bcc8, INK, 0.5);
    box(c, -0.6, -4.8, 1.2, 1.8, 0x1a2236, 0.2, null);
    c.restore();
  },
  person: (c) => {
    box(c, 2.4, 5.4, 5.2, 4.2, 0xe8833a, 1.5);
    circle(c, 5, 3.6, 2.3, 0xf1c8a0, INK, 0.5);
    c.beginPath();
    c.arc(5, 3.2, 2.4, Math.PI, 0);
    c.fillStyle = css(0xf4c84a);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
  },
  menu: (c) => {
    for (let i = 0; i < 3; i++) box(c, 1.5, 2 + i * 2.6, 7, 1.2, 0xf2f0ea, 0.6, null);
  },
  lock: (c) => {
    c.beginPath();
    c.arc(5, 4.4, 2.2, Math.PI, 0);
    c.strokeStyle = css(0x9aa0ae);
    c.lineWidth = 1.1;
    c.stroke();
    box(c, 2, 4.4, 6, 4.8, 0xf4c84a, 0.8);
    circle(c, 5, 6.5, 0.7, INK, null);
  },
  check: (c) => line(c, [[1.6, 5.4], [4, 7.8], [8.6, 2.4]], 0x6abf5a, 1.8),
  cross: (c) => {
    line(c, [[2, 2], [8, 8]], 0xe0573a, 1.8);
    line(c, [[8, 2], [2, 8]], 0xe0573a, 1.8);
  },
  heart: (c) => {
    c.beginPath();
    c.moveTo(5, 8.8);
    c.bezierCurveTo(0, 5, 1.5, 1, 5, 3.2);
    c.bezierCurveTo(8.5, 1, 10, 5, 5, 8.8);
    c.fillStyle = css(0xe0573a);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
  },
  thermo: (c) => {
    box(c, 4, 0.8, 2, 6.4, 0xf2f0ea, 1);
    box(c, 4.6, 3, 0.8, 4.4, 0xe0573a, 0.4, null);
    circle(c, 5, 7.6, 1.8, 0xe0573a, INK, 0.5);
  },
  book: (c) => {
    box(c, 1, 2, 4, 6.4, 0xf2e6c9, 0.5);
    box(c, 5, 2, 4, 6.4, 0xf2e6c9, 0.5);
    for (let i = 0; i < 3; i++) {
      line(c, [[1.8, 3.6 + i * 1.4], [4.2, 3.6 + i * 1.4]], 0xa08a6a, 0.35);
      line(c, [[5.8, 3.6 + i * 1.4], [8.2, 3.6 + i * 1.4]], 0xa08a6a, 0.35);
    }
    box(c, 4.6, 1.6, 0.8, 7.2, 0x8a2a2a, 0.3, null);
  },
  star: (c) => {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 1.9 : 4.4;
      pts.push([5 + Math.cos(a) * r, 5.3 + Math.sin(a) * r]);
    }
    poly(c, pts, vgrad(c, 0, 10, [[0, 0xffe680], [1, 0xf0a020]]), INK, 0.5);
  },
  up: (c) => poly(c, [[5, 1.5], [8.6, 6], [6.2, 6], [6.2, 8.8], [3.8, 8.8], [3.8, 6], [1.4, 6]], 0xf2f0ea, null),
  down: (c) => poly(c, [[5, 8.5], [8.6, 4], [6.2, 4], [6.2, 1.2], [3.8, 1.2], [3.8, 4], [1.4, 4]], 0xf2f0ea, null),
  shield: (c) => {
    c.beginPath();
    c.moveTo(5, 0.8);
    c.lineTo(8.8, 2.2);
    c.quadraticCurveTo(8.6, 7.2, 5, 9.3);
    c.quadraticCurveTo(1.4, 7.2, 1.2, 2.2);
    c.closePath();
    c.fillStyle = vgrad(c, 0, 10, [[0, 0x7aa6ff], [1, 0x2a4aa0]]);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
  },
  plant: (c) => {
    box(c, 2.8, 6.4, 4.4, 3, 0xa06a3c, 0.6);
    line(c, [[5, 6.6], [5, 3]], 0x2f6b3a, 0.8);
    c.beginPath();
    c.ellipse(3.3, 3.6, 2, 1.1, -0.5, 0, Math.PI * 2);
    c.fillStyle = css(0x6abf5a);
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(6.8, 2.8, 2.2, 1.2, 0.5, 0, Math.PI * 2);
    c.fillStyle = css(0x8ad06a);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
  },
  pot: (c) => {
    box(c, 1.6, 3.6, 6.8, 5, vgrad(c, 3, 9, [[0, 0xf09a50], [1, 0xb0521f]]), 1.6);
    box(c, 0.6, 3.2, 8.8, 1.2, 0x8a8f9c, 0.6);
    box(c, 4.2, 2.2, 1.6, 1, 0x5f6474, 0.4);
  },
  bed: (c) => {
    box(c, 0.8, 4, 8.4, 3.4, 0x2f6b3a, 0.8);
    box(c, 1.2, 3.2, 3, 1.6, 0xf2f0ea, 0.6);
    box(c, 0.6, 7, 1, 2.4, 0x7d5232, 0.3);
    box(c, 8.4, 5.6, 1, 3.8, 0x7d5232, 0.3);
  },
  hatch: (c) => {
    box(c, 0.8, 1.6, 8.4, 6.8, 0x6a6f7c, 1.2);
    for (let i = 0; i < 4; i++) poly(c, [[1.2 + i * 2, 7.8], [2.4 + i * 2, 7.8], [3.4 + i * 2, 6.6], [2.2 + i * 2, 6.6]], 0xf4c84a, null);
    circle(c, 5, 4.2, 1.6, 0x9aa0ae, INK, 0.5);
  },
  leak: (c) => {
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.moveTo(1, 2.5 + i * 2.6);
      c.bezierCurveTo(3.5, 1 + i * 2.6, 5.5, 4 + i * 2.6, 9, 2.5 + i * 2.6);
      c.strokeStyle = css(0xa9d8f0);
      c.lineWidth = 0.9;
      c.stroke();
    }
  },
  bug: (c) => {
    ellipse(c, 5, 5.6, 2.6, 3.2, 0x2f6b3a, INK, 0.5);
    circle(c, 5, 2.4, 1.3, 0x14101c, null);
    line(c, [[5, 3], [5, 8.6]], INK, 0.4);
    for (const y of [4.5, 6, 7.5]) {
      line(c, [[2.4, y], [0.8, y - 0.6]], INK, 0.4);
      line(c, [[7.6, y], [9.2, y - 0.6]], INK, 0.4);
    }
  },
  dust: (c) => {
    for (const [x, y, r] of [[3, 3, 1.4], [6.5, 4, 1], [4.4, 6.6, 1.2], [7.4, 7.6, 0.8], [2, 7.8, 0.7]] as [number, number, number][]) circle(c, x, y, r, 0x9a8f86, INK, 0.4);
  },
  door: (c) => {
    box(c, 2, 0.8, 6, 8.6, 0x6a6f7c, 0.6);
    box(c, 3, 1.8, 4, 3, 0x9aa0ae, 0.3, INK, 0.3);
    circle(c, 6.6, 6, 0.5, 0xf4c84a, null);
  },
  eye: (c) => {
    c.beginPath();
    c.moveTo(0.6, 5);
    c.quadraticCurveTo(5, -0.6, 9.4, 5);
    c.quadraticCurveTo(5, 10.6, 0.6, 5);
    c.fillStyle = css(0xf2f0ea);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
    circle(c, 5, 5, 1.9, 0x4a7ad0, INK, 0.4);
    circle(c, 5, 5, 0.8, INK, null);
  },
  shovel: (c) => {
    // Picareta.
    c.save();
    c.translate(5, 5);
    c.rotate(-Math.PI / 4);
    box(c, -0.6, -1, 1.2, 6, 0xa06a3c, 0.4, INK, 0.4);
    c.beginPath();
    c.moveTo(-4.2, -0.4);
    c.quadraticCurveTo(0, -3.8, 4.2, -0.4);
    c.quadraticCurveTo(0, -2.4, -4.2, -0.4);
    c.fillStyle = css(0xb8bcc8);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
    c.restore();
  },
  fill: (c) => {
    DRAW.earth(c);
    poly(c, [[5, 0.4], [6.6, 2.4], [3.4, 2.4]], 0xf2f0ea, INK, 0.4);
  },
  wall: (c) => {
    for (let r = 0; r < 4; r++) {
      for (let k = 0; k < 3; k++) {
        const x = 0.6 + k * 3 + (r % 2 ? 1.5 : 0);
        if (x > 7.6) continue;
        box(c, x, 1 + r * 2, Math.min(2.8, 9.4 - x), 1.8, 0x9aa0ae, 0.3, INK, 0.4);
      }
    }
  },
  hammer: (c) => {
    // Suporte de madeira (mesa de escora).
    box(c, 1, 1.6, 8, 1.8, 0xa06a3c, 0.4);
    box(c, 1.8, 3.2, 1.6, 6, 0x7d5232, 0.3);
    box(c, 6.6, 3.2, 1.6, 6, 0x7d5232, 0.3);
  },
  equip: (c) => {
    DRAW.gear(c);
    circle(c, 5, 5, 1.2, 0x3fa0a0, INK, 0.4);
  },
  mission: (c) => {
    box(c, 1.6, 0.8, 6.8, 8.6, 0xf2e6c9, 0.6);
    for (let i = 0; i < 4; i++) line(c, [[3, 2.6 + i * 1.7], [7, 2.6 + i * 1.7]], 0xa08a6a, 0.45);
  },
  panel: (c) => {
    box(c, 0.8, 1, 8.4, 8, 0x3a4052, 0.8);
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) circle(c, 2.8 + k * 2.2, 3 + r * 2.1, 0.6, [0x6abf5a, 0xe0573a, 0xf4c84a][(r + k) % 3], null);
  },
  skull: (c) => {
    circle(c, 5, 4.4, 3.6, 0xf2f0ea, INK, 0.5);
    box(c, 3.2, 6.6, 3.6, 2.6, 0xf2f0ea, 0.6);
    circle(c, 3.7, 4.4, 1, INK, null);
    circle(c, 6.3, 4.4, 1, INK, null);
  },
};

export type IconName = keyof typeof DRAW;
export const ICON_NAMES = Object.keys(DRAW);

export function iconKey(scene: Phaser.Scene, name: string): string {
  const draw = DRAW[name] ?? DRAW.alert;
  return hdTexture(scene, `i2_${name}`, 10, 10, draw, ICON_RES);
}

export function preloadIcons(scene: Phaser.Scene): void {
  for (const k of ICON_NAMES) iconKey(scene, k);
}
