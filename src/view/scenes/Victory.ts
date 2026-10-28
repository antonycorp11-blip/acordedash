// Vitória: a meta de dias foi atingida e o loop se desfaz.

import Phaser from 'phaser';
import { alivePeople } from '../../core/rooms';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { personKey } from '../art/survivors';
import { store } from '../store';
import { t, variantOf } from '../text';
import { Button, txt, hiRes, LEFT, VW } from '../ui/buttons';
import { fadeIn, go } from './common';

export class Victory extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create(): void {
    hiRes(this);
    fadeIn(this);
    audio.setMood('none');
    const run = store.run!;
    const sky = this.add.graphics();
    const sun = this.add.circle(320, 300, 34, P.yellow);
    let k = 0;
    this.time.addEvent({
      delay: 40, repeat: 60,
      callback: () => {
        k++;
        sky.clear();
        const top = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(P.ink), Phaser.Display.Color.ValueToColor(P.blueDark), 60, k);
        const bot = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(P.night), Phaser.Display.Color.ValueToColor(P.orange), 60, k);
        sky.fillStyle(Phaser.Display.Color.GetColor(top.r, top.g, top.b));
        sky.fillRect(LEFT, 0, VW, 200);
        sky.fillStyle(Phaser.Display.Color.GetColor(bot.r, bot.g, bot.b));
        sky.fillRect(LEFT, 200, VW, 80);
        sun.y = 300 - k * 1.6;
      },
    });
    this.add.rectangle(LEFT, 270, VW, 90, P.dirtDark).setOrigin(0, 0);
    this.add.rectangle(LEFT, 268, VW, 4, P.ash).setOrigin(0, 0);
    alivePeople(run).forEach((p, i) => {
      this.add.image(260 + i * 20, 270, personKey(this, p.look, p.archetype, 'feliz', i % 2 ? 2 : 0)).setOrigin(0.5, 1).setScale(2 * 0.105);
    });
    txt(this, 320, 30, t('victory.title'), 22, P.yellow, { title: true, stroke: '#14101c', strokeThickness: 6 }).setOrigin(0.5);
    txt(this, 320, 70, t('victory.text', { dia: run.config.goalDays }, variantOf(run.seed, 'v')), 18, P.white, { wrap: 520, align: 'center' }).setOrigin(0.5, 0);
    new Button(this, 220, 310, 200, 40, { label: t('victory.continue'), style: 'primary' }, () => {
      const survivors = alivePeople(run).map((p) => ({ nameId: p.nameId, look: p.look, archetype: p.archetype }));
      const ending = run.outcome?.ending ?? 'cinismo';
      const summary = store.closeRun();
      store.discardRun();
      go(this, 'Ending', { ending, survivors, knowledge: summary?.knowledgeGained ?? 0, newDiary: summary?.newDiary.length ?? 0 });
    });
  }
}
