import { describe, expect, it } from 'vitest';
import { BALANCE } from '../core/balance';
import { simulateRun } from '../core/batch';
import { applyCommand, applyCommandMut } from '../core/commands';
import { computeEnding } from '../core/endings';
import { expectedEmergencies } from '../core/emergencies';
import { detonate, expectedDamage } from '../core/explosion';
import { idx, isSealed } from '../core/grid';
import { legistReport } from '../core/legist';
import { mutinyDaily, resolveMutiny } from '../core/mutiny';
import { createPerson } from '../core/people';
import { finishRun, newMeta, runConfig } from '../core/progression';
import { rand, randInt } from '../core/rng';
import { roomsOf, traveler } from '../core/rooms';
import { newRun, tick, tickMut } from '../core/simulate';
import { buySkill, computeMods, skillStatus } from '../core/skills';
import { DUG } from '../core/state';
import { updateEnergy } from '../core/systems/energy';
import { computeTopology } from '../core/topology';
import { meta, quiet, runWith, shaftTo, survivingBunker } from './helpers';

function days(s: ReturnType<typeof survivingBunker>, n: number) {
  for (let i = 0; i < n * 24 && !s.outcome; i++) {
    tickMut(s);
    // Testes de sistema: sem eventos sorteados no caminho.
    s.events = [];
    s.emergencySchedule = [];
    s.emergencies = [];
    s.catastrophes = [];
  }
}

