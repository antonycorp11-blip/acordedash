// Topologia do bunker calculada uma vez por tick: mapa de ocupação, vizinhança,
// componentes e vedação. Evita recalcular a mesma coisa em cada sistema.

import { adjacency, components, isSealed, roomMap } from './grid';
import type { RunState } from './state';

export interface Topology {
  map: Int32Array;
  adj: Map<number, Set<number>>;
  comp: Map<number, number>;
  sealed: Map<number, boolean>;
}

export function computeTopology(s: RunState): Topology {
  const map = roomMap(s);
  const adj = adjacency(s, map);
  const comp = components(s, adj);
  const sealed = new Map<number, boolean>();
  for (const r of s.rooms) if (!r.collapsed) sealed.set(r.id, isSealed(s, r, map));
  return { map, adj, comp, sealed };
}
