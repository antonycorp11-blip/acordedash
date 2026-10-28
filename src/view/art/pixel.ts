// Ferramenta de desenho pixel a pixel sobre canvas. Toda textura do jogo nasce aqui.

import Phaser from 'phaser';
import { rand } from '../../core/rng';
import { hex } from './palette';

export class Pix {
  constructor(public ctx: CanvasRenderingContext2D, public w: number, public h: number) {
    ctx.imageSmoothingEnabled = false;
  }

  px(x: number, y: number, c: number, a = 1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.ctx.globalAlpha = a;
    this.ctx.fillStyle = hex(c);
    this.ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    this.ctx.globalAlpha = 1;
  }

  rect(x: number, y: number, w: number, h: number, c: number, a = 1): void {
    this.ctx.globalAlpha = a;
    this.ctx.fillStyle = hex(c);
    this.ctx.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));
    this.ctx.globalAlpha = 1;
  }

  /** Retângulo com contorno de 1 pixel. */
  box(x: number, y: number, w: number, h: number, fill: number, line: number): void {
    this.rect(x, y, w, h, line);
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
  }

  hline(x: number, y: number, w: number, c: number): void {
    this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: number): void {
    this.rect(x, y, 1, h, c);
  }

  circle(cx: number, cy: number, r: number, c: number): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.px(cx + x, cy + y, c);
  }

  /** Pontilhado aleatório com semente: textura de terra, rocha, poeira. */
  speckle(x: number, y: number, w: number, h: number, colors: number[], density: number, seed: number): void {
    const s = { rng: seed };
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (rand(s) < density) this.px(xx, yy, colors[Math.floor(rand(s) * colors.length)]);
  }

  /** Desenha um mapa de caracteres: cada letra vira uma cor da legenda. */
  map(rows: string[], legend: Record<string, number>, ox = 0, oy = 0): void {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = legend[row[x]];
        if (c !== undefined) this.px(ox + x, oy + y, c);
      }
    });
  }
}

/** Cria (uma vez) uma textura de canvas e devolve a chave. */
export function makeTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (p: Pix) => void): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return key;
  draw(new Pix(tex.getContext(), w, h));
  tex.refresh();
  return key;
}

/** Contorno de 1 pixel em volta de tudo que não é transparente. */
export function outlineCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, color: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  const mark: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push(y * w + x);
    }
  }
  const r = (color >> 16) & 255;
  const g = (color >> 8) & 255;
  const b = color & 255;
  for (const i of mark) {
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** Gradiente radial suave (luz). Branco no centro, transparente na borda. */
export function lightTexture(scene: Phaser.Scene, key: string, size: number, color = 0xffffff): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  const c = hex(color);
  grd.addColorStop(0, c + 'ff');
  grd.addColorStop(0.45, c + 'b0');
  grd.addColorStop(1, c + '00');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
}
