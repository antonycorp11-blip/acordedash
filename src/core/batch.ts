// Simulação em lote: constrói bunkers de modelo, joga sozinho com uma política
// simples e resume o resultado. Usada pelo modo desenvolvedor e pelo script
// `npm run batch`.

import { BALANCE } from './balance';
import { applyCommandMut, type Command } from './commands';
import { survivalDay } from './log';
import { newMeta } from './progression';
import { alivePeople, roomsOf } from './rooms';
import { newRun, tickMut } from './simulate';
import type { DeathCause, EndingId, MetaProgress, Role, RoomType, RunState } from './state';

export type TemplateId = 'minimo' | 'equilibrado' | 'complexo';
export const TEMPLATES: TemplateId[] = ['minimo', 'equilibrado', 'complexo'];

type Placement = [RoomType, number, number];

function shaft(x: number, to: number): Placement[] {
  const out: Placement[] = [];
  for (let y = 0; y <= to; y++) out.push(['corridor', x, y]);
  return out;
}

const LAYOUTS: Record<TemplateId, Placement[]> = {
  minimo: [
    ...shaft(14, 9),
    ['dorm', 10, 6], ['generator', 15, 6], ['panel', 15, 4], ['vent', 12, 3], ['reservoir', 15, 8],
  ],
  equilibrado: [
    ...shaft(14, 11),
    ['dorm', 10, 6], ['generator', 15, 6], ['panel', 15, 4], ['vent', 12, 3], ['reservoir', 15, 8],
    ['greenhouse', 10, 8], ['kitchen', 11, 10], ['generator', 15, 10],
  ],
  complexo: [
    ...shaft(14, 15),
    ['dorm', 10, 6], ['generator', 15, 6], ['panel', 15, 4], ['vent', 12, 3], ['reservoir', 15, 8],
    ['greenhouse', 10, 8], ['kitchen', 11, 10], ['generator', 15, 10], ['vent', 15, 2], ['dorm', 10, 12],
    ['greenhouse', 15, 12], ['generator', 15, 14],
  ],
};

const ROLE_CYCLE: Role[] = ['energia', 'ar', 'comida', 'cozinha', 'reparo', 'guarda'];

/** Responde eventos e emergências com uma política simples e previsível. */
export function autoPlay(s: RunState): void {
  for (let guard = 0; guard < 20 && s.events.length; guard++) {
    const e = s.events[0];
    let option = Math.max(0, e.options.findIndex((o) => !o.disabledReason));
    if (e.kind === 'sobrevivente') {
      const space = roomsOf(s, 'dorm').length > 0;
      option = space && alivePeople(s).length < 6 ? 0 : 1;
      if (e.options[0].disabledReason) option = 1;
    }
    const before = alivePeople(s).length;
    if (applyCommandMut(s, { t: 'event', id: e.id, option })) s.events.shift();
    const now = alivePeople(s);
    if (now.length > before) {
      const p = now[now.length - 1];
      p.role = ROLE_CYCLE[(now.length - 2) % ROLE_CYCLE.length];
    }
  }
  for (const e of [...s.emergencies]) {
    if (e.pendingFix) continue;
    const o = e.options.findIndex((x) => !x.disabledReason);
    applyCommandMut(s, { t: 'emergency', id: e.id, option: o < 0 ? e.options.length - 1 : o });
  }
  for (const g of roomsOf(s, 'generator')) {
    if (g.wear >= 100 && s.res.parts >= BALANCE.emergencies.fixGeneratorParts) applyCommandMut(s, { t: 'repair', id: g.id });
  }
}

export function buildTemplate(s: RunState, t: TemplateId): void {
  for (const [room, x, y] of LAYOUTS[t]) {
    applyCommandMut(s, { t: 'place', room, x, y } as Command);
    autoPlay(s);
  }
  if (t === 'complexo') {
    for (const r of s.rooms) {
      if (r.type !== 'corridor') applyCommandMut(s, { t: 'install', id: r.id });
      if (r.y < 5) applyCommandMut(s, { t: 'reinforce', id: r.id });
    }
  }
  applyCommandMut(s, { t: 'hatch', open: false });
}

export interface RunResult {
  template: TemplateId;
  seed: number;
  victory: boolean;
  days: number;
  cause?: DeathCause;
  ending?: EndingId;
  emergencies: number;
}

export function simulateRun(template: TemplateId, seed: number, meta: MetaProgress = { ...newMeta(), runs: 4 }): RunResult {
  const s = newRun(meta, seed);
  buildTemplate(s, template);
  applyCommandMut(s, { t: 'skipBuild' });
  autoPlay(s);
  applyCommandMut(s, { t: 'detonate' });
  const maxTicks = (s.config.goalDays + 2) * 24;
  for (let i = 0; i < maxTicks && !s.outcome; i++) {
    autoPlay(s);
    tickMut(s);
  }
  const days = s.outcome ? (s.outcome.kind === 'vitoria' ? s.config.goalDays : s.outcome.day) : survivalDay(s);
  return {
    template, seed, victory: s.outcome?.kind === 'vitoria', days,
    cause: s.outcome?.cause, ending: s.outcome?.ending, emergencies: s.stats.emergenciesTotal,
  };
}

export interface BatchReport {
  runs: number;
  byTemplate: Record<string, { runs: number; wins: number; avgDays: number; emergenciesPerDay: number }>;
  causes: Record<string, number>;
  endings: Record<string, number>;
  avgDays: number;
  emergenciesPerDay: number;
}

export function summarize(results: RunResult[]): BatchReport {
  const byTemplate: BatchReport['byTemplate'] = {};
  const causes: Record<string, number> = {};
  const endings: Record<string, number> = {};
  let days = 0;
  let em = 0;
  for (const r of results) {
    const b = (byTemplate[r.template] ??= { runs: 0, wins: 0, avgDays: 0, emergenciesPerDay: 0 });
    b.runs++;
    if (r.victory) b.wins++;
    b.avgDays += r.days;
    b.emergenciesPerDay += r.emergencies / Math.max(1, r.days);
    if (r.cause) causes[r.cause] = (causes[r.cause] ?? 0) + 1;
    if (r.ending) endings[r.ending] = (endings[r.ending] ?? 0) + 1;
    days += r.days;
    em += r.emergencies / Math.max(1, r.days);
  }
  for (const b of Object.values(byTemplate)) {
    b.avgDays /= b.runs;
    b.emergenciesPerDay /= b.runs;
  }
  return { runs: results.length, byTemplate, causes, endings, avgDays: days / Math.max(1, results.length), emergenciesPerDay: em / Math.max(1, results.length) };
}

/** Roda o lote inteiro de uma vez (script de linha de comando). */
export function runBatch(n: number, firstSeed = 1): BatchReport {
  const results: RunResult[] = [];
  for (let i = 0; i < n; i++) results.push(simulateRun(TEMPLATES[i % TEMPLATES.length], firstSeed + i * 7919));
  return summarize(results);
}
