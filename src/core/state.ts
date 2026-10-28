// Tipos do estado da run e do progresso persistente. Tudo aqui é dado puro,
// serializável em JSON, sem classes nem funções.

export type RoomType = 'dorm' | 'generator' | 'panel' | 'vent' | 'greenhouse' | 'kitchen' | 'reservoir' | 'corridor';
export const ROOM_TYPES: RoomType[] = ['dorm', 'generator', 'panel', 'vent', 'greenhouse', 'kitchen', 'reservoir', 'corridor'];

export type Terrain = 0 | 1 | 2; // 0 terra, 1 rocha, 2 escavado
export const DIRT: Terrain = 0;
export const ROCK: Terrain = 1;
export const DUG: Terrain = 2;

export type EquipmentId = 'beliche' | 'catalisador' | 'regulador' | 'filtro' | 'lampada' | 'freezer' | 'bomba' | 'escora';

export type Role = 'energia' | 'ar' | 'comida' | 'reparo' | 'guarda' | 'cozinha' | 'nenhuma';
export const ROLES: Role[] = ['nenhuma', 'energia', 'ar', 'comida', 'cozinha', 'reparo', 'guarda'];

export type Archetype = 'hipocondriaco' | 'coach' | 'sogra' | 'engenheiro' | 'crianca' | 'religioso';
export const ARCHETYPES: Archetype[] = ['hipocondriaco', 'coach', 'sogra', 'engenheiro', 'crianca', 'religioso'];

export type Need = 'comida' | 'ar' | 'privacidade' | 'descanso' | 'trabalho';

export type Health = 'ok' | 'ferido' | 'doente' | 'morto';

export type DeathCause =
  | 'explosao' | 'sufocamento' | 'fome' | 'sede' | 'desabamento'
  | 'frio' | 'calor' | 'doenca' | 'invasao' | 'motim';
export const DEATH_CAUSES: DeathCause[] = ['explosao', 'sufocamento', 'fome', 'sede', 'desabamento', 'frio', 'calor', 'doenca', 'invasao', 'motim'];

export type CatastropheType = 'desabamento' | 'tribo' | 'praga' | 'agua' | 'temperatura' | 'blecaute';
export const CATASTROPHE_TYPES: CatastropheType[] = ['desabamento', 'tribo', 'praga', 'agua', 'temperatura', 'blecaute'];

export type EmergencyType =
  | 'gerador' | 'vazamento' | 'entrada' | 'desmoronamento' | 'agua'
  | 'doente' | 'briga' | 'praga' | 'pedido' | 'crianca';

export type EndingId = 'coletivo' | 'solitario' | 'ruptura' | 'cinismo';
export const ENDINGS: EndingId[] = ['coletivo', 'solitario', 'ruptura', 'cinismo'];

export type Phase = 'build' | 'countdown' | 'survival' | 'ended';

export type RiskHint = 'arriscado' | 'demorado' | 'caro' | 'seguro' | 'incerto';

export interface Room {
  id: number;
  type: RoomType;
  x: number;
  y: number;
  w: number;
  h: number;
  integrity: number;
  air: number;
  /** desgaste do gerador (0..100). Em 100 está parado. */
  wear: number;
  powered: boolean;
  /** fração de energia recebida (0..1) */
  powerFrac: number;
  unstable: boolean;
  collapsed: boolean;
  breach: boolean;
  breachHours: number;
  pest: boolean;
  equipment: EquipmentId | null;
  /** quantas vezes foi reforçada */
  reinforced: number;
}

export interface Person {
  id: number;
  /** índice na lista de nomes do arquivo de textos; −1 é o viajante */
  nameId: number;
  archetype: Archetype | 'viajante';
  /** semente visual (cabelo, roupa, pele) */
  look: number;
  morale: number;
  health: Health;
  hunger: number;
  thirst: number;
  suffocation: number;
  exposure: number;
  sickDays: number;
  role: Role;
  homeId: number | null;
  joinedDay: number;
  /** a criança fugiu para outra sala */
  wanderRoomId: number | null;
  /** isolado por doença: não passa a doença adiante */
  isolated?: boolean;
  deathCause?: DeathCause;
  deathDay?: number;
  /** saiu do bunker (expulso, recusado depois de entrar, foi embora) */
  left?: boolean;
  lastFood: 'cozida' | 'crua' | 'lata' | 'nada';
  lastWater: boolean;
}

export interface Resources {
  canned: number;
  food: number;
  raw: number;
  water: number;
  parts: number;
  earth: number;
  battery: number;
}

export interface OptionView {
  /** chave de texto do rótulo */
  label: string;
  hint: RiskHint;
  /** a opção não pode ser escolhida agora (motivo em chave de texto) */
  disabledReason?: string;
}

export interface Emergency {
  id: number;
  type: EmergencyType;
  day: number;
  targetRoom?: number;
  targetPerson?: number;
  targetPerson2?: number;
  /** variação de texto sorteada */
  variant: number;
  resolveAt?: number;
  pendingFix?: string;
  options: OptionView[];
}

export type GameEventKind = 'sobrevivente' | 'catastrofe' | 'motim_aviso' | 'motim_decisao' | 'narrativa' | 'missao';

