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
import { Button, drawPanel, txt, hiRes } from '../ui/buttons';
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

interface Spec {
  title: string;
  color: number;
  text: string;
  portrait: (x: number, y: number) => void;
  options: OptionView[];
  choose: (i: number) => { ok: boolean; reason?: string };
}

export class EventScene extends Phaser.Scene {
  private data0!: EventData;

  constructor() {
    super('Event');
  }

  create(data: EventData): void {
    hiRes(this);
    this.data0 = data;
    const run = store.run!;
    this.add.rectangle(0, 0, 640, 360, P.ink, 0.72).setOrigin(0, 0).setInteractive();
    const ev = data.eventId != null ? run.events.find((e) => e.id === data.eventId) : undefined;
    const em = data.emergencyId != null ? run.emergencies.find((e) => e.id === data.emergencyId) : undefined;
    if (ev) this.showEvent(run, ev);
    else if (em) this.showEmergency(run, em);
    else this.close();
  }

  /**
   * Monta a janela do tamanho do conteúdo: texto à direita do retrato,
   * opções embaixo. Centralizada na tela.
   */
  private render(spec: Spec): void {
    const w = 500;
    const x = 70;
    const n = spec.options.length;
    const bh = 40;
    const gap = 6;
    const optsH = n * bh + (n - 1) * gap;
    const left = x + 98;
    const body = txt(this, left, 0, spec.text, 18, P.paper, { wrap: x + w - 16 - left, body: true }).setDepth(2);
    const contentH = Math.max(body.height, 104);
    const h = Math.min(340, 30 + contentH + 14 + optsH + 12);
    const y = Math.round((360 - h) / 2);
    body.setY(y + 34);
    const g = this.add.graphics().setDepth(1);
    drawPanel(g, x, y, w, h, P.night);
    g.fillStyle(spec.color);
    g.fillRect(x + 2, y + 2, w - 4, 24);
    g.fillStyle(0x000000, 0.2);
    g.fillRect(x + 2, y + 24, w - 4, 2);
    txt(this, x + w / 2, y + 14, spec.title, 20, P.ink, { title: true }).setOrigin(0.5).setDepth(2);
    // Moldura do retrato.
    g.fillStyle(P.ink);
    g.fillRect(x + 12, y + 34, 76, 100);
    g.fillStyle(0x2a2238);
    g.fillRect(x + 13, y + 35, 74, 98);
    g.fillStyle(spec.color, 0.25);
    g.fillRect(x + 13, y + 95, 74, 38);
    spec.portrait(x + 50, y + 34);
    const top = y + h - 12 - optsH;
    spec.options.forEach((o, i) => {
      const sub = o.disabledReason ? t(o.disabledReason) : o.label === 'opt.ok' ? undefined : t(`hint.${o.hint}`);
      const b = new Button(this, x + 20, top + i * (bh + gap), w - 40, bh, { label: t(o.label), sub, style: i === 0 && !o.disabledReason ? 'primary' : 'normal', align: 'left' }, () => {
        const res = spec.choose(i);
        if (!res.ok) {
          audio.play('error');
          return;
        }
        this.close();
      }).setDepth(3);
      if (o.disabledReason) b.setDisabled(true);
    });
    if (!store.settings.reduceMotion) {
      this.cameras.main.setAlpha(0);
      this.tweens.add({ targets: this.cameras.main, alpha: 1, duration: 120 });
    }
  }

  /** Retrato de pessoa grande, respirando. `x, y`: centro do topo da moldura. */
  private person(look: number, arch: Person['archetype'], expr: 'ok' | 'medo' | 'raiva' | 'feliz'): (x: number, y: number) => void {
    return (x, y) => {
      const img = this.add.image(x, y + 96, personKey(this, look, arch, expr, 2)).setScale(5 * 0.21).setOrigin(0.5, 1).setDepth(2);
      if (!store.settings.reduceMotion) this.tweens.add({ targets: img, y: y + 94, duration: 600, yoyo: true, repeat: -1 });
    };
  }

  private icon(name: string): (x: number, y: number) => void {
    return (x, y) => {
      this.add.image(x, y + 50, iconKey(this, name)).setScale(5 / 4).setDepth(2);
    };
  }

  private showEvent(run: RunState, ev: GameEvent): void {
    const v = variantOf(run.seed, ev.id);
    const params = ev.params;
    let text = t(ev.text, params, v);
    let spec: Omit<Spec, 'text' | 'options' | 'choose'>;
    switch (ev.kind) {
      case 'sobrevivente': {
        const ctx = t(params.fase === 'depois' ? 'sv.after' : 'sv.before');
        text = `${ctx}\n\n${t('arq.' + params.arq)}:\n${text}`;
        spec = { title: t('sv.title'), color: P.paperDark, portrait: this.person(Number(ev.data.seed), ev.data.archetype as Person['archetype'], 'medo') };
        break;
      }
      case 'catastrofe': {
        const fear = this.fearLine(run, v);
        if (fear && ev.text.includes('.inicio')) text += `\n\n${fear}`;
        spec = { title: t(`cat.${params.cat}`), color: P.red, portrait: this.icon(CAT_ICON[String(params.cat)] ?? 'alert') };
        audio.play('alert');
        break;
      }
      case 'motim_aviso':
      case 'motim_decisao': {
        const inst = run.people.find((p) => p.id === Number(ev.data.instigator));
        if (ev.kind === 'motim_aviso' && inst) text = `${personName(inst.nameId)}: ${text}\n\n${t('mutiny.warning', { pessoa: inst.nameId, prazo: params.prazo })}`;
        spec = { title: t('mutiny.title'), color: P.red, portrait: inst ? this.person(inst.look, inst.archetype, 'raiva') : this.icon('alert') };
        audio.play('mutiny');
        break;
      }
      case 'missao': {
        const list = run.missions.map((m) => `• ${missionText(run, m.type, m.personId, m.untilDay)}`).join('\n');
        text = `${text}\n\n${list}`;
        spec = { title: t('mission.title'), color: P.yellow, portrait: this.icon('mission') };
        break;
      }
      default:
        spec = { title: ev.text.startsWith('explosion') ? t('explosion.title') : t('game.title'), color: P.orange, portrait: this.icon('book') };
    }
    this.render({ ...spec, text, options: ev.options, choose: (i) => store.dispatch({ t: 'event', id: ev.id, option: i }) });
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
    this.render({
      title: `${t('emg.title')}: ${t(`emg.${em.type}`)}`,
      color: P.yellow,
      portrait: a ? this.person(a.look, a.archetype, em.type === 'briga' ? 'raiva' : 'medo') : this.icon(EMG_ICON[em.type] ?? 'alert'),
      text: t(key, params, v),
      options: em.options,
      choose: (i) => store.dispatch({ t: 'emergency', id: em.id, option: i }),
    });
  }

  private fearLine(run: RunState, v: number): string | undefined {
    const others = alivePeople(run).filter((p) => p.archetype !== 'viajante');
    if (!others.length) return undefined;
    const p = others[v % others.length];
    return `${personName(p.nameId)}: ${t(`arq.${p.archetype}.medo`, {}, v >> 2)}`;
  }

  private close(): void {
    store.save();
    const from = this.data0.from;
    this.scene.stop();
    this.scene.resume(from);
  }
}
