// Comandos do jogador. A apresentação nunca mexe no estado: ela envia um
// comando e recebe um novo estado.

import { BALANCE } from './balance';
import { chooseCatastrophe, forceCatastrophe } from './catastrophes';
import { resolveEmergency, spawnEmergency } from './emergencies';
import { idx, inBounds, roomById, roomMap, isRubble } from './grid';
import { addLog, say } from './log';
import { resolveMutiny, forceMutiny } from './mutiny';
import { rand } from './rng';
import { alivePeople, blankRoom, canInstall, checkPlacement, digCost, equipmentFor } from './rooms';
import { advanceBuild, buildEndMinute, checkEnd, startSurvival, tickMut } from './simulate';
import { maxRepairIntegrity } from './systems/structure';
import { DUG, ROCK, ROOM_TYPES } from './state';
import type { Archetype, CatastropheType, EmergencyType, Role, RoomType, RunState } from './state';
import { acceptSurvivor, expel, refuseSurvivor } from './survivors';

export type Command =
  | { t: 'dig'; x: number; y: number }
  | { t: 'fill'; x: number; y: number }
  | { t: 'place'; room: RoomType; x: number; y: number }
  | { t: 'demolish'; id: number }
  | { t: 'reinforce'; id: number }
  | { t: 'install'; id: number }
  | { t: 'hatch'; open: boolean }
  | { t: 'priority'; room: RoomType; dir: -1 | 1 }
  | { t: 'role'; person: number; role: Role }
  | { t: 'home'; person: number; room: number }
  | { t: 'repair'; id: number }
  | { t: 'emergency'; id: number; option: number }
  | { t: 'event'; id: number; option: number }
  | { t: 'expel'; person: number }
  | { t: 'skipBuild' }
  | { t: 'detonate' }
  | { t: 'devSkipDays'; days: number }
  | { t: 'devCatastrophe'; type: CatastropheType }
  | { t: 'devMutiny' }
  | { t: 'devEmergency'; type: EmergencyType }
  | { t: 'devResources' }
  | { t: 'devTeleport'; room: number }
  | { t: 'devSeed'; seed: number };

export interface CommandResult {
  state: RunState;
  ok: boolean;
  /** chave de texto do motivo da recusa */
  reason?: string;
}

/** Aplica um comando sem alterar o estado recebido. */
export function applyCommand(state: RunState, cmd: Command): CommandResult {
  const s = structuredClone(state);
  const reason = run(s, cmd);
  return reason ? { state, ok: false, reason } : { state: s, ok: true };
}

/** Versão que altera o estado recebido (usada na simulação em lote e em testes). */
export function applyCommandMut(s: RunState, cmd: Command): string | undefined {
  return run(s, cmd);
}

const G = BALANCE.grid;

