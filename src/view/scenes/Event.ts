// Evento: pausa a simulação para mostrar catástrofe, sobrevivente, motim,
// missão ou emergência, com as opções e as pistas de risco.

import Phaser from 'phaser';
import { roomById } from '../../core/grid';
import { alivePeople } from '../../core/rooms';
import type { Emergency, GameEvent, OptionView, Person, RunState } from '../../core/state';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { personKey } from '../art/survivors';
import { store } from '../store';
import { personName, t, variantOf } from '../text';
import { Button, drawPanel, txt } from '../ui/buttons';
import { missionText } from '../describe';

interface EventData {
  from: string;
  eventId?: number;
  emergencyId?: number;
}

const CAT_ICON: Record<string, string> = { desabamento: 'dust', tribo: 'shield', praga: 'bug', agua: 'sick', temperatura: 'thermo', blecaute: 'nobolt' };
const EMG_ICON: Record<string, string> = {
  gerador: 'wrench', vazamento: 'leak', entrada: 'hatch', desmoronamento: 'dust', agua: 'water', doente: 'sick', briga: 'hurt', praga: 'bug', pedido: 'person', crianca: 'eye',
};

export class EventScene extends Phaser.Scene {
  private data0!: EventData;

  constructor() {
    super('Event');
  }

  create(data: EventData): void {
    this.data0 = data;
    const run = store.run!;
    this.add.rectangle(0, 0, 640, 360, P.ink, 0.72).setOrigin(0, 0).setInteractive();
    const ev = data.eventId != null ? run.events.find((e) => e.id === data.eventId) : undefined;
    const em = data.emergencyId != null ? run.emergencies.find((e) => e.id === data.emergencyId) : undefined;
    if (ev) this.showEvent(run, ev);
    else if (em) this.showEmergency(run, em);
    else this.close();
  }

