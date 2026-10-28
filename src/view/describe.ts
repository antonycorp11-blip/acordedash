// Descrições em texto de partes do estado (salas, pessoas, missões) para a tela.
// Só sinais, nunca números.

import { ARCHETYPE_NEEDS } from '../core/archetypes';
import { BALANCE } from '../core/balance';
import { roomById } from '../core/grid';
import { activeCat } from '../core/query';
import { occupantsOfHome } from '../core/rooms';
import type { Person, Room, RunState } from '../core/state';
import { computeTopology } from '../core/topology';
import { personName, t } from './text';

export function missionText(run: RunState, type: string, personId?: number, untilDay?: number): string {
  const p = run.people.find((x) => x.id === personId);
  return t(`mission.${type}`, { pessoa: p ? p.nameId : -1, dia: untilDay ?? run.config.goalDays });
}

export function roomSignals(run: RunState, r: Room): string[] {
  if (r.collapsed) return [t('room.state.collapsed')];
  const out: string[] = [];
  const surviving = run.phase === 'survival' || run.phase === 'ended';
  const sealed = computeTopology(run).sealed.get(r.id);
  if (surviving) {
    if (BALANCE.rooms[r.type].power > 0 && !r.powered) out.push(t('signal.noPower'));
    else if (run.last.deficit && r.powered) out.push(t('signal.flicker'));
    if (r.type === 'generator') out.push(r.wear >= 100 ? t('signal.broken') : r.wear > 60 ? t('signal.worn') : t('room.state.ok'));
    out.push(sealed ? t('signal.sealed') : t('signal.leak'));
    if (r.air < BALANCE.air.suffocatingBelow) out.push(t('signal.stuffy'));
    if (r.pest || (r.type === 'greenhouse' && activeCat(run, 'praga'))) out.push(t('signal.pest'));
    if (r.type === 'reservoir' && run.waterContaminated) out.push(t('signal.badWater'));
    if (run.temp < -BALANCE.temperature.harmAbove) out.push(t('signal.cold'));
    if (run.temp > BALANCE.temperature.harmAbove) out.push(t('signal.hot'));
  }
  if (r.unstable) out.push(t('signal.unstable'));
  if (r.integrity < BALANCE.structure.dustBelow) out.push(t('signal.dust'));
  else if (r.integrity < BALANCE.structure.cracksBelow) out.push(t('signal.cracks'));
  if (r.equipment) out.push(t('signal.equipment', { eq: r.equipment }));
  if (r.type === 'dorm') out.push(t('signal.residents', { n: occupantsOfHome(run, r.id).length }));
  return out;
}

export function moodWord(p: Person): string {
  return t(`mood.${Math.min(4, Math.floor(p.morale / 20))}`);
}

export function personSummary(run: RunState, p: Person): string[] {
  const home = roomById(run, p.homeId);
  return [
    `${personName(p.nameId)} — ${t(`arq.${p.archetype}`)}`,
    `${t(`health.${p.health}`)} · ${moodWord(p)}`,
    t('people.needs', { n: ARCHETYPE_NEEDS[p.archetype].map((n) => t(`need.${n}`)).join(', ') }),
    `${t('people.home')}: ${home && !home.collapsed ? t(`room.${home.type}`) : t('people.homeless')}${p.wanderRoomId != null ? ' · ' + t('people.wander') : ''}`,
  ];
}
