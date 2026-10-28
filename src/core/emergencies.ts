// Emergências: problemas reais criados na simulação, cada um com 2 ou 3
// opções. A última opção é sempre "deixar como está" e é aplicada sozinha
// se o dia acabar sem decisão.

import { BALANCE } from './balance';
import { isEntrance, roomById } from './grid';
import { addChain, addLog, say, survivalDay } from './log';
import { personParams } from './people';
import { chance, pick, pickWeighted, rand } from './rng';
import { alivePeople, bestDorm, entrances, occupantsOfHome, personLocation, roomsOf } from './rooms';
import type { Emergency, EmergencyType, OptionView, Person, Room, RunState } from './state';
import { workers } from './workforce';

const E = BALANCE.emergencies;

interface EmergencyDef {
  type: EmergencyType;
  weight: (s: RunState) => number;
  /** escolhe o alvo e aplica o problema; devolve false se não há alvo */
  spawn: (s: RunState, e: Emergency) => boolean;
  options: (s: RunState, e: Emergency) => OptionView[];
  resolve: (s: RunState, e: Emergency, option: number) => void;
  /** conclusão de uma opção demorada */
  finish?: (s: RunState, e: Emergency) => void;
}

function opt(type: EmergencyType, i: number, hint: OptionView['hint'], disabledReason?: string): OptionView {
  return { label: `emg.${type}.op${i}`, hint, ...(disabledReason ? { disabledReason } : {}) };
}

function person(s: RunState, id?: number): Person | undefined {
  return s.people.find((p) => p.id === id && p.health !== 'morto' && !p.left);
}

function room(s: RunState, id?: number): Room | undefined {
  const r = roomById(s, id);
  return r && !r.collapsed ? r : undefined;
}

function delay(s: RunState, e: Emergency, hours: number, fix: string): void {
  e.resolveAt = s.minute + hours * 60;
  e.pendingFix = fix;
}

function needParts(s: RunState, n: number): string | undefined {
  return s.res.parts < n ? 'opt.noParts' : undefined;
}

function moveOut(s: RunState, r: Room): void {
  for (const p of occupantsOfHome(s, r.id)) {
    const d = bestDorm(s, p.id);
    p.homeId = d && d.id !== r.id ? d.id : null;
  }
  for (const p of alivePeople(s)) if (p.wanderRoomId === r.id) p.wanderRoomId = null;
}

