// Botões, painéis e textos básicos desenhados dentro do Phaser.

import Phaser from 'phaser';
import { audio } from '../audio/sfx';
import { hex, P } from '../art/palette';
import { store } from '../store';

/** Fonte de interface (legível em tamanho pequeno). */
export const FONT = "'Pixelify Sans', monospace";
/** Fonte dos textos narrativos (diário, eventos, legista). */
export const BODY_FONT = "'VT323', monospace";
/** O jogo é desenhado em 640×360, mas renderizado em 1280×720 (câmera 2×) para texto nítido. */
export const UI_ZOOM = 2;
/** Área mínima de toque em pixels do jogo (≈ 44px de tela em celular). */
export const MIN_TOUCH = 40;

/** Liga a câmera 2× de uma cena (chamar no começo de cada `create`). */
export function hiRes(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(UI_ZOOM).centerOn(320, 180);
}

/** Posição do ponteiro no espaço 640×360 do jogo. */
export function ptr(p: { x: number; y: number }): { x: number; y: number } {
  return { x: p.x / UI_ZOOM, y: p.y / UI_ZOOM };
}

export function fontSize(base: number): number {
  return Math.round(base * (store.settings.bigText ? 1.2 : 1));
}

export function txt(
  scene: Phaser.Scene, x: number, y: number, str: string, size = 16, color: number = P.paper,
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { wrap?: number; title?: boolean; body?: boolean } = {},
): Phaser.GameObjects.Text {
  const { wrap, title, body, ...rest } = opts;
  // Os tamanhos do código foram pensados para a VT323; a Pixelify é mais larga.
  const px = body ? fontSize(size) : Math.round(fontSize(size) * (title ? 0.85 : 0.74));
  const t = scene.add.text(x, y, str, {
    fontFamily: body ? BODY_FONT : FONT,
    fontSize: `${px}px`,
    fontStyle: title ? '700' : '400',
    color: hex(color),
    resolution: UI_ZOOM,
    lineSpacing: body ? 0 : 2,
    ...(wrap ? { wordWrap: { width: wrap, useAdvancedWrap: true } } : {}),
    ...rest,
  });
  return t;
}

export type ButtonStyle = 'normal' | 'primary' | 'danger' | 'ghost' | 'dark';

const STYLE: Record<ButtonStyle, { fill: number; top: number; bottom: number; text: number; hi: number }> = {
  normal: { fill: 0x2e2540, top: 0x4a3d63, bottom: 0x1a1426, text: P.paper, hi: 0x3d3152 },
  primary: { fill: 0xc4622b, top: 0xf0974f, bottom: 0x7a3417, text: P.white, hi: 0xd8743a },
  danger: { fill: 0x9b3330, top: 0xd0574d, bottom: 0x581b1c, text: P.white, hi: 0xb0403a },
  ghost: { fill: 0x1e1829, top: 0x2e2540, bottom: 0x120e1a, text: P.paperDark, hi: 0x2a2238 },
  dark: { fill: 0x16111f, top: 0x2a2238, bottom: 0x0b0810, text: P.paper, hi: 0x221a2e },
};

export interface ButtonOpts {
  label?: string;
  icon?: string;
  style?: ButtonStyle;
  size?: number;
  /** subtítulo pequeno embaixo do rótulo */
  sub?: string;
  iconScale?: number;
  align?: 'center' | 'left';
}

