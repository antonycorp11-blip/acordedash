// Sobreviventes: chegada (antes ou depois da explosão), aceitar ou recusar,
// saúde diária, expulsão e missões.

import { BALANCE } from './balance';
import { scheduleExtraTribe } from './catastrophes';
import { spawnEmergency } from './emergencies';
import { addLog, say, survivalDay } from './log';
import { createPerson, killPerson, personParams } from './people';
import { chance, pick, pickWeighted, rand, randInt } from './rng';
import { alivePeople, bestDorm, entrances, hasDormSpace, roomsOf } from './rooms';
import type { Archetype, Mission, Person, RunState } from './state';
import { ARCHETYPES } from './state';
import { workers } from './workforce';

const SV = BALANCE.survivors;
const H = BALANCE.health;

/** Agenda batidas na porta dentro de uma janela de minutos. */
export function scheduleArrivals(s: RunState, fromMinute: number, toMinute: number, min: number, max: number): void {
  const n = randInt(s, min, max) + s.mods.extraArrivals;
  for (let i = 0; i < n; i++) {
    s.arrivals.push({ minute: Math.floor(fromMinute + rand(s) * (toMinute - fromMinute)), seed: Math.floor(rand(s) * 0x7fffffff) });
  }
  s.arrivals.sort((a, b) => a.minute - b.minute);
}

/** Arquétipo de quem bate na porta: sai da semente da chegada, sem tocar no gerador principal. */
export function arrivalArchetype(seed: number, s: RunState): Archetype {
  const local = { rng: seed };
  const met = new Set(alivePeople(s).map((p) => p.archetype));
  return pickWeighted(local, ARCHETYPES, (a) => BALANCE.archetypeWeights[a] * (met.has(a) ? 0.4 : 1)) ?? 'coach';
}

export function tickArrivals(s: RunState): void {
  while (s.arrivals.length && s.arrivals[0].minute <= s.minute) {
    const a = s.arrivals.shift()!;
    const archetype = arrivalArchetype(a.seed, s);
    const noDorm = roomsOf(s, 'dorm').length === 0;
    s.events.push({
      id: s.nextId++,
      kind: 'sobrevivente',
      text: `arq.${archetype}.entrada`,
      params: { arq: archetype, fase: s.phase === 'survival' ? 'depois' : 'antes' },
      options: [
        { label: 'sv.aceitar', hint: hasDormSpace(s) ? 'seguro' : 'incerto', ...(noDorm ? { disabledReason: 'opt.noDorm' } : {}) },
        { label: 'sv.recusar', hint: 'incerto' },
      ],
      data: { seed: a.seed, archetype },
    });
  }
}

export function acceptSurvivor(s: RunState, archetype: Archetype, seed: number): Person | undefined {
  if (!roomsOf(s, 'dorm').length) return undefined;
  const p = createPerson(s, archetype, bestDorm(s)?.id ?? null);
  p.look = seed;
  s.people.push(p);
  s.stats.accepted++;
  if (!s.stats.archetypesMet.includes(archetype)) s.stats.archetypesMet.push(archetype);
  if (s.phase === 'survival') {
    // Abrir a porta depois do fim do mundo tem preço.
    for (const e of entrances(s)) e.air = Math.max(0, e.air - SV.arrivalAirLoss);
  }
  addLog(s, 'log.accepted', personParams(p));
  return p;
}

export function refuseSurvivor(s: RunState, archetype: Archetype): void {
  s.stats.refused++;
  s.stats.abandoned++;
  if (!s.stats.archetypesMet.includes(archetype)) s.stats.archetypesMet.push(archetype);
  addLog(s, 'log.refused', { arq: archetype });
  if (s.phase === 'survival' && s.stats.refused >= BALANCE.catastrophes.refusedForTribe) scheduleExtraTribe(s);
}

export function expel(s: RunState, personId: number): boolean {
  const p = alivePeople(s).find((x) => x.id === personId);
  if (!p || p.archetype === 'viajante') return false;
  p.left = true;
  s.stats.abandoned++;
  for (const o of alivePeople(s)) o.morale = Math.max(0, o.morale + BALANCE.morale.expelOthers);
  say(s, 'msg.expelled', personParams(p));
  addLog(s, 'log.expelled', personParams(p));
  return true;
}

