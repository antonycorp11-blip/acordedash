// Catástrofes: uma ou duas por run, depois da explosão. Cada uma tem início
// (com escolha), meio e fim. A segunda sempre testa outro sistema.

import { BALANCE } from './balance';
import { roomById } from './grid';
import { addChain, survivalDay } from './log';
import { killPerson, personParams } from './people';
import { activeCat } from './query';
import { chance, pick, pickWeighted, rand, randInt, randRange } from './rng';
import { alivePeople, bestDorm, entrances, occupantsOfHome, roomsOf } from './rooms';
import { checkCollapses } from './systems/structure';
import type { CatastropheType, GameEvent, OptionView, Room, RunState, ScheduledCatastrophe } from './state';
import { CATASTROPHE_TYPES } from './state';
import { effectiveWorkers } from './workforce';

const C = BALANCE.catastrophes;

/** Sistema que cada catástrofe testa. */
export const CATASTROPHE_SYSTEM: Record<CatastropheType, string> = {
  desabamento: 'estrutura',
  tribo: 'vedacao',
  praga: 'alimento',
  agua: 'agua',
  temperatura: 'clima',
  blecaute: 'energia',
};

function newCat(s: RunState, type: CatastropheType, day: number): ScheduledCatastrophe {
  const dur = C.durations[type];
  return {
    type, day, stage: 'agendada', choice: -1,
    variant: type === 'temperatura' ? (rand(s) < 0.5 ? 0 : 1) : 0,
    midDay: day + Math.max(1, Math.floor(dur / 2)),
    endDay: day + dur,
    targetRooms: [],
    result: 'neutro',
  };
}

export function scheduleCatastrophes(s: RunState): void {
  const goal = s.config.goalDays;
  const first = pickWeighted(s, CATASTROPHE_TYPES, (t) => (t === 'tribo' && s.stats.refused >= C.refusedForTribe ? 4 : 1))!;
  const d1 = randInt(s, C.firstDayMin, Math.max(C.firstDayMin, Math.floor(goal * C.firstDayMaxFrac)));
  s.catastrophes = [newCat(s, first, d1)];
  if (s.config.catastrophes >= 2) {
    const sys = CATASTROPHE_SYSTEM[first];
    const second = pick(s, CATASTROPHE_TYPES.filter((t) => CATASTROPHE_SYSTEM[t] !== sys));
    const lo = Math.max(d1 + C.durations[first] + 1, Math.ceil(goal * C.secondDayMinFrac));
    const d2 = randInt(s, Math.min(lo, goal - 3), Math.max(lo, goal - 3));
    s.catastrophes.push(newCat(s, second, d2));
  }
}

/** Agenda uma invasão extra (gente recusada que ficou do lado de fora). */
export function scheduleExtraTribe(s: RunState): void {
  if (s.catastrophes.some((c) => c.type === 'tribo' && c.stage !== 'terminada')) return;
  const day = survivalDay(s) + randInt(s, 2, 4);
  if (s.catastrophes.some((c) => c.stage !== 'terminada' && day <= c.endDay && day + C.durations.tribo >= c.day)) return;
  s.catastrophes.push(newCat(s, 'tribo', day));
}

function opt(type: CatastropheType, i: number, hint: OptionView['hint'], disabledReason?: string): OptionView {
  return { label: `cat.${type}.op${i}`, hint, ...(disabledReason ? { disabledReason } : {}) };
}

