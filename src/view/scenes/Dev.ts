// Modo desenvolvedor: valores ocultos em tempo real, log diário, salas,
// pessoas, ações de teste e simulação em lote. Aberto por atalho secreto.

import Phaser from 'phaser';
import { BALANCE } from '../../core/balance';
import { simulateRun, summarize, TEMPLATES, type BatchReport, type RunResult } from '../../core/batch';
import { complexity, EMERGENCY_TYPES, expectedEmergencies } from '../../core/emergencies';
import { survivalDay } from '../../core/log';
import { DIARY } from '../../core/progression';
import { alivePeople, personLocation } from '../../core/rooms';
import { seedFrom } from '../../core/rng';
import { CATASTROPHE_TYPES, type RunState } from '../../core/state';
import { averageMorale } from '../../core/systems/morale';
import { computeTopology } from '../../core/topology';
import { P } from '../art/palette';
import { store } from '../store';
import { personName, t } from '../text';
import { Button, drawPanel, txt, hiRes, LEFT, VW } from '../ui/buttons';
import { ScrollArea } from '../ui/scroll';

type Tab = 'values' | 'log' | 'rooms' | 'people' | 'actions' | 'batch';

export class Dev extends Phaser.Scene {
  private from = 'Title';
  private tab: Tab = 'values';
  private area!: ScrollArea;
  private tabBtns = new Map<Tab, Button>();
  private batch: { results: RunResult[]; running: boolean; report?: BatchReport } = { results: [], running: false };
  private emergencyIdx = 0;
  private roomIdx = 0;

  constructor() {
    super('Dev');
  }

  create(data: { from: string }): void {
    hiRes(this);
    this.from = data.from;
    this.tabBtns.clear();
    this.add.rectangle(LEFT, 0, VW, 360, P.ink, 0.88).setOrigin(0, 0).setInteractive();
    const g = this.add.graphics();
    drawPanel(g, 6, 6, 628, 348, P.night);
    txt(this, 14, 10, t('dev.title'), 16, P.green);
    const tabs: Tab[] = ['values', 'log', 'rooms', 'people', 'actions', 'batch'];
    tabs.forEach((k, i) => {
      const b = new Button(this, 14 + i * 84, 30, 80, 32, { label: t(`dev.tab.${k}`), size: 15 }, () => this.setTab(k));
      this.tabBtns.set(k, b);
    });
    new Button(this, 540, 30, 86, 32, { label: t('dev.close'), style: 'danger', size: 15 }, () => this.close());
    this.area = new ScrollArea(this, 14, 68, 612, 280);
    this.setTab('values');
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    for (const [k, b] of this.tabBtns) b.setSelected(k === tab);
    this.render();
  }

  private mono(lines: string[]): void {
    this.area.content.add(txt(this, 0, 0, lines.join('\n'), 14, P.paper, { wrap: 600 }));
  }

  private render(): void {
    this.area.clear();
    const run = store.run;
    if (this.tab === 'batch') return this.renderBatch();
    if (this.tab === 'actions') return this.renderActions(run);
    if (!run) return this.mono([t('dev.noRun')]);
    if (this.tab === 'values') return this.mono(this.values(run));
    if (this.tab === 'log') return this.mono(run.log.slice(-60).reverse().map((l) => `[${l.day}] ${t(l.key, l.params)}`));
    if (this.tab === 'rooms') {
      const topo = computeTopology(run);
      return this.mono(run.rooms.map((r) =>
        `#${r.id} ${r.type} (${r.x},${r.y}) int=${r.integrity.toFixed(0)} ar=${r.air.toFixed(0)} desg=${r.wear.toFixed(0)} pow=${r.powerFrac.toFixed(2)} ved=${topo.sealed.get(r.id) ?? '-'} brecha=${r.breach} praga=${r.pest} inst=${r.unstable} eq=${r.equipment ?? '-'} ${r.collapsed ? 'DESABOU' : ''}`));
    }
    if (this.tab === 'people') {
      return this.mono(run.people.map((p) =>
        `#${p.id} ${personName(p.nameId)} [${p.archetype}] ${p.health} moral=${p.morale.toFixed(0)} fome=${p.hunger.toFixed(0)} sede=${p.thirst.toFixed(0)} suf=${p.suffocation.toFixed(0)} exp=${p.exposure.toFixed(0)} função=${p.role} casa=${p.homeId} local=${personLocation(run, p)?.type ?? '-'}${p.left ? ' (saiu)' : ''}${p.deathCause ? ' morto:' + p.deathCause : ''}`));
    }
  }

  private values(run: RunState): string[] {
    const L = run.last;
    const live = run.rooms.filter((r) => !r.collapsed);
    const air = live.length ? live.reduce((a, r) => a + r.air, 0) / live.length : 0;
    return [
      t('dev.seed', { n: run.seed }) + `  rng=${run.rng}  fase=${run.phase}  minuto=${run.minute}  dia=${survivalDay(run)}/${run.config.goalDays}`,
      `config: ${JSON.stringify(run.config)}`,
      `energia: prod=${L.production.toFixed(2)} demanda=${L.demand.toFixed(2)} sobra=${L.surplus.toFixed(2)} déficit=${L.deficit} bateria=${run.res.battery.toFixed(1)}`,
      `entrada/h: água=${L.waterIn.toFixed(3)} crua=${L.rawIn.toFixed(3)} comida=${L.foodIn.toFixed(3)}`,
      `recursos: lata=${run.res.canned.toFixed(1)} comida=${run.res.food.toFixed(1)} crua=${run.res.raw.toFixed(1)} água=${run.res.water.toFixed(1)} peças=${run.res.parts} terra=${run.res.earth}`,
      `ar médio=${air.toFixed(1)} temp=${run.temp.toFixed(1)} contaminada=${run.waterContaminated} escotilha=${run.hatchOpen ? 'aberta' : 'fechada'}`,
      `moral média=${averageMorale(run).toFixed(1)} vivos=${alivePeople(run).length} motim=${JSON.stringify(run.mutiny)}`,
      `complexidade=${complexity(run).toFixed(1)} emergências esperadas/dia=${expectedEmergencies(run).toFixed(2)} abertas=${run.emergencies.length} agendadas=${run.emergencySchedule.length}`,
      `catástrofes: ${run.catastrophes.map((c) => `${c.type}@${c.day}:${c.stage}:op${c.choice}:${c.result}`).join(' | ')}`,
      `stats: ${JSON.stringify(run.stats)}`,
      `mods: ${JSON.stringify(run.mods)}`,
    ];
  }

