// Configurações: volume, trilha, texto grande, modo daltônico, reduzir
// movimento e velocidade padrão. Pode abrir por cima do jogo.

import Phaser from 'phaser';
import { BALANCE } from '../../core/balance';
import { audio } from '../audio/sfx';
import { P, setColorblind } from '../art/palette';
import { store } from '../store';
import { t } from '../text';
import { Button, drawPanel, txt } from '../ui/buttons';
import { confirm } from '../ui/modal';
import { fadeIn, go } from './common';

interface SettingsData {
  from: string;
  overlay?: boolean;
}

export class Settings extends Phaser.Scene {
  private data0!: SettingsData;

  constructor() {
    super('Settings');
  }

  create(data: SettingsData): void {
    this.data0 = data;
    if (!data.overlay) fadeIn(this);
    this.draw();
  }

  private draw(): void {
    this.children.removeAll(true);
    const s = store.settings;
    this.add.rectangle(0, 0, 640, 360, P.ink, this.data0.overlay ? 0.85 : 1).setOrigin(0, 0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, 100, 10, 440, 340, P.night);
    txt(this, 320, 16, t('settings.title'), 22, P.yellow).setOrigin(0.5, 0);
    const row = (i: number, label: string) => {
      const y = 50 + i * 42;
      txt(this, 120, y + 10, label, 18);
      return y;
    };
    const onOff = (v: boolean) => t(v ? 'settings.on' : 'settings.off');

    let y = row(0, t('settings.volume'));
    new Button(this, 330, y, 40, 36, { label: '-' }, () => this.set({ volume: Math.max(0, Math.round((s.volume - 0.1) * 10) / 10) }));
    const bar = this.add.graphics();
    bar.fillStyle(P.shadow);
    bar.fillRect(376, y + 12, 100, 12);
    bar.fillStyle(P.orange);
    bar.fillRect(376, y + 12, 100 * s.volume, 12);
    new Button(this, 482, y, 40, 36, { label: '+' }, () => this.set({ volume: Math.min(1, Math.round((s.volume + 0.1) * 10) / 10) }));

    const toggles: [keyof typeof s, string][] = [['music', 'settings.music'], ['bigText', 'settings.bigText'], ['colorblind', 'settings.colorblind'], ['reduceMotion', 'settings.reduceMotion']];
    toggles.forEach(([key, label], i) => {
      y = row(i + 1, t(label));
      const v = s[key] as boolean;
      new Button(this, 330, y, 192, 36, { label: onOff(v), style: v ? 'primary' : 'normal' }, () => this.set({ [key]: !v }));
    });

    y = row(5, t('settings.defaultSpeed'));
    const speeds = BALANCE.time.speeds.filter((x) => x > 0);
    speeds.forEach((sp, i) => {
      new Button(this, 330 + i * 66, y, 60, 36, { label: `${sp}x`, style: s.defaultSpeed === sp ? 'primary' : 'normal' }, () => this.set({ defaultSpeed: sp }));
    });

    new Button(this, 120, 300, 180, 40, { label: t('settings.reset'), style: 'danger' }, () => {
      confirm(this, t('settings.resetConfirm'), t('hud.yes'), t('hud.no'), () => {
        store.resetAll();
        this.back(true);
      });
    }).setDisabled(!!this.data0.overlay);
    new Button(this, 340, 300, 180, 40, { label: t('settings.back'), style: 'primary' }, () => this.back());
  }

  private set(p: Partial<typeof store.settings>): void {
    store.updateSettings(p);
    const s = store.settings;
    audio.setVolume(s.volume);
    audio.setMusic(s.music);
    setColorblind(s.colorblind);
    this.draw();
  }

  private back(toTitle = false): void {
    if (this.data0.overlay && !toTitle) {
      this.scene.stop();
      this.scene.resume(this.data0.from);
      return;
    }
    if (this.data0.overlay) this.scene.stop(this.data0.from);
    go(this, 'Title');
  }
}
