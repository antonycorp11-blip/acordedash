// HUD fixo do topo: tempo, velocidade, recursos e menu. Também o relógio que
// transforma tempo real em ticks do núcleo.

import Phaser from 'phaser';
import { BALANCE } from '../../core/balance';
import { survivalDay } from '../../core/log';
import { currentCatastrophe } from '../../core/catastrophes';
import { alivePeople, roomsOf } from '../../core/rooms';
import { tick } from '../../core/simulate';
import type { RunState } from '../../core/state';
import { averageMorale } from '../../core/systems/morale';
import { P, statusColor } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { store } from '../store';
import { t } from '../text';
import { Button, drawPanel, txt } from './buttons';

export const TOP_H = 36;

/** Níveis qualitativos (0..4) para os medidores. Nada de números na tela. */
export function levels(run: RunState): Record<'food' | 'water' | 'air' | 'power' | 'morale', number> {
  const people = Math.max(1, alivePeople(run).length);
  const food = run.res.food + run.res.raw + run.res.canned;
  const foodDays = food / (people * BALANCE.food.personFoodPerDay);
  const ghWater = roomsOf(run, 'greenhouse').reduce((a, g) => a + g.w * g.h * BALANCE.food.greenhouseWaterPerCellDay, 0);
  const waterDays = run.res.water / (people * BALANCE.food.personWaterPerDay + ghWater);
  const occupied = run.rooms.filter((r) => !r.collapsed);
  const minAir = occupied.length ? Math.min(...occupied.map((r) => r.air)) : 0;
  const ratio = run.last.demand > 0 ? run.last.production / run.last.demand : run.last.production > 0 ? 2 : 0;
  const step = (v: number, cuts: number[]) => (v <= 0 ? 0 : cuts.filter((c) => v >= c).length + 1);
  return {
    food: food <= 0 ? 0 : Math.min(4, step(foodDays, [2, 5, 12])),
    water: run.res.water <= 0 ? 0 : Math.min(4, step(waterDays, [2, 5, 12])),
    air: minAir < 25 ? (minAir <= 0 ? 0 : 1) : minAir < 40 ? 2 : minAir < 70 ? 3 : 4,
    power: run.last.production <= 0 ? 0 : ratio < 0.8 ? 1 : ratio < 1 ? 2 : ratio < 1.3 ? 3 : 4,
    morale: Math.min(4, Math.floor(averageMorale(run) / 20)),
  };
}

export class TopBar {
  private g: Phaser.GameObjects.Graphics;
  private time: Phaser.GameObjects.Text;
  private sub: Phaser.GameObjects.Text;
  private speedBtns: Button[] = [];
  private gauges: { key: keyof ReturnType<typeof levels>; pips: Phaser.GameObjects.Rectangle[]; icon: Phaser.GameObjects.Image; zone: Phaser.GameObjects.Zone }[] = [];
  private counts: Phaser.GameObjects.Text[] = [];
  private taps = 0;
  private lastTap = 0;
  readonly menu: Button;

  constructor(private scene: Phaser.Scene, private mode: 'build' | 'survival', onMenu: () => void, onSecret: () => void, onGaugeTap?: (k: string) => void) {
    this.g = scene.add.graphics().setDepth(50);
    drawPanel(this.g, 0, 0, 640, TOP_H, mode === 'build' ? P.dirtDark : P.night);
    this.time = txt(scene, 8, 3, '', 18, P.paper).setDepth(51);
    this.sub = txt(scene, 8, 19, '', 13, P.paperDark).setDepth(51);
    // Toque escondido: cinco toques rápidos no relógio abrem o modo desenvolvedor.
    const secret = scene.add.zone(0, 0, 150, TOP_H).setOrigin(0, 0).setInteractive().setDepth(52);
    secret.on('pointerup', () => {
      const now = scene.time.now;
      this.taps = now - this.lastTap < 600 ? this.taps + 1 : 1;
      this.lastTap = now;
      if (this.taps >= 5) {
        this.taps = 0;
        onSecret();
      }
    });
    const icons = ['pause', 'play', 'ff2', 'ff4'];
    BALANCE.time.speeds.forEach((sp, i) => {
      const b = new Button(scene, 160 + i * 38, 2, 36, 32, { icon: iconKey(scene, icons[i]) }, () => {
        store.speed = sp;
      }).setDepth(51);
      this.speedBtns.push(b);
    });
    if (mode === 'survival') {
      const keys: (keyof ReturnType<typeof levels>)[] = ['food', 'water', 'air', 'power', 'morale'];
      const ic: Record<string, string> = { food: 'food', water: 'water', air: 'wind', power: 'bolt', morale: 'meh' };
      keys.forEach((k, i) => {
        const x = 318 + i * 52;
        const icon = scene.add.image(x + 8, 18, iconKey(scene, ic[k])).setScale(1.4).setDepth(51);
        const pips: Phaser.GameObjects.Rectangle[] = [];
        for (let j = 0; j < 4; j++) pips.push(scene.add.rectangle(x + 18 + j * 7, 25, 5, 8, P.shadow).setOrigin(0, 1).setDepth(51));
        const zone = scene.add.zone(x, 0, 50, TOP_H).setOrigin(0, 0).setInteractive().setDepth(52);
        zone.on('pointerup', () => onGaugeTap?.(k));
        this.gauges.push({ key: k, pips, icon, zone });
      });
    } else {
      const ic = ['earth', 'gear'];
      ic.forEach((k, i) => {
        const x = 330 + i * 70;
        scene.add.image(x + 8, 18, iconKey(scene, k)).setScale(1.6).setDepth(51);
        this.counts.push(txt(scene, x + 20, 9, '', 18).setDepth(51));
      });
    }
    this.menu = new Button(scene, 600, 2, 36, 32, { icon: iconKey(scene, 'menu') }, onMenu).setDepth(51);
  }

