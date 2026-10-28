// Registro de mensagens do narrador, log diário e cadeia de falhas (para o legista).

import type { RunState } from './state';
import { BALANCE } from './balance';

const MAX_LOG = 300;
const MAX_CHAIN = 40;
const MAX_MESSAGES = 40;

export function survivalDay(s: RunState): number {
  if (s.phase === 'build' || s.phase === 'countdown') return 0;
  return Math.floor((s.minute - s.explosionMinute) / BALANCE.time.minutesPerDay) + 1;
}

export function buildDay(s: RunState): number {
  return Math.floor(s.minute / BALANCE.time.minutesPerDay) + 1;
}

/** Dia exibido no log: na construção conta negativo até a explosão. */
export function logDay(s: RunState): number {
  return s.phase === 'build' || s.phase === 'countdown' ? buildDay(s) - BALANCE.time.buildDays - 1 : survivalDay(s);
}

export function addLog(s: RunState, key: string, params: Record<string, string | number> = {}): void {
  s.log.push({ day: logDay(s), key, params });
  if (s.log.length > MAX_LOG) s.log.splice(0, s.log.length - MAX_LOG);
}

/** Elo da cadeia de falhas. Ignora repetição imediata da mesma falha. */
export function addChain(s: RunState, key: string, params: Record<string, string | number> = {}): void {
  const last = s.chain[s.chain.length - 1];
  const day = logDay(s);
  if (last && last.key === key && JSON.stringify(last.params) === JSON.stringify(params)) return;
  s.chain.push({ day, key, params });
  if (s.chain.length > MAX_CHAIN) s.chain.splice(0, s.chain.length - MAX_CHAIN);
  addLog(s, key, params);
}

/** Fala do narrador que aparece na tela. */
export function say(s: RunState, key: string, params: Record<string, string | number> = {}): void {
  s.messageSeq++;
  s.messages.push({ seq: s.messageSeq, key, params });
  if (s.messages.length > MAX_MESSAGES) s.messages.splice(0, s.messages.length - MAX_MESSAGES);
}
