// Simulação: criação da run, tick horário e fechamento diário.
// `tick` é puro (devolve um novo estado). `tickMut` altera o estado recebido e
// existe para a simulação em lote, onde copiar a cada hora seria desperdício.

import { BALANCE } from './balance';
import { catastropheDaily, scheduleCatastrophes } from './catastrophes';
import { autoResolve, refreshOptions, scheduleEmergencies, tickEmergencies } from './emergencies';
import { computeEnding } from './endings';
import { detonate } from './explosion';
import { generateTerrain } from './grid';
import { addLog, say, survivalDay } from './log';
import { mutinyDaily } from './mutiny';
import { createPerson } from './people';
import { runConfig } from './progression';
import { alivePeople, bestDorm, fallbackShelter, traveler } from './rooms';
import { computeMods } from './skills';
import type { MetaProgress, RunState } from './state';
import { breathe, updateAir } from './systems/air';
import { updateClimate } from './systems/climate';
import { updateEnergy, wearGenerators } from './systems/energy';
import { spoil, updateFood, waterCapacity } from './systems/food';
import { moraleDaily } from './systems/morale';
import { checkCollapses, structureDaily } from './systems/structure';
import { createMissions, healthDaily, missionsDaily, scheduleArrivals, tickArrivals } from './survivors';
import { computeTopology } from './topology';

export const SCHEMA = 1;
const T = BALANCE.time;

export function buildEndMinute(): number {
  return T.buildDays * T.minutesPerDay;
}

export function newRun(meta: MetaProgress, seed: number): RunState {
  const s: RunState = {
    schema: SCHEMA,
    seed,
    rng: seed,
    phase: 'build',
    minute: 0,
    explosionMinute: buildEndMinute(),
    config: runConfig(meta),
    mods: computeMods(meta),
    width: BALANCE.grid.width,
    height: BALANCE.grid.height,
    terrain: [],
    rooms: [],
    people: [],
    nextId: 1,
    res: { canned: 0, food: 0, raw: 0, water: 0, parts: BALANCE.resources.startParts, earth: BALANCE.resources.startEarth, battery: 0 },
    hatchOpen: true,
    priority: [...BALANCE.defaultPriority],
    temp: 0,
    waterContaminated: false,
    contaminationDays: 0,
    emergencies: [],
    emergencySchedule: [],
    events: [],
    catastrophes: [],
    arrivals: [],
    mutiny: { lowDays: 0, stage: 'nenhum', instigatorId: null, deadlineDay: 0, everWarned: false, marks: 0 },
    missions: [],
    log: [],
    chain: [],
    messages: [],
    messageSeq: 0,
    stats: {
      accepted: 0, refused: 0, abandoned: 0, sacrificed: 0, catastrophesFaced: [], emergenciesTotal: 0, generatorFailures: 0,
      collapsesAfterExplosion: 0, lastCollapseDay: 0, repairsToday: 0, spoiled: 0, mutinyOccurred: false, explosionReport: [], archetypesMet: [],
    },
    outcome: null,
    brokeToday: false,
    last: { production: 0, demand: 0, deficit: false, surplus: 0, waterIn: 0, rawIn: 0, foodIn: 0 },
  };
  s.terrain = generateTerrain(s);
  s.people.push(createPerson(s, 'viajante', null));
  const day = T.minutesPerDay;
  scheduleArrivals(s, day * 1, day * (T.buildDays - 1), BALANCE.survivors.buildArrivalsMin, BALANCE.survivors.buildArrivalsMax);
  addLog(s, 'log.start');
  say(s, 'msg.buildStart');
  return s;
}

/** Avança minutos durante a construção (relógio e ações que gastam tempo). */
export function advanceBuild(s: RunState, minutes: number): void {
  if (s.phase !== 'build') return;
  const before = Math.floor(s.minute / T.minutesPerDay);
  s.minute = Math.min(buildEndMinute(), s.minute + minutes);
  const after = Math.floor(s.minute / T.minutesPerDay);
  for (let d = before + 1; d <= after; d++) buildDayStart(s, d);
  tickArrivals(s);
  if (s.minute >= buildEndMinute()) {
    s.phase = 'countdown';
    addLog(s, 'log.countdown');
  }
}

function buildDayStart(s: RunState, dayIndex: number): void {
  const left = T.buildDays - dayIndex;
  if (left === 1 && s.hatchOpen) say(s, 'msg.hatchReminder');
  else if (left > 0) say(s, 'msg.daysLeft', { dias: left });
}