  update(run: RunState): void {
    for (let i = 0; i < this.speedBtns.length; i++) this.speedBtns[i].setSelected(store.speed === BALANCE.time.speeds[i]);
    if (this.mode === 'build') {
      const left = Math.max(0, BALANCE.time.buildDays * BALANCE.time.minutesPerDay - run.minute);
      const d = Math.floor(left / 1440);
      const h = Math.floor((left % 1440) / 60);
      const m = Math.floor(left % 60);
      this.time.setText(t('hud.buildLeft', { d, h, m }));
      this.sub.setText(t(run.hatchOpen ? 'hud.hatchOpen' : 'hud.hatchClosed'));
      this.sub.setColor(run.hatchOpen ? '#e8833a' : '#c9b896');
      this.counts[0]?.setText(String(run.res.earth));
      this.counts[1]?.setText(String(run.res.parts));
    } else {
      this.time.setText(t('hud.survivalDay', { dia: Math.min(survivalDay(run), run.config.goalDays), meta: run.config.goalDays }));
      const cat = currentCatastrophe(run);
      this.sub.setText(cat ? t('hud.catastrophe', { cat: cat.type }) : store.speed === 0 ? t('hud.paused') : '');
      this.sub.setColor(cat ? '#e8833a' : '#c9b896');
      const lv = levels(run);
      for (const gg of this.gauges) {
        const v = lv[gg.key];
        const color = v <= 1 ? statusColor('bad') : v === 2 ? statusColor('warn') : statusColor('good');
        gg.pips.forEach((p, j) => {
          p.fillColor = j < v ? color : P.shadow;
          p.height = 4 + j * 1.5;
        });
        if (gg.key === 'morale') gg.icon.setTexture(iconKey(this.scene, v >= 3 ? 'happy' : v >= 2 ? 'meh' : 'sad'));
        // Medidor no fundo pisca para chamar atenção.
        gg.icon.setAlpha(v <= 1 && Math.floor(this.scene.time.now / 400) % 2 ? 0.4 : 1);
      }
    }
  }
}

/** Relógio: acumula tempo real e devolve a run avançada pelos ticks do núcleo. */
export class Clock {
  private acc = 0;

  /** Segundos reais por tick em 1x. */
  static secondsPerTick(): number {
    return (BALANCE.time.realSecondsPerDay * BALANCE.time.minutesPerTick) / BALANCE.time.minutesPerDay;
  }

  advance(run: RunState, deltaMs: number, speed: number): RunState {
    if (speed <= 0 || run.events.length || run.outcome) {
      this.acc = 0;
      return run;
    }
    this.acc += (deltaMs / 1000) * speed;
    const per = Clock.secondsPerTick();
    let n = 0;
    let cur = run;
    while (this.acc >= per && n < BALANCE.time.maxTicksPerFrame) {
      this.acc -= per;
      cur = tick(cur);
      n++;
      if (cur.events.length || cur.outcome || cur.phase !== run.phase) {
        this.acc = 0;
        break;
      }
    }
    if (n >= BALANCE.time.maxTicksPerFrame) this.acc = Math.min(this.acc, per);
    return cur;
  }

  /** Fração do tick atual (para interpolar a contagem regressiva na tela). */
  fraction(): number {
    return this.acc / Clock.secondsPerTick();
  }
}
