// Construção (fase 1): contagem regressiva e bunker editável.

import Phaser from 'phaser';
import { BALANCE } from '../../core/balance';
import { roomById, roomMap, idx, inBounds } from '../../core/grid';
import { canInstall, checkPlacement, equipmentFor } from '../../core/rooms';
import { ROOM_TYPES, type Room, type RoomType, type RunState } from '../../core/state';
import { audio } from '../audio/sfx';
import { P } from '../art/palette';
import { iconKey } from '../art/sprites/icons';
import { TILE } from '../art/sprites/tiles';
import { BunkerView } from '../bunker';
import { roomSignals } from '../describe';
import { store } from '../store';
import { t } from '../text';
import { Button, drawPanel, txt, hiRes, VW } from '../ui/buttons';
import { Clock, TOP_H, TopBar } from '../ui/hud';
import { confirm, Modal } from '../ui/modal';
import { fadeIn, go, Ticker } from './common';

type Tool = 'pan' | 'dig' | 'fill' | 'reinforce' | 'install' | 'demolish' | RoomType;

const ROOM_ICON: Record<RoomType, string> = {
  dorm: 'bed', generator: 'bolt', panel: 'panel', vent: 'wind', greenhouse: 'plant', kitchen: 'pot', reservoir: 'water', corridor: 'door',
};
const TOOL_ICON: Record<string, string> = { pan: 'eye', dig: 'shovel', fill: 'fill', reinforce: 'wall', install: 'equip', demolish: 'hammer' };

export const SIDE_X = VW - 152;

export class Build extends Phaser.Scene {
  private view!: BunkerView;
  private top!: TopBar;
  private clock = new Clock();
  private ticker!: Ticker;
  private tool: Tool = 'pan';
  private toolBtns = new Map<Tool, Button>();
  private info!: Phaser.GameObjects.Text;
  private hatchBtn!: Button;
  private readyBtn!: Button;
  private placeBtn!: Button;
  private cancelBtn!: Button;
  private roomsSig = '';
  private ghost: { x: number; y: number } | null = null;
  private dirty = false;
  private lastSave = 0;
  private modal?: Modal;
  private leaving = false;

  constructor() {
    super('Build');
  }

  create(): void {
    hiRes(this, true);
    fadeIn(this);
    audio.setMood('build');
    this.tool = 'pan';
    this.ghost = null;
    this.leaving = false;
    this.cameras.main.setBackgroundColor(P.dirtDark);
    const run = store.run!;
    this.view = new BunkerView(this, { x: 0, y: TOP_H, w: SIDE_X, h: 360 - TOP_H }, {
      dragPans: () => this.tool !== 'dig' && this.tool !== 'fill',
      onTap: (cx, cy, p) => this.tap(cx, cy, p),
      onPaint: (cx, cy) => this.paint(cx, cy),
      onHover: (cx, cy) => this.hover(cx, cy),
      blocked: (x) => x >= SIDE_X,
    });
    this.view.sync(run);
    this.top = new TopBar(this, 'build', () => this.openMenu(), () => this.openDev());
    this.buildSide();
    this.ticker = new Ticker(this, 4, 356, SIDE_X - 8, run);
    this.events.on('resume', () => this.view.sync(store.run!));
    this.roomsSig = this.signature(run);
    // Bunker vazio: já começa com o corredor de entrada escolhido e mostrando onde vai.
    this.selectTool(run.rooms.some((r) => !r.collapsed) ? 'pan' : 'corridor');
  }

