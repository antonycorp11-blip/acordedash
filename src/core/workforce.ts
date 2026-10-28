// Força de trabalho por função: quantas pessoas efetivas estão em cada função,
// e se a função está sobrecarregada.

import { BALANCE } from './balance';
import { alivePeople, roomsOf } from './rooms';
import type { Person, Role, RunState } from './state';

export function workMult(p: Person): number {
  if (p.health === 'doente') return BALANCE.health.sickWorkMult;
  if (p.health === 'ferido') return BALANCE.health.injuredWorkMult;
  return 1;
}

export function workers(s: RunState, role: Role): Person[] {
  return alivePeople(s).filter((p) => p.role === role);
}

/** Pessoas efetivas na função (doentes e feridos contam menos). */
export function effectiveWorkers(s: RunState, role: Role): number {
  let n = 0;
  for (const p of workers(s, role)) n += workMult(p);
  return n * (1 + s.mods.roleBonus);
}

/** Fração (0..1) de cobertura de uma função sobre as salas do tipo que ela opera. */
export function coverage(s: RunState, role: Role): number {
  const type = BALANCE.roles[role];
  const eff = effectiveWorkers(s, role);
  if (!type) return Math.min(1, eff);
  const n = roomsOf(s, type).length;
  if (n === 0) return 0;
  return Math.min(1, eff / n);
}

/** Uma pessoa está sobrecarregada quando cuida de salas demais sozinha. */
export function isOverworked(s: RunState, p: Person): boolean {
  const type = BALANCE.roles[p.role];
  if (!type) return false;
  const n = roomsOf(s, type).length;
  const w = workers(s, p.role).length;
  if (w === 0) return false;
  return n / w > BALANCE.morale.overworkRoomsPerWorker * s.mods.overworkMult;
}