  private frame(title: string, color: number): { x: number; y: number; w: number; h: number } {
    const w = 500;
    const h = 320;
    const x = 70;
    const y = 20;
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h, P.night);
    g.fillStyle(color);
    g.fillRect(x + 2, y + 2, w - 4, 24);
    txt(this, x + w / 2, y + 4, title, 20, P.ink).setOrigin(0.5, 0);
    if (!store.settings.reduceMotion) {
      g.setScale(0.96);
      this.tweens.add({ targets: g, scale: 1, duration: 140, ease: 'Back.out' });
    }
    return { x, y, w, h };
  }

  private portraitPerson(x: number, y: number, look: number, arch: Person['archetype'], expr: 'ok' | 'medo' | 'raiva' | 'feliz'): void {
    const img = this.add.image(x, y, personKey(this, look, arch, expr, 2)).setScale(4).setOrigin(0.5, 1);
    if (!store.settings.reduceMotion) this.tweens.add({ targets: img, y: y - 3, duration: 500, yoyo: true, repeat: -1 });
  }

  private portraitIcon(x: number, y: number, name: string): void {
    this.add.rectangle(x, y, 52, 52, P.ink).setOrigin(0.5);
    this.add.image(x, y, iconKey(this, name)).setScale(4);
  }

  private body(f: { x: number; y: number; w: number }, text: string, withPortrait = true): Phaser.GameObjects.Text {
    const left = withPortrait ? f.x + 92 : f.x + 14;
    return txt(this, left, f.y + 34, text, 17, P.paper, { wrap: f.x + f.w - 14 - left });
  }

  private showEvent(run: RunState, ev: GameEvent): void {
    const v = variantOf(run.seed, ev.id);
    const params = ev.params;
    let title = '';
    let color: number = P.orange;
    let text = t(ev.text, params, v);
    const f0 = { x: 70, y: 20, w: 500 };
    switch (ev.kind) {
      case 'sobrevivente': {
        title = t('sv.title');
        color = P.paperDark;
        const ctx = t(params.fase === 'depois' ? 'sv.after' : 'sv.before');
        text = `${ctx}\n\n${t('arq.' + params.arq)}:\n${text}`;
        this.frame(title, color);
        this.portraitPerson(f0.x + 48, f0.y + 130, Number(ev.data.seed), ev.data.archetype as Person['archetype'], 'medo');
        break;
      }
      case 'catastrofe': {
        title = t(`cat.${params.cat}`);
        color = P.red;
        const fear = this.fearLine(run, v);
        if (fear && ev.text.includes('.inicio')) text += `\n\n${fear}`;
        this.frame(title, color);
        this.portraitIcon(f0.x + 48, f0.y + 80, CAT_ICON[String(params.cat)] ?? 'alert');
        audio.play('alert');
        break;
      }
      case 'motim_aviso':
      case 'motim_decisao': {
        title = t('mutiny.title');
        color = P.redDark;
        const inst = run.people.find((p) => p.id === Number(ev.data.instigator));
        if (ev.kind === 'motim_aviso' && inst) text = `${personName(inst.nameId)}: ${text}\n\n${t('mutiny.warning', { pessoa: inst.nameId, prazo: params.prazo })}`;
        this.frame(title, color);
        if (inst) this.portraitPerson(f0.x + 48, f0.y + 130, inst.look, inst.archetype, 'raiva');
        audio.play('mutiny');
        break;
      }
      case 'missao': {
        title = t('mission.title');
        color = P.yellow;
        const list = run.missions.map((m) => `• ${missionText(run, m.type, m.personId, m.untilDay)}`).join('\n');
        text = `${text}\n\n${list}`;
        this.frame(title, color);
        this.portraitIcon(f0.x + 48, f0.y + 80, 'mission');
        break;
      }
      default: {
        title = ev.text.startsWith('explosion') ? t('explosion.title') : t('game.title');
        color = P.orange;
        this.frame(title, color);
        this.portraitIcon(f0.x + 48, f0.y + 80, 'book');
      }
    }
    this.body(f0, text);
    this.options(ev.options, (i) => store.dispatch({ t: 'event', id: ev.id, option: i }));
  }

  private showEmergency(run: RunState, em: Emergency): void {
    const v = variantOf(run.seed, em.id);
    const params: Record<string, string | number> = {};
    const room = roomById(run, em.targetRoom);
    if (room) params.sala = room.type;
    const a = run.people.find((p) => p.id === em.targetPerson);
    const b = run.people.find((p) => p.id === em.targetPerson2);
    if (a) params.pessoa = a.nameId;
    if (b) params.pessoa2 = b.nameId;
    const key = em.type === 'pedido' ? `emg.pedido.desc.${em.variant}` : `emg.${em.type}.desc`;
    const f0 = { x: 70, y: 20, w: 500 };
    this.frame(`${t('emg.title')}: ${t(`emg.${em.type}`)}`, P.yellow);
    if (a) this.portraitPerson(f0.x + 48, f0.y + 130, a.look, a.archetype, em.type === 'briga' ? 'raiva' : 'medo');
    else this.portraitIcon(f0.x + 48, f0.y + 80, EMG_ICON[em.type] ?? 'alert');
    this.body(f0, t(key, params, v));
    this.options(em.options, (i) => store.dispatch({ t: 'emergency', id: em.id, option: i }));
  }

  private fearLine(run: RunState, v: number): string | undefined {
    const others = alivePeople(run).filter((p) => p.archetype !== 'viajante');
    if (!others.length) return undefined;
    const p = others[v % others.length];
    return `${personName(p.nameId)}: ${t(`arq.${p.archetype}.medo`, {}, v >> 2)}`;
  }

  private options(opts: OptionView[], choose: (i: number) => { ok: boolean; reason?: string }): void {
    const n = opts.length;
    const bh = 40;
    const gap = 6;
    const top = 340 - 10 - n * bh - (n - 1) * gap;
    opts.forEach((o, i) => {
      const sub = o.disabledReason ? t(o.disabledReason) : o.label === 'opt.ok' ? undefined : t(`hint.${o.hint}`);
      const b = new Button(this, 90, top + i * (bh + gap), 460, bh, { label: t(o.label), sub, style: i === 0 && !o.disabledReason ? 'primary' : 'normal', align: 'left' }, () => {
        const res = choose(i);
        if (!res.ok) {
          audio.play('error');
          return;
        }
        this.close();
      });
      if (o.disabledReason) b.setDisabled(true);
    });
  }

  private close(): void {
    store.save();
    const from = this.data0.from;
    this.scene.stop();
    this.scene.resume(from);
  }
}
