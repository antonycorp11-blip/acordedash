// Visão do bunker: terreno, salas com sinais visíveis, pessoas, efeitos e
// câmera (zoom com pinça, arrastar, roda do mouse). Só lê o estado; nunca o altera.

import Phaser from 'phaser';
import { BALANCE } from '../core/balance';
import { isEntrance } from '../core/grid';
import { activeCat } from '../core/query';
import { alivePeople, personLocation } from '../core/rooms';
import type { Person, Room, RunState } from '../core/state';
import { waterCapacity } from '../core/systems/food';
import { computeTopology } from '../core/topology';
import { P } from './art/palette';
import { css, ellipse, hdTexture, line, liveCanvas, RES } from './art/hd';
import { iconKey } from './art/sprites/icons';
import { CEIL, collapsedKey, fanKey, FLOOR, roomKey, TILE } from './art/sprites/rooms';
import { lightTexture } from './art/pixel';
import { bubbleKey, personKey, PERSON_H, type Expression } from './art/survivors';
import { drawGround, drawSky, drawTower, skyMood } from './art/world';
import { t } from './text';
import { store } from './store';
import { FONT, fontSize, ptr, UI_ZOOM } from './ui/buttons';

export const SKY_H = 96;
const GROUND_RES = 3;
const DARK_RES = 1.5;

const ROOM_ICON: Record<string, string> = {
  dorm: 'bed', generator: 'bolt', panel: 'panel', vent: 'wind', greenhouse: 'plant', kitchen: 'pot', reservoir: 'water',
};

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RoomVisual {
  sig: string;
  img: Phaser.GameObjects.Image;
  dark: Phaser.GameObjects.Rectangle;
  glow?: Phaser.GameObjects.Rectangle;
  cracks: Phaser.GameObjects.Image;
  label?: Phaser.GameObjects.Container;
  icons: Phaser.GameObjects.Container;
  iconSig: string;
  fan?: Phaser.GameObjects.Image;
  leds: Phaser.GameObjects.Image[];
  water?: Phaser.GameObjects.Rectangle;
  hatch?: Phaser.GameObjects.Image;
  smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  dust?: Phaser.GameObjects.Particles.ParticleEmitter;
  wind?: Phaser.GameObjects.Particles.ParticleEmitter;
  bugs?: Phaser.GameObjects.Particles.ParticleEmitter;
  haze?: Phaser.GameObjects.Particles.ParticleEmitter;
  steam?: Phaser.GameObjects.Particles.ParticleEmitter;
  baseX: number;
}

interface PersonVisual {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  roomId: number | null;
  targetX: number;
  nextMove: number;
  frameT: number;
  frame: number;
  gestureUntil: number;
  bubble?: Phaser.GameObjects.Container;
  bubbleUntil: number;
  mood?: Phaser.GameObjects.Image;
}

export interface BunkerInput {
  /** toque rápido numa célula (ou fora da grade: cy < 0 é céu) */
  onTap?: (cx: number, cy: number, pointer: Phaser.Input.Pointer) => void;
  /** ferramentas de pintar (escavar): pressionar e arrastar */
  onPaint?: (cx: number, cy: number) => void;
  onHover?: (cx: number, cy: number) => void;
  /** true: um dedo arrasta a câmera; false: um dedo pinta */
  dragPans: () => boolean;
  /** retângulos de interface onde o toque não é do bunker */
  blocked?: (x: number, y: number) => boolean;
}

export class BunkerView {
  readonly world: Phaser.GameObjects.Container;
  private skyImg: Phaser.GameObjects.Image;
  private groundImg: Phaser.GameObjects.Image;
  private darkImg: Phaser.GameObjects.Image;
  private glowLayer: Phaser.GameObjects.Container;
  private doorsG: Phaser.GameObjects.Graphics;
  private lightSig = '';
  private doorSig = '';
  private focused = false;
  private roomLayer: Phaser.GameObjects.Container;
  private peopleLayer: Phaser.GameObjects.Container;
  private fxLayer: Phaser.GameObjects.Container;
  readonly cursor: Phaser.GameObjects.Graphics;
  private ambient?: Phaser.GameObjects.Particles.ParticleEmitter;
  private ambientKind = '';
  private rooms = new Map<number, RoomVisual>();
  private people = new Map<number, PersonVisual>();
  private terrainSig = '';
  private skySig = '';
  private run: RunState | null = null;
  private sealed = new Map<number, boolean>();
  zoom = 1;
  private minZoom = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private dragStart: { x: number; y: number; moved: number } | null = null;
  private lastPaint = '';
  readonly worldW: number;
  readonly worldH: number;

  constructor(private scene: Phaser.Scene, public vp: Viewport, private input: BunkerInput) {
    this.worldW = BALANCE.grid.width * TILE;
    this.worldH = SKY_H + BALANCE.grid.height * TILE;
    this.world = scene.add.container(vp.x, vp.y).setDepth(0);
    // Céu, solo e escuridão são canvases em alta resolução, redesenhados quando mudam.
    liveCanvas(scene, 'w_sky', this.worldW, SKY_H, RES);
    liveCanvas(scene, 'w_ground', this.worldW, this.worldH - SKY_H, GROUND_RES);
    liveCanvas(scene, 'w_dark', this.worldW, this.worldH - SKY_H, DARK_RES);
    this.skyImg = scene.add.image(0, 0, 'w_sky').setOrigin(0, 0).setScale(1 / RES);
    this.groundImg = scene.add.image(0, SKY_H, 'w_ground').setOrigin(0, 0).setScale(1 / GROUND_RES);
    this.darkImg = scene.add.image(0, SKY_H, 'w_dark').setOrigin(0, 0).setScale(1 / DARK_RES);
    this.glowLayer = scene.add.container(0, 0);
    this.roomLayer = scene.add.container(0, 0);
    this.doorsG = scene.add.graphics();
    this.fxLayer = scene.add.container(0, 0);
    this.peopleLayer = scene.add.container(0, 0);
    this.cursor = scene.add.graphics();
    this.world.add([this.skyImg, this.groundImg, this.darkImg, this.glowLayer, this.roomLayer, this.doorsG, this.peopleLayer, this.fxLayer, this.cursor]);
    this.minZoom = Math.min(1, Math.min(vp.w / this.worldW, vp.h / this.worldH));
    this.zoom = 1;
    this.applyCamera();
    this.center();
    this.bindInput();
  }

