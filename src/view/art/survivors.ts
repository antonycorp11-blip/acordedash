// Sobreviventes em estilo chibi: cabeça grande, rosto limpo (olhos em ponto
// com brilho), cabelo sob o capacete, roupa com gola, cinto e botas. Cada
// arquétipo tem figurino próprio. Desenhados em alta resolução (PERSON_RES).

import Phaser from 'phaser';
import type { Archetype } from '../../core/state';
import { box, circle, css, ellipse, hdTexture, light, line, mix, vgrad, type Ctx } from './hd';
import { HAIR, SKIN } from './palette';

export type Expression = 'ok' | 'feliz' | 'medo' | 'raiva' | 'doente';
/** Tamanho em unidades do mundo. */
export const PERSON_W = 16;
export const PERSON_H = 22;
/** Texels por unidade: o personagem aparece grande no zoom, então vai em resolução maior. */
export const PERSON_RES = 8;
const INK = 0x1e1614;
const LW = 0.42;

interface Outfit {
  shirt: number;
  pants: number;
  hat: 'capacete' | 'bone' | 'faixa' | 'touca' | 'nenhum';
  hatColor: number;
}

const OUTFIT: Record<Archetype | 'viajante', Outfit> = {
  viajante: { shirt: 0xd9822b, pants: 0x3a4a62, hat: 'capacete', hatColor: 0xf6c437 },
  engenheiro: { shirt: 0x3a6ab0, pants: 0x2e4a7a, hat: 'capacete', hatColor: 0xf08a2a },
  coach: { shirt: 0xd8433a, pants: 0xd8433a, hat: 'faixa', hatColor: 0xffffff },
  sogra: { shirt: 0x8a52a8, pants: 0x4a3a5a, hat: 'nenhum', hatColor: 0 },
  crianca: { shirt: 0xf4c84a, pants: 0x4a7a3a, hat: 'bone', hatColor: 0x4aa05a },
  religioso: { shirt: 0xeee6d4, pants: 0xeee6d4, hat: 'nenhum', hatColor: 0 },
  hipocondriaco: { shirt: 0x6ab8a8, pants: 0x5aa898, hat: 'touca', hatColor: 0x9ad8cc },
};

/** Quadro: 0 e 1 andando, 2 gesticulando. */
export function personKey(scene: Phaser.Scene, look: number, arch: Archetype | 'viajante', expr: Expression, frame: number): string {
  return hdTexture(scene, `ch2_${look}_${arch}_${expr}_${frame}`, PERSON_W, PERSON_H, (c) => draw(c, look, arch, expr, frame), PERSON_RES);
}

function stroke(c: Ctx, w = LW): void {
  c.strokeStyle = css(INK);
  c.lineWidth = w;
  c.stroke();
}

function fillShade(c: Ctx, base: number, y0: number, y1: number): void {
  c.fillStyle = vgrad(c, y0, y1, [[0, light(base, 0.18)], [1, light(base, -0.22)]]);
  c.fill();
}

