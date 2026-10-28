// Configurações do jogador e preferências do navegador.

import type { Settings } from '../core/state';

export function defaultSettings(): Settings {
  return {
    volume: 0.7,
    music: true,
    bigText: false,
    colorblind: false,
    reduceMotion: prefersReducedMotion(),
    defaultSpeed: 1,
  };
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function isTouchDevice(): boolean {
  return typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window);
}