describe('rng', () => {
  it('é determinístico', () => {
    const a = { rng: 123 };
    const b = { rng: 123 };
    const xs = Array.from({ length: 50 }, () => rand(a));
    const ys = Array.from({ length: 50 }, () => rand(b));
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const c = { rng: 9 };
    for (let i = 0; i < 200; i++) {
      const v = randInt(c, 2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
  });
});

describe('determinismo da simulação', () => {
  it('mesma semente e mesmos comandos dão o mesmo resultado', () => {
    const a = simulateRun('equilibrado', 1234);
    const b = simulateRun('equilibrado', 1234);
    expect(a).toEqual(b);
  });

  it('tick é puro e repetível', () => {
    const s = survivingBunker();
    const json = JSON.stringify(s);
    const t1 = tick(s);
    const t2 = tick(s);
    expect(JSON.stringify(s)).toBe(json);
    expect(JSON.stringify(t1)).toBe(JSON.stringify(t2));
    let x = s;
    let y = s;
    for (let i = 0; i < 24 * 5; i++) {
      x = tick(x);
      y = tick(y);
    }
    expect(JSON.stringify(x)).toBe(JSON.stringify(y));
  });

  it('semente diferente muda o resultado', () => {
    const a = newRun(newMeta(), 1);
    const b = newRun(newMeta(), 2);
    expect(a.terrain).not.toEqual(b.terrain);
  });
});

describe('construção e vedação', () => {
  it('a primeira sala precisa ser uma entrada', () => {
    const s = newRun(newMeta(), 1);
    expect(applyCommand(s, { t: 'place', room: 'dorm', x: 3, y: 5 }).ok).toBe(false);
    expect(applyCommand(s, { t: 'place', room: 'corridor', x: 3, y: 0 }).ok).toBe(true);
  });

  it('escavar gasta minutos e rende terra', () => {
    const s = newRun(newMeta(), 1);
    const r = applyCommand(s, { t: 'dig', x: 3, y: 2 });
    expect(r.ok).toBe(true);
    expect(r.state.minute).toBeGreaterThan(s.minute);
    expect(r.state.res.earth).toBe(1);
  });

  it('túnel aberto ao lado quebra a vedação; aterrar conserta', () => {
    const s = runWith([...shaftTo(5, 4), ['dorm', 6, 3]]);
    applyCommandMut(s, { t: 'hatch', open: false });
    const dorm = roomsOf(s, 'dorm')[0];
    expect(isSealed(s, dorm)).toBe(true);
    applyCommandMut(s, { t: 'dig', x: 10, y: 3 });
    expect(isSealed(s, dorm)).toBe(false);
    applyCommandMut(s, { t: 'fill', x: 10, y: 3 });
    expect(isSealed(s, dorm)).toBe(true);
  });

  it('escotilha aberta deixa a entrada aberta', () => {
    const s = runWith(shaftTo(5, 2));
    const ent = s.rooms.find((r) => r.y === 0)!;
    s.hatchOpen = true;
    expect(isSealed(s, ent)).toBe(false);
    s.hatchOpen = false;
    expect(isSealed(s, ent)).toBe(true);
  });

  it('sala rasa demais fica instável', () => {
    const s = runWith([...shaftTo(5, 2), ['generator', 6, 1]]);
    expect(roomsOf(s, 'generator')[0].unstable).toBe(true);
  });
});

describe('energia', () => {
  it('sem painel nenhuma sala recebe energia', () => {
    const s = runWith([...shaftTo(14, 8), ['generator', 15, 6], ['vent', 12, 4]]);
    updateEnergy(s, computeTopology(s));
    expect(roomsOf(s, 'vent')[0].powered).toBe(false);
  });

  it('gerador + painel ligam as salas e a prioridade decide quem fica sem', () => {
    const s = runWith([...shaftTo(14, 11), ['generator', 15, 6], ['panel', 15, 4], ['vent', 12, 4], ['greenhouse', 10, 8], ['kitchen', 11, 10]]);
    updateEnergy(s, computeTopology(s));
    // 10 de produção: painel 1 + ventilação 3 + estufa 4 = 8; a cozinha (3) fica sem.
    expect(roomsOf(s, 'vent')[0].powered).toBe(true);
    expect(roomsOf(s, 'greenhouse')[0].powered).toBe(true);
    expect(roomsOf(s, 'kitchen')[0].powered).toBe(false);
    applyCommandMut(s, { t: 'priority', room: 'kitchen', dir: -1 });
    updateEnergy(s, computeTopology(s));
    expect(roomsOf(s, 'kitchen')[0].powered).toBe(true);
    expect(roomsOf(s, 'greenhouse')[0].powered).toBe(false);
  });

  it('gerador desgastado para', () => {
    const s = survivingBunker();
    for (const g of roomsOf(s, 'generator')) g.wear = 100;
    updateEnergy(s, computeTopology(s));
    expect(s.last.production).toBe(0);
    expect(roomsOf(s, 'vent')[0].powered).toBe(false);
  });
});

describe('ar', () => {
  it('ventilação mantém o ar de um bunker vedado', () => {
    const s = survivingBunker();
    days(s, 5);
    expect(Math.min(...s.rooms.filter((r) => !r.collapsed).map((r) => r.air))).toBeGreaterThan(BALANCE.air.suffocatingBelow);
  });

  it('sala aberta perde ar e sufoca', () => {
    const s = survivingBunker();
    s.hatchOpen = true;
    for (const r of s.rooms) r.breach = r.type !== 'corridor';
    for (const g of roomsOf(s, 'generator')) g.wear = 100;
    days(s, 6);
    expect(roomsOf(s, 'dorm')[0].air).toBeLessThan(BALANCE.air.harmBelow);
  });
});

describe('alimento e água', () => {
  it('estufa ligada produz comida e a cozinha cozinha', () => {
    const s = survivingBunker();
    days(s, 3);
    expect(s.res.food + s.res.raw).toBeGreaterThan(0);
    expect(s.last.rawIn).toBeGreaterThan(0);
  });

  it('sem comida e sem água a pessoa morre', () => {
    const s = survivingBunker();
    s.res.canned = 0;
    s.res.food = 0;
    s.res.raw = 0;
    s.res.water = 0;
    for (const r of s.rooms) if (r.type === 'greenhouse' || r.type === 'reservoir') r.collapsed = true;
    days(s, 6);
    expect(s.outcome?.kind).toBe('derrota');
    expect(['sede', 'fome']).toContain(s.outcome?.cause);
  });
});

describe('moral e motim', () => {
  it('fome derruba a moral', () => {
    const s = survivingBunker();
    const p = createPerson(s, 'coach', roomsOf(s, 'dorm')[0].id);
    s.people.push(p);
    const before = p.morale;
    s.res.canned = 0;
    s.res.food = 0;
    s.res.raw = 0;
    for (const r of s.rooms) if (r.type === 'greenhouse') r.collapsed = true;
    days(s, 2);
    expect(p.morale).toBeLessThan(before);
  });

  it('moral baixa por dias seguidos gera aviso e depois decisão', () => {
    const s = survivingBunker();
    s.config.mutinyAllowed = true;
    const dorm = roomsOf(s, 'dorm')[0].id;
    s.people.push(createPerson(s, 'religioso', dorm), createPerson(s, 'sogra', dorm));
    for (let d = 0; d < BALANCE.mutiny.lowDaysToWarn; d++) {
      for (const p of s.people) p.morale = 5;
      mutinyDaily(s);
    }
    expect(s.mutiny.stage).toBe('aviso');
    expect(s.events.some((e) => e.kind === 'motim_aviso')).toBe(true);
    s.minute += BALANCE.mutiny.deadlineDays * BALANCE.time.minutesPerDay;
    mutinyDaily(s);
    expect(s.mutiny.stage).toBe('decisao');
    // Ceder nunca é derrota.
    expect(resolveMutiny(s, 2)).toBe(false);
    expect(traveler(s).health).not.toBe('morto');
  });

  it('motim vencedor mata o viajante (derrota por motim)', () => {
    const s = survivingBunker();
    s.config.mutinyAllowed = true;
    const dorm = roomsOf(s, 'dorm')[0].id;
    s.people.push(createPerson(s, 'religioso', dorm), createPerson(s, 'sogra', dorm));
    s.mutiny.stage = 'decisao';
    s.mutiny.instigatorId = s.people[1].id;
    s.mods.repressBonus = -10;
    expect(resolveMutiny(s, 1)).toBe(true);
    tickMut(s);
    expect(s.outcome?.cause).toBe('motim');
  });
});

describe('explosão', () => {
  it('sala rasa sofre mais do que sala funda', () => {
    const s = runWith([...shaftTo(14, 12), ['dorm', 10, 1], ['dorm', 10, 11]]);
    const [shallow, deep] = roomsOf(s, 'dorm');
    expect(expectedDamage(s, shallow, true)).toBeGreaterThan(expectedDamage(s, deep, true));
  });

  it('sala aberta sofre mais do que vedada', () => {
    const s = runWith([...shaftTo(14, 6), ['dorm', 10, 5]]);
    const d = roomsOf(s, 'dorm')[0];
    expect(expectedDamage(s, d, false)).toBeGreaterThan(expectedDamage(s, d, true));
  });

  it('sala instável desmorona na explosão', () => {
    const s = runWith([...shaftTo(14, 6), ['generator', 15, 1]]);
    s.phase = 'countdown';
    detonate(s);
    expect(roomsOf(s, 'generator').length).toBe(0);
    expect(s.rooms.find((r) => r.type === 'generator')!.collapsed).toBe(true);
  });

  it('bunker vazio mata o viajante na explosão', () => {
    const s = newRun(newMeta(), 3);
    applyCommandMut(s, { t: 'skipBuild' });
    s.events = [];
    applyCommandMut(s, { t: 'detonate' });
    expect(s.outcome?.kind).toBe('derrota');
    expect(s.outcome?.cause).toBe('explosao');
  });
});

describe('cascata', () => {
  it('falha de energia derruba ar e comida', () => {
    const s = survivingBunker();
    days(s, 1);
    const rawBefore = s.last.rawIn;
    for (const g of roomsOf(s, 'generator')) g.wear = 100;
    for (const p of s.people) p.role = 'nenhuma';
    days(s, 4);
    // Energia caiu → estufa parou (comida) e ventilação parou (ar).
    expect(rawBefore).toBeGreaterThan(0);
    expect(s.last.rawIn).toBe(0);
    expect(roomsOf(s, 'vent')[0].powered).toBe(false);
    const avgAir = s.rooms.filter((r) => !r.collapsed).reduce((a, r) => a + r.air, 0) / s.rooms.filter((r) => !r.collapsed).length;
    expect(avgAir).toBeLessThan(90);
  });

  it('desabamento de sala arrasta vizinhas e corta energia', () => {
    const s = survivingBunker();
    const panel = roomsOf(s, 'panel')[0];
    panel.integrity = 0;
    for (const r of s.rooms) if (r.type === 'corridor') r.integrity = 10;
    days(s, 1);
    days(s, 0.05);
    expect(panel.collapsed).toBe(true);
    expect(s.rooms.filter((r) => r.type === 'corridor' && r.collapsed).length).toBeGreaterThan(0);
    expect(roomsOf(s, 'vent').every((v) => !v.powered)).toBe(true);
  });
});

describe('emergências', () => {
  it('bunker complexo gera mais emergências que simples', () => {
    const simple = runWith(shaftTo(14, 3));
    const complex = survivingBunker([['dorm', 10, 12], ['vent', 15, 2]]);
    expect(expectedEmergencies(complex)).toBeGreaterThan(expectedEmergencies(simple));
  });
});

describe('progressão, habilidades e finais', () => {
  it('dificuldade segue as runs e os finais', () => {
    expect(runConfig({ ...newMeta(), runs: 0 })).toMatchObject({ goalDays: 30, catastrophes: 1, mutinyAllowed: false });
    expect(runConfig({ ...newMeta(), runs: 4 })).toMatchObject({ goalDays: 30, catastrophes: 2, mutinyAllowed: true });
    expect(runConfig({ ...newMeta(), runs: 4, endings: ['cinismo'] }).goalDays).toBe(60);
    expect(runConfig({ ...newMeta(), endings: ['cinismo', 'coletivo', 'ruptura', 'solitario'] }).goalDays).toBe(90);
  });

  it('habilidades exclusivas fecham a alternativa', () => {
    let m = meta({ knowledge: 20 });
    m = buySkill(m, 'en_gerador');
    m = buySkill(m, 'en_bateria');
    expect(m.skills).toContain('en_bateria');
    expect(skillStatus(m, 'en_redistribuir')).toBe('excluida');
    expect(computeMods(m).battery).toBe(true);
    expect(skillStatus(meta({ knowledge: 20 }), 'es_paredes')).toBe('ramo_fechado');
  });

  it('fim de run dá conhecimento e diário', () => {
    const s = survivingBunker();
    s.outcome = { kind: 'derrota', day: 4, cause: 'fome' };
    const { meta: m, summary } = finishRun(newMeta(), s);
    expect(m.knowledge).toBeGreaterThan(0);
    expect(m.diary).toContain('d_fome');
    expect(summary.newDiary).toContain('d_primeira_morte');
    expect(m.runs).toBe(1);
  });

  it('os quatro finais são alcançáveis', () => {
    const dormId = (s: ReturnType<typeof survivingBunker>) => roomsOf(s, 'dorm')[0].id;
    // Cinismo: venceu sozinho, sem abandonar ninguém.
    const a = survivingBunker();
    expect(computeEnding(a)).toBe('cinismo');
    // Solitário: os outros morreram ou foram embora por decisão.
    const b = survivingBunker();
    b.people.push(createPerson(b, 'coach', dormId(b)));
    applyCommandMut(b, { t: 'expel', person: b.people[1].id });
    expect(computeEnding(b)).toBe('solitario');
    // Coletivo: todos vivos, moral alta, sem motim.
    const c = survivingBunker([['dorm', 10, 12]]);
    c.people.push(createPerson(c, 'coach', dormId(c)), createPerson(c, 'engenheiro', dormId(c)));
    for (const p of c.people) p.morale = 90;
    expect(computeEnding(c)).toBe('coletivo');
    // Ruptura: o bunker caiu.
    const d = survivingBunker();
    for (const r of d.rooms) if (r.type !== 'dorm') r.collapsed = true;
    expect(computeEnding(d)).toBe('ruptura');
  });

  it('vitória ao bater a meta', () => {
    const s = survivingBunker();
    s.config.goalDays = 2;
    s.res.canned = 100;
    days(s, 3);
    expect(s.outcome?.kind).toBe('vitoria');
    expect(s.outcome?.ending).toBeDefined();
  });
});

describe('legista', () => {
  it('monta cadeia de falhas e mortes', () => {
    const s = survivingBunker();
    s.res.canned = 0;
    s.res.water = 0;
    for (const r of s.rooms) if (r.type === 'greenhouse' || r.type === 'reservoir') r.collapsed = true;
    days(s, 6);
    const rep = legistReport(s);
    expect(rep.cause).toBe(s.outcome!.cause);
    expect(rep.chain.length).toBeGreaterThan(0);
    expect(rep.chain.length).toBeLessThanOrEqual(3);
    expect([0, 1, 2]).toContain(rep.causeVariant);
  });
});

describe('grade', () => {
  it('escavar marca a célula', () => {
    const s = newRun(newMeta(), 5);
    applyCommandMut(s, { t: 'dig', x: 0, y: 0 });
    expect(s.terrain[idx(s, 0, 0)]).toBe(DUG);
    quiet(s);
  });
});
