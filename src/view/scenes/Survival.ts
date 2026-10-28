// Sobrevivência (fase 2): simulação diária, emergências, pessoas, energia e
// ações de conserto. Pausa sozinha quando entra um evento.

import Phaser from 'phaser';
import { roomById, roomMap, idx, inBounds } from '../../core/grid';
import { survivalDay } from '../../core/log';
import { alivePeople } from '../../core/rooms';
import { ROLES, type Room, type RunState } from '../../core/state';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { personKey } from '../art/survivors';
import { BunkerView } from '../bunker';
import { personSummary, roomSignals } from '../describe';
import { store } from '../store';
import { t, variantOf } from '../text';
import { Button, txt, hiRes, ptr } from '../ui/buttons';
import { PANEL_X, SurvivalPanel } from '../ui/emergencyPanel';
import { Clock, levels, TOP_H, TopBar } from '../ui/hud';
import { confirm, Modal } from '../ui/modal';
import { fadeIn, go, Ticker } from './common';

export class Survival extends Phaser.Scene {
  private view!: BunkerView;
  private top!: TopBar;
  private panel!: SurvivalPanel;
  private ticker!: Ticker;
  private clock = new Clock();
  private repairing = false;
  private relocating: number | null = null;
  private modal?: Modal;
  private infoBox?: Phaser.GameObjects.Container;
  private infoUntil = 0;
  private lastDay = 0;
  private lastSave = 0;
  private knownEmergencies = new Set<number>();
  private nextChatter = 0;
  private ending = false;

  constructor() {
    super('Survival');
  }

  create(): void {
    hiRes(this);
    fadeIn(this);
    audio.setMood('survival');
    this.repairing = false;
    this.relocating = null;
    this.ending = false;
    this.modal = undefined;
    const run = store.run!;
    this.lastDay = survivalDay(run);
    this.knownEmergencies = new Set(run.emergencies.map((e) => e.id));
    this.cameras.main.setBackgroundColor(P.ink);
    this.view = new BunkerView(this, { x: 0, y: TOP_H, w: PANEL_X, h: 360 - TOP_H }, {
      dragPans: () => true,
      onTap: (cx, cy, p) => this.tap(cx, cy, p),
      blocked: (x) => x >= PANEL_X,
    });
    this.view.sync(run);
    this.top = new TopBar(this, 'survival', () => this.openMenu(), () => this.openDev(), (k) => this.gaugeInfo(k));
    this.panel = new SurvivalPanel(this, {
      openEmergency: (id) => this.openEmergency(id),
      openPerson: (id) => this.openPerson(id),
      toggleRepair: () => {
        this.repairing = !this.repairing;
        this.relocating = null;
        return this.repairing;
      },
      isRepairing: () => this.repairing,
    });
    this.ticker = new Ticker(this, 4, 356, PANEL_X - 8, run, false);
    this.events.on('resume', () => {
      this.panel.refresh();
      this.view.sync(store.run!);
    });
  }

  // ------------------------------------------------------------ toques no bunker

  private roomAt(cx: number, cy: number): Room | undefined {
    const run = store.run!;
    if (!inBounds(run, cx, cy)) return undefined;
    const id = roomMap(run, true)[idx(run, cx, cy)];
    return id >= 0 ? roomById(run, id) : undefined;
  }

  private tap(cx: number, cy: number, p: Phaser.Input.Pointer): void {
    const room = this.roomAt(cx, cy);
    if (this.repairing) {
      if (!room) return;
      const r = store.dispatch({ t: 'repair', id: room.id });
      if (r.ok) {
        audio.play('repair');
        this.view.highlightRoom(room);
      } else {
        audio.play('error');
        this.showInfo([t(r.reason ?? 'opt.cant')]);
      }
      return;
    }
    if (this.relocating != null) {
      const pid = this.relocating;
      this.relocating = null;
      if (room) {
        const r = store.dispatch({ t: 'home', person: pid, room: room.id });
        audio.play(r.ok ? 'click' : 'error');
      }
      this.view.clearGhost();
      return;
    }
    const pp = ptr(p);
    const pid = this.view.personAt(pp.x, pp.y);
    if (pid != null) {
      this.openPerson(pid);
      return;
    }
    if (room) {
      this.view.highlightRoom(room);
      this.showInfo([t(`room.${room.type}`), ...roomSignals(store.run!, room)]);
    } else this.view.clearGhost();
  }

  private showInfo(lines: string[]): void {
    this.infoBox?.destroy();
    const text = txt(this, 8, TOP_H + 6, lines.join('\n'), 14, P.paper, { wrap: 220 }).setDepth(41);
    const bg = this.add.rectangle(4, TOP_H + 4, 228, text.height + 6, P.ink, 0.85).setOrigin(0, 0).setDepth(40).setStrokeStyle(1, P.shadow);
    this.infoBox = this.add.container(0, 0, [bg, text]).setDepth(40);
    this.infoUntil = this.time.now + 5000;
  }

  private gaugeInfo(k: string): void {
    const lvl = levels(store.run!)[k as keyof ReturnType<typeof levels>];
    this.showInfo([`${t(`hud.${k}`)}: ${t(`hud.level.${lvl}`)}`]);
  }

  // ------------------------------------------------------------ janelas

  private openEmergency(id: number): void {
    this.scene.launch('Event', { from: 'Survival', emergencyId: id });
    this.scene.pause();
  }

