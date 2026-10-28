// Explosão: dano por setor. O peso vem do que o jogador construiu
// (profundidade, vedação, estrutura, entradas abertas); a sorte do setor só
// mexe na intensidade.

import { BALANCE } from './balance';
import { isEntrance, roomDistance } from './grid';
import { addLog } from './log';
import { killPerson } from './people';
import { rand, randRange } from './rng';
import { alivePeople, personLocation } from './rooms';
import { collapseRoom } from './systems/structure';
import type { Room, RunState } from './state';
import { computeTopology } from './topology';

const X = BALANCE.explosion;

export function sectorOf(r: Room): number {
  return Math.floor((r.x + r.w / 2) / X.sectorWidth);
}

/** Dano esperado de uma sala, antes da sorte. Usado também pelo modo desenvolvedor. */
export function expectedDamage(s: RunState, r: Room, sealed: boolean): number {
  const shallow = Math.max(0, 1 - r.y / X.safeDepth);
  let dmg = X.depthDamage * shallow;
  if (!sealed) dmg += X.unsealedDamage;
  if (s.hatchOpen) {
    const near = s.rooms.some((e) => isEntrance(e) && roomDistance(e, r) <= X.hatchRadius);
    if (near) dmg += X.hatchOpenDamage;
  }
  dmg *= 1 - X.reinforceProtection * Math.min(1, r.reinforced / 3);
  return dmg * s.mods.explosionMult;
}

export function detonate(s: RunState): void {
  const topo = computeTopology(s);
  const sectors = Math.ceil(s.width / X.sectorWidth);
  const luck: number[] = [];
  for (let i = 0; i < sectors; i++) luck.push(randRange(s, X.luckMin, X.luckMax));

  // Onde cada um estava no momento da explosão.
  const where = new Map<number, number | undefined>();
  for (const p of alivePeople(s)) where.set(p.id, personLocation(s, p)?.id);

  const worst: number[] = new Array(sectors).fill(0);
  const hadRooms: boolean[] = new Array(sectors).fill(false);
  for (const r of s.rooms.filter((x) => !x.collapsed)) {
    const sec = sectorOf(r);
    hadRooms[sec] = true;
    if (r.unstable) {
      r.integrity = 0;
    } else {
      const dmg = expectedDamage(s, r, topo.sealed.get(r.id) ?? false) * luck[sec];
      r.integrity -= dmg;
      worst[sec] = Math.max(worst[sec], dmg);
      if (dmg > X.injuredAbove) {
        for (const p of alivePeople(s)) if (where.get(p.id) === r.id && rand(s) < X.injuredChance) p.health = 'ferido';
      }
    }
  }
  for (const r of [...s.rooms]) {
    if (!r.collapsed && r.integrity <= 0) {
      collapseRoom(s, r, X.collapseSurviveChance);
      const sec = sectorOf(r);
      worst[sec] = Math.max(worst[sec], 999);
    }
  }
  // Sem nenhuma sala, ninguém sobrevive.
  if (!s.rooms.some((r) => !r.collapsed)) for (const p of alivePeople(s)) killPerson(s, p, 'explosao');
  // Quem morreu na explosão morreu da explosão, não do teto.
  for (const p of s.people) if (p.deathCause === 'desabamento' && p.deathDay === 0) p.deathCause = 'explosao';

  s.stats.explosionReport = [];
  for (let i = 0; i < sectors; i++) {
    if (!hadRooms[i]) continue;
    const level = worst[i] >= 999 ? 'destruido' : worst[i] > X.injuredAbove ? 'abalado' : 'intacto';
    s.stats.explosionReport.push({ sector: i, level });
  }
  addLog(s, 'log.explosion');
}
