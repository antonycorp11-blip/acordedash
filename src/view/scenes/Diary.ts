// Diário: entradas desbloqueadas, em ordem. As trancadas aparecem como "???".

import Phaser from 'phaser';
import { DIARY } from '../../core/progression';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { store } from '../store';
import { t } from '../text';
import { Button, drawPanel, txt } from '../ui/buttons';
import { ScrollArea } from '../ui/scroll';
import { fadeIn, go } from './common';

export class Diary extends Phaser.Scene {
  private title!: Phaser.GameObjects.Text;
  private body!: Phaser.GameObjects.Text;
  private list!: ScrollArea;

  constructor() {
    super('Diary');
  }

  create(): void {
    fadeIn(this);
    this.add.rectangle(0, 0, 640, 360, P.ink).setOrigin(0, 0);
    const g = this.add.graphics();
    drawPanel(g, 6, 6, 200, 348, P.night);
    g.fillStyle(P.paper);
    g.fillRect(216, 6, 418, 300);
    g.fillStyle(P.paperDark);
    for (let y = 46; y < 300; y += 20) g.fillRect(224, y, 402, 1);
    this.title = txt(this, 230, 14, '', 20, P.redDark);
    this.body = txt(this, 230, 42, '', 18, P.ink, { wrap: 392, lineSpacing: 2 });
    new Button(this, 434, 314, 200, 40, { label: t('diary.back'), style: 'primary' }, () => go(this, 'Title'));
    txt(this, 222, 318, t('diary.title'), 22, P.paper);
    this.list = new ScrollArea(this, 10, 10, 192, 340);
    const meta = store.meta;
    DIARY.forEach((d, i) => {
      const unlocked = meta.diary.includes(d.id);
      const unread = meta.unreadDiary.includes(d.id);
      const label = unlocked ? t(`${d.id}.title`) : t('diary.locked');
      const b = new Button(this, 0, i * 40, 188, 36, { label, style: unlocked ? (unread ? 'primary' : 'normal') : 'ghost', align: 'left', size: 15, sub: unread ? t('diary.new') : undefined },
        this.list.guard(() => unlocked && this.open(d.id)));
      this.list.content.add(b);
    });
    const first = meta.unreadDiary[0] ?? meta.diary[meta.diary.length - 1];
    if (first) this.open(first, false);
    else this.body.setText(t('diary.empty'));
  }

  private open(id: string, sound = true): void {
    if (sound) audio.play('page');
    this.title.setText(t(`${id}.title`));
    this.body.setText(t(`${id}.text`));
    if (store.meta.unreadDiary.includes(id)) store.updateMeta((m) => ({ ...m, unreadDiary: m.unreadDiary.filter((x) => x !== id) }));
  }
}
