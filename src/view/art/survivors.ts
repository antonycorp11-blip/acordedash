// Sobreviventes em estilo chibi: cabeça grande, capacete ou chapéu por
// arquétipo, olhos expressivos. Partes combinadas pela semente visual.

import Phaser from 'phaser';
import type { Archetype } from '../../core/state';
import { box, circle, css, ellipse, hdTexture, light, line, mix, vgrad, type Ctx } from './hd';
import { HAIR, SKIN } from './palette';

export type Expression = 'ok' | 'feliz' | 'medo' | 'raiva' | 'doente';
/** Tamanho em unidades do mundo. */
export const PERSON_W = 16;
export const PERSON_H = 22;
const INK = 0x14101c;

const CLOTHES: Record<Archetype | 'viajante', number> = {
  viajante: 0x8a5a32, hipocondriaco: 0x6ab0a0, coach: 0xd0453a, sogra: 0x8a4aa8,
  engenheiro: 0xe8833a, crianca: 0xf4c84a, religioso: 0xe8e2d4,
};

/** Quadro: 0 e 1 andando, 2 gesticulando. */
export function personKey(scene: Phaser.Scene, look: number, arch: Archetype | 'viajante', expr: Expression, frame: number): string {
  return hdTexture(scene, `ch_${look}_${arch}_${expr}_${frame}`, PERSON_W, PERSON_H, (c) => draw(c, look, arch, expr, frame));
}

function draw(c: Ctx, look: number, arch: Archetype | 'viajante', expr: Expression, frame: number): void {
  const child = arch === 'crianca';
  const s = child ? 0.85 : 1;
  c.translate(8, PERSON_H);
  c.scale(s, s);
  c.translate(-8, -PERSON_H);
  let skin = SKIN[Math.abs(look) % SKIN.length];
  if (expr === 'doente') skin = mix(skin, 0x9ad06a, 0.45);
  const hair = arch === 'sogra' ? 0xc8c8cc : HAIR[Math.abs(look >> 3) % HAIR.length];
  const cloth = CLOTHES[arch];
  const lf = frame === 1 ? 1 : frame === 0 ? -0.4 : 0;

  // Pernas e botas.
  const legY = 16.2;
  box(c, 5.6 + lf * 0.6, legY, 2.2, 4.6, 0x2e3a52, 0.6, INK, 0.45);
  box(c, 8.4 - lf * 0.6, legY, 2.2, 4.6, 0x2e3a52, 0.6, INK, 0.45);
  box(c, 5 + lf * 0.6, 20.2, 3, 1.6, 0x3a2a20, 0.6, INK, 0.4);
  box(c, 8.2 - lf * 0.6, 20.2, 3, 1.6, 0x3a2a20, 0.6, INK, 0.4);

  // Corpo.
  const robe = arch === 'religioso' || arch === 'sogra';
  box(c, 4.6, 11.2, 6.8, robe ? 8.4 : 6, vgrad(c, 11, 18, [[0, light(cloth, 0.15)], [1, light(cloth, -0.25)]]), 2, INK, 0.5);
  if (arch === 'viajante' || arch === 'engenheiro') {
    // Colete refletivo.
    line(c, [[5.6, 12], [6.4, 17]], 0xf4e04a, 0.7);
    line(c, [[10.4, 12], [9.6, 17]], 0xf4e04a, 0.7);
  }
  if (arch === 'coach') line(c, [[8, 11.4], [8, 17]], 0xffffff, 0.5);
  if (arch === 'religioso') line(c, [[4.8, 15], [11.2, 15]], 0x8a5a32, 0.7);
  if (arch === 'sogra') for (let x = 6.3; x < 10; x += 0.9) circle(c, x, 11.9, 0.35, 0xffffff, null);

  // Braços (no gesto, um sobe).
  box(c, 3.2, 11.8, 2, 4.8, light(cloth, -0.1), 1, INK, 0.4);
  circle(c, 4.2, 16.8, 0.9, skin, INK, 0.35);
  if (frame === 2) {
    c.save();
    c.translate(11.8, 12.4);
    c.rotate(-2.4);
    box(c, -1, 0, 2, 4.8, light(cloth, -0.1), 1, INK, 0.4);
    circle(c, 0, 5.2, 0.9, skin, INK, 0.35);
    c.restore();
  } else {
    box(c, 10.8, 11.8, 2, 4.8, light(cloth, -0.1), 1, INK, 0.4);
    circle(c, 11.8, 16.8, 0.9, skin, INK, 0.35);
  }
  if (arch === 'religioso') box(c, 12, 14, 2.6, 3.2, 0x7a2a2a, 0.3, INK, 0.35);

  // Cabeça grande.
  const hx = 8;
  const hy = 7;
  circle(c, hx - 4.9, hy + 0.6, 0.9, skin, INK, 0.4);
  circle(c, hx + 4.9, hy + 0.6, 0.9, skin, INK, 0.4);
  ellipse(c, hx, hy, 4.9, 4.6, css(skin), INK, 0.55);
  ellipse(c, hx - 1.4, hy - 2, 2, 1, css(0xffffff, 0.18));
  hairBack(c, arch, hair, hx, hy, look);
  faceOf(c, expr, hx, hy, arch);
  hat(c, arch, hx, hy, look);
}