  // ------------------------------------------------------------ câmera

  private applyCamera(): void {
    this.world.setScale(this.zoom);
    const ww = this.worldW * this.zoom;
    const wh = this.worldH * this.zoom;
    const minX = this.vp.x + Math.min(0, this.vp.w - ww);
    const maxX = this.vp.x + Math.max(0, this.vp.w - ww);
    const minY = this.vp.y + Math.min(0, this.vp.h - wh);
    const maxY = this.vp.y + Math.max(0, this.vp.h - wh);
    // Quando o mundo é menor que a janela, centraliza.
    this.world.x = ww <= this.vp.w ? this.vp.x + (this.vp.w - ww) / 2 : Phaser.Math.Clamp(this.world.x, minX, maxX);
    this.world.y = wh <= this.vp.h ? this.vp.y + (this.vp.h - wh) / 2 : Phaser.Math.Clamp(this.world.y, minY, maxY);
  }

  center(): void {
    this.world.x = this.vp.x + (this.vp.w - this.worldW * this.zoom) / 2;
    this.world.y = this.vp.y;
    this.applyCamera();
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.zoom;
    this.zoom = Phaser.Math.Clamp(this.zoom * factor, this.minZoom, 4);
    const k = this.zoom / before;
    this.world.x = sx - (sx - this.world.x) * k;
    this.world.y = sy - (sy - this.world.y) * k;
    this.applyCamera();
  }

  zoomTo(sx: number, sy: number, z: number): void {
    this.zoomAt(sx, sy, Phaser.Math.Clamp(z, this.minZoom, 4) / this.zoom);
  }

  /** Enquadra as salas existentes (ou a superfície, se não houver nenhuma). */
  focus(run: RunState): void {
    const live = run.rooms.filter((r) => !r.collapsed);
    let x0 = run.width / 2 - 6;
    let x1 = run.width / 2 + 6;
    let y0 = -3;
    let y1 = 8;
    if (live.length) {
      x0 = Math.min(...live.map((r) => r.x)) - 2;
      x1 = Math.max(...live.map((r) => r.x + r.w)) + 2;
      // A entrada é corredor fino: o enquadramento usa as salas de verdade.
      const real = live.filter((r) => r.type !== 'corridor');
      y0 = (real.length ? Math.min(...real.map((r) => r.y)) : 0) - 1;
      y1 = Math.max(...live.map((r) => r.y + r.h)) + 1;
    }
    const bw = (x1 - x0) * TILE;
    const bh = (y1 - y0) * TILE;
    const fit = Math.min(this.vp.w / bw, this.vp.h / bh);
    // Zoom de perto o bastante para ver as pessoas; o resto se vê arrastando.
    this.zoom = Phaser.Math.Clamp(Math.floor(fit * 2) / 2, 2, 3);
    this.world.setScale(this.zoom);
    const cx = ((x0 + x1) / 2) * TILE;
    // Começa mostrando do céu para baixo.
    // Mostra o céu quando as salas estão rasas; senão, centraliza nelas.
    const half = this.vp.h / (2 * this.zoom);
    const centered = SKY_H + ((y0 + y1) / 2) * TILE;
    const skyTop = SKY_H - 46 + half;
    const roomsTop = SKY_H + y0 * TILE - 8 + half;
    const cy = Math.min(roomsTop, Math.max(skyTop, centered));
    this.world.x = this.vp.x + this.vp.w / 2 - cx * this.zoom;
    this.world.y = this.vp.y + this.vp.h / 2 - cy * this.zoom;
    this.applyCamera();
  }

  pan(dx: number, dy: number): void {
    this.world.x += dx;
    this.world.y += dy;
    this.applyCamera();
  }

  /** Converte posição de tela em célula da grade (cy negativo = céu). */
  screenToCell(sx: number, sy: number): { cx: number; cy: number } {
    const lx = (sx - this.world.x) / this.zoom;
    const ly = (sy - this.world.y) / this.zoom - SKY_H;
    return { cx: Math.floor(lx / TILE), cy: Math.floor(ly / TILE) };
  }

  /** Posição local (dentro do mundo) do canto de uma célula. */
  cellLocal(cx: number, cy: number): { x: number; y: number } {
    return { x: cx * TILE, y: SKY_H + cy * TILE };
  }

  inViewport(x: number, y: number): boolean {
    return x >= this.vp.x && x < this.vp.x + this.vp.w && y >= this.vp.y && y < this.vp.y + this.vp.h;
  }

