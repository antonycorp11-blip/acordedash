// Painel lateral da sobrevivência: alertas (emergências e missões), pessoas,
// prioridade de energia e ações.

import Phaser from 'phaser';
import { alivePeople } from '../../core/rooms';
import type { RoomType, RunState } from '../../core/state';
import { P, statusColor } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { personKey } from '../art/survivors';
import { missionText } from '../describe';
import { store } from '../store';
import { personName, t } from '../text';
import { Button, drawPanel, txt } from './buttons';
import { TOP_H } from './hud';
import { ScrollArea } from './scroll';

export const PANEL_X = 488;
type Tab = 'alerts' | 'people' | 'power' | 'actions';

const EMG_ICON: Record<string, string> = {
  gerador: 'wrench', vazamento: 'leak', entrada: 'hatch', desmoronamento: 'dust', agua: 'water', doente: 'sick', briga: 'hurt', praga: 'bug', pedido: 'person', crianca: 'eye',
};

export interface PanelActions {
  openEmergency: (id: number) => void;
  openPerson: (id: number) => void;
  toggleRepair: () => boolean;
  isRepairing: () => boolean;
}

export class SurvivalPanel {
  private tab: Tab = 'alerts';
  private tabBtns = new Map<Tab, Button>();
  private scroll: ScrollArea;
  private sig = '';
  private alertBadge: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene, private actions: PanelActions) {
    const g = scene.add.graphics().setDepth(45);
    drawPanel(g, PANEL_X, TOP_H, 640 - PANEL_X, 360 - TOP_H, P.night);
    const tabs: [Tab, string][] = [['alerts', 'alert'], ['people', 'person'], ['power', 'bolt'], ['actions', 'wrench']];
    tabs.forEach(([k, icon], i) => {
      const b = new Button(scene, PANEL_X + 3 + i * 37, TOP_H + 3, 36, 34, { icon: iconKey(scene, icon) }, () => this.setTab(k)).setDepth(46);
      this.tabBtns.set(k, b);
    });
    this.alertBadge = txt(scene, PANEL_X + 32, TOP_H + 1, '', 14, P.white, { backgroundColor: '#d0453a' }).setDepth(47).setOrigin(0.5, 0);
    this.scroll = new ScrollArea(scene, PANEL_X + 3, TOP_H + 42, 640 - PANEL_X - 6, 360 - TOP_H - 45);
    this.scroll.content.setDepth(46);
    this.setTab('alerts');
  }

  setTab(tab: Tab): void {
    this.tab = tab;
    for (const [k, b] of this.tabBtns) b.setSelected(k === tab);
    this.sig = '';
    this.scroll.reset();
  }

  update(run: RunState): void {
    const n = run.emergencies.filter((e) => !e.pendingFix).length;
    this.alertBadge.setText(n ? ` ${n} ` : '');
    const sig = this.signature(run);
    if (sig === this.sig) return;
    this.sig = sig;
    this.scroll.content.removeAll(true);
    if (this.tab === 'alerts') this.drawAlerts(run);
    else if (this.tab === 'people') this.drawPeople(run);
    else if (this.tab === 'power') this.drawPower(run);
    else this.drawActions(run);
  }

  private signature(run: RunState): string {
    switch (this.tab) {
      case 'alerts':
        return 'a' + run.emergencies.map((e) => `${e.id}${e.pendingFix ?? ''}`).join(',') + run.missions.map((m) => m.status).join('');
      case 'people':
        return 'p' + alivePeople(run).map((p) => `${p.id}${p.role}${p.health}${Math.floor(p.morale / 20)}`).join(',');
      case 'power':
        return 'w' + run.priority.join(',') + run.last.deficit;
      case 'actions':
        return 'c' + run.hatchOpen + this.actions.isRepairing();
    }
  }

  private add(...o: Phaser.GameObjects.GameObject[]): void {
    this.scroll.content.add(o);
  }

  private drawAlerts(run: RunState): void {
    let y = 0;
    const w = this.scroll.w;
    if (!run.emergencies.length) {
      this.add(txt(this.scene, 2, y, t('hud.noEmergencies'), 14, P.paperDark, { wrap: w - 4 }));
      y += 36;
    }
    for (const e of run.emergencies) {
      const busy = !!e.pendingFix;
      const b = new Button(this.scene, 0, y, w, 38, {
        label: t(`emg.${e.type}`), icon: iconKey(this.scene, EMG_ICON[e.type] ?? 'alert'), align: 'left', iconScale: 1.6, size: 15,
        sub: busy ? t('hud.inProgress') : undefined, style: busy ? 'ghost' : 'normal',
      }, this.scroll.guard(() => !busy && this.actions.openEmergency(e.id)));
      this.add(b);
      y += 42;
    }
    y += 6;
    this.add(txt(this.scene, 2, y, t('hud.missions'), 15, P.yellow));
    y += 18;
    for (const m of run.missions) {
      const col = m.status === 'cumprida' ? statusColor('good') : m.status === 'falhou' ? statusColor('bad') : P.paper;
      const icon = m.status === 'cumprida' ? 'check' : m.status === 'falhou' ? 'cross' : 'mission';
      this.add(this.scene.add.image(2, y + 2, iconKey(this.scene, icon)).setOrigin(0, 0).setScale(1.2 / 4));
      const tx = txt(this.scene, 16, y, missionText(run, m.type, m.personId, m.untilDay), 13, col, { wrap: w - 18 });
      this.add(tx);
      y += tx.height + 4;
    }
  }

  private drawPeople(run: RunState): void {
    let y = 0;
    const w = this.scroll.w;
    for (const p of alivePeople(run)) {
      const b = new Button(this.scene, 0, y, w, 38, {
        label: personName(p.nameId), sub: `${t(`role.${p.role}`)} · ${t(`health.${p.health}`)}`, align: 'left', size: 15,
      }, this.scroll.guard(() => this.actions.openPerson(p.id)));
      b.label?.setX(30);
      b.sub?.setX(30);
      const face = this.scene.add.image(14, 34, personKey(this.scene, p.look, p.archetype, p.morale < 25 ? 'raiva' : p.morale >= 70 ? 'feliz' : 'ok', 0)).setOrigin(0.5, 1).setScale(2 * 0.105);
      b.add(face);
      const mood = this.scene.add.rectangle(w - 6, 6, 4, 26, p.morale < 30 ? statusColor('bad') : p.morale < 50 ? statusColor('warn') : statusColor('good')).setOrigin(0, 0);
      b.add(mood);
      this.add(b);
      y += 42;
    }
  }

  private drawPower(run: RunState): void {
    const w = this.scroll.w;
    this.add(txt(this.scene, 2, 0, t(run.last.deficit ? 'power.deficit' : 'power.ok'), 14, run.last.deficit ? statusColor('bad') : statusColor('good'), { wrap: w - 4 }));
    this.add(txt(this.scene, 2, 30, t('power.hint'), 13, P.paperDark, { wrap: w - 4 }));
    run.priority.forEach((type: RoomType, i) => {
      const y = 58 + i * 36;
      this.add(this.scene.add.rectangle(0, y, w, 34, P.shadow).setOrigin(0, 0));
      this.add(txt(this.scene, 6, y + 8, `${i + 1}. ${t(`room.short.${type}`)}`, 16));
      const up = new Button(this.scene, w - 66, y + 1, 32, 32, { icon: iconKey(this.scene, 'up') }, this.scroll.guard(() => store.dispatch({ t: 'priority', room: type, dir: -1 })));
      const down = new Button(this.scene, w - 33, y + 1, 32, 32, { icon: iconKey(this.scene, 'down') }, this.scroll.guard(() => store.dispatch({ t: 'priority', room: type, dir: 1 })));
      if (i === 0) up.setDisabled(true);
      if (i === run.priority.length - 1) down.setDisabled(true);
      this.add(up, down);
    });
  }

  private drawActions(run: RunState): void {
    const w = this.scroll.w;
    const repairing = this.actions.isRepairing();
    const rep = new Button(this.scene, 0, 0, w, 40, { label: repairing ? t('actions.cancel') : t('actions.repair'), icon: iconKey(this.scene, 'wrench'), align: 'left', iconScale: 1.6 }, this.scroll.guard(() => {
      this.actions.toggleRepair();
      this.sig = '';
    }));
    rep.setSelected(repairing);
    this.add(rep, txt(this.scene, 2, 44, t('actions.repair.desc'), 13, P.paperDark, { wrap: w - 4 }));
    const hatch = new Button(this.scene, 0, 82, w, 40, {
      label: t(run.hatchOpen ? 'hud.closeHatch' : 'hud.openHatch'), icon: iconKey(this.scene, 'hatch'), align: 'left', iconScale: 1.6,
    }, this.scroll.guard(() => store.dispatch({ t: 'hatch', open: !store.run!.hatchOpen })));
    hatch.setSelected(run.hatchOpen);
    this.add(hatch, txt(this.scene, 2, 126, t(run.hatchOpen ? 'signal.hatchOpen' : 'hud.hatchClosed'), 13, run.hatchOpen ? statusColor('bad') : P.paperDark, { wrap: w - 4 }));
    this.add(txt(this.scene, 2, 156, t('actions.relocate.desc'), 13, P.paperDark, { wrap: w - 4 }));
  }

  refresh(): void {
    this.sig = '';
  }
}
