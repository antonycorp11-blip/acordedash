// Ar: ventilação produz, pessoas e o próprio tempo consomem, salas abertas vazam.
// O ar se espalha entre salas vizinhas por difusão.

import { BALANCE } from '../balance';
import { isEntrance } from '../grid';
import { addChain } from '../log';
import { killPerson } from '../people';
import { alivePeople, personLocation } from '../rooms';
import type { Room, RunState } from '../state';
import type { Topology } from '../topology';
import { coverage } from '../workforce';

const A = BALANCE.air;

export function ventOutput(s: RunState, v: Room, topo: Topology): number {
  if (v.collapsed || v.powerFrac <= 0) return 0;
  let out = A.ventOutput * s.mods.ventMult * v.powerFrac * (1 + A.operatorBonus * coverage(s, 'ar'));
  if (v.equipment === 'filtro') out *= 1 + (BALANCE.equipment.filtro.outputBonus as number);
  if (!topo.sealed.get(v.id)) out *= 0.5;
  return out;
}

/** Quanto ar a sala perde por hora por estar aberta. */
export function roomLeak(s: RunState, r: Room, topo: Topology): number {
  let leak = 0;
  if (r.breach) leak += A.leakBreach;
  if (isEntrance(r) && s.hatchOpen) leak += A.leakHatch;
  else if (!topo.sealed.get(r.id) && !r.breach) leak += A.leakUnsealed;
  return leak * s.mods.leakMult;
}

export function updateAir(s: RunState, topo: Topology): void {
  const live = s.rooms.filter((r) => !r.collapsed);
  const occupants = new Map<number, number>();
  for (const p of alivePeople(s)) {
    const loc = personLocation(s, p);
    if (loc) occupants.set(loc.id, (occupants.get(loc.id) ?? 0) + 1);
  }

  // Oferta de ar por componente, repartida igualmente.
  const supplyByComp = new Map<number, number>();
  const roomsByComp = new Map<number, number>();
  for (const r of live) {
    const c = topo.comp.get(r.id)!;
    roomsByComp.set(c, (roomsByComp.get(c) ?? 0) + 1);
    if (r.type === 'vent') supplyByComp.set(c, (supplyByComp.get(c) ?? 0) + ventOutput(s, r, topo));
  }

  for (const r of live) {
    const c = topo.comp.get(r.id)!;
    const supply = (supplyByComp.get(c) ?? 0) / (roomsByComp.get(c) ?? 1);
    const use = (occupants.get(r.id) ?? 0) * A.personUse + A.staleness * s.mods.stalenessMult;
    r.air = clamp(r.air + supply - use - roomLeak(s, r, topo));
  }

  // Difusão síncrona entre vizinhos.
  const d = Math.min(0.5, A.diffusion + s.mods.diffusionBonus);
  const next = new Map<number, number>();
  for (const r of live) {
    const ns = [...(topo.adj.get(r.id) ?? [])];
    if (!ns.length) { next.set(r.id, r.air); continue; }
    let sum = 0;
    for (const n of ns) sum += s.rooms.find((x) => x.id === n)!.air;
    next.set(r.id, r.air + d * (sum / ns.length - r.air));
  }
  for (const r of live) {
    const before = r.air;
    r.air = clamp(next.get(r.id)!);
    if (r.air < A.suffocatingBelow && before >= A.suffocatingBelow) addChain(s, 'chain.airLow', { sala: r.type });
  }
}

/** Dano por ar ruim nas pessoas. */
export function breathe(s: RunState): void {
  for (const p of alivePeople(s)) {
    const loc = personLocation(s, p);
    const air = loc ? loc.air : 0;
    if (air < A.harmBelow) {
      p.suffocation += A.suffocationPerHour * s.mods.suffocationMult * (1 + (A.harmBelow - air) / A.harmBelow);
      if (p.suffocation >= 100) killPerson(s, p, 'sufocamento');
    } else if (air >= A.suffocatingBelow) {
      p.suffocation = Math.max(0, p.suffocation - A.suffocationRecover);
    }
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