function draw(c: Ctx, look: number, arch: Archetype | 'viajante', expr: Expression, frame: number): void {
  const o = OUTFIT[arch];
  const child = arch === 'crianca';
  if (child) {
    c.translate(8, PERSON_H);
    c.scale(0.86, 0.86);
    c.translate(-8, -PERSON_H);
  }
  let skin = SKIN[Math.abs(look) % SKIN.length];
  if (expr === 'doente') skin = mix(skin, 0xa8d070, 0.4);
  const hair = arch === 'sogra' ? 0xd0d0d4 : arch === 'religioso' ? 0x6a5a4a : arch === 'coach' ? 0x3a2418 : HAIR[Math.abs(look >> 3) % HAIR.length];
  const step = frame === 1 ? 0.7 : frame === 0 ? -0.35 : 0;
  const robe = arch === 'religioso';

  // Pernas e botas.
  if (!robe) {
    for (const [lx, d] of [[5.7, step], [8.5, -step]] as [number, number][]) {
      c.beginPath();
      c.roundRect(lx + d, 16, 2.4, 4.6, 0.6);
      fillShade(c, o.pants, 16, 21);
      stroke(c);
    }
  }
  for (const [bx, d] of [[5.1, step], [8.3, -step]] as [number, number][]) {
    c.beginPath();
    c.roundRect(bx + d, 19.9, 3.3, 1.9, [0.9, 1.2, 0.5, 0.5]);
    fillShade(c, 0x4a3226, 19.9, 21.8);
    stroke(c);
    line(c, [[bx + d + 0.5, 20.4], [bx + d + 2.6, 20.4]], 0x7a5a44, 0.25);
  }

  // Tronco.
  c.beginPath();
  if (robe) {
    c.moveTo(5.2, 11.4);
    c.quadraticCurveTo(8, 10.6, 10.8, 11.4);
    c.lineTo(11.8, 20.4);
    c.quadraticCurveTo(8, 21, 4.2, 20.4);
    c.closePath();
  } else c.roundRect(4.9, 11, 6.2, 5.9, [2, 2, 0.8, 0.8]);
  fillShade(c, o.shirt, 11, robe ? 20.5 : 17);
  stroke(c);
  // Gola em V.
  c.beginPath();
  c.moveTo(6.7, 11.2);
  c.lineTo(8, 12.8);
  c.lineTo(9.3, 11.2);
  c.fillStyle = css(arch === 'hipocondriaco' ? light(o.shirt, -0.2) : skin);
  c.fill();
  stroke(c, 0.3);
  costume(c, arch, o);

  // Braços (no gesto, um sobe acenando).
  arm(c, 4.9, 11.6, 0.18, o.shirt, skin);
  if (frame === 2) arm(c, 11.1, 11.6, -2.5, o.shirt, skin);
  else arm(c, 11.1, 11.6, -0.18, o.shirt, skin);

  // Cabeça.
  head(c, skin, hair, arch, expr, look, o);
}

function arm(c: Ctx, x: number, y: number, ang: number, shirt: number, skin: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.roundRect(-1, 0, 2, 3.2, 0.9);
  fillShade(c, shirt, 0, 3.2);
  stroke(c);
  c.beginPath();
  c.roundRect(-0.85, 2.8, 1.7, 1.9, 0.8);
  c.fillStyle = css(skin);
  c.fill();
  stroke(c);
  c.restore();
}

function costume(c: Ctx, arch: Archetype | 'viajante', o: Outfit): void {
  switch (arch) {
    case 'viajante':
      // Faixas refletivas e cinto de ferramentas.
      line(c, [[5.6, 13.4], [10.4, 13.4]], 0xf2f0ea, 0.45);
      line(c, [[5.6, 13.4], [10.4, 13.4]], 0xc8c8c8, 0.15);
      belt(c, 0x5a3a24);
      box(c, 9.2, 15.8, 1.5, 1.4, 0x7a5232, 0.3, INK, 0.25);
      break;
    case 'engenheiro':
      // Macacão com alças e chave inglesa no bolso.
      line(c, [[6.3, 11.3], [6.3, 16.5]], light(o.shirt, -0.3), 0.5);
      line(c, [[9.7, 11.3], [9.7, 16.5]], light(o.shirt, -0.3), 0.5);
      box(c, 6.6, 13.8, 2.8, 2, light(o.shirt, -0.12), 0.3, INK, 0.25);
      line(c, [[10.4, 14.2], [10.9, 16.6]], 0xb8bcc8, 0.45);
      break;
    case 'coach':
      line(c, [[5.4, 11.8], [5.4, 16.6]], 0xffffff, 0.35);
      line(c, [[10.6, 11.8], [10.6, 16.6]], 0xffffff, 0.35);
      box(c, 7.2, 13.4, 1.6, 0.9, 0xf4c84a, 0.2, INK, 0.2);
      break;
    case 'sogra':
      for (let x = 6.4; x <= 9.7; x += 0.82) circle(c, x, 12.3 + Math.abs(x - 8) * 0.25, 0.32, 0xfaf6ee, INK, 0.12);
      box(c, 7.6, 14, 0.8, 2.6, light(o.shirt, -0.25), 0.2, null);
      break;
    case 'crianca':
      line(c, [[5.2, 14], [10.8, 14]], 0xe0573a, 0.6);
      break;
    case 'religioso':
      line(c, [[4.9, 15.4], [11.1, 15.4]], 0x8a5a32, 0.55);
      line(c, [[9.6, 15.4], [10, 18]], 0x8a5a32, 0.4);
      box(c, 7.4, 12.6, 1.2, 1.6, 0xb08a3a, 0.2, INK, 0.2);
      break;
    case 'hipocondriaco':
      box(c, 9, 12.6, 1.6, 1.4, light(o.shirt, -0.15), 0.2, INK, 0.2);
      line(c, [[6, 12], [6.4, 15]], 0x8a8f9c, 0.3);
      circle(c, 6.4, 15.2, 0.5, 0xb8bcc8, INK, 0.2);
      break;
  }
}