  private renderActions(run: RunState | null): void {
    const c = this.area.content;
    const btn = (i: number, label: string, fn: () => void, disabled = false) => {
      const b = new Button(this, (i % 4) * 152, Math.floor(i / 4) * 40, 148, 36, { label, size: 14 }, this.area.guard(() => {
        fn();
        store.save();
        this.render();
      }));
      b.setDisabled(disabled);
      c.add(b);
    };
    const noRun = !run || !!run.outcome;
    let i = 0;
    btn(i++, t('dev.skipDay'), () => store.dispatch({ t: 'devSkipDays', days: 1 }), noRun);
    btn(i++, t('dev.skip5'), () => store.dispatch({ t: 'devSkipDays', days: 5 }), noRun);
    btn(i++, t('dev.forceMutiny'), () => store.dispatch({ t: 'devMutiny' }), noRun || run?.phase !== 'survival');
    btn(i++, `${t('dev.forceEmergency')}: ${EMERGENCY_TYPES[this.emergencyIdx]}`, () => {
      store.dispatch({ t: 'devEmergency', type: EMERGENCY_TYPES[this.emergencyIdx] });
      this.emergencyIdx = (this.emergencyIdx + 1) % EMERGENCY_TYPES.length;
    }, noRun || run?.phase !== 'survival');
    for (const cat of CATASTROPHE_TYPES) btn(i++, t('dev.forceCat', { cat }), () => store.dispatch({ t: 'devCatastrophe', type: cat }), noRun || run?.phase !== 'survival');
    btn(i++, t('dev.addRes'), () => store.dispatch({ t: 'devResources' }), noRun);
    const live = run ? run.rooms.filter((r) => !r.collapsed) : [];
    const target = live.length ? live[this.roomIdx % live.length] : undefined;
    btn(i++, `${t('dev.teleport')}${target ? ': ' + t(`room.short.${target.type}`) + ' #' + target.id : ''}`, () => {
      if (target) store.dispatch({ t: 'devTeleport', room: target.id });
      this.roomIdx++;
    }, noRun || !target);
    btn(i++, t('dev.newSeed'), () => store.dispatch({ t: 'devSeed', seed: seedFrom(Date.now()) }), noRun);
    btn(i++, t('dev.unlockAll'), () => store.updateMeta((m) => ({
      ...m, knowledge: m.knowledge + 50, wins: Math.max(1, m.wins), diary: DIARY.map((d) => d.id),
    })));
  }

  private renderBatch(): void {
    const c = this.area.content;
    const n = BALANCE.dev.batchRuns;
    const b = new Button(this, 0, 0, 200, 36, { label: this.batch.running ? t('dev.running', { n: this.batch.results.length }) : t('dev.runBatch', { n }), style: 'primary', size: 15 }, this.area.guard(() => this.startBatch(n)));
    b.setDisabled(this.batch.running);
    c.add(b);
    const rep = this.batch.report;
    if (!rep) return;
    const lines: string[] = [];
    for (const [tpl, v] of Object.entries(rep.byTemplate)) {
      lines.push(t('dev.winRate', { t: t(`dev.template.${tpl}`), w: v.wins, n: v.runs, d: v.avgDays.toFixed(1), e: v.emergenciesPerDay.toFixed(2) }));
    }
    lines.push('', t('dev.avgDays', { n: rep.avgDays.toFixed(1) }), t('dev.emPerDay', { n: rep.emergenciesPerDay.toFixed(2) }));
    lines.push('', t('dev.causes') + ': ' + Object.entries(rep.causes).sort((a, b2) => b2[1] - a[1]).map(([k, v]) => `${t(`causaNome.${k}`)} ${v}`).join(', '));
    lines.push(t('dev.endings') + ': ' + Object.entries(rep.endings).map(([k, v]) => `${t(`ending.${k}`)} ${v}`).join(', '));
    c.add(txt(this, 0, 44, lines.join('\n'), 15, P.paper, { wrap: 600 }));
  }

  /** Roda o lote aos pedaços para não travar a tela. */
  private startBatch(n: number): void {
    this.batch = { results: [], running: true };
    const step = () => {
      for (let k = 0; k < 3 && this.batch.results.length < n; k++) {
        const i = this.batch.results.length;
        this.batch.results.push(simulateRun(TEMPLATES[i % TEMPLATES.length], 1000 + i * 7919));
      }
      if (this.batch.results.length >= n) {
        this.batch.running = false;
        this.batch.report = summarize(this.batch.results);
      } else this.time.delayedCall(1, step);
      if (this.tab === 'batch') this.render();
    };
    step();
  }

  private close(): void {
    this.scene.stop();
    if (this.from === 'Title') this.scene.stop('Title').start('Title');
    else this.scene.resume(this.from);
  }
}
