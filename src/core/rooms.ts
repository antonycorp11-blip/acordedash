// Definições das salas, validação de posicionamento e consultas sobre salas.

import { BALANCE } from './balance';
import { adjacency, idx, inBounds, isEntrance, liveRooms, roomById, roomMap } from './grid';
import { DUG, ROCK, type EquipmentId, type Person, type Room, type RoomType, type RunState } from './state';

export function roomDef(type: RoomType) {
  return BALANCE.rooms[type];
}

export interface PlacementCheck {
  ok: boolean;
  /** chave de texto do motivo quando não pode */
  reason?: string;
  digMinutes: number;
  buildMinutes: number;
  cellsToDig: number;
  rockCells: number;
  /** sala mais rasa do que deveria (o jogador não sabe disso de antemão) */
  unstable: boolean;
}

export function digCost(s: RunState, x: number, y: number): number {
  const t = s.terrain[idx(s, x, y)];
  if (t === DUG) return 0;
  const base = t === ROCK ? BALANCE.grid.digMinutesRock : BALANCE.grid.digMinutesDirt;
  return Math.round(base * s.mods.digMult);
}

export function checkPlacement(s: RunState, type: RoomType, x: number, y: number): PlacementCheck {
  const def = roomDef(type);
  const res: PlacementCheck = { ok: false, digMinutes: 0, buildMinutes: def.buildMinutes, cellsToDig: 0, rockCells: 0, unstable: y < def.minDepth };
  if (s.phase !== 'build') return { ...res, reason: 'build.reason.notBuild' };
  if (!inBounds(s, x, y) || !inBounds(s, x + def.w - 1, y + def.h - 1)) return { ...res, reason: 'build.reason.bounds' };
  if (liveRooms(s).length + s.rooms.filter((r) => r.collapsed).length >= BALANCE.grid.maxRooms) return { ...res, reason: 'build.reason.maxRooms' };
  const map = roomMap(s, true);
  for (let yy = y; yy < y + def.h; yy++) {
    for (let xx = x; xx < x + def.w; xx++) {
      if (map[idx(s, xx, yy)] >= 0) return { ...res, reason: 'build.reason.occupied' };
      const c = digCost(s, xx, yy);
      if (c > 0) {
        res.cellsToDig++;
        res.digMinutes += c;
        if (s.terrain[idx(s, xx, yy)] === ROCK) res.rockCells++;
      }
    }
  }
  // Toda sala precisa encostar em outra; a primeira precisa ser uma entrada.
  const live = liveRooms(s);
  if (live.length === 0) {
    if (!(type === 'corridor' && y === 0)) return { ...res, reason: 'build.reason.firstEntrance' };
  } else {
    let touches = false;
    const probe: Room = { ...blankRoom(-1, type, x, y) };
    const liveMap = roomMap(s);
    const check = (cx: number, cy: number) => {
      if (inBounds(s, cx, cy) && liveMap[idx(s, cx, cy)] >= 0) touches = true;
    };
    for (let xx = probe.x; xx < probe.x + probe.w; xx++) {
      check(xx, probe.y - 1);
      check(xx, probe.y + probe.h);
    }
    for (let yy = probe.y; yy < probe.y + probe.h; yy++) {
      check(probe.x - 1, yy);
      check(probe.x + probe.w, yy);
    }
    if (!touches && !(type === 'corridor' && y === 0)) return { ...res, reason: 'build.reason.isolated' };
  }
  res.ok = true;
  return res;
}

export function blankRoom(id: number, type: RoomType, x: number, y: number): Room {
  const def = roomDef(type);
  return {
    id, type, x, y, w: def.w, h: def.h,
    integrity: BALANCE.grid.baseIntegrity,
    air: BALANCE.air.start,
    wear: 0,
    powered: false,
    powerFrac: 0,
    unstable: y < def.minDepth,
    collapsed: false,
    breach: false,
    breachHours: 0,
    pest: false,
    equipment: null,
    reinforced: 0,
  };
}