export function catastropheOptions(s: RunState, c: ScheduledCatastrophe): OptionView[] {
  const kitchen = roomsOf(s, 'kitchen').some((k) => k.powered);
  switch (c.type) {
    case 'desabamento':
      return [opt(c.type, 0, 'caro', s.res.parts < C.shoreParts ? 'opt.noParts' : undefined), opt(c.type, 1, 'seguro'), opt(c.type, 2, 'arriscado')];
    case 'tribo':
      return [opt(c.type, 0, 'incerto'), opt(c.type, 1, 'arriscado'), opt(c.type, 2, 'caro')];
    case 'praga':
      return [opt(c.type, 0, 'caro'), opt(c.type, 1, 'incerto', kitchen ? undefined : 'opt.noKitchen'), opt(c.type, 2, 'demorado')];
    case 'agua':
      return [opt(c.type, 0, 'seguro', kitchen ? undefined : 'opt.noKitchen'), opt(c.type, 1, 'demorado'), opt(c.type, 2, 'arriscado')];
    case 'temperatura': {
      const third = c.variant === 0 ? (s.res.parts < C.scrapHeatParts ? 'opt.noParts' : undefined) : s.res.water < C.wetWallsWater ? 'opt.noWater' : undefined;
      return [opt(c.type, 0, 'demorado'), opt(c.type, 1, 'seguro'), { label: `cat.temperatura.op2.${c.variant}`, hint: 'caro', ...(third ? { disabledReason: third } : {}) }];
    }
    case 'blecaute':
      return [opt(c.type, 0, 'demorado'), opt(c.type, 1, 'arriscado'), opt(c.type, 2, 'incerto')];
  }
}

function pushEvent(s: RunState, text: string, c: ScheduledCatastrophe, options: OptionView[], kind: GameEvent['kind'] = 'catastrofe'): void {
  s.events.push({
    id: s.nextId++, kind, text,
    params: { cat: c.type },
    options: options.length ? options : [{ label: 'opt.ok', hint: 'seguro' }],
    data: { cat: s.catastrophes.indexOf(c) },
  });
}

/** Chamado no começo de cada dia de sobrevivência. */
export function catastropheDaily(s: RunState): void {
  const day = survivalDay(s);
  for (const c of s.catastrophes) {
    if (c.stage === 'agendada' && day >= c.day && !s.catastrophes.some((o) => o !== c && (o.stage === 'ativa' || o.stage === 'meio'))) {
      startCatastrophe(s, c);
    } else if (c.stage === 'ativa' && day >= c.midDay) {
      c.stage = 'meio';
      midCatastrophe(s, c);
    } else if (c.stage === 'meio' && day >= c.endDay) {
      endCatastrophe(s, c);
    }
    if (c.stage === 'ativa' || c.stage === 'meio') ongoingDaily(s, c);
  }
}

export function startCatastrophe(s: RunState, c: ScheduledCatastrophe): void {
  const day = survivalDay(s);
  if (c.day !== day) {
    const dur = c.endDay - c.day;
    const mid = c.midDay - c.day;
    c.day = day;
    c.midDay = day + mid;
    c.endDay = day + dur;
  }
  c.stage = 'ativa';
  if (!s.stats.catastrophesFaced.includes(c.type)) s.stats.catastrophesFaced.push(c.type);
  addChain(s, 'chain.cat', { cat: c.type });
  const sev = s.config.severity;
  if (c.type === 'desabamento') {
    const live = s.rooms.filter((r) => !r.collapsed && r.type !== 'corridor');
    const weakest = [...live].sort((a, b) => a.integrity - b.integrity)[0] ?? s.rooms.find((r) => !r.collapsed);
    if (weakest) {
      const near = s.rooms.filter((r) => !r.collapsed && r.id !== weakest.id && Math.abs(r.x - weakest.x) + Math.abs(r.y - weakest.y) <= C.collapseRadius).slice(0, C.collapseExtraRooms);
      c.targetRooms = [weakest.id, ...near.map((r) => r.id)];
      for (const r of targets(s, c)) r.integrity -= C.collapseDamage * sev;
      checkCollapses(s);
    }
  } else if (c.type === 'praga') {
    s.res.raw *= 1 - C.pestRawLoss;
    for (const g of roomsOf(s, 'greenhouse')) c.targetRooms.push(g.id);
  } else if (c.type === 'agua') {
    s.waterContaminated = true;
    s.contaminationDays = 0;
  }
  pushEvent(s, `cat.${c.type}.inicio${c.type === 'temperatura' ? '.' + c.variant : ''}`, c, catastropheOptions(s, c));
}