const DEFS: EmergencyDef[] = [
  {
    type: 'gerador',
    // Só gerador já cansado quebra de vez: quem cuida da energia adia o problema.
    weight: (s) => (roomsOf(s, 'generator').some((g) => g.wear >= E.generatorFailWear && g.wear < 100) ? 1 : 0),
    spawn: (s, e) => {
      const g = pick(s, roomsOf(s, 'generator').filter((x) => x.wear >= E.generatorFailWear && x.wear < 100));
      e.targetRoom = g.id;
      g.wear = 100;
      s.brokeToday = true;
      s.stats.generatorFailures++;
      addChain(s, 'chain.generatorStopped');
      return true;
    },
    options: (s, e) => [opt(e.type, 0, 'caro', needParts(s, E.fixGeneratorParts)), opt(e.type, 1, 'demorado'), opt(e.type, 2, 'incerto')],
    resolve: (s, e, o) => {
      const g = room(s, e.targetRoom);
      if (!g) return;
      if (o === 0) {
        s.res.parts -= E.fixGeneratorParts;
        if (chance(s, E.fixGeneratorChance)) { g.wear = 100 - BALANCE.energy.repairWearAmount; s.stats.repairsToday++; say(s, 'emg.gerador.ok'); }
        else say(s, 'emg.gerador.fail');
      } else if (o === 1) delay(s, e, E.hackGeneratorHours, 'gambiarra');
    },
    finish: (s, e) => {
      const g = room(s, e.targetRoom);
      if (!g) return;
      if (chance(s, E.hackGeneratorChance)) { g.wear = E.hackGeneratorWear; s.stats.repairsToday++; say(s, 'emg.gerador.ok'); }
      else say(s, 'emg.gerador.fail');
    },
  },
  {
    type: 'vazamento',
    weight: (s) => (s.rooms.some((r) => !r.collapsed && !r.breach && r.type !== 'corridor') ? 1 : 0),
    spawn: (s, e) => {
      const r = pick(s, s.rooms.filter((x) => !x.collapsed && !x.breach && x.type !== 'corridor'));
      e.targetRoom = r.id;
      r.breach = true;
      r.breachHours = 0;
      s.brokeToday = true;
      addChain(s, 'chain.breach', { sala: r.type });
      return true;
    },
    options: (s, e) => [opt(e.type, 0, 'caro', needParts(s, E.patchParts)), opt(e.type, 1, 'demorado'), opt(e.type, 2, 'arriscado')],
    resolve: (s, e, o) => {
      const r = room(s, e.targetRoom);
      if (!r) return;
      if (o === 0) { s.res.parts -= E.patchParts; r.breach = false; s.stats.repairsToday++; }
      else if (o === 1) {
        for (const p of alivePeople(s)) p.morale += E.mattressMorale;
        delay(s, e, E.mattressHours, 'colchao');
      }
    },
    finish: (s, e) => {
      const r = room(s, e.targetRoom);
      if (r) { r.breach = false; s.stats.repairsToday++; }
    },
  },
  {
    type: 'entrada',
    weight: (s) => (entrances(s).length && !s.hatchOpen ? 0.7 : 0),
    spawn: (s, e) => {
      e.targetRoom = entrances(s)[0].id;
      s.hatchOpen = true;
      s.brokeToday = true;
      addChain(s, 'chain.hatchOpen');
      return true;
    },
    options: (s, e) => [opt(e.type, 0, 'arriscado'), opt(e.type, 1, 'caro', needParts(s, E.weldParts)), opt(e.type, 2, 'arriscado')],
    resolve: (s, e, o) => {
      if (o === 0) {
        s.hatchOpen = false;
        if (chance(s, E.forceHatchInjury)) {
          const able = alivePeople(s).filter((p) => p.health === 'ok');
          if (able.length) { const p = pick(s, able); p.health = 'ferido'; say(s, 'emg.entrada.hurt', personParams(p)); }
        }
      } else if (o === 1) { s.res.parts -= E.weldParts; s.hatchOpen = false; s.stats.repairsToday++; }
      void e;
    },
  },
  {
    type: 'desmoronamento',
    weight: (s) => (s.rooms.some((r) => !r.collapsed && r.type !== 'corridor') ? 0.8 : 0),
    spawn: (s, e) => {
      const r = pickWeighted(s, s.rooms.filter((x) => !x.collapsed && x.type !== 'corridor'), (x) => 150 - x.integrity + 10)!;
      e.targetRoom = r.id;
      r.integrity -= E.collapseDamage;
      s.brokeToday = true;
      addChain(s, 'chain.cracks', { sala: r.type });
      return true;
    },
    options: (s, e) => [opt(e.type, 0, 'caro', needParts(s, E.shoreParts)), opt(e.type, 1, 'seguro'), opt(e.type, 2, 'arriscado')],
    resolve: (s, e, o) => {
      const r = room(s, e.targetRoom);
      if (!r) return;
      if (o === 0) { s.res.parts -= E.shoreParts; r.integrity += E.shoreAmount; s.stats.repairsToday++; }
      else if (o === 1) moveOut(s, r);
      else if (alivePeople(s).some((p) => p.archetype === 'religioso')) for (const p of alivePeople(s)) p.morale += E.prayMorale;
    },
  },
  {
    type: 'agua',
    weight: (s) => (roomsOf(s, 'reservoir').length && !s.waterContaminated && s.res.water > 0 ? 0.8 : 0),
    spawn: (s, e) => {
      e.targetRoom = roomsOf(s, 'reservoir')[0].id;
      s.waterContaminated = true;
      s.contaminationDays = 0;
      addChain(s, 'chain.waterBad');
      return true;
    },
    options: (s, e) => [
      opt(e.type, 0, 'seguro', roomsOf(s, 'kitchen').some((k) => k.powered) ? undefined : 'opt.noKitchen'),
      opt(e.type, 1, 'demorado'),
      opt(e.type, 2, 'arriscado'),
    ],
    resolve: (s, e, o) => {
      if (o === 0) { s.res.water *= 1 - E.boilWaterLoss; s.waterContaminated = false; }
      else if (o === 1) delay(s, e, E.clothHours, 'pano');
    },
    finish: (s) => {
      if (chance(s, E.clothChance)) { s.waterContaminated = false; say(s, 'emg.agua.ok'); }
      else say(s, 'emg.agua.fail');
    },
  },
  {
    type: 'doente',
    weight: (s) => (alivePeople(s).some((p) => p.health === 'ok') ? 0.9 : 0),
    spawn: (s, e) => {
      const p = pickWeighted(s, alivePeople(s).filter((x) => x.health === 'ok'), (x) => (x.archetype === 'hipocondriaco' ? BALANCE.health.hypochondriacSickMult : 1))!;
      e.targetPerson = p.id;
      p.health = 'doente';
      p.sickDays = 0;
      addChain(s, 'chain.sick', personParams(p));
      return true;
    },
    options: (s, e) => [
      opt(e.type, 0, 'caro', s.res.food + s.res.canned < E.brothFood || s.res.water < E.brothWater ? 'opt.noSupplies' : undefined),
      opt(e.type, 1, 'seguro'),
      opt(e.type, 2, 'arriscado'),
    ],
    resolve: (s, e, o) => {
      const p = person(s, e.targetPerson);
      if (!p) return;
      if (o === 0) {
        takeFood(s, E.brothFood);
        s.res.water -= E.brothWater;
        delay(s, e, E.brothHours, 'caldo');
      } else if (o === 1) {
        p.morale += E.isolateMorale;
        const target = s.rooms.filter((r) => !r.collapsed && r.type === 'dorm' && occupantsOfHome(s, r.id).length === 0)[0];
        if (target) p.homeId = target.id;
        p.sickDays = Math.max(0, p.sickDays - 1);
        p.isolated = true;
      }
    },
    finish: (s, e) => {
      const p = person(s, e.targetPerson);
      if (p && p.health === 'doente') { p.health = 'ok'; p.sickDays = 0; say(s, 'emg.doente.ok', personParams(p)); }
    },
  },
  {
    type: 'briga',
    weight: (s) => (alivePeople(s).filter((p) => p.archetype !== 'viajante').length >= 2 ? 0.8 : 0),
    spawn: (s, e) => {
      const ps = alivePeople(s).filter((p) => p.archetype !== 'viajante');
      const a = pickWeighted(s, ps, (p) => 110 - p.morale)!;
      const b = pick(s, ps.filter((p) => p.id !== a.id));
      e.targetPerson = a.id;
      e.targetPerson2 = b.id;
      a.morale += E.fightMorale;
      b.morale += E.fightMorale;
      return true;
    },
    options: (_s, e) => [opt(e.type, 0, 'seguro'), opt(e.type, 1, 'incerto'), opt(e.type, 2, 'arriscado')],
    resolve: (s, e, o) => {
      const a = person(s, e.targetPerson);
      const b = person(s, e.targetPerson2);
      if (!a || !b) return;
      if (o === 0) {
        a.morale += E.separateMorale;
        b.morale += E.separateMorale;
        const d = s.rooms.find((r) => !r.collapsed && r.type === 'dorm' && r.id !== a.homeId);
        if (d) b.homeId = d.id;
      } else if (o === 1) {
        const coach = alivePeople(s).some((p) => p.archetype === 'coach');
        const ok = chance(s, E.mediateBase + (coach ? E.mediateCoach : 0));
        a.morale += ok ? E.mediateMorale : -E.mediateMorale;
        b.morale += ok ? E.mediateMorale : -E.mediateMorale;
        say(s, ok ? 'emg.briga.ok' : 'emg.briga.fail');
      } else if (chance(s, E.fightInjury)) {
        const hurt = rand(s) < 0.5 ? a : b;
        hurt.health = hurt.health === 'ok' ? 'ferido' : hurt.health;
        say(s, 'emg.briga.hurt', personParams(hurt));
      }
    },
  },
  {
    type: 'praga',
    weight: (s) => (roomsOf(s, 'greenhouse').some((g) => !g.pest) ? 0.8 : 0),
    spawn: (s, e) => {
      const g = pick(s, roomsOf(s, 'greenhouse').filter((x) => !x.pest));
      e.targetRoom = g.id;
      g.pest = true;
      s.res.raw *= 1 - E.pestRawLoss;
      addChain(s, 'chain.pest');
      return true;
    },
    options: (s, e) => [opt(e.type, 0, 'demorado'), opt(e.type, 1, 'incerto', s.res.water < E.poisonWater ? 'opt.noWater' : undefined), opt(e.type, 2, 'seguro')],
    resolve: (s, e, o) => {
      const g = room(s, e.targetRoom);
      if (!g) return;
      if (o === 0) {
        for (const p of workers(s, 'comida')) p.morale += E.pickMorale;
        delay(s, e, E.pickHours, 'catar');
      } else if (o === 1) {
        s.res.water -= E.poisonWater;
        if (chance(s, E.poisonChance)) g.pest = false;
        else { s.res.raw *= 1 - E.poisonFailLoss; say(s, 'emg.praga.fail'); }
      } else for (const p of alivePeople(s)) p.morale += E.petsMorale;
    },
    finish: (s, e) => {
      const g = room(s, e.targetRoom);
      if (g) g.pest = false;
    },
  },
  {
    type: 'pedido',
    weight: (s) => (alivePeople(s).some((p) => p.archetype !== 'viajante') ? 0.9 : 0),
    spawn: (s, e) => {
      const p = pickWeighted(s, alivePeople(s).filter((x) => x.archetype !== 'viajante'), (x) => 110 - x.morale)!;
      e.targetPerson = p.id;
      return true;
    },
    options: (_s, e) => [opt(e.type, 0, 'seguro'), opt(e.type, 1, 'incerto'), opt(e.type, 2, 'arriscado')],
    resolve: (s, e, o) => {
      const p = person(s, e.targetPerson);
      if (!p) return;
      if (o === 0) {
        if (e.variant === 0) {
          const d = bestDorm(s, p.id);
          if (d) p.homeId = d.id;
          p.morale += E.requestMorale;
        } else if (e.variant === 1) {
          p.role = 'nenhuma';
          p.morale += E.requestMorale;
        } else {
          p.morale += E.listenMorale;
          const t = alivePeople(s).find((x) => x.archetype === 'viajante');
          if (t) t.morale += E.listenTravelerMorale;
        }
      } else if (o === 1) p.morale += E.promiseMorale;
      else p.morale += E.ignoreRequestMorale;
    },
  },
  {
    type: 'crianca',
    weight: (s) => (alivePeople(s).some((p) => p.archetype === 'crianca' && p.wanderRoomId == null) && workers(s, 'guarda').length === 0 ? 1.5 : 0),
    spawn: (s, e) => {
      const c = alivePeople(s).find((p) => p.archetype === 'crianca' && p.wanderRoomId == null)!;
      e.targetPerson = c.id;
      wander(s, c);
      return true;
    },
    options: (s, e) => [opt(e.type, 0, 'seguro'), opt(e.type, 1, 'demorado', alivePeople(s).some((p) => p.archetype !== 'crianca' && p.archetype !== 'viajante') ? undefined : 'opt.noAdult'), opt(e.type, 2, 'arriscado')],
    resolve: (s, e, o) => {
      const c = person(s, e.targetPerson);
      if (!c) return;
      if (o === 0) c.wanderRoomId = null;
      else if (o === 1) {
        const adult = alivePeople(s).filter((p) => p.archetype !== 'crianca' && p.archetype !== 'viajante').sort((a, b) => (a.role === 'nenhuma' ? -1 : 1) - (b.role === 'nenhuma' ? -1 : 1))[0];
        if (adult) adult.role = 'guarda';
        c.wanderRoomId = null;
      }
    },
  },
];

