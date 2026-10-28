// Ponte entre as cenas e o núcleo. Guarda o progresso, a run em andamento e as
// configurações; toda mudança na run passa por um comando do núcleo.

import { applyCommand, type Command, type CommandResult } from '../core/commands';
import { finishRun, newMeta } from '../core/progression';
import { seedFrom } from '../core/rng';
import { newRun, SCHEMA } from '../core/simulate';
import { buySkill } from '../core/skills';
import type { MetaProgress, RunState, RunSummary, SaveData, Settings } from '../core/state';
import { LocalStorageSaveAdapter, type SaveAdapter, SAVE_VERSION } from '../infra/saveAdapter';
import { defaultSettings } from '../infra/settings';

type Listener = () => void;

export class Store {
  private data: SaveData;
  private listeners: Listener[] = [];
  /** velocidade atual do relógio (0 pausa) */
  speed = 1;

  constructor(private adapter: SaveAdapter) {
    this.data = adapter.load() ?? { version: SAVE_VERSION, meta: newMeta(), settings: defaultSettings(), run: null };
    this.data.settings = { ...defaultSettings(), ...this.data.settings };
    this.speed = this.data.settings.defaultSpeed;
  }

  get meta(): MetaProgress {
    return this.data.meta;
  }
  get settings(): Settings {
    return this.data.settings;
  }
  get run(): RunState | null {
    return this.data.run;
  }

  onChange(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => (this.listeners = this.listeners.filter((l) => l !== fn));
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  save(): void {
    this.adapter.save(this.data);
  }

  dispatch(cmd: Command): CommandResult {
    if (!this.data.run) return { state: null as unknown as RunState, ok: false, reason: 'opt.cant' };
    const res = applyCommand(this.data.run, cmd);
    if (res.ok) {
      this.data.run = res.state;
      this.emit();
    }
    return res;
  }

  /** Substitui a run (usado pelo relógio, que chama `tick` do núcleo). */
  setRun(run: RunState): void {
    this.data.run = run;
    this.emit();
  }

  startNewRun(seed = seedFrom(Date.now())): RunState {
    this.data.run = newRun(this.data.meta, seed);
    this.speed = this.data.settings.defaultSpeed;
    this.save();
    this.emit();
    return this.data.run;
  }

  /** Fecha a run terminada: progresso atualizado, run apagada. */
  closeRun(): RunSummary | null {
    const run = this.data.run;
    if (!run || !run.outcome) return null;
    const { meta, summary } = finishRun(this.data.meta, run);
    this.data.meta = meta;
    this.save();
    this.emit();
    return summary;
  }

  /** Esquece a run terminada depois que as telas de fim já a mostraram. */
  discardRun(): void {
    this.data.run = null;
    this.save();
  }

  updateMeta(fn: (m: MetaProgress) => MetaProgress): void {
    this.data.meta = fn(this.data.meta);
    this.save();
    this.emit();
  }

  buySkill(id: string): boolean {
    const before = this.data.meta;
    this.data.meta = buySkill(before, id);
    if (this.data.meta === before) return false;
    this.save();
    this.emit();
    return true;
  }

  updateSettings(p: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...p };
    this.save();
    this.emit();
  }

  resetAll(): void {
    this.adapter.clear();
    this.data = { version: SAVE_VERSION, meta: newMeta(), settings: this.data.settings, run: null };
    this.save();
    this.emit();
  }
}

export const store = new Store(new LocalStorageSaveAdapter(SCHEMA));
