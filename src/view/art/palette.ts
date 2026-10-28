// Paleta limitada (32 cores) e temas por fase. Cores em número 0xRRGGBB.

export const P = {
  ink: 0x14101c,       // contorno e fundo mais escuro
  night: 0x221a2e,
  shadow: 0x3a2d44,
  dusk: 0x5a4a6e,
  dirtDark: 0x3b2618,
  dirt: 0x5c3a22,
  dirtLight: 0x7d5232,
  clay: 0xa06a3c,
  rockDark: 0x3f4250,
  rock: 0x5f6474,
  rockLight: 0x8a90a0,
  tunnel: 0x1c1418,
  grass: 0x5b8c3a,
  grassLight: 0x8cbf4a,
  sky: 0x6f8fb8,
  skyLight: 0xa9c4d8,
  ash: 0x8a7f86,
  paper: 0xf2e6c9,
  paperDark: 0xc9b896,
  orange: 0xe8833a,
  orangeDark: 0xb0521f,
  yellow: 0xf4c84a,
  red: 0xd0453a,
  redDark: 0x8a2a2a,
  green: 0x6abf5a,
  greenDark: 0x2f6b3a,
  teal: 0x3fa0a0,
  blue: 0x4a7ad0,
  blueDark: 0x24407a,
  purple: 0x9a5ab8,
  pink: 0xe08aa8,
  white: 0xfaf6ee,
} as const;

export type ColorName = keyof typeof P;

/** Temas por fase (fundo, cor de destaque, cor de painel). */
export const THEMES = {
  build: { bg: P.dirtDark, accent: P.clay, panel: P.night, text: P.paper },
  survival: { bg: P.ink, accent: P.orange, panel: P.night, text: P.paper },
  greenhouse: { bg: P.greenDark, accent: P.green, panel: P.night, text: P.paper },
  ending: { bg: P.blueDark, accent: P.skyLight, panel: P.night, text: P.white },
  menu: { bg: P.ink, accent: P.orange, panel: P.night, text: P.paper },
};

let colorblind = false;
export function setColorblind(v: boolean): void {
  colorblind = v;
}

/** Cores de estado. No modo daltônico, azul/laranja em vez de verde/vermelho. */
export function statusColor(kind: 'good' | 'warn' | 'bad'): number {
  if (colorblind) return kind === 'good' ? P.blue : kind === 'warn' ? P.yellow : P.orange;
  return kind === 'good' ? P.green : kind === 'warn' ? P.yellow : P.red;
}

export function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

/** Escurece uma cor (fator 0..1). */
export function shade(c: number, f: number): number {
  const r = Math.round(((c >> 16) & 255) * f);
  const g = Math.round(((c >> 8) & 255) * f);
  const b = Math.round((c & 255) * f);
  return (Math.min(255, r) << 16) | (Math.min(255, g) << 8) | Math.min(255, b);
}

export const SKIN = [0xf1c8a0, 0xd9a06e, 0xa8703f, 0x6e4628];
export const HAIR = [0x2a1d14, 0x5a3a1e, 0xc9a04a, 0x8a3a1e, 0xbdbdbd];
