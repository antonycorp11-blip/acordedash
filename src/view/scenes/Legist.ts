// Relatório do Legista: causa da morte, cadeia de falhas, outras mortes e a
// lição desta volta.

import Phaser from 'phaser';
import { legistReport, type LegistReport } from '../../core/legist';
import type { LogEntry, RunSummary } from '../../core/state';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { store } from '../store';
import { t } from '../text';
import { Button, txt, hiRes } from '../ui/buttons';
import { fadeIn, go, startJourney } from './common';

export class Legist extends Phaser.Scene {
  constructor() {
    super('Legist');
  }

  create(): void {
    hiRes(this);
    fadeIn(this);
    const run = store.run;
    if (!run || !run.outcome) {
      go(this, 'Title');
      return;
    }
    const report = legistReport(run);
    // Fecha a run agora: o progresso fica salvo mesmo se o jogo fechar nesta tela.
    const summary = store.closeRun();
    store.discardRun();
    this.draw(report, summary);
  }

  private draw(r: LegistReport, summary: RunSummary | null): void {
    this.add.rectangle(0, 0, 640, 360, P.shadow).setOrigin(0, 0);
    const g = this.add.graphics();
    g.fillStyle(P.paper);
    g.fillRect(16, 10, 608, 300);
    g.fillStyle(P.paperDark);
    g.fillRect(16, 40, 608, 2);
    g.fillRect(330, 50, 1, 250);
    txt(this, 320, 12, t('legist.title').toUpperCase(), 26, P.ink).setOrigin(0.5, 0);
    // Carimbo.
    const stamp = txt(this, 540, 272, t(`causaNome.${r.cause}`).toUpperCase(), 26, P.red).setOrigin(0.5).setAngle(-10);
    this.add.rectangle(540, 272, stamp.width + 14, stamp.height + 6).setStrokeStyle(2, P.red).setAngle(-10);

    let y = 48;
    const L = 26;
    txt(this, L, y, r.day > 0 ? t('legist.day', { dia: r.day }) : t('legist.dayBuild'), 17, P.ink);
    y += 22;
    txt(this, L, y, t('legist.cause'), 15, P.redDark);
    y += 16;
    const cause = txt(this, L, y, t(`legist.cause.${r.cause}`, {}, r.causeVariant), 17, P.ink, { wrap: 296 });
    y += cause.height + 8;
    txt(this, L, y, t('legist.chain'), 15, P.redDark);
    y += 16;
    if (!r.chain.length) {
      txt(this, L, y, t('legist.noChain'), 15, P.ink, { wrap: 296 });
    } else {
      for (const c of r.chain) {
        const line = txt(this, L, y, chainLine(c), 15, P.ink, { wrap: 296 });
        y += line.height + 3;
      }
    }

    const R = 342;
    let ry = 48;
    txt(this, R, ry, t('legist.deaths'), 15, P.redDark);
    ry += 16;
    if (!r.deaths.length) {
      const nd = txt(this, R, ry, t('legist.noDeaths'), 15, P.ink, { wrap: 270 });
      ry += nd.height + 4;
    }
    for (const d of r.deaths.slice(0, 5)) {
      const dl = txt(this, R, ry, t('legist.deathLine', { pessoa: d.nameId, dia: Math.max(0, d.day), causa: d.cause }), 15, P.ink, { wrap: 270 });
      ry += dl.height + 2;
    }
    ry += 8;
    txt(this, R, ry, t('legist.note'), 15, P.redDark);
    ry += 16;
    const note = txt(this, R, ry, `"${t(`legist.lesson.${r.cause}`, {}, r.lessonVariant)}"`, 16, P.blueDark, { wrap: 270 });
    ry += note.height + 10;
    if (summary) {
      this.add.image(R + 5, ry + 7, iconKey(this, 'star')).setScale(1.4);
      txt(this, R + 16, ry, t('legist.knowledge', { n: summary.knowledgeGained }), 16, P.greenDark);
      ry += 18;
      if (summary.newDiary.length) {
        this.add.image(R + 5, ry + 7, iconKey(this, 'book')).setScale(1.4);
        txt(this, R + 16, ry, t('legist.newDiary', { n: summary.newDiary.length }), 16, P.greenDark);
      }
    }
    audio.play('page');
    new Button(this, 340, 316, 200, 40, { label: t('legist.again'), style: 'primary' }, () => startJourney(this));
    new Button(this, 100, 316, 200, 40, { label: t('title.skills') }, () => go(this, 'Skills'));
  }
}

function chainLine(c: LogEntry): string {
  const prefix = c.day < 0 ? t('chain.dayBefore', { n: -c.day }) : c.day === 0 ? t('chain.dayZero') : t('chain.day', { dia: c.day });
  const body = t(c.key, c.params);
  return prefix + body;
}
