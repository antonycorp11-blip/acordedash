// Temperatura do bunker. Só sai do normal durante a catástrofe de frio/calor.
// Sobra de energia e salas vedadas puxam a temperatura de volta.

import { BALANCE } from '../balance';
import { addChain } from '../log';
import { killPerson } from '../people';
import { activeCat } from '../query';
import { alivePeople } from '../rooms';
import type { RunState } from '../state';
import type { Topology } from '../topology';

const T = BALANCE.temperature;

export function updateClimate(s: RunState, topo: Topology): void {
  const cat = activeCat(s, 'temperatura');
  const before = s.temp;
  if (cat) {
    const dir = cat.variant === 0 ? -1 : 1;
    s.temp += dir * T.driftPerHour * s.config.severity;
    const live = s.rooms.filter((r) => !r.collapsed);
    const sealedFrac = live.length ? live.filter((r) => topo.sealed.get(r.id)).length / live.length : 0;
    let comp = s.last.surplus * T.compensationPerPower + sealedFrac * T.sealedCompensation;
    if (cat.choice === 2) comp += BALANCE.catastrophes.scrapCompensation;
    s.temp = towardZero(s.temp, comp);
  } else {
    s.temp = towardZero(s.temp, T.returnPerHour);
  }
  s.temp = Math.max(-100, Math.min(100, s.temp));
  if (Math.abs(before) <= T.harmAbove && Math.abs(s.temp) > T.harmAbove) addChain(s, s.temp < 0 ? 'chain.cold' : 'chain.hot');

  const huddle = cat && cat.choice === 1 ? T.huddleMult : 1;
  for (const p of alivePeople(s)) {
    const over = Math.abs(s.temp) - T.harmAbove;
    if (over > 0) {
      p.exposure += (over / 10) * T.exposurePerHourPer10 * huddle;
      if (p.exposure >= 100) killPerson(s, p, s.temp < 0 ? 'frio' : 'calor');
    } else {
      p.exposure = Math.max(0, p.exposure - T.exposureRecover);
    }
  }
}

function towardZero(v: number, amount: number): number {
  if (v > 0) return Math.max(0, v - amount);
  return Math.min(0, v + amount);
}