function targets(s: RunState, c: ScheduledCatastrophe): Room[] {
  return c.targetRooms.map((id) => roomById(s, id)).filter((r): r is Room => !!r && !r.collapsed);
}

/** Aplica a escolha feita no início da catástrofe. */
export function chooseCatastrophe(s: RunState, index: number, option: number): boolean {
  const c = s.catastrophes[index];
  if (!c || c.stage === 'agendada' || c.stage === 'terminada' || c.choice >= 0) return false;
  const opts = catastropheOptions(s, c);
  if (option < 0 || option >= opts.length || opts[option].disabledReason) return false;
  c.choice = option;
  const sev = s.config.severity;
  switch (c.type) {
    case 'desabamento':
      if (option === 0) {
        s.res.parts -= C.shoreParts;
        for (const r of targets(s, c)) r.integrity += C.shoreAmount;
        c.result = 'bem';
      } else if (option === 1) {
        for (const r of targets(s, c)) evacuate(s, r);
      }
      break;
    case 'tribo': {
      if (option === 0) {
        const coach = alivePeople(s).some((p) => p.archetype === 'coach');
        if (chance(s, C.negotiateBase + (coach ? C.negotiateCoach : 0) + s.mods.negotiateBonus - (sev - 1) * C.negotiateSeverityPenalty)) {
          takeShare(s, C.negotiateFoodCost, ['food', 'canned', 'raw']);
          c.result = 'bem';
        } else fight(s, c);
      } else if (option === 1) fight(s, c);
      else {
        takeShare(s, C.tributeFraction, ['food', 'canned', 'raw', 'water', 'parts']);
        c.result = 'neutro';
      }
      break;
    }
    case 'praga':
      if (option === 0) {
        s.res.raw = 0;
        for (const g of roomsOf(s, 'greenhouse')) g.integrity -= C.burnDamage;
        c.endDay = Math.min(c.endDay, survivalDay(s) + 1);
        c.midDay = Math.min(c.midDay, c.endDay);
        c.result = 'bem';
      } else if (option === 1) {
        s.res.food += s.res.raw * C.kitchenSalvage;
        s.res.raw = 0;
      }
      break;
    case 'agua':
      if (option === 0) c.result = 'bem';
      break;
    case 'temperatura':
      if (option === 2) {
        if (c.variant === 0) s.res.parts -= C.scrapHeatParts;
        else s.res.water -= C.wetWallsWater;
      }
      break;
    case 'blecaute':
      break;
  }
  return true;
}

function evacuate(s: RunState, r: Room): void {
  for (const p of occupantsOfHome(s, r.id)) {
    const d = bestDorm(s, p.id);
    p.homeId = d && d.id !== r.id ? d.id : null;
  }
  for (const p of alivePeople(s)) if (p.wanderRoomId === r.id) p.wanderRoomId = null;
}

function takeShare(s: RunState, frac: number, keys: ('food' | 'canned' | 'raw' | 'water' | 'parts')[]): void {
  for (const k of keys) s.res[k] *= 1 - frac;
  s.res.parts = Math.floor(s.res.parts);
}

export function tribeStrength(s: RunState): number {
  return (C.tribeBase + s.stats.refused * C.tribePerRefused + (s.hatchOpen ? C.tribeHatchOpen : 0)) * s.config.severity;
}

export function tribeDefense(s: RunState): number {
  const ents = entrances(s);
  const entIntegrity = ents.length ? ents.reduce((a, r) => a + r.integrity, 0) / ents.length : 0;
  return effectiveWorkers(s, 'guarda') * C.guardDefense * s.mods.guardMult + (s.hatchOpen || !ents.length ? 0 : C.sealedDefense) + entIntegrity * C.entranceDefenseFactor;
}

