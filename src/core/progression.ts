// Progressão entre runs: configuração da próxima run, pontos de conhecimento,
// entradas do diário e meta de dias.

import { BALANCE } from './balance';
import { survivalDay } from './log';
import type { MetaProgress, RunConfig, RunState, RunSummary } from './state';
import { ARCHETYPES, ENDINGS } from './state';

const P = BALANCE.progression;

export function newMeta(): MetaProgress {
  return {
    knowledge: 0, skills: [], diary: ['d_intro'], unreadDiary: ['d_intro'], runs: 0, wins: 0, endings: [], introSeen: false,
    deathCauses: [], catastrophesSeen: [], archetypesMet: [], totalAccepted: 0, generatorFailuresSeen: 0, lastSummary: null,
  };
}

/** Dificuldade da próxima run (seção 11.4). `runs` é quantas já foram jogadas. */
export function runConfig(meta: MetaProgress): RunConfig {
  const C = BALANCE.catastrophes;
  if (ENDINGS.every((e) => meta.endings.includes(e))) {
    return { goalDays: P.goals[2], catastrophes: 2, mutinyAllowed: true, severity: C.severityAllEndings };
  }
  if (meta.endings.length > 0) {
    return { goalDays: P.goals[1], catastrophes: 2, mutinyAllowed: true, severity: C.severityAfterFirstEnding };
  }
  const n = meta.runs + 1;
  if (n <= P.earlyRuns) return { goalDays: P.goals[0], catastrophes: 1, mutinyAllowed: false, severity: 1 };
  return { goalDays: P.goals[0], catastrophes: 2, mutinyAllowed: true, severity: 1 };
}

interface DiaryCtx {
  meta: MetaProgress;
  run: RunState;
  victory: boolean;
  day: number;
}

/** Entradas do diário, em ordem. Cada uma tem a condição que a libera. */
export const DIARY: { id: string; when: (c: DiaryCtx) => boolean }[] = [
  { id: 'd_intro', when: () => true },
  { id: 'd_primeira_morte', when: (c) => !c.victory },
  { id: 'd_explosao', when: (c) => c.run.phase !== 'build' && c.run.people.some((p) => p.archetype === 'viajante' && p.deathCause !== 'explosao') },
  { id: 'd_recusa', when: (c) => c.run.stats.refused > 0 },
  { id: 'd_gerador', when: (c) => c.meta.generatorFailuresSeen > 0 },
  { id: 'd_sufocamento', when: (c) => c.meta.deathCauses.includes('sufocamento') },
  { id: 'd_fome', when: (c) => c.meta.deathCauses.includes('fome') },
  { id: 'd_sede', when: (c) => c.meta.deathCauses.includes('sede') },
  { id: 'd_desabamento', when: (c) => c.meta.deathCauses.includes('desabamento') || c.run.stats.collapsesAfterExplosion > 0 },
  { id: 'd_frio', when: (c) => c.meta.deathCauses.includes('frio') },
  { id: 'd_calor', when: (c) => c.meta.deathCauses.includes('calor') },
  { id: 'd_doenca', when: (c) => c.meta.deathCauses.includes('doenca') },
  { id: 'd_invasao', when: (c) => c.meta.deathCauses.includes('invasao') },
  { id: 'd_motim', when: (c) => c.meta.deathCauses.includes('motim') || c.run.stats.mutinyOccurred },
  { id: 'd_estragou', when: (c) => c.run.stats.spoiled > 5 },
  { id: 'd_multidao', when: (c) => c.meta.totalAccepted >= 3 },
  { id: 'd_arquetipos', when: (c) => ARCHETYPES.every((a) => c.meta.archetypesMet.includes(a)) },
  { id: 'd_cat_desabamento', when: (c) => c.meta.catastrophesSeen.includes('desabamento') },
  { id: 'd_cat_tribo', when: (c) => c.meta.catastrophesSeen.includes('tribo') },
  { id: 'd_cat_praga', when: (c) => c.meta.catastrophesSeen.includes('praga') },
  { id: 'd_cat_agua', when: (c) => c.meta.catastrophesSeen.includes('agua') },
  { id: 'd_cat_temperatura', when: (c) => c.meta.catastrophesSeen.includes('temperatura') },
  { id: 'd_blecaute', when: (c) => c.meta.catastrophesSeen.includes('blecaute') },
  { id: 'd_dia10', when: (c) => c.day >= 10 },
  { id: 'd_loop5', when: (c) => c.meta.runs >= 5 },
  { id: 'd_vitoria', when: (c) => c.victory },
  { id: 'd_final_coletivo', when: (c) => c.meta.endings.includes('coletivo') },
  { id: 'd_final_solitario', when: (c) => c.meta.endings.includes('solitario') },
  { id: 'd_final_ruptura', when: (c) => c.meta.endings.includes('ruptura') },
  { id: 'd_final_cinismo', when: (c) => c.meta.endings.includes('cinismo') },
  { id: 'd_todos_finais', when: (c) => ENDINGS.every((e) => c.meta.endings.includes(e)) },
];

/** Encerra a run: atualiza o progresso e devolve o resumo. Não muda `run`. */
export function finishRun(meta: MetaProgress, run: RunState): { meta: MetaProgress; summary: RunSummary } {
  const outcome = run.outcome!;
  const victory = outcome.kind === 'vitoria';
  const day = run.phase === 'build' || run.phase === 'countdown' ? 0 : Math.max(0, Math.min(survivalDay(run), run.config.goalDays));
  const m: MetaProgress = structuredClone(meta);
  m.runs++;
  if (victory) m.wins++;
  const newCause = !!outcome.cause && !m.deathCauses.includes(outcome.cause);
  if (outcome.cause && newCause) m.deathCauses.push(outcome.cause);
  if (outcome.ending && !m.endings.includes(outcome.ending)) m.endings.push(outcome.ending);
  for (const c of run.stats.catastrophesFaced) if (!m.catastrophesSeen.includes(c)) m.catastrophesSeen.push(c);
  for (const a of run.stats.archetypesMet) if (!m.archetypesMet.includes(a)) m.archetypesMet.push(a);
  m.totalAccepted += run.stats.accepted;
  m.generatorFailuresSeen += run.stats.generatorFailures;

  let gained = P.knowledgeBase + Math.floor(day / P.knowledgePerDays) + run.stats.catastrophesFaced.length * P.knowledgePerCatastrophe;
  if (newCause) gained += P.knowledgeNewCause;
  if (victory) gained += P.knowledgeVictory;
  gained += run.missions.filter((x) => x.status === 'cumprida').length * BALANCE.missions.successKnowledge;
  m.knowledge += gained;

  const ctx: DiaryCtx = { meta: m, run, victory, day };
  const newDiary: string[] = [];
  for (const d of DIARY) {
    if (!m.diary.includes(d.id) && d.when(ctx)) {
      m.diary.push(d.id);
      m.unreadDiary.push(d.id);
      newDiary.push(d.id);
    }
  }
  const summary: RunSummary = { outcome, knowledgeGained: gained, newDiary, seed: run.seed, daysSurvived: day };
  m.lastSummary = summary;
  return { meta: m, summary };
}