function hairBack(c: Ctx, arch: Archetype | 'viajante', hair: number, hx: number, hy: number, look: number): void {
  if (arch === 'sogra') {
    circle(c, hx, hy - 5, 2.2, hair, INK, 0.45);
    c.beginPath();
    c.arc(hx, hy - 0.5, 5, Math.PI * 1.05, Math.PI * 1.95);
    c.fillStyle = css(hair);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.45;
    c.stroke();
    return;
  }
  if (arch === 'religioso' || arch === 'coach') {
    // Franja/topete.
    const spikes = arch === 'coach' ? 5 : 3;
    for (let i = 0; i < spikes; i++) ellipse(c, hx - 3 + i * (6 / (spikes - 1)), hy - 3.8, 1.2, 1.5, css(hair), INK, 0.35);
    if (arch === 'religioso') ellipse(c, hx, hy + 3.6, 3.2, 1.6, css(hair), INK, 0.35);
    return;
  }
  // Mecha saindo do capacete.
  if (Math.abs(look >> 6) % 2) ellipse(c, hx - 3.6, hy - 0.6, 1.2, 1.8, css(hair), INK, 0.35);
  ellipse(c, hx + 3.4, hy - 0.8, 1, 1.4, css(hair), INK, 0.35);
}

function faceOf(c: Ctx, expr: Expression, hx: number, hy: number, arch: Archetype | 'viajante'): void {
  const ey = hy + 0.3;
  const big = expr === 'medo';
  for (const ex of [hx - 1.8, hx + 1.8]) {
    ellipse(c, ex, ey, big ? 1.3 : 1.05, big ? 1.5 : 1.25, css(0xffffff), INK, 0.35);
    circle(c, ex + 0.15, ey + 0.2, big ? 0.5 : 0.6, INK, null);
    circle(c, ex + 0.35, ey - 0.1, 0.2, 0xffffff, null);
  }
  if (expr === 'raiva') {
    line(c, [[hx - 3, ey - 2], [hx - 0.8, ey - 1.2]], INK, 0.5);
    line(c, [[hx + 3, ey - 2], [hx + 0.8, ey - 1.2]], INK, 0.5);
  }
  if (expr !== 'doente' && arch !== 'hipocondriaco') {
    ellipse(c, hx - 3, hy + 2, 0.8, 0.45, css(0xe07a7a, 0.55));
    ellipse(c, hx + 3, hy + 2, 0.8, 0.45, css(0xe07a7a, 0.55));
  }
  const my = hy + 2.6;
  c.beginPath();
  if (expr === 'feliz') c.arc(hx, my - 0.6, 1.3, 0.1 * Math.PI, 0.9 * Math.PI);
  else if (expr === 'medo') c.ellipse(hx, my + 0.2, 0.7, 0.9, 0, 0, Math.PI * 2);
  else if (expr === 'raiva' || expr === 'doente') c.arc(hx, my + 1.3, 1.1, 1.2 * Math.PI, 1.8 * Math.PI);
  else {
    c.moveTo(hx - 0.9, my);
    c.quadraticCurveTo(hx, my + 0.4, hx + 0.9, my);
  }
  c.strokeStyle = css(INK);
  c.lineWidth = 0.45;
  if (expr === 'medo') {
    c.fillStyle = css(0x5a2020);
    c.fill();
  }
  c.stroke();
  if (arch === 'hipocondriaco') box(c, hx - 2.8, hy + 1.4, 5.6, 2.6, 0xf2f6f8, 1, INK, 0.35);
  if (arch === 'sogra') {
    // Óculos de armação dourada.
    c.beginPath();
    c.arc(hx - 1.8, ey, 1.5, 0, Math.PI * 2);
    c.moveTo(hx + 3.3, ey);
    c.arc(hx + 1.8, ey, 1.5, 0, Math.PI * 2);
    c.strokeStyle = css(0x8a6a2a);
    c.lineWidth = 0.35;
    c.stroke();
  }
  if (expr === 'doente') ellipse(c, hx + 3.4, hy - 2.2, 0.5, 0.8, css(0x8ad0ff));
}

