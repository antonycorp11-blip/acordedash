// Desenho vetorial em alta resolução sobre canvas. As texturas são criadas em
// RES texels por unidade do mundo e exibidas com escala 1/RES: o código de
// desenho trabalha em unidades do mundo (tile = 16) e sai nítido em qualquer zoom.

import Phaser from 'phaser';
import { rand } from '../../core/rng';

export const RES = 4;

export type Ctx = CanvasRenderingContext2D;

export function css(c: number, a = 1): string {
  const r = (c >> 16) & 255;
  const g = (c >> 8) & 255;
  const b = c & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

/** Mistura duas cores (t = 0 → a, 1 → b). */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function light(c: number, t: number): number {
  return t >= 0 ? mix(c, 0xffffff, t) : mix(c, 0x000000, -t);
}

/** Cria (uma vez) uma textura desenhada em unidades do mundo. */
export function hdTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, res = RES): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, Math.ceil(w * res), Math.ceil(h * res));
  if (!tex) return key;
  const c = tex.getContext();
  c.save();
  c.scale(res, res);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  c.restore();
  tex.refresh();
  return key;
}

/** Textura de canvas reutilizável (terreno, céu, luz), redesenhada quando muda. */
export function liveCanvas(scene: Phaser.Scene, key: string, w: number, h: number, res = RES): Phaser.Textures.CanvasTexture {
  const existing = scene.textures.exists(key) ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture) : null;
  if (existing && existing.width === Math.ceil(w * res) && existing.height === Math.ceil(h * res)) return existing;
  if (existing) scene.textures.remove(key);
  return scene.textures.createCanvas(key, Math.ceil(w * res), Math.ceil(h * res))!;
}

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rad, y);
  c.arcTo(x + w, y, x + w, y + h, rad);
  c.arcTo(x + w, y + h, x, y + h, rad);
  c.arcTo(x, y + h, x, y, rad);
  c.arcTo(x, y, x + w, y, rad);
  c.closePath();
}

/** Retângulo arredondado com contorno escuro (estilo cartum). */
export function box(c: Ctx, x: number, y: number, w: number, h: number, fill: number | CanvasGradient, r = 1, line: number | null = 0x14101c, lw = 0.6): void {
  rr(c, x, y, w, h, r);
  c.fillStyle = typeof fill === 'number' ? css(fill) : fill;
  c.fill();
  if (line != null) {
    c.strokeStyle = css(line);
    c.lineWidth = lw;
    c.stroke();
  }
}

export function vgrad(c: Ctx, y0: number, y1: number, stops: [number, number][]): CanvasGradient {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (const [t, col] of stops) g.addColorStop(t, css(col));
  return g;
}

export function hgrad(c: Ctx, x0: number, x1: number, stops: [number, number][]): CanvasGradient {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  for (const [t, col] of stops) g.addColorStop(t, css(col));
  return g;
}

export function circle(c: Ctx, x: number, y: number, r: number, fill: number, line: number | null = 0x14101c, lw = 0.6): void {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = css(fill);
  c.fill();
  if (line != null) {
    c.strokeStyle = css(line);
    c.lineWidth = lw;
    c.stroke();
  }
}

export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: number | string, line: number | null = null, lw = 0.6): void {
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fillStyle = typeof fill === 'number' ? css(fill) : fill;
  c.fill();
  if (line != null) {
    c.strokeStyle = css(line);
    c.lineWidth = lw;
    c.stroke();
  }
}

export function line(c: Ctx, pts: [number, number][], color: number, w = 0.6, alpha = 1): void {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.strokeStyle = css(color, alpha);
  c.lineWidth = w;
  c.stroke();
}

export function poly(c: Ctx, pts: [number, number][], fill: number | string | CanvasGradient, lineC: number | null = 0x14101c, lw = 0.6): void {
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  c.fillStyle = typeof fill === 'number' ? css(fill) : fill;
  c.fill();
  if (lineC != null) {
    c.strokeStyle = css(lineC);
    c.lineWidth = lw;
    c.stroke();
  }
}

/** Brilho radial (luz de lâmpada). */
export function glow(c: Ctx, x: number, y: number, r: number, color: number, alpha: number): void {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(color, alpha));
  g.addColorStop(1, css(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

export function seeded(seed: number): () => number {
  const s = { rng: seed | 0 };
  return () => rand(s);
}

/** Pedra arredondada irregular com brilho e sombra. */
export function stone(c: Ctx, x: number, y: number, rx: number, ry: number, base: number, seed: number): void {
  const r = seeded(seed);
  c.beginPath();
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 0.82 + r() * 0.22;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  const g = c.createLinearGradient(x - rx, y - ry, x + rx * 0.6, y + ry);
  g.addColorStop(0, css(light(base, 0.28)));
  g.addColorStop(0.55, css(base));
  g.addColorStop(1, css(light(base, -0.45)));
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = css(light(base, -0.65), 0.9);
  c.lineWidth = 0.5;
  c.stroke();
  ellipse(c, x - rx * 0.35, y - ry * 0.4, rx * 0.25, ry * 0.15, css(0xffffff, 0.18));
}
