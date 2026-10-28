// Explosão: clarão, tremor, poeira e o relatório de dano por setor.

import Phaser from 'phaser';
import type { RunState } from '../../core/state';
import { audio } from '../audio/sfx';
import { P, statusColor } from '../art/palette';
import { BunkerView, SKY_H } from '../bunker';
import { store } from '../store';
import { t } from '../text';
import { Button, drawPanel, txt, hiRes, VW } from '../ui/buttons';
import { go } from './common';

export class Explosion extends Phaser.Scene {
  constructor() {
    super('Explosion');
  }

  create(data: { prev?: RunState }): void {
    hiRes(this, true);
    const run = store.run!;
    const view = new BunkerView(this, { x: 0, y: 0, w: VW, h: 360 }, { dragPans: () => true });
    view.sync(data.prev ?? run);
    const flash = this.add.rectangle(0, 0, VW, 360, P.white, 1).setOrigin(0, 0).setDepth(20);
    audio.play('explosion');
    view.shake(1600, 0.02);
    this.tweens.add({ targets: flash, alpha: 0, duration: store.settings.reduceMotion ? 300 : 1400, ease: 'Quad.out' });

    // Detritos caindo do céu.
    const debris = this.add.particles(0, 0, 'fx_pebble', {
      x: { min: 0, max: view.worldW }, y: -10, lifespan: 2200, speedY: { min: 60, max: 160 }, speedX: { min: -30, max: 30 },
      gravityY: 120, frequency: 20, rotate: { min: 0, max: 360 },
    });
    view.world.add(debris);
    const smoke = this.add.particles(0, 0, 'fx_blacksmoke', {
      x: { min: 0, max: view.worldW }, y: SKY_H - 4, lifespan: 2500, speedY: { min: -30, max: -10 }, scale: { start: 1, end: 4 },
      alpha: { start: 0.9, end: 0 }, frequency: 30,
    });
    view.world.add(smoke);

    this.time.delayedCall(400, () => {
      view.sync(run);
      for (const r of run.rooms) {
        if (!r.collapsed && r.integrity > 50) continue;
        const { x, y } = view.cellLocal(r.x + r.w / 2, r.y + r.h / 2);
        const burst = this.add.particles(x, y, 'fx_dust', { speed: { min: 20, max: 70 }, lifespan: 900, emitting: false });
        view.world.add(burst);
        burst.explode(r.collapsed ? 40 : 15);
      }
      if (run.rooms.some((r) => r.collapsed)) audio.play('collapse');
    });
    this.time.delayedCall(1800, () => {
      debris.stop();
      smoke.stop();
    });
    this.time.delayedCall(2600, () => this.report(run));
    this.events.on('update', (time: number, delta: number) => view.update(time, delta, 1));
  }

  private report(run: RunState): void {
    const g = this.add.graphics().setDepth(30);
    const w = 360;
    const rows = run.stats.explosionReport;
    const h = 96 + rows.length * 20;
    const x = (VW - w) / 2;
    const y = (360 - h) / 2;
    drawPanel(g, x, y, w, h, P.night);
    txt(this, VW / 2, y + 8, t('explosion.title'), 20, P.orange).setOrigin(0.5, 0).setDepth(31);
    const colors = { intacto: statusColor('good'), abalado: statusColor('warn'), destruido: statusColor('bad') };
    rows.forEach((r, i) => {
      txt(this, x + 20, y + 36 + i * 20, t('explosion.sector', { n: r.sector + 1 }), 17).setDepth(31);
      txt(this, x + w - 20, y + 36 + i * 20, t(`explosion.level.${r.level}`), 17, colors[r.level]).setOrigin(1, 0).setDepth(31);
    });
    if (!rows.length) txt(this, VW / 2, y + 40, t('explosion.dead'), 17).setOrigin(0.5, 0).setDepth(31);
    const dead = !!run.outcome;
    new Button(this, x + 40, y + h - 48, w - 80, 40, { label: dead ? t('defeat.continue') : t('explosion.continue'), style: 'primary' }, () => {
      go(this, dead ? 'Defeat' : 'Survival');
    }).setDepth(31);
  }
}