  private bindInput(): void {
    const sc = this.scene;
    sc.input.addPointer(1);
    sc.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      const q = ptr(p);
      if (over.length || !this.inViewport(q.x, q.y) || this.input.blocked?.(q.x, q.y)) return;
      this.pointers.set(p.id, { x: q.x, y: q.y });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.dragStart = null;
        return;
      }
      this.dragStart = { x: q.x, y: q.y, moved: 0 };
      this.lastPaint = '';
      if (!this.input.dragPans() && this.input.onPaint) {
        const { cx, cy } = this.screenToCell(q.x, q.y);
        this.lastPaint = `${cx},${cy}`;
        this.input.onPaint(cx, cy);
      }
    });
    sc.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const q = ptr(p);
      const prev = this.pointers.get(p.id);
      if (!prev) {
        if (!p.isDown && !p.wasTouch && this.inViewport(q.x, q.y) && !sc.input.hitTestPointer(p).length && !this.input.blocked?.(q.x, q.y)) {
          const { cx, cy } = this.screenToCell(q.x, q.y);
          this.input.onHover?.(cx, cy);
        }
        return;
      }
      if (this.pointers.size >= 2) {
        // Pinça: zoom e arrasto com dois dedos.
        const before = [...this.pointers.values()];
        const midBefore = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
        this.pointers.set(p.id, { x: q.x, y: q.y });
        const [a, b] = [...this.pointers.values()];
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (this.pinchDist > 0) this.zoomAt(mid.x, mid.y, dist / this.pinchDist);
        this.pan(mid.x - midBefore.x, mid.y - midBefore.y);
        this.pinchDist = dist;
        return;
      }
      const dx = q.x - prev.x;
      const dy = q.y - prev.y;
      this.pointers.set(p.id, { x: q.x, y: q.y });
      if (this.dragStart) this.dragStart.moved += Math.abs(dx) + Math.abs(dy);
      if (this.input.dragPans() || p.button === 2 || p.button === 1) {
        this.pan(dx, dy);
      } else if (this.input.onPaint) {
        const { cx, cy } = this.screenToCell(q.x, q.y);
        const k = `${cx},${cy}`;
        if (k !== this.lastPaint) {
          this.lastPaint = k;
          this.input.onPaint(cx, cy);
        }
      }
      if (!p.wasTouch) {
        const { cx, cy } = this.screenToCell(q.x, q.y);
        this.input.onHover?.(cx, cy);
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      const q = ptr(p);
      const had = this.pointers.has(p.id);
      const wasSingle = this.pointers.size === 1;
      const wasPinch = this.pointers.size === 2;
      this.pointers.delete(p.id);
      if (this.pointers.size < 2) this.pinchDist = 0;
      // Fim da pinça: encaixa o zoom em passos de meio (pixels inteiros na tela).
      if (wasPinch) this.zoomTo(q.x, q.y, Math.round(this.zoom * 2) / 2);
      if (had && wasSingle && this.dragStart && this.dragStart.moved < 8 && this.input.dragPans()) {
        const { cx, cy } = this.screenToCell(q.x, q.y);
        this.input.onTap?.(cx, cy, p);
      }
      if (!this.pointers.size) this.dragStart = null;
    };
    sc.input.on('pointerup', up);
    sc.input.on('pointerupoutside', up);
    sc.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const q = ptr(p);
      if (this.inViewport(q.x, q.y) && !this.input.blocked?.(q.x, q.y)) this.zoomTo(q.x, q.y, this.zoom + (dy > 0 ? -0.5 : 0.5));
    });
    sc.input.mouse?.disableContextMenu();
  }

  // ------------------------------------------------------------ desenho

  sync(run: RunState): void {
    const changed = run !== this.run;
    this.run = run;
    if (!changed) return;
    this.sealed = computeTopology(run).sealed;
    this.drawSky(run);
    this.drawTerrain(run);
    this.syncRooms(run);
    this.drawLighting(run);
    this.drawDoors(run);
    this.syncPeople(run);
    if (!this.focused) {
      this.focused = true;
      this.focus(run);
    }
    this.syncAmbient(run);
  }

  private drawSky(run: RunState): void {
    const mood = skyMood(run);
    const ents = run.rooms.filter((r) => isEntrance(r)).map((r) => r.x * TILE + 8);
    const sig = `${mood}|${ents.join(',')}`;
    if (sig === this.skySig) return;
    this.skySig = sig;
    const tex = liveCanvas(this.scene, 'w_sky', this.worldW, SKY_H, RES);
    const c = tex.getContext();
    c.setTransform(RES, 0, 0, RES, 0, 0);
    c.clearRect(0, 0, this.worldW, SKY_H);
    drawSky(c, mood, this.worldW, SKY_H, ents);
    tex.refresh();
  }

  private drawTerrain(run: RunState): void {
    const sig = run.terrain.join('') + '|' + run.rooms.map((r) => `${r.id}${r.collapsed ? 'x' : ''}`).join(',');
    if (sig === this.terrainSig) return;
    this.terrainSig = sig;
    const H = this.worldH - SKY_H;
    const tex = liveCanvas(this.scene, 'w_ground', this.worldW, H, GROUND_RES);
    const c = tex.getContext();
    c.setTransform(GROUND_RES, 0, 0, GROUND_RES, 0, 0);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    drawGround(c, run, this.worldW, H);
    tex.refresh();
  }

  /** Escuridão do subsolo, com luz quente saindo das salas acesas. */
  private drawLighting(run: RunState): void {
    const surviving = run.phase === 'survival' || run.phase === 'ended';
    const lit = run.rooms.filter((r) => !r.collapsed && (!surviving || r.powered || (r.type === 'generator' && r.wear < 100)));
    const sig = lit.map((r) => r.id).join(',') + '|' + run.rooms.length + run.phase;
    if (sig === this.lightSig) return;
    this.lightSig = sig;
    const H = this.worldH - SKY_H;
    const tex = liveCanvas(this.scene, 'w_dark', this.worldW, H, DARK_RES);
    const c = tex.getContext();
    c.setTransform(DARK_RES, 0, 0, DARK_RES, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.clearRect(0, 0, this.worldW, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(8,5,10,0.15)');
    g.addColorStop(1, 'rgba(8,5,10,0.72)');
    c.fillStyle = g;
    c.fillRect(0, 0, this.worldW, H);
    c.globalCompositeOperation = 'destination-out';
    for (const r of lit) {
      const cx = r.x * TILE + (r.w * TILE) / 2;
      const cy = r.y * TILE + (r.h * TILE) / 2;
      const rad = Math.max(r.w, r.h) * TILE * 0.9 + 18;
      const rg = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
      rg.addColorStop(0, 'rgba(0,0,0,0.95)');
      rg.addColorStop(0.5, 'rgba(0,0,0,0.6)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.save();
      c.translate(cx, cy);
      c.scale(1, (r.h * TILE + 24) / (r.w * TILE + 24));
      c.translate(-cx, -cy);
      c.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      c.restore();
    }
    c.globalCompositeOperation = 'source-over';
    tex.refresh();
    const light = lightTexture(this.scene, 'light64', 64);
    this.glowLayer.removeAll(true);
    for (const r of lit) {
      if (r.type === 'corridor') continue;
      const { x, y } = this.cellLocal(r.x, r.y);
      const w = r.w * TILE;
      const h = r.h * TILE;
      const glow = this.scene.add.image(x + w / 2, y + h / 2, light).setScale((w + 50) / 64, (h + 40) / 64).setTint(0xffb860).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD);
      this.glowLayer.add(glow);
    }
  }

  /** Portas entre salas vizinhas: porta de aço lateral ou alçapão com escada. */
  private drawDoors(run: RunState): void {
    const live = run.rooms.filter((r) => !r.collapsed);
    const sig = live.map((r) => `${r.id}${r.x}${r.y}`).join(',');
    if (sig === this.doorSig) return;
    this.doorSig = sig;
    const g = this.doorsG;
    g.clear();
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const a = live[i];
        const b = live[j];
        const [l, r] = a.x < b.x ? [a, b] : [b, a];
        if (l.x + l.w === r.x) {
          const top = Math.max(l.y, r.y);
          const bot = Math.min(l.y + l.h, r.y + r.h);
          // Uma porta por par, no nível do piso mais baixo.
          if (bot <= top || bot !== Math.max(l.y + l.h, r.y + r.h)) continue;
          const x = r.x * TILE;
          const floor = SKY_H + bot * TILE - FLOOR;
          g.fillStyle(0x14101c);
          g.fillRoundedRect(x - 3.4, floor - 13, 6.8, 13, { tl: 1.5, tr: 1.5, bl: 0, br: 0 });
          g.fillStyle(0x2a2622);
          g.fillRoundedRect(x - 2.6, floor - 12.2, 5.2, 12.2, { tl: 1, tr: 1, bl: 0, br: 0 });
          g.fillStyle(0xffd27a, 0.12);
          g.fillRect(x - 2.6, floor - 4, 5.2, 4);
          continue;
        }
        const [tp, d] = a.y < b.y ? [a, b] : [b, a];
        if (tp.y + tp.h === d.y && !(tp.type === 'corridor' && d.type === 'corridor')) {
          const left = Math.max(tp.x, d.x);
          const right = Math.min(tp.x + tp.w, d.x + d.w);
          if (right <= left) continue;
          const cx = ((left + right) / 2) * TILE;
          const y = SKY_H + d.y * TILE;
          g.fillStyle(0x14101c);
          g.fillRect(cx - 4.5, y - 3.5, 9, 7);
          g.fillStyle(0x221d1a);
          g.fillRect(cx - 3.8, y - 3.5, 7.6, 7);
          g.lineStyle(0.7, 0xb07a44);
          g.lineBetween(cx - 2.6, y - 3.5, cx - 2.6, y + 3.5);
          g.lineBetween(cx + 2.6, y - 3.5, cx + 2.6, y + 3.5);
          for (let k = -2.5; k < 3.5; k += 2.4) g.lineBetween(cx - 2.6, y + k, cx + 2.6, y + k);
        }
      }
    }
  }

  private roomSig(r: Room): string {
    return `${r.type}${r.w}${r.h}${r.equipment}${isEntrance(r) ? 'e' : ''}${r.collapsed ? 'x' : ''}`;
  }

  private syncRooms(run: RunState): void {
    const seen = new Set<number>();
    for (const r of run.rooms) {
      seen.add(r.id);
      let v = this.rooms.get(r.id);
      const sig = this.roomSig(r);
      if (v && v.sig !== sig) {
        this.destroyRoom(v);
        v = undefined;
      }
      if (!v) {
        v = this.createRoom(r, sig);
        this.rooms.set(r.id, v);
      }
      this.updateRoom(run, r, v);
    }
    for (const [id, v] of this.rooms) {
      if (!seen.has(id)) {
        this.destroyRoom(v);
        this.rooms.delete(id);
      }
    }
  }

  private createRoom(r: Room, sig: string): RoomVisual {
    const sc = this.scene;
    const { x, y } = this.cellLocal(r.x, r.y);
    const W = r.w * TILE;
    const H = r.h * TILE;
    const key = r.collapsed ? collapsedKey(sc, r.w, r.h) : roomKey(sc, r.type, r.w, r.h, r.equipment, isEntrance(r));
    const img = sc.add.image(x, y, key).setOrigin(0, 0).setScale(1 / RES);
    const cracks = sc.add.image(x, y, crackTex(sc, r.w, r.h, 1)).setOrigin(0, 0).setScale(1 / RES).setVisible(false);
    const dark = sc.add.rectangle(x + 0.5, y + 0.5, W - 1, H - 1, 0x07050a, 0.62).setOrigin(0, 0).setVisible(false);
    const icons = sc.add.container(x + W - 4, y + CEIL + 2);
    const v: RoomVisual = { sig, img, dark, cracks, icons, iconSig: '', leds: [], baseX: x };
    this.roomLayer.add([img, cracks]);
    if (!r.collapsed) {
      const fy = H - FLOOR;
      if (r.type === 'vent') {
        // Mesma geometria da carcaça desenhada em rooms.ts.
        v.fan = sc.add.image(x + W / 2, y + (CEIL + fy) / 2 + 0.5, fanKey(sc, 6)).setScale(1 / RES);
        this.roomLayer.add(v.fan);
      }
      if (r.type === 'panel') {
        for (let i = 0; i < Math.floor((W - 12) / 4); i++) {
          const led = sc.add.image(x + 7 + i * 4, y + fy - 2.2, i % 3 === 1 ? 'fx_ledred' : 'fx_led').setOrigin(0.5).setScale(0.8);
          v.leds.push(led);
          this.roomLayer.add(led);
        }
      }
      if (r.type === 'reservoir') {
        v.water = sc.add.rectangle(x + 5.6, y + fy - 0.6, W - 14.2, 1, 0x3a8ad8, 0.55).setOrigin(0, 1);
        this.roomLayer.add(v.water);
      }
      if (isEntrance(r)) {
        v.hatch = sc.add.image(x + TILE / 2, SKY_H + 1, towerKey(sc, true, false)).setOrigin(0.5, 1).setScale(1 / RES);
        this.roomLayer.add(v.hatch);
      }
      if (r.type !== 'corridor') v.label = roomLabel(sc, x + COL_PAD, y + CEIL + 1.2, r.type, W - COL_PAD * 2 - 2);
      if (v.label) this.roomLayer.add(v.label);
      if (r.type === 'generator') {
        v.smoke = sc.add.particles(x + W - 9, y + CEIL + 2, 'fx_smoke', {
          lifespan: 1400, speedY: { min: -14, max: -8 }, speedX: { min: -3, max: 3 }, scale: { start: 0.6, end: 1.4 },
          alpha: { start: 0.7, end: 0 }, frequency: 450, emitting: false,
        });
        this.fxLayer.add(v.smoke);
      }
      if (r.type === 'kitchen') {
        v.steam = sc.add.particles(x + 8.5, y + H - 16, 'fx_smoke', {
          lifespan: 1000, speedY: { min: -12, max: -6 }, scale: { start: 0.3, end: 0.9 }, alpha: { start: 0.5, end: 0 }, frequency: 600, emitting: false,
        });
        this.fxLayer.add(v.steam);
      }
      v.dust = sc.add.particles(0, 0, 'fx_dust', {
        x: { min: x + 3, max: x + W - 3 }, y: y + 3, lifespan: 1200, speedY: { min: 12, max: 30 }, gravityY: 30,
        frequency: 260, alpha: { start: 1, end: 0.2 }, emitting: false,
      });
      v.wind = sc.add.particles(0, 0, 'fx_wind', {
        x: { min: x, max: x + W }, y: { min: y + 4, max: y + H - 4 }, lifespan: 700, speedX: { min: 30, max: 60 },
        alpha: { start: 0.9, end: 0 }, frequency: 220, emitting: false,
      });
      v.haze = sc.add.particles(0, 0, 'fx_haze', {
        x: { min: x + 2, max: x + W - 8 }, y: { min: y + 2, max: y + H - 8 }, lifespan: 1800, scale: { start: 0.5, end: 1.5 },
        alpha: { start: 0.5, end: 0 }, frequency: 300, emitting: false,
      });
      v.bugs = sc.add.particles(0, 0, 'fx_bug', {
        x: { min: x + 3, max: x + W - 3 }, y: { min: y + H - 14, max: y + H - 5 }, lifespan: 900, speedX: { min: -12, max: 12 },
        speedY: { min: -4, max: 4 }, frequency: 120, emitting: false,
      });
      this.fxLayer.add([v.dust, v.wind, v.haze, v.bugs]);
    }
    this.roomLayer.add([dark, icons]);
    return v;
  }

  private destroyRoom(v: RoomVisual): void {
    for (const o of [v.img, v.dark, v.glow, v.label, v.cracks, v.icons, v.fan, v.water, v.hatch, v.smoke, v.dust, v.wind, v.bugs, v.haze, v.steam, ...v.leds]) o?.destroy();
  }

  private updateRoom(run: RunState, r: Room, v: RoomVisual): void {
    if (r.collapsed) {
      v.dark.setVisible(false);
      v.cracks.setVisible(false);
      v.icons.removeAll(true);
      return;
    }
    const surviving = run.phase === 'survival' || run.phase === 'ended';
    const needsPower = BALANCE.rooms[r.type].power > 0 || r.type === 'generator';
    const unpowered = surviving && needsPower && r.type !== 'generator' && !r.powered;
    const genStopped = r.type === 'generator' && surviving && r.wear >= 100;
    v.dark.setVisible(unpowered || genStopped);
    const crackLevel = r.unstable && !surviving ? 2 : r.integrity < BALANCE.structure.dustBelow ? 2 : r.integrity < BALANCE.structure.cracksBelow ? 1 : -1;
    v.cracks.setVisible(crackLevel >= 0);
    if (crackLevel >= 0) v.cracks.setTexture(crackTex(this.scene, r.w, r.h, crackLevel));
    const sealed = this.sealed.get(r.id) ?? true;
    const leaking = surviving ? !sealed : false;
    setEmit(v.dust, crackLevel >= 2 || (r.unstable && !surviving));
    setEmit(v.wind, leaking);
    setEmit(v.haze, surviving && r.air < BALANCE.air.suffocatingBelow);
    setEmit(v.bugs, surviving && (r.pest || (r.type === 'greenhouse' && !!activeCat(run, 'praga'))));
    setEmit(v.smoke, r.type === 'generator' && (!surviving || (r.wear < 100 && r.powered)));
    if (v.smoke) v.smoke.setTexture(r.wear > 60 ? 'fx_blacksmoke' : 'fx_smoke');
    setEmit(v.steam, surviving && r.powered && run.last.foodIn > 0);
    if (v.glow) v.glow.setVisible(!surviving || r.powered);
    if (v.water) {
      const frac = surviving ? Math.min(1, run.res.water / Math.max(1, waterCapacity(run))) : 0.9;
      v.water.setSize(v.water.width, Math.max(0.5, (r.h * TILE - FLOOR - 6.6) * frac));
      v.water.fillColor = run.waterContaminated ? 0x7aa83a : 0x3a8ad8;
    }
    if (v.hatch) v.hatch.setTexture(towerKey(this.scene, run.hatchOpen, run.phase === 'countdown'));

    // Ícones de estado: formas, não só cores (modo daltônico).
    const icons: string[] = [];
    if (unpowered) icons.push('nobolt');
    if (genStopped) icons.push('wrench');
    if (leaking || r.breach) icons.push('leak');
    if (surviving && r.air < BALANCE.air.harmBelow) icons.push('skull');
    if (surviving && r.pest) icons.push('bug');
    if (r.type === 'reservoir' && run.waterContaminated) icons.push('sick');
    if (r.unstable && !surviving) icons.push('alert');
    const sig = icons.join(',');
    if (sig !== v.iconSig) {
      v.iconSig = sig;
      v.icons.removeAll(true);
      icons.forEach((k, i) => {
        const bx = -(i + 1) * 8;
        const bg = this.scene.add.circle(bx + 3.5, 3.5, 3.9, 0x0e1320, 0.9).setStrokeStyle(0.5, 0xe0573a);
        v.icons.add([bg, this.scene.add.image(bx + 3.5, 3.5, iconKey(this.scene, k)).setScale(0.6 / 4)]);
      });
    }
  }

  private syncAmbient(run: RunState): void {
    const temp = activeCat(run, 'temperatura');
    const kind = run.phase === 'survival' || run.phase === 'ended' ? (temp ? (temp.variant === 0 ? 'snow' : 'ember') : 'ash') : 'none';
    if (kind === this.ambientKind) return;
    this.ambientKind = kind;
    this.ambient?.destroy();
    this.ambient = undefined;
    if (kind === 'none') return;
    const tex = kind === 'snow' ? 'fx_snow' : kind === 'ember' ? 'fx_ember' : 'fx_dust';
    this.ambient = this.scene.add.particles(0, 0, tex, {
      x: { min: 0, max: this.worldW }, y: kind === 'ash' ? -2 : { min: SKY_H, max: this.worldH },
      lifespan: kind === 'ash' ? 4000 : 2500, speedY: kind === 'ember' ? { min: -10, max: -4 } : { min: 6, max: 14 },
      speedX: { min: -4, max: 4 }, alpha: { start: kind === 'ash' ? 0.7 : 0.6, end: 0 }, frequency: kind === 'ash' ? 120 : 90,
      maxAliveParticles: store.settings.reduceMotion ? 20 : 120,
    });
    if (kind === 'ash') {
      this.ambient.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, 0, this.worldW, SKY_H - 4), quantity: 1 } as Phaser.Types.GameObjects.Particles.EmitZoneData);
    }
    this.fxLayer.add(this.ambient);
  }

  // ------------------------------------------------------------ pessoas

  private syncPeople(run: RunState): void {
    const alive = new Set(alivePeople(run).map((p) => p.id));
    for (const [id, v] of this.people) {
      if (!alive.has(id)) {
        v.sprite.destroy();
        v.shadow.destroy();
        v.mood?.destroy();
        v.bubble?.destroy();
        this.people.delete(id);
      }
    }
    for (const p of alivePeople(run)) {
      let v = this.people.get(p.id);
      const loc = personLocation(run, p);
      if (!v) {
        const pos = this.spotIn(loc, p.id);
        v = {
          sprite: this.scene.add.image(pos.x, pos.y + 0.6, personKey(this.scene, p.look, p.archetype, 'ok', 0)).setOrigin(0.5, 1).setScale(1 / RES),
          shadow: this.scene.add.image(pos.x, pos.y, shadowKey(this.scene)).setOrigin(0.5, 0.5).setScale(1 / RES),
          roomId: loc?.id ?? null, targetX: pos.x, nextMove: 0, frameT: 0, frame: 0, gestureUntil: 0, bubbleUntil: 0,
        };
        this.peopleLayer.add([v.shadow, v.sprite]);
        this.people.set(p.id, v);
      }
      if ((loc?.id ?? null) !== v.roomId) {
        // Mudou de sala: aparece na nova (o bunker é pequeno, ninguém se perde no caminho).
        const pos = this.spotIn(loc, p.id);
        v.sprite.setPosition(pos.x, pos.y + 0.6);
        v.targetX = pos.x;
        v.roomId = loc?.id ?? null;
      }
    }
  }

  private spotIn(r: Room | undefined, seed: number): { x: number; y: number } {
    if (!r) return { x: this.worldW / 2 + ((seed * 17) % 40) - 20, y: SKY_H - 4 };
    const { x, y } = this.cellLocal(r.x, r.y);
    const W = r.w * TILE;
    const span = Math.max(1, W - 10);
    return { x: x + 6 + ((seed * 37) % Math.max(1, span - 2)), y: y + r.h * TILE - FLOOR };
  }

  private expression(run: RunState, p: Person): Expression {
    if (p.health === 'doente') return 'doente';
    const loc = personLocation(run, p);
    if (run.catastrophes.some((c) => c.stage === 'ativa') || (loc && loc.air < BALANCE.air.suffocatingBelow)) return 'medo';
    if (p.morale < 25) return 'raiva';
    if (p.morale >= 70) return 'feliz';
    return 'ok';
  }

  /** Balão de fala sobre uma pessoa. */
  bubble(personId: number, text: string, ms = 3500): void {
    const v = this.people.get(personId);
    if (!v) return;
    v.bubble?.destroy();
    const t = this.scene.add.text(0, 0, text, {
      fontFamily: FONT, fontSize: `${fontSize(11)}px`, fontStyle: '500', color: '#14101c', wordWrap: { width: 120 }, resolution: UI_ZOOM * 3,
    }).setOrigin(0.5, 1);
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(-t.width / 2 - 4, -t.height - 3, t.width + 8, t.height + 6, 4);
    bg.fillStyle(0xffffff);
    bg.lineStyle(0.8, 0x14101c);
    bg.fillRoundedRect(-t.width / 2 - 4, -t.height - 4, t.width + 8, t.height + 6, 4);
    bg.strokeRoundedRect(-t.width / 2 - 4, -t.height - 4, t.width + 8, t.height + 6, 4);
    bg.fillTriangle(-3, 1.6, 3, 1.6, -1, 5);
    t.setY(-1);
    const c = this.scene.add.container(v.sprite.x, v.sprite.y - PERSON_H - 2, [bg, t]).setScale(1 / Math.max(1, this.zoom * 0.8));
    this.fxLayer.add(c);
    v.bubble = c;
    v.bubbleUntil = this.scene.time.now + ms;
  }

  /** Pessoa na posição de tela (para toques no modo sobrevivência). */
  personAt(sx: number, sy: number): number | undefined {
    const lx = (sx - this.world.x) / this.zoom;
    const ly = (sy - this.world.y) / this.zoom;
    for (const [id, v] of this.people) {
      const b = v.sprite.getBounds();
      if (lx >= b.x - 2 && lx <= b.right + 2 && ly >= b.y - 2 && ly <= b.bottom + 2) return id;
    }
    return undefined;
  }

  // ------------------------------------------------------------ animação

  update(time: number, delta: number, speed: number): void {
    const run = this.run;
    if (!run) return;
    const dt = delta / 1000;
    const motion = !store.settings.reduceMotion;
    for (const r of run.rooms) {
      const v = this.rooms.get(r.id);
      if (!v || r.collapsed) continue;
      const surviving = run.phase === 'survival' || run.phase === 'ended';
      const on = !surviving || r.powered;
      if (v.fan) v.fan.rotation += dt * (on ? 7 * Math.max(0.3, r.powerFrac || 1) : 0) * (speed > 0 || !surviving ? 1 : 0.2);
      for (const led of v.leds) if (Math.random() < dt * 3) led.setVisible(on && Math.random() < 0.7);
      if (r.type === 'generator' && on && r.wear < 100 && motion) v.img.x = v.baseX + (Math.sin(time / 30) > 0.6 ? 0.5 : 0);
      // Luz piscando quando falta energia.
      if (surviving && run.last.deficit && r.powered && Math.random() < dt * 2) {
        v.dark.setVisible(true);
        this.scene.time.delayedCall(80, () => v.dark.active && v.dark.setVisible(!r.powered));
      }
    }
    for (const p of alivePeople(run)) {
      const v = this.people.get(p.id);
      if (!v) continue;
      const loc = personLocation(run, p);
      // Passeio dentro da sala.
      if (time > v.nextMove && loc) {
        v.targetX = this.spotIn(loc, Math.floor(time / 1000) + p.id * 7).x;
        v.nextMove = time + 2500 + ((p.id * 997 + time) % 3000);
        if ((p.id + Math.floor(time / 4000)) % 5 === 0) v.gestureUntil = time + 700;
      }
      const dx = v.targetX - v.sprite.x;
      const walking = Math.abs(dx) > 0.5 && p.health !== 'ferido' ? true : false;
      if (walking) {
        v.sprite.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * (p.archetype === 'crianca' ? 18 : 10));
        v.sprite.setFlipX(dx < 0);
        v.frameT += dt;
        if (v.frameT > 0.18) {
          v.frameT = 0;
          v.frame = v.frame ? 0 : 1;
        }
      } else v.frame = 0;
      const frame = time < v.gestureUntil ? 2 : walking ? v.frame : 0;
      v.sprite.setTexture(personKey(this.scene, p.look, p.archetype, this.expression(run, p), frame));
      v.shadow.setPosition(v.sprite.x, v.sprite.y - 0.6);
      // Balão de humor acima da cabeça (some quando há fala).
      const surviving = run.phase === 'survival' || run.phase === 'ended';
      const hour = Math.floor((run.minute % 1440) / 60);
      const kind = !surviving ? null : p.health === 'doente' ? 'doente' : p.morale < 30 ? 'triste' : (hour >= 22 || hour < 6) && loc?.type === 'dorm' ? 'zz' : p.morale >= 75 ? 'feliz' : null;
      if (kind && !v.bubble) {
        v.mood ??= this.peopleLayer.scene.add.image(0, 0, bubbleKey(this.scene, kind)).setOrigin(0.5, 1).setScale(1 / RES);
        if (!v.mood.parentContainer) this.peopleLayer.add(v.mood);
        v.mood.setTexture(bubbleKey(this.scene, kind)).setVisible(true).setPosition(v.sprite.x + 3, v.sprite.y - PERSON_H + 1 + Math.sin(time / 300 + p.id) * 0.4);
      } else v.mood?.setVisible(false);
      if (v.bubble) {
        v.bubble.setPosition(v.sprite.x, v.sprite.y - PERSON_H - 2);
        if (time > v.bubbleUntil) {
          v.bubble.destroy();
          v.bubble = undefined;
        }
      }
    }
  }

  shake(ms = 300, intensity = 0.01): void {
    if (store.settings.reduceMotion) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  /** Desenha o contorno de pré-visualização (fantasma) de uma construção. */
  drawGhost(cx: number, cy: number, w: number, h: number, ok: boolean, warn = false): void {
    const g = this.cursor;
    g.clear();
    const { x, y } = this.cellLocal(cx, cy);
    const c = ok ? (warn ? P.yellow : P.green) : P.red;
    g.fillStyle(c, 0.25);
    g.fillRect(x, y, w * TILE, h * TILE);
    g.lineStyle(1, c, 1);
    g.strokeRect(x + 0.5, y + 0.5, w * TILE - 1, h * TILE - 1);
    if (!ok) {
      g.lineBetween(x, y, x + w * TILE, y + h * TILE);
      g.lineBetween(x + w * TILE, y, x, y + h * TILE);
    }
  }

  highlightRoom(r: Room | undefined): void {
    this.cursor.clear();
    if (!r) return;
    const { x, y } = this.cellLocal(r.x, r.y);
    this.cursor.lineStyle(1, P.yellow, 1);
    this.cursor.strokeRect(x - 0.5, y - 0.5, r.w * TILE + 1, r.h * TILE + 1);
  }

  clearGhost(): void {
    this.cursor.clear();
  }

  /** Coordenada de tela do centro de uma sala (para efeitos de interface). */
  roomScreen(r: Room): { x: number; y: number } {
    const { x, y } = this.cellLocal(r.x + r.w / 2, r.y + r.h / 2);
    return { x: this.world.x + x * this.zoom, y: this.world.y + y * this.zoom };
  }

  destroy(): void {
    this.world.destroy(true);
  }
}

