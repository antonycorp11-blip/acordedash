// Motim: moral baixa por dias seguidos gera aviso; no prazo, decisão.
// Negociar ou reprimir pode falhar (motim vencedor = derrota). Ceder custa caro,
// mas ninguém perde o bunker.

import { BALANCE } from './balance';
import { addChain, say, survivalDay } from './log';
import { killPerson, personParams } from './people';
import { chance, pickWeighted } from './rng';
import { alivePeople } from './rooms';
import { averageMorale } from './systems/morale';
import type { RunState } from './state';
import { effectiveWorkers } from './workforce';

const MU = BALANCE.mutiny;

export function mutinyThreshold(s: RunState): number {
  return s.mods.listening ? MU.listeningThreshold : MU.threshold;
}

export function mutinyDaily(s: RunState): void {
  if (!s.config.mutinyAllowed) return;
  const others = alivePeople(s).filter((p) => p.archetype !== 'viajante');
  if (others.length < 2) {
    s.mutiny.lowDays = 0;
    s.mutiny.stage = 'nenhum';
    return;
  }
  const avg = averageMorale(s, false);
  const day = survivalDay(s);
  const m = s.mutiny;
  if (m.stage === 'nenhum') {
    m.lowDays = avg < mutinyThreshold(s) ? m.lowDays + 1 : Math.max(0, m.lowDays - 1);
    if (m.lowDays >= MU.lowDaysToWarn) {
      const inst = pickWeighted(s, others, (p) => (100 - p.morale) * (p.archetype === 'religioso' ? MU.zealotWeight : 1) + 1)!;
      m.stage = 'aviso';
      m.instigatorId = inst.id;
      m.deadlineDay = day + MU.deadlineDays;
      m.everWarned = true;
      addChain(s, 'chain.mutinyWarning', personParams(inst));
      s.events.push({
        id: s.nextId++, kind: 'motim_aviso', text: `arq.${inst.archetype}.motim`,
        params: { pessoa: inst.nameId, arq: inst.archetype, prazo: MU.deadlineDays },
        options: [{ label: 'opt.ok', hint: 'seguro' }], data: { instigator: inst.id },
      });
    }
  } else if (m.stage === 'aviso' && day >= m.deadlineDay) {
    const inst = alivePeople(s).find((p) => p.id === m.instigatorId);
    if (avg >= MU.recoverAbove || !inst) {
      m.stage = 'nenhum';
      m.lowDays = 0;
      say(s, 'mutiny.dissolved');
      return;
    }
    m.stage = 'decisao';
    s.events.push({
      id: s.nextId++, kind: 'motim_decisao', text: 'mutiny.decision',
      params: { pessoa: inst.nameId },
      options: [
        { label: 'mutiny.op0', hint: 'incerto' },
        { label: 'mutiny.op1', hint: 'arriscado' },
        { label: 'mutiny.op2', hint: 'caro' },
      ],
      data: { instigator: inst.id },
    });
  }
}

export function negotiateChance(s: RunState): number {
  const coach = alivePeople(s).some((p) => p.archetype === 'coach');
  return MU.negotiateBase + (averageMorale(s, false) / 100) * MU.negotiateMoraleFactor + (coach ? MU.negotiateCoach : 0) + s.mods.negotiateBonus;
}

export function repressChance(s: RunState): number {
  return MU.repressBase + effectiveWorkers(s, 'guarda') * MU.repressPerGuard * s.mods.guardMult + s.mods.repressBonus;
}

/** Resolve a decisão do motim. Devolve true se o motim venceu (derrota). */
export function resolveMutiny(s: RunState, option: number): boolean {
  const m = s.mutiny;
  if (m.stage !== 'decisao') return false;
  s.stats.mutinyOccurred = true;
  const inst = alivePeople(s).find((p) => p.id === m.instigatorId);
  const people = alivePeople(s);
  let lost = false;
  if (option === 0) {
    if (chance(s, negotiateChance(s))) {
      for (const k of ['food', 'canned', 'water'] as const) s.res[k] *= 1 - MU.negotiateCost;
      for (const p of people) p.morale = Math.min(100, p.morale + MU.successMorale);
      say(s, 'mutiny.negotiated');
    } else lost = true;
  } else if (option === 1) {
    if (chance(s, repressChance(s))) {
      if (inst) {
        inst.left = true;
        s.stats.sacrificed++;
      }
      for (const p of people) p.morale = Math.max(0, p.morale + MU.repressMorale);
      say(s, 'mutiny.repressed', inst ? personParams(inst) : {});
    } else lost = true;
  } else {
    // Ceder: os insatisfeitos levam metade de tudo e vão embora.
    const unhappy = people.filter((p) => p.archetype !== 'viajante' && p.morale < MU.recoverAbove);
    for (const p of unhappy) p.left = true;
    s.stats.abandoned += unhappy.length;
    for (const k of ['food', 'canned', 'raw', 'water', 'parts'] as const) s.res[k] *= 1 - MU.yieldShare;
    s.res.parts = Math.floor(s.res.parts);
    say(s, 'mutiny.yielded', { n: unhappy.length });
  }
  m.stage = 'nenhum';
  m.lowDays = 0;
  m.instigatorId = null;
  if (lost) {
    addChain(s, 'chain.mutinyWon');
    const t = alivePeople(s).find((p) => p.archetype === 'viajante');
    if (t) killPerson(s, t, 'motim');
    return true;
  }
  m.marks++;
  return false;
}

/** Força um motim (modo desenvolvedor). */
export function forceMutiny(s: RunState): void {
  const others = alivePeople(s).filter((p) => p.archetype !== 'viajante');
  if (others.length < 2) return;
  for (const p of others) p.morale = Math.min(p.morale, 15);
  s.mutiny.lowDays = MU.lowDaysToWarn;
  s.mutiny.stage = 'nenhum';
  const allowed = s.config.mutinyAllowed;
  s.config.mutinyAllowed = true;
  mutinyDaily(s);
  s.config.mutinyAllowed = allowed;
}