  private buildSide(): void {
    const g = this.add.graphics().setDepth(45);
    drawPanel(g, SIDE_X, TOP_H, VW - SIDE_X, 360 - TOP_H, P.night);
    const tools: Tool[] = ['pan', 'dig', 'fill', 'reinforce', 'install', 'demolish', ...ROOM_TYPES];
    tools.forEach((tool, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const isRoom = (ROOM_TYPES as string[]).includes(tool);
      const label = isRoom ? t(`room.short.${tool}`) : t(`tool.${tool}`);
      const icon = iconKey(this, isRoom ? ROOM_ICON[tool as RoomType] : TOOL_ICON[tool]);
      const b = new Button(this, SIDE_X + 3 + col * 49, TOP_H + 3 + row * 37, 48, 35, { label, icon, size: 13, iconScale: 2 }, () => this.selectTool(tool)).setDepth(46);
      this.toolBtns.set(tool, b);
    });
    const infoY = TOP_H + 3 + 5 * 37 + 2;
    this.add.rectangle(SIDE_X + 3, infoY, 146, 360 - infoY - 46, 0x16111f, 1).setOrigin(0, 0).setDepth(45);
    this.info = txt(this, SIDE_X + 7, infoY + 3, '', 14, P.paper, { wrap: 138, maxLines: store.settings.bigText ? 5 : 6 }).setDepth(46);
    this.hatchBtn = new Button(this, SIDE_X + 3, 316, 72, 40, { icon: iconKey(this, 'hatch'), label: ' ', size: 12, iconScale: 1.6 }, () => {
      const r = store.dispatch({ t: 'hatch', open: !store.run!.hatchOpen });
      if (r.ok) audio.play('build');
    }).setDepth(46);
    this.readyBtn = new Button(this, SIDE_X + 77, 316, 72, 40, { label: t('hud.ready'), style: 'primary', size: 14 }, () => {
      confirm(this, t('hud.readyConfirm'), t('hud.yes'), t('hud.no'), () => store.dispatch({ t: 'skipBuild' }));
    }).setDepth(46);
    // Com uma sala escolhida, o rodapé vira "construir aqui" + cancelar.
    this.placeBtn = new Button(this, SIDE_X + 3, 316, 104, 40, { label: t('build.here'), style: 'primary', size: 16 }, () => this.placeGhost()).setDepth(47);
    this.cancelBtn = new Button(this, SIDE_X + 109, 316, 40, 40, { icon: iconKey(this, 'cross'), iconScale: 1.8 }, () => this.selectTool('pan')).setDepth(47);
  }

  private isRoomTool(): boolean {
    return (ROOM_TYPES as string[]).includes(this.tool);
  }

  /** Mostra os botões certos no rodapé do painel. */
  private updateFooter(): void {
    const room = this.isRoomTool();
    this.hatchBtn.setShown(!room);
    this.readyBtn.setShown(!room);
    this.placeBtn.setShown(room);
    this.cancelBtn.setShown(room);
    if (room) {
      const ok = !!this.ghost && checkPlacement(store.run!, this.tool as RoomType, this.ghost.x, this.ghost.y).ok;
      this.placeBtn.setDisabled(!ok);
    }
  }