export function roomsOf(s: RunState, type: RoomType): Room[] {
  return s.rooms.filter((r) => r.type === type && !r.collapsed);
}

export function dormCapacity(r: Room): number {
  return BALANCE.dorm.capacity + (r.equipment === 'beliche' ? (BALANCE.equipment.beliche.capacityBonus as number) : 0);
}

export function alivePeople(s: RunState): Person[] {
  return s.people.filter((p) => p.health !== 'morto' && !p.left);
}

export function traveler(s: RunState): Person {
  return s.people.find((p) => p.archetype === 'viajante')!;
}

export function occupantsOfHome(s: RunState, roomId: number): Person[] {
  return alivePeople(s).filter((p) => p.homeId === roomId);
}

/** Dormitório com vaga, ou o menos lotado se todos estiverem cheios. */
export function bestDorm(s: RunState, exceptPersonId?: number): Room | undefined {
  const dorms = roomsOf(s, 'dorm');
  let best: Room | undefined;
  let bestFree = -Infinity;
  for (const d of dorms) {
    const occ = alivePeople(s).filter((p) => p.homeId === d.id && p.id !== exceptPersonId).length;
    const free = dormCapacity(d) - occ;
    if (free > bestFree) {
      best = d;
      bestFree = free;
    }
  }
  return best;
}

export function hasDormSpace(s: RunState): boolean {
  return roomsOf(s, 'dorm').some((d) => occupantsOfHome(s, d.id).length < dormCapacity(d));
}

/** Uma sala de abrigo para quem não tem dormitório: qualquer sala viva, de preferência funda. */
export function fallbackShelter(s: RunState): Room | undefined {
  const live = liveRooms(s);
  if (!live.length) return undefined;
  return [...live].sort((a, b) => b.y - a.y || a.id - b.id)[0];
}

function hourOfDay(s: RunState): number {
  return Math.floor((s.minute % BALANCE.time.minutesPerDay) / 60);
}

export function isWorkHours(s: RunState): boolean {
  const h = hourOfDay(s);
  return h >= BALANCE.time.workStartHour && h < BALANCE.time.workEndHour;
}

/** Sala onde a pessoa está agora: trabalho de dia, casa à noite. */
export function personLocation(s: RunState, p: Person): Room | undefined {
  if (p.wanderRoomId != null) {
    const w = roomById(s, p.wanderRoomId);
    if (w && !w.collapsed) return w;
  }
  if (isWorkHours(s) && p.health === 'ok') {
    const workType = BALANCE.roles[p.role];
    if (workType) {
      const rooms = roomsOf(s, workType);
      if (rooms.length) return rooms[p.id % rooms.length];
    }
  }
  const home = roomById(s, p.homeId);
  if (home && !home.collapsed) return home;
  return fallbackShelter(s);
}

export function peopleIn(s: RunState, roomId: number): Person[] {
  return alivePeople(s).filter((p) => personLocation(s, p)?.id === roomId);
}

export function entrances(s: RunState): Room[] {
  return s.rooms.filter(isEntrance);
}

/** Salas ligadas (por adjacência) a uma entrada. */
export function connectedToEntrance(s: RunState): Set<number> {
  const adj = adjacency(s);
  const seen = new Set<number>();
  const stack = entrances(s).map((r) => r.id);
  for (const id of stack) seen.add(id);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const n of adj.get(cur) ?? []) if (!seen.has(n)) { seen.add(n); stack.push(n); }
  }
  return seen;
}

export function canInstall(s: RunState, r: Room, eq: EquipmentId): boolean {
  return s.mods.equipment.includes(eq) && BALANCE.equipment[eq].room === r.type && r.equipment == null && !r.collapsed;
}

export function equipmentFor(type: RoomType): EquipmentId | undefined {
  return (Object.keys(BALANCE.equipment) as EquipmentId[]).find((e) => BALANCE.equipment[e].room === type);
}
