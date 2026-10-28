// Árvore de habilidades: definição dos nós e cálculo dos modificadores que a
// simulação lê. As habilidades são permanentes (ficam no progresso).

import { BALANCE } from './balance';
import type { EquipmentId, MetaProgress, SkillMods } from './state';

export type Branch = 'energia' | 'ar' | 'alimento' | 'humano' | 'estrutura';
export const BRANCHES: Branch[] = ['energia', 'ar', 'alimento', 'humano', 'estrutura'];

export interface SkillNode {
  id: string;
  branch: Branch;
  cost: number;
  requires?: string;
  /** escolher este fecha o outro */
  excludes?: string;
  apply: (m: SkillMods) => void;
}

const K = BALANCE.skills;

export const SKILLS: SkillNode[] = [
  // Energia
  { id: 'en_gerador', branch: 'energia', cost: 2, apply: (m) => (m.genOutput += K.genOutput) },
  { id: 'en_desgaste', branch: 'energia', cost: 2, requires: 'en_gerador', apply: (m) => (m.wearMult *= 1 - K.wearReduction) },
  { id: 'en_bateria', branch: 'energia', cost: 3, requires: 'en_gerador', excludes: 'en_redistribuir', apply: (m) => (m.battery = true) },
  { id: 'en_redistribuir', branch: 'energia', cost: 3, requires: 'en_gerador', excludes: 'en_bateria', apply: (m) => (m.redistribute = true) },
  { id: 'en_regulador', branch: 'energia', cost: 2, apply: (m) => m.equipment.push('regulador', 'catalisador') },
  { id: 'en_reserva', branch: 'energia', cost: 4, requires: 'en_desgaste', apply: (m) => (m.reserve = true) },
  // Ar
  { id: 'ar_vent', branch: 'ar', cost: 2, apply: (m) => (m.ventMult += K.ventOutput) },
  { id: 'ar_filtros', branch: 'ar', cost: 3, requires: 'ar_vent', excludes: 'ar_autoveda', apply: (m) => { m.stalenessMult *= 1 - K.filterStaleness; m.equipment.push('filtro'); } },
  { id: 'ar_autoveda', branch: 'ar', cost: 3, requires: 'ar_vent', excludes: 'ar_filtros', apply: (m) => (m.autoSeal = true) },
  { id: 'ar_circulacao', branch: 'ar', cost: 2, apply: (m) => { m.leakMult *= 1 - K.circulationLeak; m.diffusionBonus += K.circulationDiffusion; } },
  { id: 'ar_pulmao', branch: 'ar', cost: 3, requires: 'ar_circulacao', apply: (m) => (m.suffocationMult *= 1 - K.lungs) },
  // Alimento
  { id: 'al_estoque', branch: 'alimento', cost: 2, apply: (m) => { m.stockFood += K.stockFood; m.stockWater += K.stockWater; } },
  { id: 'al_resistente', branch: 'alimento', cost: 3, excludes: 'al_conserva', apply: (m) => { m.pestMult *= K.resistantPest; m.greenhouseMult += K.resistantOutput; m.equipment.push('lampada'); } },
  { id: 'al_conserva', branch: 'alimento', cost: 3, excludes: 'al_resistente', apply: (m) => { m.noSpoil = true; m.equipment.push('freezer'); } },
  { id: 'al_cantil', branch: 'alimento', cost: 2, apply: (m) => { m.thirstMult *= 1 - K.canteenThirst; m.equipment.push('bomba'); } },
  { id: 'al_racionamento', branch: 'alimento', cost: 3, requires: 'al_estoque', apply: (m) => (m.hungerMult *= 1 - K.rationHunger) },
  // Humano
  { id: 'hu_moral', branch: 'humano', cost: 2, apply: (m) => (m.moraleBonus += BALANCE.morale.skillBonus) },
  { id: 'hu_delegacao', branch: 'humano', cost: 2, apply: (m) => { m.overworkMult += K.delegationThreshold; m.roleBonus += K.delegationBonus; } },
  { id: 'hu_pulso', branch: 'humano', cost: 3, excludes: 'hu_escuta', apply: (m) => { m.repressBonus += BALANCE.mutiny.repressSkill; m.guardMult += K.firmGuard; } },
  { id: 'hu_escuta', branch: 'humano', cost: 3, excludes: 'hu_pulso', apply: (m) => { m.negotiateBonus += BALANCE.mutiny.negotiateSkill; m.listening = true; } },
  { id: 'hu_especiais', branch: 'humano', cost: 3, requires: 'hu_moral', apply: (m) => { m.extraArrivals += BALANCE.survivors.specialExtraArrivals; m.equipment.push('beliche'); } },
  // Estrutura (liberado depois da primeira vitória)
  { id: 'es_paredes', branch: 'estrutura', cost: 2, apply: (m) => (m.integrityBonus += K.wallsIntegrity) },
  { id: 'es_escoramento', branch: 'estrutura', cost: 3, excludes: 'es_rapida', apply: (m) => { m.reinforceMult *= 2; m.equipment.push('escora'); } },
  { id: 'es_rapida', branch: 'estrutura', cost: 3, excludes: 'es_escoramento', apply: (m) => (m.digMult *= 1 - K.fastDig) },
  { id: 'es_sondagem', branch: 'estrutura', cost: 2, apply: (m) => (m.probe = true) },
  { id: 'es_amortecedor', branch: 'estrutura', cost: 4, requires: 'es_paredes', apply: (m) => (m.explosionMult *= 1 - K.dampener) },
];

