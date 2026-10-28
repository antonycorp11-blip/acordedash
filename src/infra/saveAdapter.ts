// Persistência. Todo acesso ao progresso passa por SaveAdapter; trocar a
// implementação não exige mudar mais nada no jogo.

import type { SaveData } from '../core/state';

export interface SaveAdapter {
  load(): SaveData | null;
  save(data: SaveData): void;
  clear(): void;
}

export const SAVE_VERSION = 1;
const KEY = 'bunker-do-loop/save';

/** Migração simples entre versões do formato salvo. */
export function migrate(raw: unknown, runSchema: number): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Partial<SaveData> & { version?: number };
  const version = data.version ?? 0;
  if (version > SAVE_VERSION) return null;
  if (!data.meta || !data.settings) return null;
  // Versão 0 (protótipo) não tinha leitura de diário nem resumo.
  if (version < 1) {
    data.meta.unreadDiary ??= [];
    data.meta.lastSummary ??= null;
  }
  // Run salva com outro formato de simulação é descartada (o progresso fica).
  const run = data.run && data.run.schema === runSchema ? data.run : null;
  return { version: SAVE_VERSION, meta: data.meta, settings: data.settings, run };
}

export class LocalStorageSaveAdapter implements SaveAdapter {
  constructor(private runSchema: number, private storage: Storage | null = safeStorage()) {}

  load(): SaveData | null {
    if (!this.storage) return null;
    try {
      const txt = this.storage.getItem(KEY);
      return txt ? migrate(JSON.parse(txt), this.runSchema) : null;
    } catch {
      return null;
    }
  }

  save(data: SaveData): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
    } catch {
      // Armazenamento cheio ou bloqueado: o jogo continua, só não salva.
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(KEY);
    } catch {
      // ignorado
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