  /** Todas as posições (canto superior esquerdo) onde a sala escolhida cabe. */
  private validSpots(type: RoomType): { x: number; y: number }[] {
    const run = store.run!;
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < run.height; y++) for (let x = 0; x < run.width; x++) if (checkPlacement(run, type, x, y).ok) out.push({ x, y });
    return out;
  }

  /** Redesenha a zona verde e reposiciona o fantasma (perto do centro da tela ou do último lugar). */
  private refreshRoomTool(near?: { cx: number; cy: number }): void {
    const type = this.tool as RoomType;
    const def = BALANCE.rooms[type];
    const spots = this.validSpots(type);
    this.view.drawZones(spots.map((s) => ({ x: s.x, y: s.y, w: def.w, h: def.h })));
    if (!spots.length) {
      this.ghost = null;
      this.view.clearGhost();
      this.showToolInfo(t(store.run!.rooms.length ? 'build.noSpot' : 'build.reason.firstEntrance'));
      this.updateFooter();
      return;
    }
    const c = near ?? this.view.centerCell();
    const best = nearest(spots, c.cx - Math.floor(def.w / 2), c.cy - Math.floor(def.h / 2));
    this.setGhost(best.x, best.y);
    this.view.reveal(best.x, best.y, def.w, def.h);
  }

  private placeGhost(): void {
    if (!this.ghost || !this.isRoomTool()) return;
    const g = this.ghost;
    const r = store.dispatch({ t: 'place', room: this.tool as RoomType, x: g.x, y: g.y });
    this.feedback(r.ok, r.reason, 'build', g.x, g.y);
    if (!r.ok) return;
    this.view.shake(120, 0.003);
    this.view.sync(store.run!);
    this.roomsSig = this.signature(store.run!);
    // Depois da primeira sala, volta para o modo de olhar; senão mostra a próxima vaga.
    const built = this.tool;
    this.selectTool('pan');
    this.info.setText(t('build.done', { sala: built }));
  }

  private signature(run: RunState): string {
    return run.rooms.map((r) => `${r.id}${r.collapsed ? 'x' : ''}`).join(',') + '|' + run.terrain.length;
  }

  private selectTool(tool: Tool): void {
    this.tool = tool;
    this.ghost = null;
    this.view.clearGhost();
    this.view.clearZones();
    for (const [k, b] of this.toolBtns) b.setSelected(k === tool);
    this.showToolInfo();
    if (this.isRoomTool()) this.refreshRoomTool();
    else if (tool === 'pan' && !store.run!.rooms.some((r) => !r.collapsed)) this.showToolInfo(t('build.start'));
    this.updateFooter();
  }

  private showToolInfo(extra = ''): void {
    const tool = this.tool;
    const isRoom = (ROOM_TYPES as string[]).includes(tool);
    const head = isRoom ? t(`room.${tool}`) : t(`tool.${tool}`);
    const desc = isRoom ? t(`room.${tool}.desc`) : t(`tool.desc.${tool}`);
    this.info.setText(`${head}\n${desc}${extra ? '\n\n' + extra : ''}`);
  }

  private showRoomInfo(r: Room): void {
    this.info.setText([t(`room.${r.type}`), t(`room.${r.type}.desc`), ...roomSignals(store.run!, r)].join('\n'));
  }

  private roomAtCell(cx: number, cy: number): Room | undefined {
    const run = store.run!;
    if (!inBounds(run, cx, cy)) return undefined;
    const id = roomMap(run)[idx(run, cx, cy)];
    return id >= 0 ? roomById(run, id) : undefined;
  }

  private feedback(ok: boolean, reason: string | undefined, sound: 'dig' | 'build' | 'repair', cx: number, cy: number): void {
    if (!ok) {
      audio.play('error');
      this.showToolInfo(t(reason ?? 'opt.cant'));
      return;
    }
    audio.play(sound);
    this.dirty = true;
    const { x, y } = this.view.cellLocal(cx, cy);
    const burst = this.add.particles(0, 0, 'fx_dust', {
      x: x + TILE / 2, y: y + TILE / 2, speed: { min: 10, max: 40 }, lifespan: 400, quantity: 8, emitting: false,
    });
    this.view.world.add(burst);
    burst.explode(8);
    this.time.delayedCall(600, () => burst.destroy());
  }

  private paint(cx: number, cy: number): void {
    const run = store.run!;
    if (!inBounds(run, cx, cy)) return;
    if (this.tool === 'dig') {
      const r = store.dispatch({ t: 'dig', x: cx, y: cy });
      if (r.ok || r.reason !== 'build.reason.alreadyDug') this.feedback(r.ok, r.reason, 'dig', cx, cy);
    } else if (this.tool === 'fill') {
      const r = store.dispatch({ t: 'fill', x: cx, y: cy });
      this.feedback(r.ok, r.reason, 'dig', cx, cy);
    }
  }

  private hover(cx: number, cy: number): void {
    if (!this.isRoomTool()) return;
    const def = BALANCE.rooms[this.tool as RoomType];
    this.setGhost(cx - Math.floor(def.w / 2), cy - Math.floor(def.h / 2));
  }

  private setGhost(cx: number, cy: number): void {
    const type = this.tool as RoomType;
    const run = store.run!;
    const def = BALANCE.rooms[type];
    this.ghost = { x: cx, y: cy };
    const chk = checkPlacement(run, type, cx, cy);
    this.view.drawGhost(cx, cy, def.w, def.h, chk.ok, chk.ok && run.mods.probe && chk.unstable);
    const lines = [];
    if (chk.ok) {
      const min = chk.digMinutes + chk.buildMinutes;
      lines.push(t(chk.rockCells ? 'build.costRock' : 'build.cost', { min }));
      if (run.mods.probe) lines.push(t(chk.unstable ? 'build.probe.weak' : 'build.probe.firm'));
      lines.push(t(run.rooms.some((r) => !r.collapsed) ? 'room.place' : 'build.start'));
    } else lines.push(t(chk.reason ?? 'opt.cant'));
    // Sem a descrição longa: aqui o que importa é o custo e o próximo passo.
    this.info.setText(`${t(`room.${type}`)}\n${lines.join('\n')}`);
    this.updateFooter();
  }

  private tap(cx: number, cy: number, p: Phaser.Input.Pointer): void {
    const tool = this.tool;
    if ((ROOM_TYPES as string[]).includes(tool)) {
      const def = BALANCE.rooms[tool as RoomType];
      const inGhost = this.ghost && cx >= this.ghost.x && cx < this.ghost.x + def.w && cy >= this.ghost.y && cy < this.ghost.y + def.h;
      // Mouse constrói direto (o fantasma já seguia o cursor); no toque, tocar
      // no fantasma constrói e tocar fora move o fantasma para lá.
      if (this.ghost && (inGhost || !p.wasTouch)) {
        this.placeGhost();
        return;
      }
      // Toque fora: centraliza a sala no dedo e, se não couber, encaixa na vaga verde mais próxima.
      const ax = cx - Math.floor(def.w / 2);
      const ay = cy - Math.floor(def.h / 2);
      if (checkPlacement(store.run!, tool as RoomType, ax, ay).ok) this.setGhost(ax, ay);
      else {
        const spots = this.validSpots(tool as RoomType);
        const best = spots.length ? nearest(spots, ax, ay) : undefined;
        if (best && Math.abs(best.x - ax) + Math.abs(best.y - ay) <= 4) this.setGhost(best.x, best.y);
        else this.setGhost(ax, ay);
      }
      return;
    }
    const room = this.roomAtCell(cx, cy);
    if (tool === 'pan') {
      this.view.highlightRoom(room);
      if (room) this.showRoomInfo(room);
      else this.showToolInfo();
      return;
    }
    if (!room) {
      audio.play('error');
      this.showToolInfo(t('build.reason.noRoom'));
      return;
    }
    if (tool === 'reinforce') {
      const r = store.dispatch({ t: 'reinforce', id: room.id });
      this.feedback(r.ok, r.reason, 'build', cx, cy);
    } else if (tool === 'install') {
      const eq = equipmentFor(room.type);
      if (!eq || !canInstall(store.run!, room, eq)) {
        audio.play('error');
        this.showToolInfo(room.equipment ? t('signal.equipment', { eq: room.equipment }) : t('eq.none'));
        return;
      }
      const r = store.dispatch({ t: 'install', id: room.id });
      this.feedback(r.ok, r.reason, 'repair', cx, cy);
      if (r.ok) this.showToolInfo(`${t(`eq.${eq}`)}: ${t(`eq.${eq}.desc`)}`);
    } else if (tool === 'demolish') {
      confirm(this, `${t('tool.demolish')}: ${t(`room.${room.type}`)}?`, t('hud.yes'), t('hud.no'), () => {
        const r = store.dispatch({ t: 'demolish', id: room.id });
        this.feedback(r.ok, r.reason, 'dig', cx, cy);
      });
    }
  }

  private openMenu(): void {
    if (this.modal) return;
    const prevSpeed = store.speed;
    store.speed = 0;
    const m = new Modal(this, 260, 190, t('hud.menu'));
    const close = () => {
      m.close();
      this.modal = undefined;
    };
    m.add(
      new Button(this, m.x + 30, m.y + 40, 200, 38, { label: t('menu.resume'), style: 'primary' }, () => { close(); store.speed = prevSpeed || 1; }),
      new Button(this, m.x + 30, m.y + 84, 200, 38, { label: t('menu.settings') }, () => {
        close();
        this.scene.launch('Settings', { from: 'Build', overlay: true });
        this.scene.pause();
      }),
      new Button(this, m.x + 30, m.y + 128, 200, 38, { label: t('menu.quit') }, () => {
        store.save();
        go(this, 'Title');
      }),
    );
    this.modal = m;
  }

  private openDev(): void {
    this.scene.launch('Dev', { from: 'Build' });
    this.scene.pause();
  }

  update(time: number, delta: number): void {
    let run = store.run;
    if (!run) return;
    if (this.leaving) return;
    if (run.phase === 'countdown') {
      this.leaving = true;
      store.save();
      go(this, 'Countdown');
      return;
    }
    if (run.events.length) {
      this.openEvent(run);
      return;
    }
    const next = this.clock.advance(run, delta, store.speed);
    if (next !== run) {
      store.setRun(next);
      run = next;
      this.dirty = true;
    }
    this.view.sync(run);
    // Salas mudaram (desabamento, evento): recalcula a zona verde.
    const sig = this.signature(run);
    if (sig !== this.roomsSig) {
      this.roomsSig = sig;
      if (this.isRoomTool()) this.refreshRoomTool(this.ghost ? { cx: this.ghost.x, cy: this.ghost.y } : undefined);
    }
    this.view.update(time, delta, store.speed);
    this.top.update(run);
    this.ticker.update(run, time);
    this.hatchBtn.setLabel(t(run.hatchOpen ? 'hud.hatchShortClose' : 'hud.hatchShortOpen'));
    this.hatchBtn.setSelected(run.hatchOpen);
    if (this.dirty && time - this.lastSave > 2000) {
      store.save();
      this.dirty = false;
      this.lastSave = time;
    }
  }

  private openEvent(run: RunState): void {
    audio.play('knock');
    store.save();
    this.scene.launch('Event', { from: 'Build', eventId: run.events[0].id });
    this.scene.pause();
  }
}

function nearest(spots: { x: number; y: number }[], x: number, y: number): { x: number; y: number } {
  let best = spots[0];
  let bd = Infinity;
  for (const s of spots) {
    const d = Math.abs(s.x - x) + Math.abs(s.y - y) * 1.2;
    if (d < bd) {
      bd = d;
      best = s;
    }
  }
  return best;
}
