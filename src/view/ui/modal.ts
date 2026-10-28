// Janela modal dentro de uma cena: escurece o fundo e bloqueia o toque atrás.

import Phaser from 'phaser';
import { P } from '../art/palette';
import { Button, drawPanel, txt, viewCenterX, VW, type ButtonStyle } from './buttons';

export interface ModalButton {
  label: string;
  style?: ButtonStyle;
  sub?: string;
  disabled?: boolean;
  onClick: () => void;
}

export class Modal {
  readonly root: Phaser.GameObjects.Container;
  readonly x: number;
  readonly y: number;

  constructor(scene: Phaser.Scene, public w: number, public h: number, title?: string, body?: string, buttons: ModalButton[] = [], depth = 200) {
    const mid = viewCenterX(scene);
    this.x = Math.round(mid - w / 2);
    this.y = Math.round((360 - h) / 2);
    this.root = scene.add.container(0, 0).setDepth(depth);
    const dim = scene.add.rectangle(mid - VW / 2 - 10, 0, VW + 20, 360, P.ink, 0.7).setOrigin(0, 0).setInteractive();
    const g = scene.add.graphics();
    drawPanel(g, this.x, this.y, w, h, P.night);
    this.root.add([dim, g]);
    let cy = this.y + 10;
    if (title) {
      this.root.add(txt(scene, this.x + w / 2, cy, title, 20, P.yellow).setOrigin(0.5, 0));
      cy += 26;
    }
    if (body) {
      const b = txt(scene, this.x + 14, cy, body, 16, P.paper, { wrap: w - 28 });
      this.root.add(b);
    }
    const bw = Math.min(200, (w - 20 - (buttons.length - 1) * 8) / Math.max(1, buttons.length));
    const total = buttons.length * bw + (buttons.length - 1) * 8;
    buttons.forEach((bt, i) => {
      const b = new Button(scene, this.x + (w - total) / 2 + i * (bw + 8), this.y + h - 46, bw, 38, { label: bt.label, style: bt.style, sub: bt.sub }, bt.onClick);
      if (bt.disabled) b.setDisabled(true);
      this.root.add(b);
    });
  }

  add(...objs: Phaser.GameObjects.GameObject[]): this {
    this.root.add(objs);
    return this;
  }

  close(): void {
    this.root.destroy(true);
  }
}

/** Confirmação simples sim/não. */
export function confirm(scene: Phaser.Scene, text: string, yes: string, no: string, onYes: () => void): Modal {
  const m = new Modal(scene, 360, 150, undefined, text, [
    { label: no, onClick: () => m.close() },
    { label: yes, style: 'danger', onClick: () => { m.close(); onYes(); } },
  ], 300);
  return m;
}
