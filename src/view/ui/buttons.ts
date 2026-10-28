// Botões e textos básicos desenhados dentro do Phaser.

import Phaser from 'phaser';
import { audio } from '../audio/sfx';
import { hex, P } from '../art/palette';
import { store } from '../store';

export const FONT = "'VT323', monospace";
export const TITLE_FONT = "'Press Start 2P', monospace";
/** Área mínima de toque em pixels do jogo (≈ 44px de tela em celular). */
export const MIN_TOUCH = 40;

export function fontSize(base: number): number {
  return Math.round(base * (store.settings.bigText ? 1.25 : 1));
}

export function txt(
  scene: Phaser.Scene, x: number, y: number, str: string, size = 16, color: number = P.paper,
  opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> & { wrap?: number; title?: boolean } = {},
): Phaser.GameObjects.Text {
  const { wrap, title, ...rest } = opts;
  const t = scene.add.text(x, y, str, {
    fontFamily: title ? TITLE_FONT : FONT,
    fontSize: `${title ? size : fontSize(size)}px`,
    color: hex(color),
    lineSpacing: title ? 6 : 0,
    ...(wrap ? { wordWrap: { width: wrap, useAdvancedWrap: true } } : {}),
    ...rest,
  });
  return t;
}

export type ButtonStyle = 'normal' | 'primary' | 'danger' | 'ghost' | 'dark';

const STYLE: Record<ButtonStyle, { fill: number; line: number; text: number; hi: number }> = {
  normal: { fill: P.shadow, line: P.ink, text: P.paper, hi: P.dusk },
  primary: { fill: P.orangeDark, line: P.ink, text: P.white, hi: P.orange },
  danger: { fill: P.redDark, line: P.ink, text: P.white, hi: P.red },
  ghost: { fill: P.night, line: P.shadow, text: P.paperDark, hi: P.shadow },
  dark: { fill: P.ink, line: P.shadow, text: P.paper, hi: P.night },
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

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  label?: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  private _selected = false;
  private _disabled = false;
  private styleName: ButtonStyle;
  private hit: Phaser.GameObjects.Zone;

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
      const iconY = opts.label && !left ? h / 2 - 7 : h / 2;
      this.icon = scene.add.image(iconX, iconY, opts.icon).setScale(sc);
      this.add(this.icon);
      if (left) cx = 12 + 10 * sc;
    }
    if (opts.label) {
      const ly = opts.icon && !left ? h - 9 : opts.sub ? h / 2 - 6 : h / 2;
      this.label = txt(scene, cx, ly, opts.label, opts.size ?? (opts.icon && !left ? 13 : 16), STYLE[this.styleName].text).setOrigin(left ? 0 : 0.5, 0.5);
      this.add(this.label);
    }
    if (opts.sub) {
      this.sub = txt(scene, cx, h / 2 + 7, opts.sub, 13, P.paperDark).setOrigin(left ? 0 : 0.5, 0.5);
      this.add(this.sub);
    }
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
    g.clear();
    const fill = this._disabled ? P.night : pressed || this._selected ? st.hi : st.fill;
    g.fillStyle(st.line);
    g.fillRect(0, 0, this.w, this.h);
    g.fillStyle(fill);
    g.fillRect(1, 1, this.w - 2, this.h - 2);
    if (!pressed) {
      g.fillStyle(0xffffff, 0.08);
      g.fillRect(1, 1, this.w - 2, 2);
      g.fillStyle(0x000000, 0.25);
      g.fillRect(1, this.h - 3, this.w - 2, 2);
    }
    if (this._selected) {
      g.lineStyle(1, P.yellow);
      g.strokeRect(1.5, 1.5, this.w - 3, this.h - 3);
    }
    this.label?.setAlpha(this._disabled ? 0.45 : 1);
    this.icon?.setAlpha(this._disabled ? 0.45 : 1);
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
    this.label?.setText(s);
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

export function drawPanel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number = P.night, alpha = 1): void {
  g.fillStyle(P.ink, alpha);
  g.fillRect(x, y, w, h);
  g.fillStyle(fill, alpha);
  g.fillRect(x + 2, y + 2, w - 4, h - 4);
  g.fillStyle(0xffffff, 0.06 * alpha);
  g.fillRect(x + 2, y + 2, w - 4, 1);
}