/** Começa a fase 2: explosão, recursos iniciais, catástrofes, missões. */
export function startSurvival(s: RunState): void {
  if (s.phase !== 'countdown' && s.phase !== 'build') return;
  s.minute = buildEndMinute();
  s.phase = 'countdown';
  // Quem não tem dormitório se abriga onde dá.
  const t = traveler(s);
  if (t.homeId == null) t.homeId = bestDorm(s)?.id ?? fallbackShelter(s)?.id ?? null;
  s.events = s.events.filter((e) => e.kind !== 'sobrevivente');
  s.arrivals = [];
  detonate(s);
  s.phase = 'survival';
  s.explosionMinute = s.minute;
  s.res.canned = BALANCE.food.startCanned + s.mods.stockFood;
  s.res.water = waterCapacity(s);
  for (const r of s.rooms) if (!r.collapsed) r.air = BALANCE.air.start;
  scheduleCatastrophes(s);
  scheduleArrivals(s, s.minute + T.minutesPerDay * 2, s.minute + T.minutesPerDay * (s.config.goalDays - 2), BALANCE.survivors.survivalArrivalsMin, BALANCE.survivors.survivalArrivalsMax);
  if (checkEnd(s)) return;
  s.events.push({
    id: s.nextId++, kind: 'narrativa', text: 'explosion.after', params: {}, options: [{ label: 'opt.ok', hint: 'seguro' }],
    data: {},
  });
  createMissions(s);
  scheduleEmergencies(s);
  const topo = computeTopology(s);
  updateEnergy(s, topo);
}

/** Um tick = uma hora de jogo. Puro. */
export function tick(state: RunState): RunState {
  const s = structuredClone(state);
  tickMut(s);
  return s;
}

export function tickMut(s: RunState): void {
  if (s.outcome) return;
  if (s.phase === 'build') {
    advanceBuild(s, T.minutesPerTick);
    return;
  }
  if (s.phase !== 'survival') return;

  const prevDay = survivalDay(s);
  s.minute += T.minutesPerTick;

  for (const r of s.rooms) {
    if (r.breach && !r.collapsed) {
      r.breachHours++;
      if (s.mods.autoSeal && r.breachHours >= BALANCE.skills.autoSealHours) r.breach = false;
    }
  }
  const topo = computeTopology(s);
  updateEnergy(s, topo);
  updateFood(s);
  updateAir(s, topo);
  updateClimate(s, topo);
  breathe(s);
  wearGenerators(s);
  tickEmergencies(s);
  tickArrivals(s);
  if (checkEnd(s)) return;

  if (survivalDay(s) !== prevDay) dayClose(s);
  refreshOptions(s);
}

/** Fechamento diário: decisões pendentes, estragos, estrutura, saúde, moral, motim, catástrofes. */
export function dayClose(s: RunState): void {
  autoResolve(s);
  s.stats.spoiled += spoil(s);
  structureDaily(s);
  healthDaily(s);
  moraleDaily(s);
  mutinyDaily(s);
  missionsDaily(s);
  if (s.mods.autoSeal && s.hatchOpen) s.hatchOpen = false;
  if (checkEnd(s)) return;
  catastropheDaily(s);
  checkCollapses(s);
  if (checkEnd(s)) return;
  addLog(s, 'log.day', {
    moral: Math.round(alivePeople(s).reduce((a, p) => a + p.morale, 0) / Math.max(1, alivePeople(s).length)),
    vivos: alivePeople(s).length,
  });
  s.brokeToday = false;
  s.stats.repairsToday = 0;
  scheduleEmergencies(s);
}

/** Verifica derrota (viajante morto) e vitória (meta de dias). */
export function checkEnd(s: RunState): boolean {
  if (s.outcome) return true;
  const t = traveler(s);
  if (t.health === 'morto') {
    s.outcome = { kind: 'derrota', day: survivalDay(s), cause: t.deathCause ?? 'explosao' };
    s.phase = 'ended';
    return true;
  }
  if (s.phase === 'survival' && s.minute - s.explosionMinute >= s.config.goalDays * T.minutesPerDay) {
    missionsDaily(s, true);
    s.outcome = { kind: 'vitoria', day: s.config.goalDays, ending: computeEnding(s) };
    s.phase = 'ended';
    return true;
  }
  return false;
}
