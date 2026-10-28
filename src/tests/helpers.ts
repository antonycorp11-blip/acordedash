import { applyCommandMut } from '../core/commands';
import { newMeta } from '../core/progression';
import { newRun } from '../core/simulate';
import type { MetaProgress, RoomType, RunState } from '../core/state';
import { buildTemplate, type TemplateId } from '../core/batch';

export function meta(over: Partial<MetaProgress> = {}): MetaProgress {
  return { ...newMeta(), ...over };
}

/** Run de teste com bunker montado à mão. */
export function runWith(rooms: [RoomType, number, number][], seed = 42, m = meta()): RunState {
  const s = newRun(m, seed);
  s.arrivals = [];
  for (const [room, x, y] of rooms) {
    const err = applyCommandMut(s, { t: 'place', room, x, y });
    if (err) throw new Error(`não coube ${room} em ${x},${y}: ${err}`);
  }
  return s;
}

export function shaftTo(x: number, y: number): [RoomType, number, number][] {
  const out: [RoomType, number, number][] = [];
  for (let i = 0; i <= y; i++) out.push(['corridor', x, i]);
  return out;
}

/** Bunker funcional padrão, já na fase de sobrevivência, sem catástrofes nem emergências. */
export function survivingBunker(extra: [RoomType, number, number][] = [], seed = 7): RunState {
  const s = runWith([
    ...shaftTo(14, 11),
    ['dorm', 10, 6], ['generator', 15, 6], ['panel', 15, 4], ['vent', 12, 4], ['reservoir', 15, 8],
    ['greenhouse', 10, 8], ['kitchen', 11, 10], ['generator', 15, 10],
    ...extra,
  ], seed);
  applyCommandMut(s, { t: 'hatch', open: false });
  applyCommandMut(s, { t: 'skipBuild' });
  s.events = [];
  applyCommandMut(s, { t: 'detonate' });
  quiet(s);
  return s;
}

/** Remove a aleatoriedade "de eventos" para testar sistemas isolados. */
export function quiet(s: RunState): void {
  s.events = [];
  s.emergencies = [];
  s.emergencySchedule = [];
  s.catastrophes = [];
  s.arrivals = [];
  for (const r of s.rooms) if (!r.collapsed) r.integrity = 100;
  for (const p of s.people) p.health = 'ok';
}

export function template(t: TemplateId, seed: number): RunState {
  const s = newRun({ ...newMeta(), runs: 4 }, seed);
  buildTemplate(s, t);
  return s;
}
