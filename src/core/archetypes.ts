// Necessidades de cada arquétipo. As falas ficam no arquivo de textos.

import type { Archetype, Need } from './state';

export const ARCHETYPE_NEEDS: Record<Archetype | 'viajante', Need[]> = {
  viajante: ['comida', 'ar'],
  hipocondriaco: ['privacidade', 'descanso'],
  coach: ['trabalho'],
  sogra: ['privacidade', 'comida'],
  engenheiro: ['trabalho'],
  crianca: ['descanso', 'comida'],
  religioso: ['comida', 'descanso'],
};
