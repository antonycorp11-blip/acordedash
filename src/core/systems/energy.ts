// Energia: geradores produzem, painéis distribuem, salas consomem.
// A energia só chega a salas no mesmo componente de um painel; a produção
// conta apenas geradores ligados a esse mesmo componente.

import { BALANCE } from '../balance';
import { addChain } from '../log';
import { activeCat } from '../query';
import { roomDef } from '../rooms';
import type { Topology } from '../topology';
import type { Room, RunState } from '../state';
import { coverage } from '../workforce';

const E = BALANCE.energy;

export function generatorOutput(s: RunState, g: Room): number {
  if (g.collapsed || g.wear >= 100) return 0;
  const op = coverage(s, 'energia');
  return E.generatorOutput * (1 + s.mods.genOutput) * (1 - (E.wearOutputLoss * g.wear) / 100) * (1 + E.operatorOutputBonus * op);
}

/** Demanda de uma sala, levando em conta modos especiais de catástrofe. */
export function roomDemand(s: RunState, r: Room): number {
  if (r.collapsed) return 0;
  let d = roomDef(r.type).power;
  const agua = activeCat(s, 'agua');
  if (r.type === 'kitchen' && agua && agua.choice === 0) d *= 2;
  return d;
}

/** Salas que ficam fora da distribuição por escolha feita numa catástrofe. */
function excludedByCatastrophe(s: RunState, r: Room): boolean {
  const temp = activeCat(s, 'temperatura');
  if (temp && temp.choice === 0 && (r.type === 'greenhouse' || r.type === 'kitchen')) return true;
  const black = activeCat(s, 'blecaute');
  if (black && black.choice === 1 && r.type !== 'vent' && r.type !== 'panel') return true;
  return false;
}

export function updateEnergy(s: RunState, topo: Topology): void {
  const live = s.rooms.filter((r) => !r.collapsed);
  for (const r of live) {
    r.powered = false;
    r.powerFrac = 0;
  }

  // Produção por gerador, considerando blecaute e reserva.
  const gens = live.filter((r) => r.type === 'generator');
  const outputs = new Map<number, number>();
  for (const g of gens) outputs.set(g.id, generatorOutput(s, g));
  const black = activeCat(s, 'blecaute');
  if (black) {
    const working = gens.filter((g) => g.wear < 100).sort((a, b) => a.wear - b.wear || a.id - b.id);
    for (const g of gens) outputs.set(g.id, 0);
    const reserveFrac = s.mods.reserve ? E.reserveSkillFraction : gens.length >= 2 ? E.reserveOutputFraction : 0;
    if (working.length && reserveFrac > 0) outputs.set(working[0].id, generatorOutput(s, working[0]) * reserveFrac);
  }
  let crank = 0;
  if (black && black.choice === 0) crank = BALANCE.catastrophes.crankPower;

  let totalProd = 0;
  let totalDemand = 0;
  let totalSurplus = 0;
  let anyDeficit = false;

  // Agrupa por componente.
  const byComp = new Map<number, Room[]>();
  for (const r of live) {
    const c = topo.comp.get(r.id);
    if (c == null) continue;
    if (!byComp.has(c)) byComp.set(c, []);
    byComp.get(c)!.push(r);
  }

  let crankUsed = false;
  for (const rooms of byComp.values()) {
    const panels = rooms.filter((r) => r.type === 'panel');
    let prod = 0;
    for (const r of rooms) if (r.type === 'generator') prod += outputs.get(r.id) ?? 0;
    if (!crankUsed && crank > 0 && panels.length) {
      prod += crank;
      crankUsed = true;
    }
    if (panels.some((p) => p.equipment === 'regulador')) prod *= 1 + (BALANCE.equipment.regulador.productionBonus as number);
    totalProd += prod;
    if (!panels.length) continue;

    const consumers = rooms
      .filter((r) => roomDemand(s, r) > 0 && !excludedByCatastrophe(s, r))
      .sort((a, b) => priorityIndex(s, a) - priorityIndex(s, b) || a.id - b.id);
    const demand = consumers.reduce((acc, r) => acc + roomDemand(s, r), 0);
    totalDemand += demand;

    let available = prod;
    if (s.mods.battery && prod < demand) {
      const draw = Math.min(s.res.battery, demand - prod);
      s.res.battery -= draw;
      available += draw;
    }

    if (s.mods.redistribute && available < demand && demand > 0) {
      const frac = available / demand;
      for (const r of consumers) {
        r.powerFrac = frac;
        r.powered = frac >= 0.5;
      }
      anyDeficit = true;
      available = 0;
    } else {
      for (const r of consumers) {
        const d = roomDemand(s, r);
        if (available + 1e-9 >= d) {
          available -= d;
          r.powered = true;
          r.powerFrac = 1;
        } else {
          anyDeficit = true;
        }
      }
    }
    // Salas sem consumo (corredores, geradores) estão "ligadas" se há painel.
    for (const r of rooms) if (roomDemand(s, r) === 0) { r.powered = prod > 0; r.powerFrac = prod > 0 ? 1 : 0; }

    if (available > 0) {
      if (s.mods.battery) {
        const charge = Math.min(available, E.batteryCapacity - s.res.battery);
        s.res.battery += charge;
        available -= charge;
      }
      totalSurplus += available;
    }
  }

  if (anyDeficit && !s.last.deficit) addChain(s, 'chain.deficit');
  s.last.production = totalProd;
  s.last.demand = totalDemand;
  s.last.deficit = anyDeficit;
  s.last.surplus = totalSurplus;
}

function priorityIndex(s: RunState, r: Room): number {
  if (r.type === 'panel') return -1;
  const i = s.priority.indexOf(r.type);
  return i < 0 ? 99 : i;
}

/** Desgaste horário dos geradores. */
export function wearGenerators(s: RunState): void {
  const perHour = E.wearPerDay / 24;
  const op = coverage(s, 'energia');
  for (const g of s.rooms) {
    if (g.type !== 'generator' || g.collapsed || g.wear >= 100) continue;
    let mult = s.mods.wearMult * (1 - (1 - E.operatorWearMult) * op);
    if (g.equipment === 'catalisador') mult *= BALANCE.equipment.catalisador.wearMult as number;
    g.wear = Math.min(100, g.wear + perHour * mult);
    if (g.wear >= 100) {
      s.brokeToday = true;
      s.stats.generatorFailures++;
      addChain(s, 'chain.generatorStopped');
    }
  }
}
