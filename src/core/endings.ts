// Finais: qual final a vitória alcança depende de como se chegou lá.

import { BALANCE } from './balance';
import { alivePeople } from './rooms';
import { averageMorale } from './systems/morale';
import type { EndingId, RunState } from './state';

const EN = BALANCE.endings;

export function computeEnding(s: RunState): EndingId {
  const total = s.rooms.length;
  const collapsed = s.rooms.filter((r) => r.collapsed).length;
  const live = s.rooms.filter((r) => !r.collapsed);
  const avgIntegrity = live.length ? live.reduce((a, r) => a + r.integrity, 0) / live.length : 0;
  if (total > 0 && (collapsed / total >= EN.ruptureCollapsedFrac || avgIntegrity < EN.ruptureAvgIntegrity)) return 'ruptura';

  const others = s.people.filter((p) => p.archetype !== 'viajante');
  const othersAlive = alivePeople(s).filter((p) => p.archetype !== 'viajante');
  if (othersAlive.length === 0 && s.stats.abandoned + s.stats.sacrificed >= 1) return 'solitario';

  const allKept = others.length >= EN.collectiveMinSurvivors && others.every((p) => p.health !== 'morto' && !p.left);
  if (allKept && !s.stats.mutinyOccurred && !s.mutiny.everWarned && averageMorale(s) >= EN.collectiveMorale) return 'coletivo';

  return 'cinismo';
}