function belt(c: Ctx, color: number): void {
  box(c, 4.95, 15.9, 6.1, 1, color, 0.2, INK, 0.25);
  box(c, 7.5, 15.85, 1, 1.1, 0xd0b060, 0.15, INK, 0.2);
}

function head(c: Ctx, skin: number, hair: number, arch: Archetype | 'viajante', expr: Expression, look: number, o: Outfit): void {
  const hx = 8;
  const hy = 6.6;
  // Cabelo de trás (aparece em volta da cabeça).
  if (arch === 'sogra') {
    circle(c, hx, hy - 4.6, 1.9, hair, INK, LW);
  }
  if (o.hat !== 'faixa' && arch !== 'religioso') {
    c.beginPath();
    c.ellipse(hx, hy - 0.3, 4.95, 4.65, 0, Math.PI * 0.95, Math.PI * 2.05);
    c.fillStyle = css(hair);
    c.fill();
    stroke(c);
  }
  // Pescoço e orelhas.
  box(c, hx - 1, hy + 3.4, 2, 1.4, light(skin, -0.15), 0.3, null);
  circle(c, hx - 4.6, hy + 0.7, 0.85, skin, INK, LW);
  circle(c, hx + 4.6, hy + 0.7, 0.85, skin, INK, LW);
  // Rosto.
  c.beginPath();
  c.ellipse(hx, hy + 0.5, 4.5, 4.2, 0, 0, Math.PI * 2);
  const g = c.createRadialGradient(hx - 1.4, hy - 1, 0.5, hx, hy + 0.5, 5);
  g.addColorStop(0, css(light(skin, 0.12)));
  g.addColorStop(1, css(light(skin, -0.12)));
  c.fillStyle = g;
  c.fill();
  stroke(c);
  // Franja / cabelo da frente.
  hairFront(c, arch, hair, hx, hy, look, o);
  face(c, expr, hx, hy + 0.9, arch);
  hat(c, o, hx, hy);
  if (arch === 'religioso') {
    // Barba.
    c.beginPath();
    c.ellipse(hx, hy + 3.4, 3.2, 1.9, 0, 0, Math.PI);
    c.fillStyle = css(hair);
    c.fill();
    stroke(c, 0.3);
  }
}

function hairFront(c: Ctx, arch: Archetype | 'viajante', hair: number, hx: number, hy: number, look: number, o: Outfit): void {
  if (arch === 'religioso') return;
  if (o.hat === 'faixa') {
    // Topete arrepiado do coach (tufos arredondados).
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.ellipse(hx - 2.7 + i * 1.8, hy - 3.2 - (i % 2) * 0.5, 1.4, 1.9, (i - 1.5) * 0.35, 0, Math.PI * 2);
      c.fillStyle = css(hair);
      c.fill();
      stroke(c, 0.3);
    }
    return;
  }
  if (o.hat === 'nenhum') {
    // Franja de lado.
    c.beginPath();
    c.moveTo(hx - 4.4, hy - 0.4);
    c.quadraticCurveTo(hx - 2, hy - 4.6, hx + 4.4, hy - 1.4);
    c.quadraticCurveTo(hx + 1, hy - 2.2, hx - 4.4, hy - 0.4);
    c.fillStyle = css(hair);
    c.fill();
    stroke(c, 0.3);
    return;
  }
  // Mechas saindo do capacete.
  const s = Math.abs(look >> 6) % 3;
  c.fillStyle = css(hair);
  for (const [x, w] of [[hx - 3.8, 1.3], [hx + 3, 1.2], ...(s ? [[hx - 1.6, 1.1]] as [number, number][] : [])] as [number, number][]) {
    c.beginPath();
    c.ellipse(x + w / 2, hy - 1.2, w, 1.1, 0.2, 0, Math.PI * 2);
    c.fill();
  }
}