/** A criança vai para uma sala qualquer e pode abrir a escotilha. */
export function wander(s: RunState, c: Person): void {
  const live = s.rooms.filter((r) => !r.collapsed);
  if (!live.length) return;
  const r = pick(s, live);
  c.wanderRoomId = r.id;
  if (isEntrance(r) && !s.hatchOpen && chance(s, BALANCE.archetypeBonuses.childOpenHatchChance)) {
    s.hatchOpen = true;
    addChain(s, 'chain.childHatch', personParams(c));
  }
}

function takeFood(s: RunState, n: number): void {
  const a = Math.min(s.res.food, n);
  s.res.food -= a;
  s.res.canned = Math.max(0, s.res.canned - (n - a));
}

export function emergencyDef(type: EmergencyType): EmergencyDef {
  return DEFS.find((d) => d.type === type)!;
}

/** Complexidade do bunker: quanto mais coisa, mais coisa quebra. */
export function complexity(s: RunState): number {
  const rooms = s.rooms.filter((r) => !r.collapsed && r.type !== 'corridor').length;
  const eq = s.rooms.filter((r) => !r.collapsed && r.equipment).length;
  return rooms + eq * E.equipmentWeight + alivePeople(s).length * E.personWeight;
}

export function expectedEmergencies(s: RunState): number {
  return E.base + complexity(s) * E.perComplexity;
}

