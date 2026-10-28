// Título: logo, menu principal e o atalho secreto do modo desenvolvedor
// (cinco toques no logo).

import Phaser from 'phaser';
import { runConfig } from '../../core/progression';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { roomKey } from '../art/sprites/rooms';
import { dirtKey, grassKey, TILE } from '../art/sprites/tiles';
import { personKey } from '../art/survivors';
import { store } from '../store';
import { t } from '../text';
import { Button, txt } from '../ui/buttons';
import { confirm } from '../ui/modal';
import { fadeIn, go, sceneForRun, startJourney } from './common';

export class Title extends Phaser.Scene {
  private taps = 0;
  private lastTap = 0;
  private digger?: Phaser.GameObjects.Image;

  constructor() {
    super('Title');
  }

  create(): void {
    fadeIn(this);
    audio.setMood('menu');
    this.drawBackdrop();

    const logo = txt(this, 170, 54, t('game.title'), 22, P.orange, { title: true, stroke: '#14101c', strokeThickness: 6 }).setOrigin(0.5);
    const sub = txt(this, 170, 84, t('game.subtitle'), 18, P.paper).setOrigin(0.5);
    this.tweens.add({ targets: logo, y: 50, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    logo.setInteractive();
    logo.on('pointerup', () => {
      const now = this.time.now;
      this.taps = now - this.lastTap < 600 ? this.taps + 1 : 1;
      this.lastTap = now;
      if (this.taps >= 5) {
        this.taps = 0;
        this.scene.launch('Dev', { from: 'Title' });
        this.scene.pause();
      }
    });
    void sub;

    const meta = store.meta;
    const run = store.run;
    const x = 430;
    let y = 40;
    const add = (label: string, style: 'primary' | 'normal', icon: string, fn: () => void, sublabel?: string) => {
      new Button(this, x, y, 190, 42, { label, style, icon: iconKey(this, icon), align: 'left', iconScale: 2, sub: sublabel }, fn);
      y += 50;
    };
    if (run) add(t('title.continue'), 'primary', 'play', () => go(this, sceneForRun(run)));
    add(t('title.new'), run ? 'normal' : 'primary', 'shovel', () => {
      if (run && !run.outcome) confirm(this, t('title.confirmNew'), t('title.confirmYes'), t('title.confirmNo'), () => startJourney(this));
      else {
        if (run) store.discardRun();
        startJourney(this);
      }
    });
    add(t('title.diary'), 'normal', 'book', () => go(this, 'Diary'), meta.unreadDiary.length ? t('title.newDiary', { n: meta.unreadDiary.length }) : undefined);
    add(t('title.skills'), 'normal', 'star', () => go(this, 'Skills'), t('title.knowledge', { n: meta.knowledge }));
    add(t('title.settings'), 'normal', 'gear', () => go(this, 'Settings', { from: 'Title' }));

    txt(this, 12, 340, `${t('title.loops', { n: meta.runs })}   ${t('title.goal', { n: goalFor() })}`, 15, P.paperDark);
  }

  private drawBackdrop(): void {
    const g = this.add.graphics();
    g.fillStyle(P.shadow);
    g.fillRect(0, 0, 640, 360);
    // Céu de fim de tarde, terra e um bunker em corte.
    const sky = [P.dusk, P.purple, P.pink, P.orange];
    sky.forEach((c, i) => {
      g.fillStyle(c);
      g.fillRect(0, i * 30, 640, 30);
    });
    const groundY = 120;
    for (let yy = 0; yy < 15; yy++) for (let xx = 0; xx < 40; xx++) this.add.image(xx * TILE, groundY + yy * TILE, dirtKey(this, (xx * 7 + yy * 3) % 4, yy)).setOrigin(0, 0);
    for (let xx = 0; xx < 40; xx++) this.add.image(xx * TILE, groundY - 5, grassKey(this, false)).setOrigin(0, 0);
    const bx = 120;
    for (let i = 0; i < 6; i++) this.add.image(bx, groundY + i * TILE, roomKey(this, 'corridor', 1, 1, null, i === 0)).setOrigin(0, 0);
    this.add.image(bx + TILE, groundY + 2 * TILE, roomKey(this, 'dorm', 4, 2, null)).setOrigin(0, 0);
    this.add.image(bx - 3 * TILE, groundY + 3 * TILE, roomKey(this, 'generator', 3, 2, null)).setOrigin(0, 0);
    this.add.image(bx + TILE, groundY + 4 * TILE, roomKey(this, 'greenhouse', 4, 2, null)).setOrigin(0, 0);
    this.add.image(bx - 2 * TILE, groundY + 1 * TILE, roomKey(this, 'vent', 2, 2, null)).setOrigin(0, 0);
    this.digger = this.add.image(bx + 3 * TILE, groundY + 4 * TILE - 3, personKey(this, 7, 'viajante', 'ok', 0)).setOrigin(0.5, 1).setScale(1);
    this.add.particles(0, 0, 'fx_dust', {
      x: { min: 0, max: 640 }, y: -4, lifespan: 6000, speedY: { min: 8, max: 20 }, speedX: { min: -5, max: 5 },
      alpha: { start: 0.8, end: 0 }, frequency: store.settings.reduceMotion ? 800 : 140,
    });
    // Painel escuro atrás dos botões.
    g.fillStyle(P.ink, 0.55);
    g.fillRect(410, 24, 226, 290);
  }

  update(time: number): void {
    if (this.digger) {
      const f = Math.floor(time / 300) % 4;
      this.digger.setTexture(personKey(this, 7, 'viajante', f === 3 ? 'feliz' : 'ok', f === 2 ? 2 : f % 2));
    }
  }
}

function goalFor(): number {
  // A meta mostrada é a da run atual, ou a da próxima.
  return store.run?.config.goalDays ?? runConfig(store.meta).goalDays;
}
