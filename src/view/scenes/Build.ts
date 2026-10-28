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
import { Button, drawPanel, txt } from '../ui/buttons';
import { Clock, TOP_H, TopBar } from '../ui/hud';
import { confirm, Modal } from '../ui/modal';
import { fadeIn, go, Ticker } from './common';

type Tool = 'pan' | 'dig' | 'fill' | 'reinforce' | 'install' | 'demolish' | RoomType;

const ROOM_ICON: Record<RoomType, string> = {
  dorm: 'bed', generator: 'bolt', panel: 'panel', vent: 'wind', greenhouse: 'plant', kitchen: 'pot', reservoir: 'water', corridor: 'door',
};
const TOOL_ICON: Record<string, string> = { pan: 'eye', dig: 'shovel', fill: 'fill', reinforce: 'wall', install: 'equip', demolish: 'hammer' };

export const SIDE_X = 488;

export class Build extends Phaser.Scene {
  private view!: BunkerView;
  private top!: TopBar;
  private clock = new Clock();
  private ticker!: Ticker;
  private tool: Tool = 'pan';
  private toolBtns = new Map<Tool, Button>();
  private info!: Phaser.GameObjects.Text;
  private hatchBtn!: Button;
  private ghost: { x: number; y: number } | null = null;
  private dirty = false;
  private lastSave = 0;
  private modal?: Modal;
  private leaving = false;

  constructor() {
    super('Build');
  }

  create(): void {
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
    this.selectTool('pan');
  }

  private buildSide(): void {
    const g = this.add.graphics().setDepth(45);
    drawPanel(g, SIDE_X, TOP_H, 640 - SIDE_X, 360 - TOP_H, P.dirtDark);
    const tools: Tool[] = ['pan', 'dig', 'fill', 'reinforce', 'install', 'demolish', ...ROOM_TYPES];
    tools.forEach((tool, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const isRoom = (ROOM_TYPES as string[]).includes(tool);
      const label = isRoom ? t(`room.short.${tool}`) : t(`tool.${tool}`);
      const icon = iconKey(this, isRoom ? ROOM_ICON[tool as RoomType] : TOOL_ICON[tool]);
      const b = new Button(this, SIDE_X + 3 + col * 49, TOP_H + 3 + row * 37, 48, 35, { label, icon, size: 13, iconScale: 1.6 }, () => this.selectTool(tool)).setDepth(46);
      this.toolBtns.set(tool, b);
    });
    const infoY = TOP_H + 3 + 5 * 37 + 2;
    this.add.rectangle(SIDE_X + 3, infoY, 146, 360 - infoY - 46, P.ink, 0.6).setOrigin(0, 0).setDepth(45);
    this.info = txt(this, SIDE_X + 7, infoY + 3, '', 14, P.paper, { wrap: 138, maxLines: store.settings.bigText ? 5 : 6 }).setDepth(46);
    this.hatchBtn = new Button(this, SIDE_X + 3, 316, 72, 40, { icon: iconKey(this, 'hatch'), label: ' ', size: 12, iconScale: 1.6 }, () => {
      const r = store.dispatch({ t: 'hatch', open: !store.run!.hatchOpen });
      if (r.ok) audio.play('build');
    }).setDepth(46);
    new Button(this, SIDE_X + 77, 316, 72, 40, { label: t('hud.ready'), style: 'primary', size: 14 }, () => {
      confirm(this, t('hud.readyConfirm'), t('hud.yes'), t('hud.no'), () => store.dispatch({ t: 'skipBuild' }));
    }).setDepth(46);
  }

  private selectTool(tool: Tool): void {
    this.tool = tool;
    this.ghost = null;
    this.view.clearGhost();
    for (const [k, b] of this.toolBtns) b.setSelected(k === tool);
    this.showToolInfo();
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
    if ((ROOM_TYPES as string[]).includes(this.tool)) this.setGhost(cx, cy);
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
      lines.push(t('room.place'));
    } else lines.push(t(chk.reason ?? 'opt.cant'));
    this.showToolInfo(lines.join('\n'));
  }

  private tap(cx: number, cy: number, p: Phaser.Input.Pointer): void {
    const tool = this.tool;
    if ((ROOM_TYPES as string[]).includes(tool)) {
      const def = BALANCE.rooms[tool as RoomType];
      const inGhost = this.ghost && cx >= this.ghost.x && cx < this.ghost.x + def.w && cy >= this.ghost.y && cy < this.ghost.y + def.h;
      // Mouse constrói direto (o fantasma já seguia o cursor); toque pede confirmação.
      if (this.ghost && (inGhost || !p.wasTouch)) {
        const g = this.ghost;
        const r = store.dispatch({ t: 'place', room: tool as RoomType, x: g.x, y: g.y });
        this.feedback(r.ok, r.reason, 'build', g.x, g.y);
        if (r.ok) {
          this.ghost = null;
          this.view.clearGhost();
          this.view.shake(120, 0.003);
        }
      } else this.setGhost(cx, cy);
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