/** Agenda as emergências do dia em horas sorteadas. */
export function scheduleEmergencies(s: RunState): void {
  const n = Math.min(E.max, Math.floor(expectedEmergencies(s) + rand(s)));
  const dayStart = s.minute - (s.minute % BALANCE.time.minutesPerDay);
  s.emergencySchedule = [];
  for (let i = 0; i < n; i++) {
    const hour = 1 + Math.floor(rand(s) * 22);
    s.emergencySchedule.push({ minute: dayStart + hour * 60, type: null });
  }
  s.emergencySchedule.sort((a, b) => a.minute - b.minute);
}

export function spawnEmergency(s: RunState, forced?: EmergencyType): Emergency | undefined {
  const def = forced ? DEFS.find((d) => d.type === forced && d.weight(s) > 0) : pickWeighted(s, DEFS, (d) => d.weight(s));
  if (!def) return undefined;
  const e: Emergency = { id: s.nextId++, type: def.type, day: survivalDay(s), variant: Math.floor(rand(s) * 3), options: [] };
  if (!def.spawn(s, e)) return undefined;
  e.options = def.options(s, e);
  s.emergencies.push(e);
  s.stats.emergenciesTotal++;
  addLog(s, 'log.emergency', { tipo: e.type });
  return e;
}

/** Atualiza as opções (custos podem ter mudado desde que a emergência surgiu). */
export function refreshOptions(s: RunState): void {
  for (const e of s.emergencies) e.options = emergencyDef(e.type).options(s, e);
}