export function baseMods(): SkillMods {
  return {
    genOutput: 0, wearMult: 1, battery: false, redistribute: false, reserve: false,
    ventMult: 1, stalenessMult: 1, autoSeal: false, leakMult: 1, diffusionBonus: 0, suffocationMult: 1,
    stockFood: 0, stockWater: 0, pestMult: 1, greenhouseMult: 1, noSpoil: false, thirstMult: 1, hungerMult: 1,
    moraleBonus: 0, overworkMult: 1, roleBonus: 0, repressBonus: 0, negotiateBonus: 0, guardMult: 1, listening: false,
    extraArrivals: 0, integrityBonus: 0, reinforceMult: 1, digMult: 1, probe: false, explosionMult: 1,
    equipment: [],
  };
}

/** Equipamentos liberados por entradas do diário. */
export const DIARY_EQUIPMENT: Record<string, EquipmentId> = {
  d_sufocamento: 'filtro',
  d_sede: 'bomba',
  d_fome: 'lampada',
  d_gerador: 'catalisador',
  d_desabamento: 'escora',
  d_multidao: 'beliche',
  d_blecaute: 'regulador',
  d_estragou: 'freezer',
};

export function computeMods(meta: Pick<MetaProgress, 'skills' | 'diary'>): SkillMods {
  const m = baseMods();
  for (const id of meta.skills) SKILLS.find((n) => n.id === id)?.apply(m);
  for (const d of meta.diary) {
    const eq = DIARY_EQUIPMENT[d];
    if (eq) m.equipment.push(eq);
  }
  m.equipment = [...new Set(m.equipment)];
  return m;
}

export function branchUnlocked(meta: MetaProgress, b: Branch): boolean {
  return b !== 'estrutura' || meta.wins > 0;
}

export type SkillStatus = 'comprada' | 'disponivel' | 'cara' | 'bloqueada' | 'excluida' | 'ramo_fechado';

export function skillStatus(meta: MetaProgress, id: string): SkillStatus {
  const n = SKILLS.find((k) => k.id === id);
  if (!n) return 'bloqueada';
  if (meta.skills.includes(id)) return 'comprada';
  if (!branchUnlocked(meta, n.branch)) return 'ramo_fechado';
  if (n.excludes && meta.skills.includes(n.excludes)) return 'excluida';
  if (n.requires && !meta.skills.includes(n.requires)) return 'bloqueada';
  if (meta.knowledge < n.cost) return 'cara';
  return 'disponivel';
}

/** Compra uma habilidade. Devolve um novo progresso, ou o mesmo se não puder. */
export function buySkill(meta: MetaProgress, id: string): MetaProgress {
  if (skillStatus(meta, id) !== 'disponivel') return meta;
  const n = SKILLS.find((k) => k.id === id)!;
  return { ...meta, knowledge: meta.knowledge - n.cost, skills: [...meta.skills, id] };
}
