// Utilidades compartilhadas pelas cenas: transição, rota da run e ticker do narrador.

import Phaser from 'phaser';
import type { RunState } from '../../core/state';
import { P } from '../art/palette';
import { store } from '../store';
import { t, variantOf } from '../text';
import { txt } from '../ui/buttons';

/** Troca de cena com fade curto (sem fade no modo reduzir movimento). */
export function go(scene: Phaser.Scene, key: string, data?: object): void {
  if (store.settings.reduceMotion) {
    scene.scene.start(key, data);
    return;
  }
  scene.cameras.main.fadeOut(180, 20, 16, 28);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}

export function fadeIn(scene: Phaser.Scene): void {
  if (!store.settings.reduceMotion) scene.cameras.main.fadeIn(180, 20, 16, 28);
}

/** Cena certa para uma run salva. */
export function sceneForRun(run: RunState): string {
  if (run.outcome) return run.outcome.kind === 'vitoria' ? 'Victory' : 'Defeat';
  if (run.phase === 'build') return 'Build';
  if (run.phase === 'countdown') return 'Countdown';
  return 'Survival';
}

/** Começa uma run nova, passando pela intro na primeira vez. */
export function startJourney(scene: Phaser.Scene): void {
  store.startNewRun();
  go(scene, store.meta.introSeen ? 'Build' : 'Intro');
}

/** Faixa com as falas do narrador, embaixo da área do bunker. */
export class Ticker {
  private lastSeq = 0;
  private items: { text: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Rectangle; until: number }[] = [];

  /** `showLast`: mostra de novo a última fala (ao voltar para uma run salva). */
  constructor(private scene: Phaser.Scene, private x: number, private bottom: number, private width: number, run: RunState | null, showLast = true) {
    this.lastSeq = run ? Math.max(0, run.messageSeq - (showLast ? 1 : 0)) : 0;
  }

  update(run: RunState, now: number): void {
    for (const m of run.messages) {
      if (m.seq <= this.lastSeq) continue;
      this.lastSeq = m.seq;
      this.push(t(m.key, m.params, variantOf(run.seed, m.seq)), now);
    }
    for (const it of [...this.items]) {
      const left = it.until - now;
      if (left < 400) {
        it.text.setAlpha(Math.max(0, left / 400));
        it.bg.setAlpha(Math.max(0, left / 400) * 0.75);
      }
      if (left <= 0) {
        it.text.destroy();
        it.bg.destroy();
        this.items.splice(this.items.indexOf(it), 1);
      }
    }
    this.layout();
  }

  push(str: string, now: number): void {
    const text = txt(this.scene, this.x + 6, 0, str, 15, P.paper, { wrap: this.width - 12 }).setDepth(40);
    const bg = this.scene.add.rectangle(this.x, 0, this.width, text.height + 4, P.ink, 0.75).setOrigin(0, 0).setDepth(39);
    this.items.push({ text, bg, until: now + 4500 });
    while (this.items.length > 3) {
      const old = this.items.shift()!;
      old.text.destroy();
      old.bg.destroy();
    }
  }

  private layout(): void {
    let y = this.bottom;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      y -= it.text.height + 6;
      it.bg.setPosition(this.x, y - 2);
      it.text.setPosition(this.x + 6, y);
    }
  }
}
