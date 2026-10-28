// Intro: o diário do viajante, linha por linha. Pulável. Só aparece uma vez.

import Phaser from 'phaser';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { store } from '../store';
import { lines, t } from '../text';
import { Button, txt } from '../ui/buttons';
import { fadeIn, go } from './common';

export class Intro extends Phaser.Scene {
  private idx = 0;
  private shown: Phaser.GameObjects.Text[] = [];
  private typing?: Phaser.Time.TimerEvent;

  constructor() {
    super('Intro');
  }

  create(): void {
    fadeIn(this);
    this.idx = 0;
    this.shown = [];
    const g = this.add.graphics();
    g.fillStyle(P.paper);
    g.fillRect(60, 20, 520, 320);
    g.fillStyle(P.paperDark);
    for (let y = 44; y < 330; y += 22) g.fillRect(70, y, 500, 1);
    g.fillStyle(P.red, 0.6);
    g.fillRect(96, 20, 1, 320);
    txt(this, 320, 336, t('intro.next'), 14, P.shadow).setOrigin(0.5, 1);
    new Button(this, 540, 4, 92, 36, { label: t('intro.skip'), style: 'ghost' }, () => this.finish());
    this.input.on('pointerup', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length) return;
      this.next();
    });
    this.next();
  }

  private next(): void {
    const all = lines('intro.lines');
    if (this.typing) {
      // Toque durante a digitação completa a linha.
      this.typing.remove(true);
      this.typing = undefined;
      const last = this.shown[this.shown.length - 1];
      last.setText(all[this.idx - 1]);
      return;
    }
    if (this.idx >= all.length) {
      this.finish();
      return;
    }
    const line = all[this.idx++];
    const y = 26 + this.shown.reduce((a, s) => a + s.height + 4, 0);
    if (y > 300) {
      for (const s of this.shown) s.destroy();
      this.shown = [];
    }
    const yy = this.shown.length ? y : 26;
    const text = txt(this, 104, yy, '', 18, P.ink, { wrap: 460 });
    this.shown.push(text);
    audio.play('page');
    let i = 0;
    this.typing = this.time.addEvent({
      delay: store.settings.reduceMotion ? 1 : 22,
      repeat: line.length - 1,
      callback: () => {
        i++;
        text.setText(line.slice(0, i));
        if (i >= line.length) this.typing = undefined;
      },
    });
  }

  private finish(): void {
    store.updateMeta((m) => ({ ...m, introSeen: true }));
    go(this, 'Build');
  }
}
