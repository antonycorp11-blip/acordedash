// Criação e morte de pessoas. Convenção de parâmetros de texto: chaves que
// começam com "pessoa" levam o nameId; chaves que começam com "sala" levam o
// tipo da sala. A camada de apresentação traduz isso.

import { BALANCE } from './balance';
import { addChain, say, survivalDay } from './log';
import { rand, randInt } from './rng';
import { alivePeople } from './rooms';
import type { Archetype, DeathCause, Person, RunState } from './state';

export function createPerson(s: RunState, archetype: Archetype | 'viajante', homeId: number | null): Person {
  const used = new Set(s.people.map((p) => p.nameId));
  let nameId = -1;
  if (archetype !== 'viajante') {
    nameId = randInt(s, 0, BALANCE.survivors.namePool - 1);
    for (let i = 0; i < BALANCE.survivors.namePool && used.has(nameId); i++) nameId = (nameId + 1) % BALANCE.survivors.namePool;
  }
  const morale =
    archetype === 'viajante' ? BALANCE.morale.travelerStart : archetype === 'coach' ? BALANCE.archetypeBonuses.coachStartMorale : BALANCE.morale.start;
  return {
    id: s.nextId++,
    nameId,
    archetype,
    look: Math.floor(rand(s) * 0x7fffffff),
    morale,
    health: 'ok',
    hunger: 0,
    thirst: 0,
    suffocation: 0,
    exposure: 0,
    sickDays: 0,
    role: 'nenhuma',
    homeId,
    joinedDay: survivalDay(s),
    wanderRoomId: null,
    lastFood: 'lata',
    lastWater: true,
  };
}

export function killPerson(s: RunState, p: Person, cause: DeathCause): void {
  if (p.health === 'morto') return;
  p.health = 'morto';
  p.deathCause = cause;
  p.deathDay = survivalDay(s);
  addChain(s, 'chain.death', { pessoa: p.nameId, causa: cause });
  if (p.archetype === 'viajante') return;
  say(s, 'msg.death', { pessoa: p.nameId, causa: cause });
  for (const o of alivePeople(s)) o.morale = Math.max(0, o.morale - 8);
}

export function personParams(p: Person): { pessoa: number } {
  return { pessoa: p.nameId };
}
