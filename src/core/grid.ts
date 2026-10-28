// Grade do bunker: terreno, mapa de ocupação de salas, vizinhança e componentes.

import { BALANCE } from './balance';
import { rand } from './rng';
import { DIRT, DUG, ROCK, type Room, type RunState, type Terrain } from './state';

export function idx(s: { width: number }, x: number, y: number): number {
  return y * s.width + x;
}

export function inBounds(s: { width: number; height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.width && y < s.height;
}

/** Terreno inicial: terra em cima, rocha cada vez mais comum conforme desce. */
export function generateTerrain(s: RunState): Terrain[] {
  const g = BALANCE.grid;
  const t: Terrain[] = [];
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const depthRows = y - g.rockStartRow;
      const p = depthRows < 0 ? 0 : Math.min(g.rockChanceMax, (depthRows + 1) * g.rockChancePerRow);
      t.push(rand(s) < p ? ROCK : DIRT);
    }
  }
  return t;
}

/**
 * Mapa célula → id de sala (−1 vazio). Salas desmoronadas viram entulho:
 * `includeCollapsed` decide se elas aparecem no mapa.
 */
export function roomMap(s: RunState, includeCollapsed = false): Int32Array {
  const m = new Int32Array(s.width * s.height).fill(-1);
  for (const r of s.rooms) {
    if (r.collapsed && !includeCollapsed) continue;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) m[idx(s, x, y)] = r.id;
  }
  return m;
}

export function roomById(s: RunState, id: number | null | undefined): Room | undefined {
  if (id == null) return undefined;
  return s.rooms.find((r) => r.id === id);
}

export function liveRooms(s: RunState): Room[] {
  return s.rooms.filter((r) => !r.collapsed);
}

/** Percorre as células da borda externa de uma sala (vizinhos ortogonais fora dela). */
export function forEachBorder(r: Room, fn: (x: number, y: number) => void): void {
  for (let x = r.x; x < r.x + r.w; x++) {
    fn(x, r.y - 1);
    fn(x, r.y + r.h);
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    fn(r.x - 1, y);
    fn(r.x + r.w, y);
  }
}

/** Lista de adjacência entre salas vivas (compartilham uma aresta). */
export function adjacency(s: RunState, map = roomMap(s)): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (const r of s.rooms) {
    if (r.collapsed) continue;
    const set = new Set<number>();
    forEachBorder(r, (x, y) => {
      if (!inBounds(s, x, y)) return;
      const id = map[idx(s, x, y)];
      if (id >= 0 && id !== r.id) set.add(id);
    });
    adj.set(r.id, set);
  }
  return adj;
}

/** Componentes conexos de salas vivas. Devolve mapa sala → índice do componente. */
export function components(s: RunState, adj = adjacency(s)): Map<number, number> {
  const comp = new Map<number, number>();
  let c = 0;
  for (const id of adj.keys()) {
    if (comp.has(id)) continue;
    const stack = [id];
    comp.set(id, c);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const n of adj.get(cur) ?? []) {
        if (!comp.has(n)) {
          comp.set(n, c);
          stack.push(n);
        }
      }
    }
    c++;
  }
  return comp;
}

export function isEntrance(r: Room): boolean {
  return r.type === 'corridor' && r.y === 0 && !r.collapsed;
}

/**
 * Uma sala está vedada quando nenhuma borda dá para túnel aberto ou para o céu,
 * não tem rachadura aberta (brecha) e, se for entrada, a escotilha está fechada.
 */
export function isSealed(s: RunState, r: Room, map = roomMap(s)): boolean {
  if (r.collapsed) return false;
  if (r.breach) return false;
  let sealed = true;
  forEachBorder(r, (x, y) => {
    if (!sealed) return;
    if (y < 0) {
      if (isEntrance(r)) {
        if (s.hatchOpen) sealed = false;
      } else {
        sealed = false;
      }
      return;
    }
    if (!inBounds(s, x, y)) return;
    const i = idx(s, x, y);
    if (s.terrain[i] === DUG && map[i] < 0 && !isRubble(s, x, y)) sealed = false;
  });
  return sealed;
}

/** Célula ocupada por sala desmoronada: conta como entulho sólido. */
export function isRubble(s: RunState, x: number, y: number): boolean {
  return s.rooms.some((r) => r.collapsed && x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

/** Distância de Manhattan entre os retângulos de duas salas. */
export function roomDistance(a: Room, b: Room): number {
  const dx = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w - 1, b.x + b.w - 1));
  const dy = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h - 1, b.y + b.h - 1));
  return dx + dy;
}

export function terrainAt(s: RunState, x: number, y: number): Terrain {
  return s.terrain[idx(s, x, y)];
}

export { DIRT, ROCK, DUG };
