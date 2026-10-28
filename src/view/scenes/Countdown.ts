// Contagem final: dez segundos em que não dá para mudar mais nada.

import Phaser from 'phaser';
import { BALANCE } from '../../core/balance';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { BunkerView } from '../bunker';
import { store } from '../store';
import { t, variantOf } from '../text';
import { txt, hiRes } from '../ui/buttons';
import { fadeIn, go } from './common';

export class Countdown extends Phaser.Scene {
  private view!: BunkerView;
  private left = 0;
  private number!: Phaser.GameObjects.Text;
  private red!: Phaser.GameObjects.Rectangle;
  private lastSecond = -1;
  private done = false;

  constructor() {
    super('Countdown');
  }

  create(): void {
    hiRes(this);
    fadeIn(this);
    audio.setMood('none');
    this.done = false;
    this.left = BALANCE.time.countdownSeconds;
    this.lastSecond = -1;
    const run = store.run!;
    this.view = new BunkerView(this, { x: 0, y: 0, w: 640, h: 360 }, { dragPans: () => true });
    this.view.sync(run);
    this.red = this.add.rectangle(0, 0, 640, 360, P.red, 0).setOrigin(0, 0).setDepth(10);
    this.add.rectangle(0, 0, 640, 54, P.ink, 0.75).setOrigin(0, 0).setDepth(11);
    txt(this, 320, 4, t('countdown.title'), 20, P.orange).setOrigin(0.5, 0).setDepth(12);
    txt(this, 320, 28, t('countdown.text', {}, variantOf(run.seed, 'cd')), 15, P.paper).setOrigin(0.5, 0).setDepth(12);
    this.number = txt(this, 320, 190, '', 96, P.white, { stroke: '#14101c', strokeThickness: 8 }).setOrigin(0.5).setDepth(12);
  }

  update(time: number, delta: number): void {
    if (this.done) return;
    this.left -= delta / 1000;
    const sec = Math.max(0, Math.ceil(this.left));
    if (sec !== this.lastSecond) {
      this.lastSecond = sec;
      this.number.setText(String(sec));
      this.number.setScale(1.4);
      this.tweens.add({ targets: this.number, scale: 1, duration: 300 });
      audio.play('beep');
      if (sec <= 3) this.view.shake(200, 0.002 * (4 - sec));
    }
    this.red.setAlpha(0.12 + 0.12 * Math.abs(Math.sin(time / 250)));
    this.view.update(time, delta, 1);
    if (this.left <= 0) {
      this.done = true;
      const prev = store.run!;
      store.dispatch({ t: 'detonate' });
      store.save();
      go(this, 'Explosion', { prev });
    }
  }
}
