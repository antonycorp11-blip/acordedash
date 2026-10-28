// Estrutura: integridade cai com o tempo; salas fracas desmoronam e arrastam
// as vizinhas. Quem cuida de reparo recupera um pouco por dia.

import { BALANCE } from '../balance';
import { adjacency, roomById } from '../grid';
import { addChain, survivalDay } from '../log';
import { killPerson } from '../people';
import { rand } from '../rng';
import { alivePeople, bestDorm, personLocation } from '../rooms';
import type { Room, RunState } from '../state';
import { workers, workMult } from '../workforce';

const S = BALANCE.structure;

export function maxRepairIntegrity(s: RunState, r: Room): number {
  return BALANCE.grid.baseIntegrity + s.mods.integrityBonus + (r.equipment === 'escora' ? (BALANCE.equipment.escora.integrityBonus as number) : 0);
}

/**
 * Desmorona uma sala. Quem está dentro morre (ou, na explosão, pode sobreviver
 * ferido). As salas vizinhas levam dano e podem cair em cascata.
 */
export function collapseRoom(s: RunState, r: Room, survivalChance = 0): void {
  if (r.collapsed) return;
  const inside = alivePeople(s).filter((p) => personLocation(s, p)?.id === r.id);
  const adj = adjacency(s).get(r.id) ?? new Set<number>();
  r.collapsed = true;
  r.powered = false;
  r.powerFrac = 0;
  r.air = 0;
  if (s.phase === 'survival') {
    s.stats.collapsesAfterExplosion++;
    s.stats.lastCollapseDay = survivalDay(s);
  }
  addChain(s, 'chain.collapse', { sala: r.type });
  for (const p of inside) {
    if (survivalChance > 0 && rand(s) < survivalChance) p.health = 'ferido';
    else killPerson(s, p, 'desabamento');
  }
  // Quem morava ali procura outro canto.
  for (const p of alivePeople(s)) {
    if (p.homeId === r.id) p.homeId = bestDorm(s)?.id ?? null;
    if (p.wanderRoomId === r.id) p.wanderRoomId = null;
  }
  for (const id of adj) {
    const n = roomById(s, id);
    if (!n || n.collapsed) continue;
    const mult = n.equipment === 'escora' ? S.braceCascadeMult : 1;
    n.integrity -= S.cascadeDamage * mult;
    if (n.integrity <= 0) collapseRoom(s, n, survivalChance);
  }
}

/** Fechamento diário da estrutura. */
export function structureDaily(s: RunState): void {
  for (const r of s.rooms) {
    if (r.collapsed) continue;
    r.integrity -= S.decayPerDay + (r.unstable ? S.unstableDecayPerDay : 0);
  }
  // Reparos automáticos de quem tem a função.
  let budget = 0;
  for (const p of workers(s, 'reparo')) budget += workMult(p) * S.repairPerWorkerDay * (p.archetype === 'engenheiro' ? BALANCE.archetypeBonuses.engineerRepairMult : 1);
  budget *= 1 + s.mods.roleBonus;
  const damaged = s.rooms.filter((r) => !r.collapsed && r.integrity < maxRepairIntegrity(s, r)).sort((a, b) => a.integrity - b.integrity);
  for (const r of damaged) {
    if (budget <= 0) break;
    const add = Math.min(budget, maxRepairIntegrity(s, r) - r.integrity);
    r.integrity += add;
    budget -= add;
    if (add > 2) s.stats.repairsToday++;
  }
  // Quem faz reparo também cuida dos geradores que ainda funcionam.
  const care = workers(s, 'reparo').length * S.generatorCarePerWorker;
  if (care > 0) {
    for (const g of s.rooms) {
      if (g.type === 'generator' && !g.collapsed && g.wear > 0 && g.wear < 100) g.wear = Math.max(0, g.wear - care);
    }
  }
  checkCollapses(s);
}

export function checkCollapses(s: RunState): void {
  for (const r of [...s.rooms]) if (!r.collapsed && r.integrity <= 0) collapseRoom(s, r);
}
