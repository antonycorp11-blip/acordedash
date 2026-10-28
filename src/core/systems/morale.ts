// Moral: fechamento diário do humor de cada pessoa. Depende de tudo.

import { ARCHETYPE_NEEDS } from '../archetypes';
import { BALANCE } from '../balance';
import { roomById } from '../grid';
import { addChain } from '../log';
import { alivePeople, occupantsOfHome, personLocation } from '../rooms';
import type { Person, RunState } from '../state';
import { isOverworked } from '../workforce';

const M = BALANCE.morale;

export function averageMorale(s: RunState, includeTraveler = true): number {
  const ps = alivePeople(s).filter((p) => includeTraveler || p.archetype !== 'viajante');
  if (!ps.length) return 0;
  return ps.reduce((a, p) => a + p.morale, 0) / ps.length;
}

function hasPrivacy(s: RunState, p: Person): boolean {
  const home = roomById(s, p.homeId);
  if (!home || home.type !== 'dorm') return false;
  const n = occupantsOfHome(s, home.id).length;
  return p.archetype === 'sogra' ? n <= 1 : n <= BALANCE.dorm.privacyMax;
}

export function moraleDaily(s: RunState, extra: Map<number, number> = new Map()): void {
  const people = alivePeople(s);
  const coachIdle = people.some((p) => p.archetype === 'coach' && p.role === 'nenhuma');
  const sograUnhappy = people.some((p) => p.archetype === 'sogra' && !hasPrivacy(s, p));
  const noFood = s.res.food + s.res.raw + s.res.canned <= 0;
  const before = averageMorale(s);

  for (const p of people) {
    let d = 0;
    d += p.lastFood === 'cozida' ? M.foodCooked : p.lastFood === 'crua' ? M.foodRaw : p.lastFood === 'lata' ? M.foodCanned : M.foodNone;
    if (!p.lastWater) d += M.waterNone;
    const loc = personLocation(s, p);
    if (!loc || loc.air < BALANCE.air.suffocatingBelow) d += M.badAir;
    if (p.health === 'ferido') d += M.injured;
    if (p.health === 'doente') d += M.sick;
    if (Math.abs(s.temp) > BALANCE.temperature.harmAbove) d += M.badTemp;

    const needs = ARCHETYPE_NEEDS[p.archetype];
    if (p.role === 'nenhuma') {
      d += M.rest + (needs.includes('descanso') ? M.restNeed : 0);
      if (needs.includes('trabalho')) d += M.workUnmet;
    } else if (isOverworked(s, p)) {
      d += M.overworked;
    }
    const privacyOk = !needs.includes('privacidade') || hasPrivacy(s, p);
    if (!privacyOk) d += M.privacyUnmet;
    const workOk = !needs.includes('trabalho') || p.role !== 'nenhuma';
    const foodOk = !needs.includes('comida') || p.lastFood === 'cozida';
    if (privacyOk && workOk && foodOk) d += M.needsMet;
    const home = roomById(s, p.homeId);
    if (!home || home.type !== 'dorm') d += M.corridorSleeper;

    if (p.archetype === 'religioso') d += noFood ? M.zealotNoFood : M.prayer;
    if (p.archetype === 'engenheiro' && !s.brokeToday) d += M.engineerBored;
    if (coachIdle && p.archetype !== 'coach') d += M.coachIdleOthers;
    if (sograUnhappy && p.archetype !== 'sogra') d += M.motherInLawOthers;

    d += s.mods.moraleBonus + s.mutiny.marks * M.markPenalty + (extra.get(p.id) ?? 0);
    p.morale += d;
    p.morale += (M.regressionTarget - p.morale) * M.regression;
    p.morale = Math.max(0, Math.min(100, p.morale));
  }
  const after = averageMorale(s);
  if (before >= BALANCE.mutiny.recoverAbove && after < BALANCE.mutiny.recoverAbove) addChain(s, 'chain.moraleLow');
}