/** Retângulo com cantos chanfrados de 1 pixel (visual de pixel art). */
export function bevelRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillRect(x + 1, y, w - 2, h);
  g.fillRect(x, y + 1, w, h - 2);
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  private _selected = false;
  private _disabled = false;
  private styleName: ButtonStyle;
  private hit: Phaser.GameObjects.Zone;
  private content: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, public w: number, public h: number, opts: ButtonOpts, onClick: () => void) {
    super(scene, x, y);
    this.styleName = opts.style ?? 'normal';
    this.bg = scene.add.graphics();
    this.add(this.bg);
    const left = opts.align === 'left';
    let cx = left ? 8 : w / 2;
    if (opts.icon) {
      const sc = opts.iconScale ?? 2;
      const iconX = opts.label ? (left ? 6 + 5 * sc : w / 2) : w / 2;
      const iconY = opts.label && !left ? h / 2 - 6 : h / 2;
      this.icon = scene.add.image(Math.round(iconX), Math.round(iconY), opts.icon).setScale(sc);
      this.add(this.icon);
      if (left) cx = 12 + 10 * sc;
    }
    if (opts.label) {
      const ly = opts.icon && !left ? h - 8 : opts.sub ? h / 2 - 6 : h / 2;
      this.label = txt(scene, cx, ly, opts.label, opts.size ?? (opts.icon && !left ? 13 : 16), STYLE[this.styleName].text).setOrigin(left ? 0 : 0.5, 0.5);
      this.add(this.label);
    }
    if (opts.sub) {
      this.sub = txt(scene, cx, h / 2 + 7, opts.sub, 13, this.styleName === 'primary' ? P.paper : P.paperDark).setOrigin(left ? 0 : 0.5, 0.5);
      this.add(this.sub);
    }
    this.content = [this.icon, this.label, this.sub].filter((o): o is NonNullable<typeof o> => !!o);
    this.draw(false);
    // Área de toque generosa, mesmo quando o desenho é menor. Uma zona filha
    // centrada no botão evita o deslocamento de origem dos containers.
    const hw = Math.max(w, MIN_TOUCH);
    const hh = Math.max(h, MIN_TOUCH);
    this.setSize(w, h);
    this.hit = scene.add.zone(w / 2, h / 2, hw, hh).setInteractive();
    this.add(this.hit);
    this.hit.on('pointerdown', () => {
      if (this._disabled) return;
      this.draw(true);
    });
    this.hit.on('pointerout', () => this.draw(false));
    this.hit.on('pointerup', () => {
      this.draw(false);
      if (this._disabled) {
        audio.play('error');
        return;
      }
      audio.play('click');
      onClick();
    });
    scene.add.existing(this);
  }

  private draw(pressed: boolean): void {
    const st = STYLE[this.styleName];
    const g = this.bg;
    const w = this.w;
    const h = this.h;
    g.clear();
    const dis = this._disabled;
    const fill = dis ? 0x1c1724 : pressed || this._selected ? st.hi : st.fill;
    // Contorno, sombra de base e brilho de topo.
    bevelRect(g, 0, 0, w, h, P.ink);
    bevelRect(g, 1, 1, w - 2, h - 2, dis ? 0x120e18 : st.bottom);
    bevelRect(g, 1, 1, w - 2, h - (pressed ? 2 : 4), fill);
    if (!pressed && !dis) {
      g.fillStyle(st.top);
      g.fillRect(2, 1, w - 4, 1);
      g.fillStyle(0xffffff, 0.05);
      g.fillRect(2, 2, w - 4, Math.floor((h - 6) / 2));
    }
    if (this._selected) {
      g.lineStyle(1, P.yellow);
      g.strokeRect(1.5, 1.5, w - 3, h - 4);
    }
    const dy = pressed ? 1 : 0;
    for (const o of this.content) {
      const obj = o as Phaser.GameObjects.Image & { baseY?: number };
      obj.baseY ??= obj.y;
      obj.y = obj.baseY + dy;
      obj.setAlpha(dis ? 0.4 : 1);
    }
  }

  setSelected(v: boolean): this {
    if (v !== this._selected) {
      this._selected = v;
      this.draw(false);
    }
    return this;
  }

  setDisabled(v: boolean): this {
    if (v !== this._disabled) {
      this._disabled = v;
      this.draw(false);
    }
    return this;
  }

  setLabel(s: string): this {
    if (this.label && this.label.text !== s) this.label.setText(s);
    return this;
  }

  setIcon(key: string): this {
    this.icon?.setTexture(key);
    return this;
  }
}

/** Painel com borda pixelada. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill: number = P.night, alpha = 1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h, fill, alpha);
  return g;
}

/** Painel: contorno escuro, borda clara interna, fundo e sombra embaixo. */
export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number = P.night, alpha = 1): void {
  bevelRect(g, x, y, w, h, P.ink, alpha);
  bevelRect(g, x + 1, y + 1, w - 2, h - 2, 0x3d3152, alpha);
  bevelRect(g, x + 2, y + 2, w - 4, h - 4, fill, alpha);
  g.fillStyle(0xffffff, 0.04 * alpha);
  g.fillRect(x + 2, y + 2, w - 4, 1);
}
