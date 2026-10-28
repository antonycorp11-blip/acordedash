// Relatório do Legista: dados da derrota, prontos para os templates de texto.

import { hashString } from './rng';
import type { DeathCause, LogEntry, RunState } from './state';

export interface LegistReport {
  day: number;
  cause: DeathCause;
  causeVariant: number;
  chain: LogEntry[];
  deaths: { nameId: number; cause: DeathCause; day: number }[];
  lessonVariant: number;
}

/** Elos que contam como "falha" na cadeia (o resto é só contexto). */
const FAILURE_KEYS = new Set([
  'chain.deficit', 'chain.generatorStopped', 'chain.airLow', 'chain.foodOut', 'chain.waterOut', 'chain.collapse',
  'chain.cat', 'chain.moraleLow', 'chain.hatchOpen', 'chain.breach', 'chain.cracks', 'chain.waterBad', 'chain.sick',
  'chain.pest', 'chain.cold', 'chain.hot', 'chain.mutinyWarning', 'chain.mutinyWon', 'chain.childHatch',
]);

export function legistReport(s: RunState): LegistReport {
  const cause = s.outcome?.cause ?? 'explosao';
  const day = s.outcome?.day ?? 0;
  const failures = s.chain.filter((e) => FAILURE_KEYS.has(e.key));
  const chain = failures.slice(-3);
  const deaths = s.people
    .filter((p) => p.health === 'morto' && p.archetype !== 'viajante')
    .map((p) => ({ nameId: p.nameId, cause: p.deathCause ?? 'explosao', day: p.deathDay ?? 0 }));
  const h = Math.abs(hashString(`${s.seed}:${cause}`));
  return { day, cause, causeVariant: h % 3, chain, deaths, lessonVariant: (h >> 3) % 3 };
}
