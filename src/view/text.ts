// Formatador de textos. Resolve chaves do arquivo de idioma, escolhe variações
// e traduz parâmetros especiais (pessoa, sala, causa...).

import { NAMES, PT_BR } from '../strings/pt-BR';
import { hashString } from '../core/rng';

const SPECIAL: Record<string, (v: string | number) => string> = {
  pessoa: (v) => (Number(v) < 0 ? t('me') : NAMES[Number(v) % NAMES.length]),
  sala: (v) => t(`room.art.${v}`),
  causa: (v) => t(`causa.${v}`),
  cat: (v) => t(`cat.${v}`),
  tipo: (v) => t(`emg.${v}`),
  arq: (v) => t(`arq.${v}`),
  eq: (v) => t(`eq.${v}`),
};

function special(name: string): ((v: string | number) => string) | undefined {
  for (const k of Object.keys(SPECIAL)) if (name === k || (name.startsWith(k) && /\d$/.test(name))) return SPECIAL[k];
  return undefined;
}

export function hasText(key: string): boolean {
  return key in PT_BR;
}

/**
 * Texto de uma chave. `variant` escolhe entre as variações (use a semente da
 * run somada a algo estável, como o número da mensagem).
 */
export function t(key: string, params: Record<string, string | number> = {}, variant = 0): string {
  const raw = PT_BR[key];
  if (raw === undefined) return key;
  const str = Array.isArray(raw) ? raw[Math.abs(variant) % raw.length] : raw;
  return str.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const lower = name.charAt(0).toLowerCase() + name.slice(1);
    const cap = lower !== name;
    if (!(lower in params)) return `{${name}}`;
    const fn = special(lower);
    let out = fn ? fn(params[lower]) : String(params[lower]);
    if (cap) out = out.charAt(0).toUpperCase() + out.slice(1);
    return out;
  });
}

/** Lista de linhas de uma chave que é sempre lista (intro, finais). */
export function lines(key: string): string[] {
  const raw = PT_BR[key];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

/** Variação estável a partir de qualquer coisa. */
export function variantOf(...parts: (string | number)[]): number {
  return Math.abs(hashString(parts.join(':')));
}

export function personName(nameId: number): string {
  return nameId < 0 ? t('me.cap') : NAMES[nameId % NAMES.length];
}
