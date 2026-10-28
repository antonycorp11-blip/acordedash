// Título: logo, menu principal e o atalho secreto do modo desenvolvedor
// (cinco toques no logo).

import Phaser from 'phaser';
import { applyCommandMut } from '../../core/commands';
import { newMeta, runConfig } from '../../core/progression';
import { newRun } from '../../core/simulate';
import type { RoomType, RunState } from '../../core/state';
import { BunkerView } from '../bunker';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { store } from '../store';
import { t } from '../text';
import { Button, txt, hiRes, VW } from '../ui/buttons';
import { confirm } from '../ui/modal';
import { fadeIn, go, sceneForRun, startJourney } from './common';

export class Title extends Phaser.Scene {
  private taps = 0;
  private lastTap = 0;
  private view?: BunkerView;
  private demo?: RunState;

  constructor() {
    super('Title');
  }

  create(): void {
    hiRes(this, true);
    fadeIn(this);
    audio.setMood('menu');
    this.drawBackdrop();

    // Sombra suave atrás do logo, para separar do cenário.
    const band = this.add.graphics().setDepth(9);
    band.fillStyle(0x0e1320, 0.55);
    band.fillRoundedRect(-20, 24, 380, 68, 18);
    // Logo com sombra em camadas.
    const lx = 160;
    const ly = 46;
    for (const [dx, dy, c] of [[0, 4, P.ink], [0, 3, P.redDark], [0, 2, P.orangeDark]] as [number, number, number][]) {
      txt(this, lx + dx, ly + dy, t('game.title'), 46, c, { title: true }).setOrigin(0.5).setDepth(10);
    }
    const logo = txt(this, lx, ly, t('game.title'), 46, P.yellow, { title: true, stroke: '#14101c', strokeThickness: 3 }).setOrigin(0.5).setDepth(11);
    txt(this, lx, ly + 34, t('game.subtitle'), 16, P.paper, { stroke: '#14101c', strokeThickness: 4 }).setOrigin(0.5).setDepth(11);
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

    const meta = store.meta;
    const run = store.run;
    const x = VW - 146;
    let y = 46;
    const add = (label: string, style: 'primary' | 'normal', icon: string, fn: () => void, sublabel?: string) => {
      new Button(this, x, y, 138, 42, { label, style, icon: iconKey(this, icon), align: 'left', iconScale: 2, sub: sublabel, size: 15 }, fn).setDepth(12);
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

    txt(this, VW - 146, 12, `${t('title.loops', { n: meta.runs })}\n${t('title.goal', { n: goalFor() })}`, 14, P.paperDark).setDepth(12);
  }

  private drawBackdrop(): void {
    // Um bunker de demonstração, desenhado pela mesma visão do jogo, sob o céu da contagem final.
    const demo = newRun(newMeta(), 20251028);
    const place: [RoomType, number, number][] = [];
    for (let y = 0; y <= 9; y++) place.push(['corridor', 9, y]);
    place.push(['vent', 7, 2], ['panel', 10, 2], ['dorm', 5, 4], ['generator', 10, 4], ['greenhouse', 5, 6], ['reservoir', 10, 6], ['kitchen', 6, 8], ['generator', 10, 8]);
    for (const [room, x, y] of place) applyCommandMut(demo, { t: 'place', room, x, y });
    for (const r of demo.rooms) r.unstable = false;
    for (const p of demo.people) p.homeId = demo.rooms.find((r) => r.type === 'dorm')?.id ?? null;
    demo.events = [];
    demo.phase = 'countdown';
    this.demo = demo;
    this.view = new BunkerView(this, { x: 0, y: 0, w: VW, h: 360 }, { dragPans: () => true, blocked: () => true });
    this.view.sync(demo);
    this.view.zoom = 2.5;
    this.view.world.setScale(2.5);
    this.view.world.setPosition(-100, -90);
    // Escurece a lateral dos botões e o canto do logo.
    const g = this.add.graphics().setDepth(5);
    for (let i = 0; i < 12; i++) {
      g.fillStyle(P.ink, 0.06 * i);
      g.fillRect(VW - 280 + i * 10, 0, 10, 360);
    }
    g.fillStyle(P.ink, 0.72);
    g.fillRect(VW - 160, 0, 160, 360);
    this.add.particles(0, 0, 'fx_ember', {
      x: { min: 0, max: VW }, y: -4, lifespan: 7000, speedY: { min: 6, max: 16 }, speedX: { min: -6, max: 6 },
      alpha: { start: 0.9, end: 0 }, frequency: store.settings.reduceMotion ? 900 : 160,
    }).setDepth(6);
  }

  update(time: number, delta: number): void {
    if (this.view && this.demo) this.view.update(time, delta, 1);
  }
}

function goalFor(): number {
  // A meta mostrada é a da run atual, ou a da próxima.
  return store.run?.config.goalDays ?? runConfig(store.meta).goalDays;
}
