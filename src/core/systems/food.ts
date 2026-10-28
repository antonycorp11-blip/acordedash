// Alimento e água: reservatório coleta água, estufa produz comida crua,
// cozinha transforma em comida de verdade, pessoas comem e bebem.

import { BALANCE } from '../balance';
import { addChain } from '../log';
import { killPerson } from '../people';
import { activeCat } from '../query';
import { alivePeople, roomsOf } from '../rooms';
import type { Room, RunState } from '../state';
import { coverage, workers, workMult } from '../workforce';

const F = BALANCE.food;

export function waterCapacity(s: RunState): number {
  const res = roomsOf(s, 'reservoir');
  if (!res.length) return F.startWaterNoReservoir + s.mods.stockWater;
  return res.length * F.reservoirCapacity + s.mods.stockWater;
}

export function greenhouseFactor(s: RunState, g: Room): number {
  let f = 1;
  const praga = activeCat(s, 'praga');
  if (praga) {
    // Durante a praga a estufa não produz, a não ser que o grupo aprenda a conviver.
    const base = praga.choice === 2 ? BALANCE.catastrophes.pestOutputMult : 0;
    f *= 1 - (1 - base) * s.mods.pestMult;
  }
  if (g.pest) f *= 1 - (1 - BALANCE.catastrophes.pestOutputMult) * s.mods.pestMult;
  return f;
}

export function cookMult(s: RunState): number {
  const cooks = workers(s, 'cozinha');
  let bonus = 0;
  for (const c of cooks) bonus += workMult(c) * (c.archetype === 'sogra' ? BALANCE.archetypeBonuses.motherInLawCookMult : 1);
  return 1 + F.cookBonus * Math.min(1.5, bonus);
}

export function updateFood(s: RunState): void {
  const perHour = 1 / 24;
  s.last.waterIn = 0;
  s.last.rawIn = 0;
  s.last.foodIn = 0;

  // Água coletada pelos reservatórios ligados.
  const cap = waterCapacity(s);
  for (const r of roomsOf(s, 'reservoir')) {
    if (r.powerFrac <= 0) continue;
    const rate = (F.reservoirCollectPerDay + (r.equipment === 'bomba' ? F.pumpBonus : 0)) * r.powerFrac * perHour;
    s.last.waterIn += rate;
  }
  s.res.water = Math.min(cap, s.res.water + s.last.waterIn);

  // Estufa.
  const farm = coverage(s, 'comida');
  for (const g of roomsOf(s, 'greenhouse')) {
    if (g.powerFrac <= 0) continue;
    const cells = g.w * g.h;
    const waterNeed = cells * F.greenhouseWaterPerCellDay * perHour * g.powerFrac;
    if (s.res.water < waterNeed) continue;
    s.res.water -= waterNeed;
    let out = cells * F.greenhouseRawPerCellDay * perHour * g.powerFrac * s.mods.greenhouseMult * (1 + F.farmerBonus * farm);
    if (g.equipment === 'lampada') out *= 1 + F.lampBonus;
    out *= greenhouseFactor(s, g);
    s.res.raw += out;
    s.last.rawIn += out;
  }

  // Cozinha.
  const cm = cookMult(s);
  for (const k of roomsOf(s, 'kitchen')) {
    if (k.powerFrac <= 0 || s.res.raw <= 0) continue;
    const amount = Math.min(s.res.raw, F.kitchenRatePerDay * perHour * k.powerFrac * cm);
    s.res.raw -= amount;
    s.res.food += amount;
    s.last.foodIn += amount;
  }

  // Consumo.
  const agua = activeCat(s, 'agua');
  const rationed = agua && agua.choice === 1;
  const hadFood = s.res.food + s.res.raw + s.res.canned > 0;
  const hadWater = s.res.water > 0;
  for (const p of alivePeople(s)) {
    const needF = F.personFoodPerDay * perHour * s.mods.hungerMult;
    let got = 0;
    let kind: typeof p.lastFood = 'nada';
    const take = (key: 'food' | 'raw' | 'canned', k: typeof p.lastFood) => {
      if (got >= needF) return;
      const t = Math.min(s.res[key], needF - got);
      if (t > 0) {
        s.res[key] -= t;
        got += t;
        if (kind === 'nada') kind = k;
      }
    };
    take('food', 'cozida');
    take('raw', 'crua');
    take('canned', 'lata');
    p.lastFood = kind;
    const fFrac = needF > 0 ? got / needF : 1;
    if (fFrac >= 0.999) p.hunger = Math.max(0, p.hunger - F.recoverPerHour);
    else p.hunger += F.hungerPerDay * perHour * (1 - fFrac) * s.mods.hungerMult;

    const needW = F.personWaterPerDay * perHour * (rationed ? BALANCE.catastrophes.rationWaterMult : 1);
    const w = Math.min(s.res.water, needW);
    s.res.water -= w;
    const wFrac = needW > 0 ? w / needW : 1;
    p.lastWater = wFrac >= 0.999;
    if (rationed) p.thirst += F.thirstPerDay * perHour * (p.lastWater ? 0.25 : 1) * s.mods.thirstMult;
    else if (p.lastWater) p.thirst = Math.max(0, p.thirst - F.recoverPerHour);
    else p.thirst += F.thirstPerDay * perHour * (1 - wFrac) * s.mods.thirstMult;

    if (p.thirst >= F.starveAt) killPerson(s, p, 'sede');
    else if (p.hunger >= F.starveAt) killPerson(s, p, 'fome');
  }
  if (hadFood && s.res.food + s.res.raw + s.res.canned <= 1e-6) addChain(s, 'chain.foodOut');
  if (hadWater && s.res.water <= 1e-6) addChain(s, 'chain.waterOut');
}

/** Comida estraga no fechamento do dia. */
export function spoil(s: RunState): number {
  if (s.mods.noSpoil) return 0;
  const kitchenOn = roomsOf(s, 'kitchen').some((k) => k.powered);
  const freezer = roomsOf(s, 'kitchen').some((k) => k.powered && k.equipment === 'freezer');
  const before = s.res.raw + s.res.food;
  s.res.raw *= 1 - (kitchenOn ? F.rawSpoilWithKitchen : F.rawSpoilNoKitchen) * (freezer ? 0.3 : 1);
  if (!kitchenOn) s.res.food *= 1 - F.foodSpoilNoPower;
  return before - (s.res.raw + s.res.food);
}