export function resolveEmergency(s: RunState, id: number, option: number): boolean {
  const e = s.emergencies.find((x) => x.id === id);
  if (!e || e.pendingFix) return false;
  const def = emergencyDef(e.type);
  const opts = def.options(s, e);
  if (option < 0 || option >= opts.length || opts[option].disabledReason) return false;
  def.resolve(s, e, option);
  addLog(s, 'log.emergencyResolved', { tipo: e.type, opcao: option });
  if (!e.pendingFix) s.emergencies = s.emergencies.filter((x) => x.id !== id);
  clampMorale(s);
  return true;
}

/** Conclui opções demoradas cujo prazo chegou. */
export function tickEmergencies(s: RunState): void {
  for (const e of [...s.emergencies]) {
    if (e.pendingFix && e.resolveAt != null && s.minute >= e.resolveAt) {
      emergencyDef(e.type).finish?.(s, e);
      s.emergencies = s.emergencies.filter((x) => x.id !== e.id);
    }
  }
  while (s.emergencySchedule.length && s.emergencySchedule[0].minute <= s.minute) {
    const item = s.emergencySchedule.shift()!;
    const e = spawnEmergency(s, item.type ?? undefined);
    if (e) say(s, 'msg.emergency', { tipo: e.type });
  }
}

/** No fim do dia, o que ficou sem resposta recebe a última opção. */
export function autoResolve(s: RunState): void {
  for (const e of [...s.emergencies]) {
    if (e.pendingFix) continue;
    const def = emergencyDef(e.type);
    const last = def.options(s, e).length - 1;
    def.resolve(s, e, last);
    s.emergencies = s.emergencies.filter((x) => x.id !== e.id);
    addLog(s, 'log.emergencyIgnored', { tipo: e.type });
  }
  clampMorale(s);
}

export function clampMorale(s: RunState): void {
  for (const p of s.people) p.morale = Math.max(0, Math.min(100, p.morale));
}

export const EMERGENCY_TYPES: EmergencyType[] = DEFS.map((d) => d.type);

/** Usado pelo modo desenvolvedor e pela simulação em lote. */
export function emergencyLocation(s: RunState, e: Emergency): Room | undefined {
  if (e.targetRoom != null) return room(s, e.targetRoom);
  const p = person(s, e.targetPerson);
  return p ? personLocation(s, p) : undefined;
}
