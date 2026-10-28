// Gerador determinístico mulberry32. O estado é um inteiro de 32 bits que vive
// dentro do estado da run, então salvar a run salva também a sequência aleatória.

export interface HasRng {
  rng: number;
}

/** Avança o gerador guardado em `s.rng` e devolve um número em [0, 1). */
export function rand(s: HasRng): number {
  let t = (s.rng = (s.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: HasRng, min: number, maxInclusive: number): number {
  return min + Math.floor(rand(s) * (maxInclusive - min + 1));
}

export function randRange(s: HasRng, min: number, max: number): number {
  return min + rand(s) * (max - min);
}

export function chance(s: HasRng, p: number): boolean {
  return rand(s) < p;
}

export function pick<T>(s: HasRng, list: readonly T[]): T {
  return list[Math.floor(rand(s) * list.length)];
}

/** Sorteio com pesos. Pesos zero ou negativos nunca são escolhidos. */
export function pickWeighted<T>(s: HasRng, list: readonly T[], weight: (item: T) => number): T | undefined {
  let total = 0;
  for (const item of list) total += Math.max(0, weight(item));
  if (total <= 0) return undefined;
  let r = rand(s) * total;
  for (const item of list) {
    r -= Math.max(0, weight(item));
    if (r < 0) return item;
  }
  return list[list.length - 1];
}

export function shuffle<T>(s: HasRng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Semente nova a partir de um número qualquer (ex.: Date.now()). */
export function seedFrom(n: number): number {
  const s = { rng: n | 0 };
  return Math.floor(rand(s) * 0xffffffff) | 0;
}

/** Hash de string estável, usado para variações visuais e de texto. */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h | 0;
}
