// Derrota: o viajante morreu e o loop reinicia. Leva ao Relatório do Legista.

import Phaser from 'phaser';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { store } from '../store';
import { lines, t } from '../text';
import { Button, txt } from '../ui/buttons';
import { fadeIn, go } from './common';

export class Defeat extends Phaser.Scene {
  private hand!: Phaser.GameObjects.Graphics;
  private speed = 1;

  constructor() {
    super('Defeat');
  }

  create(): void {
    fadeIn(this);
    audio.setMood('none');
    audio.play('defeat');
    this.speed = 1;
    this.add.rectangle(0, 0, 640, 360, P.ink).setOrigin(0, 0);
    // Relógio andando para trás.
    const face = this.add.graphics();
    face.fillStyle(P.paper);
    face.fillCircle(320, 130, 62);
    face.fillStyle(P.ink);
    face.fillCircle(320, 130, 58);
    face.fillStyle(P.paperDark);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      face.fillRect(320 + Math.cos(a) * 50 - 1, 130 + Math.sin(a) * 50 - 1, 3, 3);
    }
    this.hand = this.add.graphics({ x: 320, y: 130 });
    this.hand.fillStyle(P.red);
    this.hand.fillRect(-1, -48, 3, 48);
    this.hand.fillStyle(P.paper);
    this.hand.fillRect(-1, -30, 3, 30).setAngle(90);
    txt(this, 320, 210, t('defeat.title'), 18, P.red, { title: true }).setOrigin(0.5);
    const ls = lines('defeat.lines');
    ls.forEach((l, i) => {
      const tx = txt(this, 320, 236 + i * 18, l, 17, P.paper).setOrigin(0.5, 0).setAlpha(0);
      this.tweens.add({ targets: tx, alpha: 1, delay: 500 + i * 700, duration: 400 });
    });
    const btn = new Button(this, 220, 316, 200, 38, { label: t('defeat.report'), style: 'primary' }, () => go(this, 'Legist'));
    btn.setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, delay: 500 + ls.length * 700, duration: 300 });
    if (!store.run?.outcome) go(this, 'Title');
  }

  update(_t: number, delta: number): void {
    this.speed = Math.min(30, this.speed * (1 + delta / 600));
    this.hand.rotation -= (delta / 1000) * this.speed * (store.settings.reduceMotion ? 0.2 : 1);
  }
}