function setEmit(e: Phaser.GameObjects.Particles.ParticleEmitter | undefined, on: boolean): void {
  if (!e) return;
  if (on && !e.emitting) e.start();
  else if (!on && e.emitting) e.stop();
}

const COL_PAD = 4;

/** Rachaduras em alta resolução, do tamanho da sala. */
function crackTex(scene: Phaser.Scene, wT: number, hT: number, level: number): string {
  const W = wT * TILE;
  const H = hT * TILE;
  return hdTexture(scene, `crk_${wT}_${hT}_${level}`, W, H, (c) => {
    const n = 2 + level * 2;
    let seed = wT * 31 + hT * 7 + level;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) % 1000) / 1000;
    for (let i = 0; i < n; i++) {
      let x = 4 + rnd() * (W - 8);
      let y = CEIL;
      const pts: [number, number][] = [[x, y]];
      while (y < H * (0.4 + rnd() * 0.4)) {
        x += (rnd() - 0.5) * 5;
        y += 2 + rnd() * 3;
        pts.push([x, y]);
      }
      line(c, pts, 0x14101c, 0.7 + level * 0.2, 0.85);
      line(c, pts.map(([px, py]) => [px + 0.5, py] as [number, number]), 0xffffff, 0.3, 0.15);
    }
  });
}

