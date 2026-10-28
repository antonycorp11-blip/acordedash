// Final: tela própria de cada final, com arte gerada por código, texto do
// narrador e quem chegou ao fim.

import Phaser from 'phaser';
import type { Archetype, EndingId } from '../../core/state';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { roomKey } from '../art/sprites/rooms';
import { personKey } from '../art/survivors';
import { store } from '../store';
import { lines, personName, t } from '../text';
import { Button, drawPanel, txt } from '../ui/buttons';
import { fadeIn, go } from './common';

interface EndingData {
  ending: EndingId;
  survivors: { nameId: number; look: number; archetype: Archetype | 'viajante' }[];
  knowledge: number;
  newDiary: number;
}

export class Ending extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(data: EndingData): void {
    fadeIn(this);
    audio.setMood('menu');
    audio.play('victory');
    const ending = data.ending ?? 'cinismo';
    this.art(ending, data);
    const g = this.add.graphics();
    drawPanel(g, 330, 8, 302, 344, P.night, 0.92);
    txt(this, 481, 14, t(`ending.${ending}`), 13, P.skyLight, { title: true }).setOrigin(0.5, 0);
    let y = 40;
    lines(`ending.${ending}.text`).forEach((l, i) => {
      const tx = txt(this, 342, y, l, 15, P.white, { wrap: 280 }).setAlpha(0);
      this.tweens.add({ targets: tx, alpha: 1, delay: 400 + i * 900, duration: 500 });
      y += tx.height + 6;
    });
    y += 4;
    txt(this, 342, y, t('ending.survivors'), 15, P.yellow);
    y += 18;
    const names = data.survivors?.length ? data.survivors.map((s) => personName(s.nameId)).join(', ') : t('ending.nobody');
    txt(this, 342, y, names, 15, P.paper, { wrap: 280 });
    new Button(this, 380, 308, 200, 38, { label: t('ending.back'), style: 'primary' }, () => go(this, 'Title'));
  }

  /** Cada final tem seu quadro, desenhado na hora. */
  private art(e: EndingId, data: EndingData): void {
    const g = this.add.graphics();
    const sky: Record<EndingId, [number, number]> = {
      coletivo: [P.blueDark, P.skyLight], solitario: [P.ink, P.ash], ruptura: [P.ink, P.purple], cinismo: [P.blueDark, P.orange],
    };
    const [a, b] = sky[e];
    for (let i = 0; i < 10; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(a), Phaser.Display.Color.ValueToColor(b), 9, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(0, i * 24, 640, 24);
    }
    g.fillStyle(P.dirtDark);
    g.fillRect(0, 240, 640, 120);
    g.fillStyle(e === 'coletivo' ? P.grass : P.ash);
    g.fillRect(0, 238, 640, 4);
    const people = data.survivors ?? [];
    switch (e) {
      case 'coletivo': {
        // Linha verde no horizonte e todo mundo junto.
        g.fillStyle(P.green);
        g.fillRect(0, 226, 330, 3);
        people.forEach((p, i) => this.add.image(70 + i * 26, 240, personKey(this, p.look, p.archetype, 'feliz', i % 2 ? 2 : 0)).setOrigin(0.5, 1).setScale(2));
        this.add.image(40, 240, roomKey(this, 'corridor', 1, 1, null, true)).setOrigin(0.5, 0);
        break;
      }
      case 'solitario': {
        const t0 = people.find((p) => p.archetype === 'viajante') ?? { look: 7, archetype: 'viajante' as const };
        this.add.image(200, 240, personKey(this, t0.look, 'viajante', 'ok', 0)).setOrigin(0.5, 1).setScale(3);
        this.add.image(80, 240, roomKey(this, 'dorm', 4, 2, null)).setOrigin(0.5, 0).setAlpha(0.5);
        for (let i = 0; i < 5; i++) {
          g.fillStyle(P.paperDark, 0.15);
          g.fillRect(40 + i * 18, 200 - (i % 2) * 10, 6, 14);
        }
        break;
      }
      case 'ruptura': {
        // Um rasgo roxo no céu engolindo o bunker.
        const rift = this.add.graphics();
        rift.fillStyle(P.purple, 0.8);
        rift.fillTriangle(160, 40, 120, 200, 200, 200);
        rift.fillStyle(P.pink, 0.9);
        rift.fillTriangle(160, 70, 140, 190, 180, 190);
        if (!store.settings.reduceMotion) this.tweens.add({ targets: rift, alpha: 0.5, yoyo: true, repeat: -1, duration: 700 });
        this.add.image(110, 250, roomKey(this, 'generator', 3, 2, null)).setOrigin(0.5, 0).setAngle(-12);
        this.add.image(220, 255, roomKey(this, 'dorm', 4, 2, null)).setOrigin(0.5, 0).setAngle(9);
        const t0 = people.find((p) => p.archetype === 'viajante') ?? { look: 7 };
        const guy = this.add.image(160, 150, personKey(this, t0.look, 'viajante', 'medo', 2)).setScale(2).setAngle(30);
        if (!store.settings.reduceMotion) this.tweens.add({ targets: guy, angle: 390, duration: 4000, repeat: -1 });
        break;
      }
      case 'cinismo': {
        // Na beira da cratera, com a última lata. E uma placa de "vende-se".
        g.fillStyle(P.ink);
        g.fillEllipse(220, 262, 240, 40);
        const t0 = people.find((p) => p.archetype === 'viajante') ?? { look: 7 };
        this.add.image(110, 244, personKey(this, t0.look, 'viajante', 'feliz', 2)).setOrigin(0.5, 1).setScale(3);
        g.fillStyle(P.dirt);
        g.fillRect(268, 200, 4, 40);
        g.fillStyle(P.paper);
        g.fillRect(244, 196, 54, 22);
        txt(this, 271, 200, t('ending.sign'), 14, P.red).setOrigin(0.5, 0);
        break;
      }
    }
    txt(this, 12, 330, t('legist.knowledge', { n: data.knowledge ?? 0 }), 16, P.yellow);
  }
}