function run(s: RunState, c: Command): string | undefined {
  const building = s.phase === 'build';
  const surviving = s.phase === 'survival' && !s.outcome;
  switch (c.t) {
    case 'dig': {
      if (!building) return 'build.reason.notBuild';
      if (!inBounds(s, c.x, c.y)) return 'build.reason.bounds';
      const i = idx(s, c.x, c.y);
      if (s.terrain[i] === DUG) return 'build.reason.alreadyDug';
      const wasRock = s.terrain[i] === ROCK;
      const cost = digCost(s, c.x, c.y);
      s.terrain[i] = DUG;
      s.res.earth++;
      if (wasRock && rand(s) < G.rockPartsChance) s.res.parts++;
      advanceBuild(s, cost);
      return;
    }
    case 'fill': {
      if (!building) return 'build.reason.notBuild';
      if (!inBounds(s, c.x, c.y)) return 'build.reason.bounds';
      const i = idx(s, c.x, c.y);
      if (s.terrain[i] !== DUG || roomMap(s, true)[i] >= 0) return 'build.reason.cantFill';
      if (s.res.earth < 1) return 'build.reason.noEarth';
      s.res.earth--;
      s.terrain[i] = 0;
      advanceBuild(s, G.fillMinutes);
      return;
    }
    case 'place': {
      const chk = checkPlacement(s, c.room, c.x, c.y);
      if (!chk.ok) return chk.reason;
      const def = BALANCE.rooms[c.room];
      for (let y = c.y; y < c.y + def.h; y++) {
        for (let x = c.x; x < c.x + def.w; x++) {
          const i = idx(s, x, y);
          if (s.terrain[i] !== DUG) {
            if (s.terrain[i] === ROCK && rand(s) < G.rockPartsChance) s.res.parts++;
            s.terrain[i] = DUG;
            s.res.earth++;
          }
        }
      }
      const r = blankRoom(s.nextId++, c.room, c.x, c.y);
      r.integrity += s.mods.integrityBonus;
      s.rooms.push(r);
      if (r.unstable) say(s, s.mods.probe ? 'msg.unstableProbe' : 'msg.unstable', { sala: r.type });
      else say(s, `room.${r.type}.built`);
      // Quem não tem casa ganha uma.
      if (r.type === 'dorm') for (const p of alivePeople(s)) if (p.homeId == null || roomById(s, p.homeId)?.type !== 'dorm') p.homeId = r.id;
      if (alivePeople(s).some((p) => p.homeId == null)) for (const p of alivePeople(s)) if (p.homeId == null) p.homeId = r.id;
      addLog(s, 'log.built', { sala: r.type });
      advanceBuild(s, chk.digMinutes + chk.buildMinutes);
      return;
    }
    case 'demolish': {
      if (!building) return 'build.reason.notBuild';
      const r = roomById(s, c.id);
      if (!r) return 'build.reason.noRoom';
      s.rooms = s.rooms.filter((x) => x.id !== r.id);
      for (const p of s.people) if (p.homeId === r.id) p.homeId = null;
      return;
    }
    case 'reinforce': {
      if (!building) return 'build.reason.notBuild';
      const r = roomById(s, c.id);
      if (!r || r.collapsed) return 'build.reason.noRoom';
      if (s.res.earth < G.reinforceEarthCost) return 'build.reason.noEarth';
      if (r.integrity >= G.maxIntegrity) return 'build.reason.maxed';
      s.res.earth -= G.reinforceEarthCost;
      r.integrity = Math.min(G.maxIntegrity, r.integrity + G.reinforceAmount * s.mods.reinforceMult);
      r.reinforced++;
      advanceBuild(s, G.reinforceMinutes);
      return;
    }
    case 'install': {
      if (!building) return 'build.reason.notBuild';
      const r = roomById(s, c.id);
      if (!r) return 'build.reason.noRoom';
      const eq = equipmentFor(r.type);
      if (!eq || !canInstall(s, r, eq)) return 'build.reason.noEquipment';
      if (s.res.parts < BALANCE.resources.installParts) return 'opt.noParts';
      s.res.parts -= BALANCE.resources.installParts;
      r.equipment = eq;
      if (eq === 'escora') r.integrity += BALANCE.equipment.escora.integrityBonus as number;
      advanceBuild(s, BALANCE.resources.installMinutes);
      return;
    }
    case 'hatch': {
      if (s.phase === 'ended' || s.phase === 'countdown') return 'build.reason.locked';
      s.hatchOpen = c.open;
      return;
    }
    case 'priority': {
      const i = s.priority.indexOf(c.room);
      const j = i + c.dir;
      if (i < 0 || j < 0 || j >= s.priority.length) return 'opt.cant';
      [s.priority[i], s.priority[j]] = [s.priority[j], s.priority[i]];
      return;
    }
    case 'role': {
      const p = alivePeople(s).find((x) => x.id === c.person);
      if (!p) return 'opt.cant';
      p.role = c.role;
      return;
    }
    case 'home': {
      const p = alivePeople(s).find((x) => x.id === c.person);
      const r = roomById(s, c.room);
      if (!p || !r || r.collapsed) return 'opt.cant';
      p.homeId = r.id;
      p.wanderRoomId = null;
      return;
    }
    case 'repair': {
      if (!surviving) return 'opt.cant';
      const r = roomById(s, c.id);
      if (!r || r.collapsed) return 'build.reason.noRoom';
      if (r.type === 'generator' && r.wear >= 100) {
        if (s.res.parts < BALANCE.emergencies.fixGeneratorParts) return 'opt.noParts';
        s.res.parts -= BALANCE.emergencies.fixGeneratorParts;
        r.wear = 100 - BALANCE.energy.repairWearAmount;
      } else if (r.breach) {
        if (s.res.parts < BALANCE.emergencies.patchParts) return 'opt.noParts';
        s.res.parts -= BALANCE.emergencies.patchParts;
        r.breach = false;
        s.emergencies = s.emergencies.filter((e) => !(e.type === 'vazamento' && e.targetRoom === r.id && !e.pendingFix));
      } else if (r.integrity < maxRepairIntegrity(s, r)) {
        const S = BALANCE.structure;
        if (s.res.parts < S.repairActionParts) return 'opt.noParts';
        s.res.parts -= S.repairActionParts;
        r.integrity = Math.min(maxRepairIntegrity(s, r), r.integrity + S.repairActionAmount);
      } else return 'opt.nothingToFix';
      s.stats.repairsToday++;
      say(s, 'msg.repaired', { sala: r.type });
      return;
    }
    case 'emergency': {
      if (!surviving) return 'opt.cant';
      if (!resolveEmergency(s, c.id, c.option)) return 'opt.cant';
      checkEnd(s);
      return;
    }
    case 'event': {
      const e = s.events.find((x) => x.id === c.id);
      if (!e) return 'opt.cant';
      if (e.options[c.option]?.disabledReason) return e.options[c.option].disabledReason;
      if (e.kind === 'sobrevivente') {
        const arch = e.data.archetype as Archetype;
        if (c.option === 0) {
          if (!acceptSurvivor(s, arch, Number(e.data.seed))) return 'opt.noDorm';
        } else refuseSurvivor(s, arch);
      } else if (e.kind === 'catastrofe' && e.text.includes('.inicio')) {
        if (!chooseCatastrophe(s, Number(e.data.cat), c.option)) return 'opt.cant';
      } else if (e.kind === 'motim_decisao') {
        resolveMutiny(s, c.option);
      }
      s.events = s.events.filter((x) => x.id !== c.id);
      checkEnd(s);
      return;
    }
    case 'expel': {
      if (!surviving && !building) return 'opt.cant';
      return expel(s, c.person) ? undefined : 'opt.cant';
    }
    case 'skipBuild': {
      if (!building) return 'opt.cant';
      advanceBuild(s, buildEndMinute() - s.minute);
      return;
    }
    case 'detonate': {
      if (s.phase !== 'countdown') return 'opt.cant';
      startSurvival(s);
      return;
    }
    case 'devSkipDays': {
      if (s.phase === 'build') {
        advanceBuild(s, c.days * BALANCE.time.minutesPerDay);
        return;
      }
      for (let i = 0; i < c.days * 24 && !s.outcome; i++) {
        tickMut(s);
        // Eventos pendentes recebem a primeira opção possível para o tempo andar.
        for (const e of [...s.events]) {
          const o = Math.max(0, e.options.findIndex((x) => !x.disabledReason));
          run(s, { t: 'event', id: e.id, option: o });
        }
      }
      return;
    }
    case 'devCatastrophe':
      forceCatastrophe(s, c.type);
      return;
    case 'devMutiny':
      forceMutiny(s);
      return;
    case 'devEmergency':
      if (!surviving) return 'opt.cant';
      return spawnEmergency(s, c.type) ? undefined : 'opt.cant';
    case 'devResources':
      for (const [k, v] of Object.entries(BALANCE.dev.resources)) s.res[k as keyof typeof s.res] += v;
      return;
    case 'devTeleport':
      for (const p of alivePeople(s)) p.wanderRoomId = c.room;
      return;
    case 'devSeed':
      s.rng = c.seed | 0;
      return;
  }
}

/** Ainda há algo que bloqueie a escavação desta célula? */
export function cellInfo(s: RunState, x: number, y: number): { dug: boolean; rock: boolean; room?: number; rubble: boolean } {
  const i = idx(s, x, y);
  const map = roomMap(s);
  return { dug: s.terrain[i] === DUG, rock: s.terrain[i] === ROCK, room: map[i] >= 0 ? map[i] : undefined, rubble: isRubble(s, x, y) };
}

export { ROOM_TYPES };