function face(c: Ctx, expr: Expression, hx: number, fy: number, arch: Archetype | 'viajante'): void {
  const ex = 1.75;
  const ey = fy;
  // Bochechas.
  if (expr !== 'doente') {
    ellipse(c, hx - 2.8, ey + 1.3, 0.85, 0.5, css(0xf08a7a, 0.45));
    ellipse(c, hx + 2.8, ey + 1.3, 0.85, 0.5, css(0xf08a7a, 0.45));
  }
  // Olhos.
  for (const s of [-1, 1]) {
    const x = hx + s * ex;
    if (expr === 'feliz') {
      c.beginPath();
      c.arc(x, ey + 0.3, 0.7, Math.PI * 1.1, Math.PI * 1.9);
      stroke(c, 0.4);
    } else if (expr === 'medo') {
      ellipse(c, x, ey, 0.8, 0.95, css(0xffffff), INK, 0.25);
      circle(c, x, ey + 0.15, 0.4, INK, null);
    } else if (expr === 'doente') {
      ellipse(c, x, ey + 0.15, 0.55, 0.35, css(INK));
    } else {
      ellipse(c, x, ey, 0.5, 0.72, css(INK));
      circle(c, x + 0.18, ey - 0.25, 0.18, 0xffffff, null);
    }
  }
  // Sobrancelhas.
  const brow = (s: number, tilt: number, lift: number) => line(c, [[hx + s * (ex - 0.7), ey - 1.35 - lift + tilt], [hx + s * (ex + 0.6), ey - 1.35 - lift - tilt]], INK, 0.32);
  if (expr === 'raiva') {
    brow(-1, -0.35, 0);
    brow(1, -0.35, 0);
  } else if (expr === 'medo') {
    brow(-1, 0.3, 0.3);
    brow(1, 0.3, 0.3);
  } else if (arch !== 'hipocondriaco') {
    brow(-1, 0, 0);
    brow(1, 0, 0);
  }
  // Nariz.
  c.beginPath();
  c.arc(hx, ey + 0.95, 0.35, 0.2 * Math.PI, 0.8 * Math.PI);
  c.strokeStyle = css(0x8a5a44, 0.8);
  c.lineWidth = 0.25;
  c.stroke();
  // Boca.
  const my = ey + 2;
  if (arch === 'hipocondriaco') {
    // Máscara cirúrgica.
    c.beginPath();
    c.roundRect(hx - 2.6, ey + 0.9, 5.2, 2.4, 0.9);
    c.fillStyle = css(0xeef6f8);
    c.fill();
    stroke(c, 0.3);
    line(c, [[hx - 2.6, ey + 1.6], [hx - 4.2, ey + 0.4]], 0xc8d0d4, 0.2);
    line(c, [[hx + 2.6, ey + 1.6], [hx + 4.2, ey + 0.4]], 0xc8d0d4, 0.2);
    return;
  }
  c.beginPath();
  if (expr === 'feliz') {
    c.moveTo(hx - 1.1, my - 0.3);
    c.quadraticCurveTo(hx, my + 1.3, hx + 1.1, my - 0.3);
    c.closePath();
    c.fillStyle = css(0x8a2a2a);
    c.fill();
    stroke(c, 0.3);
  } else if (expr === 'medo') {
    c.ellipse(hx, my + 0.1, 0.55, 0.7, 0, 0, Math.PI * 2);
    c.fillStyle = css(0x5a1e1e);
    c.fill();
    stroke(c, 0.28);
  } else if (expr === 'raiva' || expr === 'doente') {
    c.moveTo(hx - 0.9, my + 0.4);
    c.quadraticCurveTo(hx, my - 0.3, hx + 0.9, my + 0.4);
    stroke(c, 0.32);
  } else {
    c.moveTo(hx - 0.8, my);
    c.quadraticCurveTo(hx, my + 0.6, hx + 0.8, my);
    stroke(c, 0.32);
  }
  if (arch === 'sogra') {
    // Óculos.
    c.beginPath();
    c.arc(hx - ex, ey, 1.05, 0, Math.PI * 2);
    c.moveTo(hx + ex + 1.05, ey);
    c.arc(hx + ex, ey, 1.05, 0, Math.PI * 2);
    c.moveTo(hx - ex + 1.05, ey);
    c.lineTo(hx + ex - 1.05, ey);
    c.strokeStyle = css(0x7a5a2a);
    c.lineWidth = 0.28;
    c.stroke();
  }
  if (arch === 'crianca') for (const s of [-1, 1]) for (let k = 0; k < 3; k++) circle(c, hx + s * (2.4 + k * 0.4), ey + 1 + (k % 2) * 0.3, 0.12, 0x9a5a3a, null);
  if (expr === 'doente') ellipse(c, hx + 3.2, fy - 2, 0.4, 0.65, css(0x8ad0ff), INK, 0.15);
}

