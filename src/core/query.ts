// Consultas pequenas sobre o estado, compartilhadas entre sistemas.

import type { CatastropheType, RunState, ScheduledCatastrophe } from './state';

export function activeCat(s: RunState, type: CatastropheType): ScheduledCatastrophe | undefined {
  return s.catastrophes.find((c) => c.type === type && (c.stage === 'ativa' || c.stage === 'meio'));
}

export function anyActiveCat(s: RunState): ScheduledCatastrophe | undefined {
  return s.catastrophes.find((c) => c.stage === 'ativa' || c.stage === 'meio');
}