  private openPerson(id: number): void {
    const run = store.run!;
    const p = alivePeople(run).find((x) => x.id === id);
    if (!p || this.modal) return;
    const m = new Modal(this, 440, 300);
    const close = () => {
      m.close();
      this.modal = undefined;
    };
    this.modal = m;
    const portrait = this.add.image(m.x + 40, m.y + 80, personKey(this, p.look, p.archetype, p.health === 'doente' ? 'doente' : p.morale < 25 ? 'raiva' : p.morale >= 70 ? 'feliz' : 'ok', 2)).setScale(4 * 0.21).setOrigin(0.5, 1);
    const info = txt(this, m.x + 80, m.y + 12, personSummary(run, p).join('\n'), 15, P.paper, { wrap: 340 });
    m.add(portrait, info);
    m.add(txt(this, m.x + 14, m.y + 112, t('people.role'), 15, P.yellow));
    ROLES.forEach((role, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const b = new Button(this, m.x + 14 + col * 104, m.y + 132 + row * 40, 100, 36, { label: t(`role.${role}`), size: 15 }, () => {
        store.dispatch({ t: 'role', person: p.id, role });
        close();
        this.openPerson(id);
      });
      b.setSelected(p.role === role);
      m.add(b);
    });
    m.add(
      new Button(this, m.x + 14, m.y + 250, 130, 38, { label: t('actions.relocate') }, () => {
        close();
        this.repairing = false;
        this.relocating = p.id;
        this.panel.refresh();
        this.showInfo([t('actions.relocate.desc')]);
      }),
      new Button(this, m.x + 296, m.y + 250, 130, 38, { label: t('settings.back'), style: 'primary' }, close),
    );
    if (p.archetype !== 'viajante') {
      m.add(new Button(this, m.x + 155, m.y + 250, 130, 38, { label: t('people.expel'), style: 'danger' }, () => {
        confirm(this, t('people.expelConfirm', { pessoa: p.nameId }), t('hud.yes'), t('hud.no'), () => {
          store.dispatch({ t: 'expel', person: p.id });
          close();
        });
      }));
    }
  }

  private openMenu(): void {
    if (this.modal) return;
    const prev = store.speed;
    store.speed = 0;
    const m = new Modal(this, 260, 190, t('hud.menu'));
    this.modal = m;
    const close = () => {
      m.close();
      this.modal = undefined;
    };
    m.add(
      new Button(this, m.x + 30, m.y + 40, 200, 38, { label: t('menu.resume'), style: 'primary' }, () => { close(); store.speed = prev || 1; }),
      new Button(this, m.x + 30, m.y + 84, 200, 38, { label: t('menu.settings') }, () => {
        close();
        this.scene.launch('Settings', { from: 'Survival', overlay: true });
        this.scene.pause();
      }),
      new Button(this, m.x + 30, m.y + 128, 200, 38, { label: t('menu.quit') }, () => {
        store.save();
        go(this, 'Title');
      }),
    );
  }

  private openDev(): void {
    this.scene.launch('Dev', { from: 'Survival' });
    this.scene.pause();
  }

  // ------------------------------------------------------------ laço

  update(time: number, delta: number): void {
    let run = store.run;
    if (!run || this.ending) return;
    if (run.outcome) {
      this.ending = true;
      store.save();
      audio.play(run.outcome.kind === 'vitoria' ? 'victory' : 'defeat');
      this.time.delayedCall(900, () => go(this, run!.outcome!.kind === 'vitoria' ? 'Victory' : 'Defeat'));
      return;
    }
    if (run.events.length) {
      store.save();
      this.scene.launch('Event', { from: 'Survival', eventId: run.events[0].id });
      this.scene.pause();
      return;
    }
    const next = this.clock.advance(run, delta, store.speed);
    if (next !== run) {
      store.setRun(next);
      run = next;
    }
    // Sons e tremores para mudanças que importam.
    for (const e of run.emergencies) {
      if (!this.knownEmergencies.has(e.id)) {
        this.knownEmergencies.add(e.id);
        audio.play('alert');
        if (e.type === 'desmoronamento') this.view.shake(250, 0.006);
      }
    }
    const day = survivalDay(run);
    if (day !== this.lastDay) {
      this.lastDay = day;
      store.save();
      this.lastSave = time;
    } else if (time - this.lastSave > 10000) {
      store.save();
      this.lastSave = time;
    }
    if (time > this.nextChatter) this.chatter(run, time);
    this.view.sync(run);
    this.view.update(time, delta, store.speed);
    this.top.update(run);
    this.panel.update(run);
    this.ticker.update(run, time);
    if (this.infoBox && time > this.infoUntil) {
      this.infoBox.destroy();
      this.infoBox = undefined;
    }
  }

  /** Falas soltas: quem está mal reclama em voz alta. */
  private chatter(run: RunState, time: number): void {
    this.nextChatter = time + 15000 + (time % 7000);
    if (store.speed === 0) return;
    const others = alivePeople(run).filter((p) => p.archetype !== 'viajante');
    if (!others.length) return;
    const p = others[Math.floor(time / 1000) % others.length];
    const scared = run.catastrophes.some((c) => c.stage === 'ativa' || c.stage === 'meio') || p.morale < 35;
    if (!scared) return;
    this.view.bubble(p.id, t(`arq.${p.archetype}.medo`, {}, variantOf(run.seed, p.id, time)));
  }
}