function hat(c: Ctx, arch: Archetype | 'viajante', hx: number, hy: number, look: number): void {
  const helmet = (color: number) => {
    c.beginPath();
    c.arc(hx, hy - 1.2, 4.9, Math.PI, 0);
    c.closePath();
    c.fillStyle = vgrad(c, hy - 6, hy - 1, [[0, light(color, 0.3)], [1, light(color, -0.15)]]);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
    line(c, [[hx, hy - 6], [hx, hy - 1.4]], light(color, -0.3), 0.6);
    box(c, hx - 6, hy - 1.8, 12, 1.3, light(color, -0.1), 0.6, INK, 0.45);
    ellipse(c, hx - 2, hy - 4.4, 1.5, 0.7, css(0xffffff, 0.45));
  };
  switch (arch) {
    case 'viajante':
      helmet(0xf4c84a);
      // Óculos de proteção na testa do capacete.
      box(c, hx - 3.4, hy - 3.6, 6.8, 1.4, 0x2a3a4a, 0.6, INK, 0.3);
      ellipse(c, hx - 1.5, hy - 2.9, 1, 0.5, css(0x8ad0ff));
      ellipse(c, hx + 1.5, hy - 2.9, 1, 0.5, css(0x8ad0ff));
      break;
    case 'engenheiro':
      helmet(0xe8833a);
      break;
    case 'crianca':
      // Boné azul virado.
      c.beginPath();
      c.arc(hx, hy - 1.4, 4.8, Math.PI, 0);
      c.closePath();
      c.fillStyle = css(0x3a6ad0);
      c.fill();
      c.strokeStyle = css(INK);
      c.lineWidth = 0.5;
      c.stroke();
      box(c, hx + 2, hy - 2, 4.5, 1.1, 0x2a4aa0, 0.5, INK, 0.4);
      break;
    case 'hipocondriaco':
      c.beginPath();
      c.arc(hx, hy - 1.6, 4.8, Math.PI, 0);
      c.closePath();
      c.fillStyle = css(0x9ad8c8);
      c.fill();
      c.strokeStyle = css(INK);
      c.lineWidth = 0.45;
      c.stroke();
      break;
    case 'coach':
      box(c, hx - 4.9, hy - 3, 9.8, 1.4, 0xffffff, 0.6, INK, 0.35);
      break;
    default:
      if (Math.abs(look) % 3 === 0 && arch !== 'sogra' && arch !== 'religioso') helmet(0xf4c84a);
  }
}

/** Balão de humor acima da cabeça. */
export function bubbleKey(scene: Phaser.Scene, kind: 'feliz' | 'triste' | 'doente' | 'zz' | 'alerta'): string {
  return hdTexture(scene, `bub_${kind}`, 10, 11, (c) => {
    c.beginPath();
    c.arc(5, 4.8, 4.3, 0, Math.PI * 2);
    c.moveTo(3.6, 8.6);
    c.lineTo(4.4, 10.6);
    c.lineTo(5.6, 8.8);
    c.fillStyle = css(0xffffff);
    c.fill();
    c.strokeStyle = css(INK);
    c.lineWidth = 0.5;
    c.stroke();
    if (kind === 'zz') {
      c.fillStyle = css(0x3a4a8a);
      c.font = `bold 4.6px 'Fredoka', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('z z', 5, 5);
      return;
    }
    if (kind === 'alerta') {
      c.fillStyle = css(0xe0573a);
      c.font = `bold 6px 'Fredoka', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('!', 5, 5.2);
      return;
    }
    const col = kind === 'feliz' ? 0x6abf5a : kind === 'doente' ? 0x9ad06a : 0xe0573a;
    circle(c, 5, 4.8, 3, col, INK, 0.4);
    circle(c, 3.9, 4.1, 0.45, INK, null);
    circle(c, 6.1, 4.1, 0.45, INK, null);
    c.beginPath();
    if (kind === 'feliz') c.arc(5, 4.9, 1.4, 0.15 * Math.PI, 0.85 * Math.PI);
    else c.arc(5, 7.2, 1.3, 1.2 * Math.PI, 1.8 * Math.PI);
    c.strokeStyle = css(INK);
    c.lineWidth = 0.4;
    c.stroke();
  });
}