/** Saúde: doença evolui, contagia colegas de quarto; feridos se recuperam. */
export function healthDaily(s: RunState): void {
  const people = alivePeople(s);
  for (const p of people) {
    if (p.health === 'doente') {
      p.sickDays++;
      if (p.sickDays >= H.sickDeathDays || (p.sickDays > H.sickGraceDays && chance(s, H.sickDailyDeathChance))) {
        killPerson(s, p, 'doenca');
        continue;
      }
      if (chance(s, H.sickRecoverChance)) {
        p.health = 'ok';
        p.sickDays = 0;
        p.isolated = false;
        continue;
      }
      if (!p.isolated) {
        for (const o of people) {
          if (o.id !== p.id && o.health === 'ok' && o.homeId === p.homeId) {
            const mult = o.archetype === 'hipocondriaco' ? H.hypochondriacSickMult : 1;
            if (chance(s, H.sickSpreadChance * mult)) { o.health = 'doente'; o.sickDays = 0; }
          }
        }
      }
    } else if (p.health === 'ferido' && chance(s, H.injuredRecoverChance)) {
      p.health = 'ok';
    }
  }
  if (s.waterContaminated) {
    s.contaminationDays++;
    for (const p of alivePeople(s)) {
      const mult = p.archetype === 'hipocondriaco' ? H.hypochondriacSickMult : 1;
      if (p.health === 'ok' && chance(s, H.contaminatedSickChance * H.backgroundContaminationMult * mult)) { p.health = 'doente'; p.sickDays = 0; }
    }
    if (s.contaminationDays >= BALANCE.emergencies.contaminationDays && !s.catastrophes.some((c) => c.type === 'agua' && (c.stage === 'ativa' || c.stage === 'meio'))) {
      s.waterContaminated = false;
    }
  }
  // A criança sem guarda some pelo bunker.
  const child = alivePeople(s).find((p) => p.archetype === 'crianca' && p.wanderRoomId == null);
  if (child && workers(s, 'guarda').length === 0 && chance(s, BALANCE.archetypeBonuses.childWanderChance)) {
    const e = spawnEmergency(s, 'crianca');
    if (e) say(s, 'msg.emergency', { tipo: e.type });
  }
  // A criança vigiada volta para casa.
  if (workers(s, 'guarda').length) for (const p of alivePeople(s)) if (p.archetype === 'crianca') p.wanderRoomId = null;
}

/** Missões sorteadas no começo da fase 2. */
export function createMissions(s: RunState): void {
  const others = alivePeople(s).filter((p) => p.archetype !== 'viajante');
  const goal = s.config.goalDays;
  const ms: Mission[] = [];
  if (others.length) {
    const a = pick(s, others);
    ms.push({ type: 'manterVivo', personId: a.id, untilDay: Math.ceil(goal / 2), status: 'ativa' });
    if (others.length > 1) {
      const b = pick(s, others.filter((p) => p.id !== a.id));
      ms.push({ type: 'chegarFim', personId: b.id, status: 'ativa' });
    } else {
      ms.push({ type: 'moral', status: 'ativa' });
    }
  } else {
    ms.push({ type: 'semDesabar', status: 'ativa' });
  }
  s.missions = ms;
  s.events.push({
    id: s.nextId++, kind: 'missao', text: 'mission.intro', params: {},
    options: [{ label: 'opt.ok', hint: 'seguro' }], data: {},
  });
}

function alive(s: RunState, id?: number): boolean {
  return s.people.some((p) => p.id === id && p.health !== 'morto' && !p.left);
}

/** Avalia missões no fechamento do dia (final = chegou à meta). */
export function missionsDaily(s: RunState, final = false): void {
  const day = survivalDay(s);
  for (const m of s.missions) {
    if (m.status !== 'ativa') continue;
    let failed = false;
    let done = false;
    if (m.type === 'manterVivo') {
      if (!alive(s, m.personId)) failed = true;
      else if (day >= (m.untilDay ?? 0)) done = true;
    } else if (m.type === 'chegarFim') {
      if (!alive(s, m.personId)) failed = true;
      else if (final) done = true;
    } else if (m.type === 'moral') {
      const ps = alivePeople(s);
      const avg = ps.length ? ps.reduce((a, p) => a + p.morale, 0) / ps.length : 0;
      if (avg < BALANCE.missions.moraleTarget && day > 1) failed = true;
      else if (final) done = true;
    } else if (m.type === 'semDesabar') {
      if (s.stats.collapsesAfterExplosion > 0) failed = true;
      else if (final) done = true;
    }
    if (failed) {
      m.status = 'falhou';
      for (const p of alivePeople(s)) p.morale = Math.max(0, p.morale + BALANCE.missions.failMorale);
      say(s, 'mission.failed', { missao: m.type, ...(m.personId != null ? { pessoa: s.people.find((p) => p.id === m.personId)!.nameId } : {}) });
    } else if (done) {
      m.status = 'cumprida';
      say(s, 'mission.done', { missao: m.type });
    }
  }
}