function fight(s: RunState, c: ScheduledCatastrophe): void {
  const win = tribeDefense(s) * randRange(s, C.fightLuckMin, C.fightLuckMax) >= tribeStrength(s);
  if (win) {
    c.result = 'bem';
    const guards = alivePeople(s).filter((p) => p.role === 'guarda' && p.health === 'ok');
    if (guards.length && chance(s, C.guardInjuryChance)) {
      const g = pick(s, guards);
      g.health = 'ferido';
    }
    return;
  }
  c.result = 'mal';
  takeShare(s, C.stolenFraction, ['food', 'canned', 'raw', 'water', 'parts']);
  const victim = pickWeighted(s, alivePeople(s), (p) => (p.archetype === 'viajante' ? 0.5 : 1));
  if (victim) killPerson(s, victim, 'invasao');
  const hurt = alivePeople(s).filter((p) => p.health === 'ok');
  if (hurt.length) pick(s, hurt).health = 'ferido';
}

function midCatastrophe(s: RunState, c: ScheduledCatastrophe): void {
  const sev = s.config.severity;
  if (c.type === 'desabamento') {
    const dmg = c.choice === 0 ? C.aftershockShored : c.choice === 1 ? C.aftershockEvacuated : C.aftershockIgnored;
    for (const r of targets(s, c)) r.integrity -= dmg * sev;
    checkCollapses(s);
    if (!targets(s, c).length && c.result !== 'bem') c.result = 'mal';
  } else if (c.type === 'tribo' && s.hatchOpen && c.result !== 'mal') {
    takeShare(s, C.stolenFraction / 3, ['food', 'canned', 'raw', 'water']);
    c.result = 'mal';
  }
  pushEvent(s, `cat.${c.type}.meio`, c, []);
  c.stage = 'meio';
}

function endCatastrophe(s: RunState, c: ScheduledCatastrophe): void {
  c.stage = 'terminada';
  if (c.type === 'agua') s.waterContaminated = false;
  if (c.type === 'praga') for (const g of roomsOf(s, 'greenhouse')) g.pest = false;
  if (c.result === 'neutro') c.result = alivePeople(s).length >= 1 && s.stats.collapsesAfterExplosion === 0 ? 'bem' : 'neutro';
  pushEvent(s, `cat.${c.type}.fim.${c.result}`, c, []);
}

/** Efeitos diários enquanto a catástrofe dura. */
function ongoingDaily(s: RunState, c: ScheduledCatastrophe): void {
  const people = alivePeople(s);
  if (c.type === 'agua') {
    const boiling = c.choice === 0 && roomsOf(s, 'kitchen').some((k) => k.powered);
    if (!boiling && c.choice !== 1) {
      for (const p of people) {
        const mult = p.archetype === 'hipocondriaco' ? BALANCE.health.hypochondriacSickMult : 1;
        if (p.health === 'ok' && chance(s, BALANCE.health.contaminatedSickChance * mult)) {
          p.health = 'doente';
          p.sickDays = 0;
          addChain(s, 'chain.sick', personParams(p));
        }
      }
    }
    if (c.choice === 1) for (const p of people) p.morale += C.rationMorale;
  }
  if (c.type === 'temperatura' && c.choice === 1) for (const p of people) p.morale += C.huddleMoralePerDay;
  if (c.type === 'blecaute' && c.choice === 0) for (const p of people) p.morale += C.crankMoralePerDay;
}

/** Catástrofe ativa (para HUD e modo desenvolvedor). */
export function currentCatastrophe(s: RunState): ScheduledCatastrophe | undefined {
  return CATASTROPHE_TYPES.map((t) => activeCat(s, t)).find(Boolean);
}

/** Força uma catástrofe agora (modo desenvolvedor). */
export function forceCatastrophe(s: RunState, type: CatastropheType): void {
  if (s.phase !== 'survival') return;
  for (const c of s.catastrophes) if (c.stage === 'ativa' || c.stage === 'meio') endCatastrophe(s, c);
  const c = newCat(s, type, survivalDay(s));
  s.catastrophes.push(c);
  startCatastrophe(s, c);
}