function hat(c: Ctx, o: Outfit, hx: number, hy: number): void {
  if (o.hat === 'nenhum') return;
  if (o.hat === 'faixa') {
    c.beginPath();
    c.roundRect(hx - 4.5, hy - 2.2, 9, 1.3, 0.5);
    c.fillStyle = css(o.hatColor);
    c.fill();
    stroke(c, 0.3);
    line(c, [[hx - 4.5, hy - 1.55], [hx + 4.5, hy - 1.55]], 0xe0573a, 0.3);
    return;
  }
  if (o.hat === 'touca') {
    c.beginPath();
    c.ellipse(hx, hy - 1.4, 4.7, 3.5, 0, Math.PI, Math.PI * 2);
    c.closePath();
    fillShade(c, o.hatColor, hy - 5, hy - 1);
    stroke(c);
    return;
  }
  if (o.hat === 'bone') {
    c.beginPath();
    c.ellipse(hx, hy - 1.1, 4.7, 4, 0, Math.PI, Math.PI * 2);
    c.closePath();
    fillShade(c, o.hatColor, hy - 5, hy - 1);
    stroke(c);
    c.beginPath();
    c.ellipse(hx + 3.4, hy - 1.1, 2.8, 0.8, 0, 0, Math.PI * 2);
    c.fillStyle = css(light(o.hatColor, -0.2));
    c.fill();
    stroke(c, 0.3);
    circle(c, hx, hy - 5, 0.45, light(o.hatColor, -0.2), INK, 0.2);
    return;
  }
  // Capacete de obra: cúpula, aba larga, friso central e brilho.
  c.beginPath();
  c.ellipse(hx, hy - 1.2, 4.8, 4.6, 0, Math.PI, Math.PI * 2);
  c.closePath();
  c.fillStyle = vgrad(c, hy - 6, hy - 1, [[0, light(o.hatColor, 0.35)], [1, light(o.hatColor, -0.12)]]);
  c.fill();
  stroke(c);
  c.beginPath();
  c.moveTo(hx - 1, hy - 5.7);
  c.lineTo(hx + 1, hy - 5.7);
  c.lineTo(hx + 0.9, hy - 1.3);
  c.lineTo(hx - 0.9, hy - 1.3);
  c.closePath();
  c.fillStyle = css(light(o.hatColor, -0.18));
  c.fill();
  c.beginPath();
  c.ellipse(hx, hy - 1.15, 6, 0.95, 0, 0, Math.PI * 2);
  c.fillStyle = vgrad(c, hy - 2, hy, [[0, light(o.hatColor, 0.1)], [1, light(o.hatColor, -0.25)]]);
  c.fill();
  stroke(c);
  ellipse(c, hx - 2.3, hy - 4, 1.3, 0.55, css(0xffffff, 0.55));
}

/** Balão de humor acima da cabeça. */
export function bubbleKey(scene: Phaser.Scene, kind: 'feliz' | 'triste' | 'doente' | 'zz' | 'alerta'): string {
  return hdTexture(scene, `bub2_${kind}`, 10, 11, (c) => {
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
    if (kind === 'zz' || kind === 'alerta') {
      c.fillStyle = css(kind === 'zz' ? 0x3a4a8a : 0xe0573a);
      c.font = `bold ${kind === 'zz' ? 4.4 : 6}px 'Fredoka', sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(kind === 'zz' ? 'zz' : '!', 5, 5.1);
      return;
    }
    const col = kind === 'feliz' ? 0x6abf5a : kind === 'doente' ? 0x9ad06a : 0xf4c84a;
    circle(c, 5, 4.8, 3, col, INK, 0.4);
    ellipse(c, 4, 3.6, 1, 0.5, css(0xffffff, 0.4));
    circle(c, 3.9, 4.3, 0.45, INK, null);
    circle(c, 6.1, 4.3, 0.45, INK, null);
    c.beginPath();
    if (kind === 'feliz') c.arc(5, 5, 1.4, 0.15 * Math.PI, 0.85 * Math.PI);
    else c.arc(5, 7.3, 1.3, 1.2 * Math.PI, 1.8 * Math.PI);
    c.strokeStyle = css(INK);
    c.lineWidth = 0.4;
    c.stroke();
  }, 8);
}
