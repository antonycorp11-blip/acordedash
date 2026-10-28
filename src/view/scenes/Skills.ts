// Árvore de habilidades: cinco ramos, nós com custo, pré-requisitos e
// alternativas exclusivas. As compras são permanentes.

import Phaser from 'phaser';
import { BRANCHES, SKILLS, skillStatus } from '../../core/skills';
import { audio } from '../audio/sfx';
import { P, statusColor } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { store } from '../store';
import { t } from '../text';
import { Button, drawPanel, txt, hiRes } from '../ui/buttons';
import { fadeIn, go } from './common';

export class Skills extends Phaser.Scene {
  private selected: string | null = null;
  private detail?: Phaser.GameObjects.Container;
  private nodes = new Map<string, Button>();
  private marks = new Map<string, Phaser.GameObjects.Image>();
  private points!: Phaser.GameObjects.Text;

  constructor() {
    super('Skills');
  }

  create(): void {
    hiRes(this);
    fadeIn(this);
    this.nodes.clear();
    this.marks.clear();
    this.selected = null;
    this.add.rectangle(0, 0, 640, 360, P.ink).setOrigin(0, 0);
    txt(this, 10, 6, t('skills.title'), 22, P.yellow);
    this.points = txt(this, 630, 8, '', 18, P.paper).setOrigin(1, 0);
    const colW = 124;
    BRANCHES.forEach((b, ci) => {
      const x = 8 + ci * (colW + 2);
      const g = this.add.graphics();
      drawPanel(g, x, 32, colW, 236, P.night);
      txt(this, x + colW / 2, 36, t(`branch.${b}`), 17, P.orange).setOrigin(0.5, 0);
      SKILLS.filter((s) => s.branch === b).forEach((s, i) => {
        const btn = new Button(this, x + 4, 56 + i * 35, colW - 8, 33, { label: t(`skill.${s.id}`), size: 13, align: 'left' }, () => this.select(s.id));
        btn.label?.setWordWrapWidth(colW - 30).setLineSpacing(0);
        this.nodes.set(s.id, btn);
      });
    });
    new Button(this, 532, 316, 100, 40, { label: t('skills.back'), style: 'primary' }, () => go(this, 'Title'));
    this.refresh();
  }

  private refresh(): void {
    const meta = store.meta;
    this.points.setText(t('skills.points', { n: meta.knowledge }));
    for (const [id, b] of this.nodes) {
      const st = skillStatus(meta, id);
      b.setSelected(id === this.selected);
      b.setAlpha(st === 'excluida' || st === 'ramo_fechado' ? 0.45 : 1);
      b.label?.setColor(st === 'comprada' ? '#6abf5a' : st === 'disponivel' ? '#faf6ee' : '#c9b896');
      // Ícone de estado: forma além da cor (modo daltônico).
      this.marks.get(id)?.destroy();
      const icon = st === 'comprada' ? 'check' : st === 'ramo_fechado' || st === 'excluida' ? 'lock' : null;
      if (icon) {
        const img = this.add.image(b.w - 8, b.h / 2, iconKey(this, icon));
        b.add(img);
        this.marks.set(id, img);
      }
    }
    this.drawDetail();
  }

  private select(id: string): void {
    this.selected = id;
    this.refresh();
  }

  private drawDetail(): void {
    this.detail?.destroy();
    const c = this.add.container(0, 0);
    this.detail = c;
    const g = this.add.graphics();
    drawPanel(g, 8, 272, 516, 84, P.shadow);
    c.add(g);
    if (!this.selected) return;
    const meta = store.meta;
    const node = SKILLS.find((s) => s.id === this.selected)!;
    const st = skillStatus(meta, node.id);
    c.add(txt(this, 16, 276, t(`skill.${node.id}`), 18, P.yellow));
    c.add(txt(this, 16, 296, t(`skill.${node.id}.desc`), 15, P.paper, { wrap: 360 }));
    const extra: string[] = [t('skills.cost', { n: node.cost })];
    if (node.requires) extra.push(t('skills.requires', { n: t(`skill.${node.requires}`) }));
    if (node.excludes) extra.push(t('skills.excludes', { n: t(`skill.${node.excludes}`) }));
    c.add(txt(this, 16, 336, extra.join(' · '), 13, P.paperDark));
    const color = st === 'comprada' || st === 'disponivel' ? statusColor('good') : statusColor('bad');
    c.add(txt(this, 512, 278, t(`skills.status.${st}`), 14, color).setOrigin(1, 0));
    const buy = new Button(this, 392, 308, 124, 40, { label: t('skills.buy'), style: 'primary' }, () => {
      if (store.buySkill(node.id)) {
        audio.play('victory');
        this.refresh();
      }
    });
    buy.setDisabled(st !== 'disponivel');
    c.add(buy);
  }
}