export interface GameEvent {
  id: number;
  kind: GameEventKind;
  /** chave principal de texto */
  text: string;
  params: Record<string, string | number>;
  options: OptionView[];
  /** dados específicos do evento */
  data: Record<string, number | string>;
}

export interface ScheduledCatastrophe {
  type: CatastropheType;
  day: number;
  stage: 'agendada' | 'ativa' | 'meio' | 'terminada';
  choice: number;
  /** variante (temperatura: 0 frio, 1 calor) */
  variant: number;
  endDay: number;
  midDay: number;
  targetRooms: number[];
  /** como terminou (usado para variar o texto final) */
  result: 'bem' | 'mal' | 'neutro';
}

export type MissionType = 'manterVivo' | 'moral' | 'chegarFim' | 'semDesabar';
export interface Mission {
  type: MissionType;
  personId?: number;
  untilDay?: number;
  status: 'ativa' | 'cumprida' | 'falhou';
}

export interface LogEntry {
  day: number;
  key: string;
  params: Record<string, string | number>;
}

export interface Message {
  seq: number;
  key: string;
  params: Record<string, string | number>;
}

export interface Arrival {
  minute: number;
  seed: number;
}

export interface MutinyState {
  lowDays: number;
  stage: 'nenhum' | 'aviso' | 'decisao';
  instigatorId: number | null;
  deadlineDay: number;
  everWarned: boolean;
  marks: number;
}

export interface RunConfig {
  goalDays: number;
  catastrophes: number;
  mutinyAllowed: boolean;
  severity: number;
}

export interface SkillMods {
  genOutput: number;
  wearMult: number;
  battery: boolean;
  redistribute: boolean;
  reserve: boolean;
  ventMult: number;
  stalenessMult: number;
  autoSeal: boolean;
  leakMult: number;
  diffusionBonus: number;
  suffocationMult: number;
  stockFood: number;
  stockWater: number;
  pestMult: number;
  greenhouseMult: number;
  noSpoil: boolean;
  thirstMult: number;
  hungerMult: number;
  moraleBonus: number;
  overworkMult: number;
  roleBonus: number;
  repressBonus: number;
  negotiateBonus: number;
  guardMult: number;
  listening: boolean;
  extraArrivals: number;
  integrityBonus: number;
  reinforceMult: number;
  digMult: number;
  probe: boolean;
  explosionMult: number;
  equipment: EquipmentId[];
}

export interface Outcome {
  kind: 'vitoria' | 'derrota';
  day: number;
  cause?: DeathCause;
  ending?: EndingId;
}

export interface RunStats {
  accepted: number;
  refused: number;
  abandoned: number;
  sacrificed: number;
  catastrophesFaced: CatastropheType[];
  emergenciesTotal: number;
  generatorFailures: number;
  collapsesAfterExplosion: number;
  lastCollapseDay: number;
  repairsToday: number;
  spoiled: number;
  mutinyOccurred: boolean;
  explosionReport: { sector: number; level: 'intacto' | 'abalado' | 'destruido' }[];
  archetypesMet: Archetype[];
}

export interface RunState {
  schema: number;
  seed: number;
  rng: number;
  phase: Phase;
  minute: number;
  explosionMinute: number;
  config: RunConfig;
  mods: SkillMods;
  width: number;
  height: number;
  terrain: Terrain[];
  rooms: Room[];
  people: Person[];
  nextId: number;
  res: Resources;
  hatchOpen: boolean;
  priority: RoomType[];
  temp: number;
  waterContaminated: boolean;
  contaminationDays: number;
  emergencies: Emergency[];
  emergencySchedule: { minute: number; type: EmergencyType | null }[];
  events: GameEvent[];
  catastrophes: ScheduledCatastrophe[];
  arrivals: Arrival[];
  mutiny: MutinyState;
  missions: Mission[];
  log: LogEntry[];
  chain: LogEntry[];
  messages: Message[];
  messageSeq: number;
  stats: RunStats;
  outcome: Outcome | null;
  /** dias consecutivos em que algo quebrou (para o engenheiro) */
  brokeToday: boolean;
  /** valores do último tick, para o modo desenvolvedor e sinais visuais */
  last: {
    production: number;
    demand: number;
    deficit: boolean;
    surplus: number;
    waterIn: number;
    rawIn: number;
    foodIn: number;
  };
}

export interface Settings {
  volume: number;
  music: boolean;
  bigText: boolean;
  colorblind: boolean;
  reduceMotion: boolean;
  defaultSpeed: number;
}

export interface MetaProgress {
  knowledge: number;
  skills: string[];
  diary: string[];
  /** entradas do diário ainda não lidas */
  unreadDiary: string[];
  runs: number;
  wins: number;
  endings: EndingId[];
  introSeen: boolean;
  deathCauses: DeathCause[];
  catastrophesSeen: CatastropheType[];
  archetypesMet: Archetype[];
  totalAccepted: number;
  generatorFailuresSeen: number;
  lastSummary: RunSummary | null;
}

export interface RunSummary {
  outcome: Outcome;
  knowledgeGained: number;
  newDiary: string[];
  seed: number;
  daysSurvived: number;
}

export interface SaveData {
  version: number;
  meta: MetaProgress;
  settings: Settings;
  run: RunState | null;
}
