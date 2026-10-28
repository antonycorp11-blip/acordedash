import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARCHETYPE_NEEDS } from '../core/archetypes';
import { BALANCE } from '../core/balance';
import { EMERGENCY_TYPES } from '../core/emergencies';
import { DIARY, newMeta } from '../core/progression';
import { SKILLS, BRANCHES } from '../core/skills';
import { ARCHETYPES, CATASTROPHE_TYPES, DEATH_CAUSES, ENDINGS, ROLES, ROOM_TYPES } from '../core/state';
import { migrate, LocalStorageSaveAdapter, SAVE_VERSION } from '../infra/saveAdapter';
import { defaultSettings } from '../infra/settings';
import { NAMES, PT_BR } from '../strings/pt-BR';
import { survivingBunker } from './helpers';

function has(key: string): void {
  expect(PT_BR[key], `falta o texto "${key}"`).toBeDefined();
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('textos', () => {
  it('lista de nomes bate com o balanceamento', () => {
    expect(NAMES.length).toBe(BALANCE.survivors.namePool);
  });

  it('toda chave literal usada no código existe', () => {
    const re = /'((?:build|opt|msg|chain|log|mission|mutiny|arq|cat|emg|room|hud|signal|explosion|legist|defeat|victory|ending|skills|people|settings|dev|title|intro|tool|power|actions|tab|countdown|sv|diary|menu|eq|need|health|mood)\.[\w.]+)'/g;
    const missing: string[] = [];
    for (const f of [...files('src/core'), ...files('src/view')]) {
      for (const m of readFileSync(f, 'utf8').matchAll(re)) {
        if (m[1].endsWith('.') || PT_BR[m[1]] !== undefined) continue;
        missing.push(`${m[1]} (${f})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('chaves dinâmicas de todo o conteúdo existem', () => {
    for (const r of ROOM_TYPES) for (const k of ['', '.desc', '.built']) has(`room.${r}${k}`);
    for (const r of ROOM_TYPES) { has(`room.short.${r}`); has(`room.art.${r}`); }
    for (const e of EMERGENCY_TYPES) {
      has(`emg.${e}`);
      for (let i = 0; i < 3; i++) has(`emg.${e}.op${i}`);
      if (e === 'pedido') for (let i = 0; i < 3; i++) has(`emg.pedido.desc.${i}`);
      else has(`emg.${e}.desc`);
    }
    for (const c of CATASTROPHE_TYPES) {
      has(`cat.${c}`);
      has(`cat.${c}.meio`);
      for (const r of ['bem', 'mal', 'neutro']) has(`cat.${c}.fim.${r}`);
      if (c === 'temperatura') { has('cat.temperatura.inicio.0'); has('cat.temperatura.inicio.1'); has('cat.temperatura.op2.0'); has('cat.temperatura.op2.1'); }
      else { has(`cat.${c}.inicio`); has(`cat.${c}.op2`); }
      has(`cat.${c}.op0`); has(`cat.${c}.op1`);
    }
    for (const a of ARCHETYPES) for (const k of ['', '.entrada', '.medo', '.motim']) has(`arq.${a}${k}`);
    for (const d of DEATH_CAUSES) for (const k of ['causa', 'causaNome', 'legist.cause', 'legist.lesson']) has(`${k}.${d}`);
    for (const d of DIARY) { has(`${d.id}.title`); has(`${d.id}.text`); }
    for (const s of SKILLS) { has(`skill.${s.id}`); has(`skill.${s.id}.desc`); }
    for (const b of BRANCHES) has(`branch.${b}`);
    for (const e of ENDINGS) { has(`ending.${e}`); has(`ending.${e}.text`); }
    for (const r of ROLES) has(`role.${r}`);
    for (const n of new Set(Object.values(ARCHETYPE_NEEDS).flat())) has(`need.${n}`);
    for (const e of Object.keys(BALANCE.equipment)) { has(`eq.${e}`); has(`eq.${e}.desc`); }
    for (const m of ['manterVivo', 'chegarFim', 'moral', 'semDesabar']) has(`mission.${m}`);
  });

  it('templates variáveis têm pelo menos três variações', () => {
    const keys = [
      ...DEATH_CAUSES.flatMap((d) => [`legist.cause.${d}`, `legist.lesson.${d}`]),
      ...EMERGENCY_TYPES.filter((e) => e !== 'pedido').map((e) => `emg.${e}.desc`),
      ...CATASTROPHE_TYPES.filter((c) => c !== 'temperatura').map((c) => `cat.${c}.inicio`),
      ...ARCHETYPES.flatMap((a) => [`arq.${a}.entrada`, `arq.${a}.medo`, `arq.${a}.motim`]),
      'msg.death', 'msg.emergency', 'explosion.after', 'mutiny.decision',
    ];
    for (const k of keys) expect((PT_BR[k] as string[]).length, k).toBeGreaterThanOrEqual(3);
    expect(DIARY.length).toBeGreaterThanOrEqual(20);
  });
});

describe('saves', () => {
  class MemStorage {
    m = new Map<string, string>();
    getItem(k: string) { return this.m.get(k) ?? null; }
    setItem(k: string, v: string) { this.m.set(k, v); }
    removeItem(k: string) { this.m.delete(k); }
  }

  it('salva e carrega a run exatamente como estava', () => {
    const mem = new MemStorage() as unknown as Storage;
    const a = new LocalStorageSaveAdapter(1, mem);
    const run = survivingBunker();
    a.save({ version: SAVE_VERSION, meta: newMeta(), settings: defaultSettings(), run });
    const back = new LocalStorageSaveAdapter(1, mem).load()!;
    expect(back.run).toEqual(run);
    a.clear();
    expect(a.load()).toBeNull();
  });

  it('migra formato antigo e descarta run de outra versão da simulação', () => {
    const meta = { ...newMeta() } as Partial<ReturnType<typeof newMeta>>;
    delete meta.unreadDiary;
    const old = { version: 0, meta, settings: defaultSettings(), run: { schema: 0 } };
    const m = migrate(old, 1)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.meta.unreadDiary).toEqual([]);
    expect(m.run).toBeNull();
    expect(migrate({ version: 99 }, 1)).toBeNull();
  });
});