/** Torre de concreto da entrada (aberta/fechada, com alarme na contagem). */
function towerKey(scene: Phaser.Scene, open: boolean, alarm: boolean): string {
  return hdTexture(scene, `tower_${open ? 1 : 0}_${alarm ? 1 : 0}`, 30, 42, (c) => {
    c.translate(1, 2);
    drawTower(c, open, alarm);
  });
}

function shadowKey(scene: Phaser.Scene): string {
  return hdTexture(scene, 'ch_shadow', 12, 3, (c) => ellipse(c, 6, 1.5, 5.5, 1.3, css(0x000000, 0.4)));
}

/** Placa com ícone e nome da sala, no canto de cima. */
function roomLabel(scene: Phaser.Scene, x: number, y: number, type: string, maxW: number): Phaser.GameObjects.Container {
  const text = scene.add.text(0, 0, t(`room.label.${type}`), {
    fontFamily: FONT, fontSize: '22px', fontStyle: '600', color: '#f2f0ea', resolution: 2,
  }).setOrigin(0, 0.5);
  text.setScale(Math.min(0.17, (maxW - 9) / text.width));
  const w = text.displayWidth + 9;
  const g = scene.add.graphics();
  g.fillStyle(0x0e1320, 0.85);
  g.fillRoundedRect(0, -2.6, w, 5.2, 1.2);
  g.lineStyle(0.35, 0x3b4766);
  g.strokeRoundedRect(0, -2.6, w, 5.2, 1.2);
  const icon = scene.add.image(2.6, 0, iconKey(scene, ROOM_ICON[type] ?? 'alert')).setScale(0.42 / 4);
  text.setX(5.6);
  return scene.add.container(x, y + 2.6, [g, icon, text]);
}

