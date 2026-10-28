/*
 * BALANCEAMENTO — todos os números do jogo moram aqui. Nenhum outro arquivo do
 * núcleo deve ter número mágico de regra de jogo.
 *
 * Padrões aplicados (seção 20 do documento de design):
 * - Origem do conhecimento: diário de um eu anterior, encontrado no futuro.
 * - Pausa disponível durante a simulação: sim.
 * - Velocidade padrão: 1 dia de jogo = 60 segundos reais em 1x.
 * - Construção: 10 dias de contagem regressiva.
 * - Meta inicial de sobrevivência: 30 dias.
 * - Idioma: português do Brasil.
 *
 * Unidades: "por dia" significa por dia de jogo; a simulação converte para
 * hora dividindo por 24. Energia é medida em unidades instantâneas por hora.
 */

import type { RoomType, Role, Archetype, EquipmentId } from './state';

export const BALANCE = {
  time: {
    minutesPerTick: 60,
    minutesPerDay: 1440,
    buildDays: 10,
    /** segundos reais por dia de jogo em 1x */
    realSecondsPerDay: 60,
    speeds: [0, 1, 2, 4] as const,
    /** limite de ticks processados por quadro de renderização */
    maxTicksPerFrame: 4,
    countdownSeconds: 10,
    workStartHour: 8,
    workEndHour: 18,
  },

  grid: {
    width: 30,
    height: 16,
    /** a partir desta linha começa a aparecer rocha */
    rockStartRow: 6,
    rockChancePerRow: 0.07,
    rockChanceMax: 0.55,
    digMinutesDirt: 15,
    digMinutesRock: 40,
    fillMinutes: 10,
    /** chance de achar sucata (peças) ao escavar rocha */
    rockPartsChance: 0.25,
    reinforceMinutes: 45,
    reinforceEarthCost: 3,
    reinforceAmount: 20,
    maxIntegrity: 150,
    baseIntegrity: 100,
    maxRooms: 60,
  },

  rooms: {
    dorm:       { w: 4, h: 2, minDepth: 3, power: 1, buildMinutes: 180 },
    generator:  { w: 3, h: 2, minDepth: 5, power: 0, buildMinutes: 240 },
    panel:      { w: 2, h: 2, minDepth: 4, power: 1, buildMinutes: 150 },
    vent:       { w: 2, h: 2, minDepth: 2, power: 3, buildMinutes: 150 },
    greenhouse: { w: 4, h: 2, minDepth: 3, power: 4, buildMinutes: 240 },
    kitchen:    { w: 3, h: 2, minDepth: 3, power: 3, buildMinutes: 180 },
    reservoir:  { w: 3, h: 2, minDepth: 6, power: 2, buildMinutes: 200 },
    corridor:   { w: 1, h: 1, minDepth: 0, power: 0, buildMinutes: 20 },
  } as Record<RoomType, { w: number; h: number; minDepth: number; power: number; buildMinutes: number }>,

  /** ordem de prioridade de energia inicial (o jogador pode mudar) */
  defaultPriority: ['vent', 'panel', 'reservoir', 'dorm', 'greenhouse', 'kitchen'] as RoomType[],

  dorm: { capacity: 4, privacyMax: 2 },

  energy: {
    generatorOutput: 10,
    /** desgaste por dia (0..100); em 100 o gerador para */
    wearPerDay: 2.6,
    /** produção cai até esta fração conforme o desgaste */
    wearOutputLoss: 0.5,
    operatorWearMult: 0.6,
    operatorOutputBonus: 0.15,
    repairWearAmount: 60,
    batteryCapacity: 40,
    reserveOutputFraction: 0.5,
    reserveSkillFraction: 0.6,
  },

  air: {
    start: 100,
    ventOutput: 5,
    operatorBonus: 0.25,
    personUse: 1.2,
    staleness: 0.15,
    leakUnsealed: 5,
    leakBreach: 9,
    leakHatch: 12,
    diffusion: 0.25,
    suffocatingBelow: 40,
    harmBelow: 25,
    suffocationPerHour: 6,
    suffocationRecover: 4,
  },

  food: {
    personFoodPerDay: 1,
    personWaterPerDay: 1,
    startCanned: 25,
    startWaterNoReservoir: 6,
    reservoirCapacity: 40,
    reservoirCollectPerDay: 3,
    pumpBonus: 3,
    greenhouseRawPerCellDay: 0.75,
    greenhouseWaterPerCellDay: 0.1,
    lampBonus: 0.5,
    farmerBonus: 0.2,
    kitchenRatePerDay: 7,
    cookBonus: 0.3,
    rawSpoilNoKitchen: 0.15,
    rawSpoilWithKitchen: 0.03,
    foodSpoilNoPower: 0.04,
    hungerPerDay: 34,
    thirstPerDay: 50,
    recoverPerHour: 3,
    starveAt: 100,
  },

  structure: {
    decayPerDay: 0.4,
    unstableDecayPerDay: 3,
    repairPerWorkerDay: 6,
    generatorCarePerWorker: 3,
    repairActionAmount: 30,
    repairActionParts: 1,
    cascadeDamage: 25,
    braceCascadeMult: 0.5,
    cracksBelow: 50,
    dustBelow: 25,
  },

  morale: {
    start: 60,
    travelerStart: 55,
    regressionTarget: 55,
    regression: 0.12,
    foodCooked: 3,
    foodRaw: -3,
    foodCanned: 0,
    foodNone: -15,
    waterNone: -15,
    badAir: -8,
    injured: -3,
    sick: -5,
    badTemp: -6,
    rest: 4,
    restNeed: 2,
    overworked: -4,
    privacyUnmet: -4,
    workUnmet: -4,
    corridorSleeper: -4,
    prayer: 3,
    zealotNoFood: -12,
    coachIdleOthers: -3,
    engineerBored: -4,
    motherInLawOthers: -2,
    markPenalty: -2,
    skillBonus: 3,
    needsMet: 2,
    /** quantas salas por trabalhador antes de sobrecarregar */
    overworkRoomsPerWorker: 2,
  },

  health: {
    sickDeathDays: 8,
    sickDailyDeathChance: 0.04,
    /** dias de doença antes de existir risco diário de morte */
    sickGraceDays: 3,
    sickRecoverChance: 0.2,
    sickSpreadChance: 0.1,
    hypochondriacSickMult: 3,
    injuredRecoverChance: 0.12,
    sickWorkMult: 0.5,
    injuredWorkMult: 0.6,
    contaminatedSickChance: 0.25,
    backgroundContaminationMult: 0.5,
  },

  temperature: {
    driftPerHour: 12,
    returnPerHour: 3,
    compensationPerPower: 1.5,
    sealedCompensation: 4,
    harmAbove: 50,
    exposurePerHourPer10: 1,
    exposureRecover: 3,
    huddleMult: 0.5,
  },

  explosion: {
    /** dano máximo por raso (linha 0) */
    depthDamage: 70,
    /** profundidade em linhas a partir da qual a profundidade não protege mais */
    safeDepth: 10,
    unsealedDamage: 25,
    hatchOpenDamage: 35,
    hatchRadius: 3,
    luckMin: 0.75,
    luckMax: 1.25,
    sectorWidth: 8,
    reinforceProtection: 0.5,
    injuredAbove: 40,
    injuredChance: 0.5,
    collapseSurviveChance: 0.25,
  },

  emergencies: {
    fixGeneratorParts: 2,
    fixGeneratorChance: 0.85,
    hackGeneratorHours: 8,
    hackGeneratorChance: 0.6,
    hackGeneratorWear: 60,
    patchParts: 1,
    mattressHours: 4,
    mattressMorale: -4,
    forceHatchInjury: 0.3,
    weldParts: 2,
    collapseDamage: 30,
    shoreParts: 2,
    shoreAmount: 25,
    boilWaterLoss: 0.1,
    clothHours: 12,
    clothChance: 0.7,
    contaminationDays: 4,
    brothFood: 2,
    brothWater: 2,
    brothHours: 24,
    isolateMorale: -6,
    fightMorale: -8,
    separateMorale: -3,
    mediateBase: 0.5,
    mediateCoach: 0.3,
    mediateMorale: 6,
    fightInjury: 0.4,
    pestRawLoss: 0.2,
    pickHours: 8,
    pickMorale: -3,
    poisonWater: 3,
    poisonChance: 0.8,
    poisonFailLoss: 0.3,
    petsMorale: 5,
    requestMorale: 10,
    listenMorale: 12,
    listenTravelerMorale: -3,
    promiseMorale: -2,
    ignoreRequestMorale: -10,
    prayMorale: 4,
    base: 0.4,
    perComplexity: 0.12,
    max: 6,
    equipmentWeight: 2,
    personWeight: 0.5,
  },

  catastrophes: {
    firstDayMin: 5,
    firstDayMaxFrac: 0.5,
    secondDayMinFrac: 0.55,
    durations: { desabamento: 2, tribo: 3, praga: 4, agua: 4, temperatura: 3, blecaute: 3 } as Record<string, number>,
    collapseDamage: 45,
    collapseRadius: 4,
    collapseExtraRooms: 2,
    negotiateSeverityPenalty: 0.3,
    entranceDefenseFactor: 0.2,
    fightLuckMin: 0.7,
    fightLuckMax: 1.3,
    guardInjuryChance: 0.4,
    aftershockShored: 5,
    aftershockEvacuated: 20,
    aftershockIgnored: 35,
    shoreParts: 3,
    shoreAmount: 30,
    tribeBase: 40,
    tribePerRefused: 10,
    tribeHatchOpen: 30,
    guardDefense: 20,
    sealedDefense: 25,
    negotiateBase: 0.5,
    negotiateCoach: 0.2,
    negotiateFoodCost: 0.15,
    tributeFraction: 0.35,
    stolenFraction: 0.4,
    pestRawLoss: 0.5,
    pestOutputMult: 0.5,
    kitchenSalvage: 0.7,
    burnDamage: 20,
    rationWaterMult: 0.5,
    rationMorale: -4,
    scrapHeatParts: 2,
    wetWallsWater: 10,
    scrapCompensation: 6,
    huddleMoralePerDay: -6,
    crankPower: 4,
    crankMoralePerDay: -5,
    severityAfterFirstEnding: 1.3,
    severityAllEndings: 1.5,
    refusedForTribe: 2,
  },

  survivors: {
    /** quantidade de nomes no arquivo de textos */
    namePool: 48,
    buildArrivalsMin: 1,
    buildArrivalsMax: 3,
    survivalArrivalsMin: 0,
    survivalArrivalsMax: 2,
    specialExtraArrivals: 1,
    arrivalAirLoss: 15,
  },

  mutiny: {
    threshold: 30,
    listeningThreshold: 24,
    lowDaysToWarn: 3,
    deadlineDays: 2,
    recoverAbove: 40,
    negotiateBase: 0.35,
    negotiateMoraleFactor: 0.4,
    negotiateCoach: 0.15,
    negotiateSkill: 0.25,
    negotiateCost: 0.2,
    repressBase: 0.3,
    repressPerGuard: 0.15,
    repressSkill: 0.25,
    successMorale: 15,
    repressMorale: -15,
    yieldShare: 0.5,
    zealotWeight: 2,
  },

  missions: {
    moraleTarget: 45,
    failMorale: -10,
    successKnowledge: 2,
  },

  progression: {
    earlyRuns: 3,
    midRuns: 8,
    goals: [30, 60, 90],
    knowledgeBase: 1,
    knowledgePerDays: 5,
    knowledgePerCatastrophe: 1,
    knowledgeNewCause: 2,
    knowledgeVictory: 5,
  },

  endings: {
    collectiveMinSurvivors: 2,
    collectiveMorale: 60,
    ruptureCollapsedFrac: 0.35,
    ruptureAvgIntegrity: 35,
  },

  resources: {
    startParts: 12,
    startEarth: 0,
    installParts: 2,
    installMinutes: 120,
  },

  roles: {
    energia: 'generator',
    ar: 'vent',
    comida: 'greenhouse',
    cozinha: 'kitchen',
    reparo: null,
    guarda: null,
    nenhuma: null,
  } as Record<Role, RoomType | null>,

  archetypeWeights: {
    hipocondriaco: 1, coach: 1, sogra: 1, engenheiro: 1, crianca: 1, religioso: 1,
  } as Record<Archetype, number>,

  archetypeBonuses: {
    motherInLawCookMult: 1.6,
    engineerRepairMult: 2,
    childWanderChance: 0.35,
    childOpenHatchChance: 0.3,
    coachStartMorale: 80,
  },

  equipment: {
    beliche: { room: 'dorm', capacityBonus: 2 },
    catalisador: { room: 'generator', wearMult: 0.6 },
    regulador: { room: 'panel', productionBonus: 0.1 },
    filtro: { room: 'vent', outputBonus: 0.5 },
    lampada: { room: 'greenhouse', outputBonus: 0.5 },
    freezer: { room: 'kitchen' },
    bomba: { room: 'reservoir' },
    escora: { room: 'corridor', integrityBonus: 30 },
  } as Record<EquipmentId, { room: RoomType; [k: string]: number | string }>,

  dev: {
    resources: { canned: 30, food: 20, water: 40, parts: 10, earth: 20 },
    batchRuns: 60,
  },

  skills: {
    genOutput: 0.2,
    wearReduction: 0.3,
    ventOutput: 0.25,
    filterStaleness: 0.4,
    autoSealHours: 6,
    circulationLeak: 0.3,
    circulationDiffusion: 0.15,
    lungs: 0.4,
    stockFood: 15,
    stockWater: 15,
    resistantPest: 0.5,
    resistantOutput: 0.2,
    canteenThirst: 0.25,
    rationHunger: 0.2,
    delegationThreshold: 0.5,
    delegationBonus: 0.2,
    firmGuard: 0.5,
    wallsIntegrity: 20,
    fastDig: 0.4,
    dampener: 0.25,
  },
};

export type Balance = typeof BALANCE;
