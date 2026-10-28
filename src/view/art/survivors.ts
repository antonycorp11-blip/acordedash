// Sobreviventes compostos por partes (cabeça, cabelo, roupa, acessório,
// expressão), combinadas pela semente visual de cada pessoa.

import Phaser from 'phaser';
import type { Archetype } from '../../core/state';
import { HAIR, P, SKIN, shade } from './palette';
import { makeTexture, type Pix } from './pixel';

export type Expression = 'ok' | 'feliz' | 'medo' | 'raiva' | 'doente';
export const PERSON_W = 12;
export const PERSON_H = 16;

const CLOTHES: Record<Archetype | 'viajante', number> = {
  viajante: P.dirtLight, hipocondriaco: P.teal, coach: P.red, sogra: P.purple,
  engenheiro: P.orange, crianca: P.yellow, religioso: P.white,
};

/**
 * Quadro de animação: 0 e 1 andando, 2 gesticulando.
 * A chave inclui tudo que muda o desenho, então cada variação é criada uma vez.
 */
export function personKey(scene: Phaser.Scene, look: number, arch: Archetype | 'viajante', expr: Expression, frame: number): string {
  const key = `p_${look}_${arch}_${expr}_${frame}`;
  return makeTexture(scene, key, PERSON_W, PERSON_H, (p) => drawPerson(p, look, arch, expr, frame));
}

function drawPerson(p: Pix, look: number, arch: Archetype | 'viajante', expr: Expression, frame: number): void {
  const child = arch === 'crianca';
  const oy = child ? 3 : 0;
  let skin = SKIN[Math.abs(look) % SKIN.length];
  if (expr === 'doente') skin = mix(skin, P.green);
  const hair = arch === 'sogra' ? P.rockLight : HAIR[Math.abs(look >> 3) % HAIR.length];
  const style = Math.abs(look >> 6) % 5;
  const cloth = CLOTHES[arch];
  const dark = shade(cloth, 0.65);

  // Pernas (alternam ao andar).
  const legY = 12;
  const lf = frame === 1 ? 1 : 0;
  p.rect(4 - lf, legY, 2, 4 - (child ? 1 : 0), P.blueDark);
  p.rect(7 + lf, legY, 2, 4 - (child ? 1 : 0), P.blueDark);
  p.px(4 - lf, 15, P.ink);
  p.px(8 + lf, 15, P.ink);

  // Corpo.
  const bodyTop = 7 + oy;
  const bodyH = child ? 3 : 5;
  p.rect(3, bodyTop, 6, bodyH + (arch === 'sogra' || arch === 'religioso' ? 2 : 0), cloth);
  p.vline(2, bodyTop, bodyH, P.ink);
  p.vline(9, bodyTop, bodyH, P.ink);
  p.hline(3, bodyTop + bodyH - 1, 6, dark);

  // Braços: no gesto, um braço sobe (expressões exageradas).
  p.rect(1, bodyTop + 1, 1, 3, skin);
  if (frame === 2) {
    p.rect(10, bodyTop - 3, 1, 4, skin);
    p.px(10, bodyTop - 4, skin);
  } else p.rect(10, bodyTop + 1, 1, 3, skin);

  // Cabeça.
  const hy = 1 + oy;
  p.rect(3, hy, 6, 6, P.ink);
  p.rect(4, hy + 1, 4, 5, skin);
  p.rect(3, hy + 1, 1, 4, skin);
  p.rect(8, hy + 1, 1, 4, skin);
  hairStyle(p, style, hair, hy, arch);
  face(p, expr, hy);
  accessory(p, arch, hy, bodyTop);
}

function hairStyle(p: Pix, style: number, c: number, hy: number, arch: Archetype | 'viajante'): void {
  if (arch === 'engenheiro' || arch === 'crianca') return;
  if (arch === 'sogra') {
    p.rect(3, hy, 6, 2, c);
    p.rect(5, hy - 2, 3, 2, c);
    return;
  }
  if (style === 0) p.rect(3, hy, 6, 2, c);
  if (style === 1) {
    p.rect(3, hy, 6, 2, c);
    p.rect(2, hy + 1, 1, 5, c);
    p.rect(9, hy + 1, 1, 5, c);
  }
  if (style === 3) p.rect(4, hy, 4, 1, c);
  if (style === 4) for (let x = 3; x < 9; x += 2) p.rect(x, hy - 1, 1, 2, c);
}

function face(p: Pix, expr: Expression, hy: number): void {
  const ey = hy + 2;
  if (expr === 'medo') {
    p.rect(4, ey, 2, 2, P.white);
    p.rect(7, ey, 2, 2, P.white);
    p.px(5, ey + 1, P.ink);
    p.px(7, ey + 1, P.ink);
    p.rect(5, ey + 3, 2, 1, P.ink);
  } else {
    p.px(5, ey, P.ink);
    p.px(7, ey, P.ink);
    if (expr === 'raiva') {
      p.px(4, ey - 1, P.ink);
      p.px(8, ey - 1, P.ink);
      p.hline(5, ey + 2, 3, P.ink);
    } else if (expr === 'feliz') {
      p.px(4, ey + 2, P.ink);
      p.hline(5, ey + 3, 3, P.ink);
      p.px(8, ey + 2, P.ink);
    } else if (expr === 'doente') {
      p.hline(5, ey + 2, 3, P.greenDark);
    } else {
      p.hline(5, ey + 2, 2, P.ink);
    }
  }
}

function accessory(p: Pix, arch: Archetype | 'viajante', hy: number, bodyTop: number): void {
  switch (arch) {
    case 'viajante':
      // Óculos de proteção na testa e sobretudo.
      p.rect(3, hy + 1, 6, 1, P.teal);
      p.px(4, hy + 1, P.skyLight);
      p.px(7, hy + 1, P.skyLight);
      p.rect(3, bodyTop + 4, 1, 3, P.dirt);
      p.rect(8, bodyTop + 4, 1, 3, P.dirt);
      break;
    case 'hipocondriaco':
      p.rect(4, hy + 4, 4, 2, P.white);
      p.px(3, hy + 4, P.rockLight);
      p.px(8, hy + 4, P.rockLight);
      break;
    case 'coach':
      p.hline(3, hy + 1, 6, P.white);
      p.vline(6, bodyTop, 4, P.white);
      break;
    case 'sogra':
      for (let x = 4; x < 8; x++) p.px(x, bodyTop, P.white);
      break;
    case 'engenheiro':
      p.rect(3, hy - 1, 6, 2, P.yellow);
      p.hline(2, hy + 1, 8, P.yellow);
      p.hline(3, bodyTop + 2, 6, P.yellow);
      break;
    case 'crianca':
      p.rect(3, hy - 1, 6, 2, P.blue);
      p.hline(7, hy + 1, 3, P.blue);
      break;
    case 'religioso':
      p.hline(3, bodyTop + 3, 6, P.dirt);
      p.rect(10, bodyTop + 2, 2, 3, P.redDark);
      break;
  }
}

function mix(a: number, b: number): number {
  const r = (((a >> 16) & 255) + ((b >> 16) & 255)) >> 1;
  const g = (((a >> 8) & 255) + ((b >> 8) & 255)) >> 1;
  const bl = ((a & 255) + (b & 255)) >> 1;
  return (r << 16) | (g << 8) | bl;
}
