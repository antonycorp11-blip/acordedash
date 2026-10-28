// Visão do bunker: terreno, salas com sinais visíveis, pessoas, efeitos e
// câmera (zoom com pinça, arrastar, roda do mouse). Só lê o estado; nunca o altera.

import Phaser from 'phaser';
import { BALANCE } from '../core/balance';
import { isEntrance } from '../core/grid';
import { activeCat } from '../core/query';
import { alivePeople, personLocation } from '../core/rooms';
import { DUG, ROCK, type Person, type Room, type RunState } from '../core/state';
import { waterCapacity } from '../core/systems/food';
import { computeTopology } from '../core/topology';
import { P } from './art/palette';
import { iconKey } from './art/sprites/icons';
import { collapsedKey, fanKey, roomKey } from './art/sprites/rooms';
import { crackKey, dirtKey, grassKey, hatchKey, rockKey, rubbleKey, TILE, tunnelKey } from './art/sprites/tiles';
import { personKey, PERSON_H, type Expression } from './art/survivors';
import { store } from './store';
import { FONT, fontSize } from './ui/buttons';

export const SKY_H = 56;

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
  cracks: Phaser.GameObjects.TileSprite;
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
  roomId: number | null;
  targetX: number;
  nextMove: number;
  frameT: number;
  frame: number;
  gestureUntil: number;
  bubble?: Phaser.GameObjects.Container;
  bubbleUntil: number;
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
  private skyG: Phaser.GameObjects.Graphics;
  private terrainRT: Phaser.GameObjects.RenderTexture;
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
  private clouds: { x: number; y: number; w: number }[] = [];
  readonly worldW: number;
  readonly worldH: number;

  constructor(private scene: Phaser.Scene, public vp: Viewport, private input: BunkerInput) {
    this.worldW = BALANCE.grid.width * TILE;
    this.worldH = SKY_H + BALANCE.grid.height * TILE;
    this.world = scene.add.container(vp.x, vp.y).setDepth(0);
    this.skyG = scene.add.graphics();
    this.terrainRT = scene.add.renderTexture(0, SKY_H, this.worldW, this.worldH - SKY_H).setOrigin(0, 0);
    this.roomLayer = scene.add.container(0, 0);
    this.fxLayer = scene.add.container(0, 0);
    this.peopleLayer = scene.add.container(0, 0);
    this.cursor = scene.add.graphics();
    this.world.add([this.skyG, this.terrainRT, this.roomLayer, this.peopleLayer, this.fxLayer, this.cursor]);
    for (let i = 0; i < 5; i++) this.clouds.push({ x: i * 110 + 20, y: 8 + (i % 3) * 9, w: 24 + (i % 2) * 14 });
    this.minZoom = Math.min(vp.w / this.worldW, vp.h / this.worldH);
    this.zoom = Math.max(this.minZoom, 1);
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
    this.zoom = Phaser.Math.Clamp(this.zoom * factor, this.minZoom, 3);
    const k = this.zoom / before;
    this.world.x = sx - (sx - this.world.x) * k;
    this.world.y = sy - (sy - this.world.y) * k;
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
      if (over.length || !this.inViewport(p.x, p.y) || this.input.blocked?.(p.x, p.y)) return;
      this.pointers.set(p.id, { x: p.x, y: p.y });
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.dragStart = null;
        return;
      }
      this.dragStart = { x: p.x, y: p.y, moved: 0 };
      this.lastPaint = '';
      if (!this.input.dragPans() && this.input.onPaint) {
        const { cx, cy } = this.screenToCell(p.x, p.y);
        this.lastPaint = `${cx},${cy}`;
        this.input.onPaint(cx, cy);
      }
    });
    sc.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const prev = this.pointers.get(p.id);
      if (!prev) {
        if (!p.isDown && !p.wasTouch && this.inViewport(p.x, p.y) && !sc.input.hitTestPointer(p).length && !this.input.blocked?.(p.x, p.y)) {
          const { cx, cy } = this.screenToCell(p.x, p.y);
          this.input.onHover?.(cx, cy);
        }
        return;
      }
      if (this.pointers.size >= 2) {
        // Pinça: zoom e arrasto com dois dedos.
        const before = [...this.pointers.values()];
        const midBefore = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
        this.pointers.set(p.id, { x: p.x, y: p.y });
        const [a, b] = [...this.pointers.values()];
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (this.pinchDist > 0) this.zoomAt(mid.x, mid.y, dist / this.pinchDist);
        this.pan(mid.x - midBefore.x, mid.y - midBefore.y);
        this.pinchDist = dist;
        return;
      }
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      this.pointers.set(p.id, { x: p.x, y: p.y });
      if (this.dragStart) this.dragStart.moved += Math.abs(dx) + Math.abs(dy);
      if (this.input.dragPans() || p.button === 2 || p.button === 1) {
        this.pan(dx, dy);
      } else if (this.input.onPaint) {
        const { cx, cy } = this.screenToCell(p.x, p.y);
        const k = `${cx},${cy}`;
        if (k !== this.lastPaint) {
          this.lastPaint = k;
          this.input.onPaint(cx, cy);
        }
      }
      if (!p.wasTouch) {
        const { cx, cy } = this.screenToCell(p.x, p.y);
        this.input.onHover?.(cx, cy);
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      const had = this.pointers.has(p.id);
      const wasSingle = this.pointers.size === 1;
      this.pointers.delete(p.id);
      if (this.pointers.size < 2) this.pinchDist = 0;
      if (had && wasSingle && this.dragStart && this.dragStart.moved < 8 && this.input.dragPans()) {
        const { cx, cy } = this.screenToCell(p.x, p.y);
        this.input.onTap?.(cx, cy, p);
      }
      if (!this.pointers.size) this.dragStart = null;
    };
    sc.input.on('pointerup', up);
    sc.input.on('pointerupoutside', up);
    sc.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.inViewport(p.x, p.y) && !this.input.blocked?.(p.x, p.y)) this.zoomAt(p.x, p.y, dy > 0 ? 0.9 : 1.1);
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
    this.syncPeople(run);
    this.syncAmbient(run);
  }

  private drawSky(run: RunState): void {
    const after = run.phase === 'survival' || run.phase === 'ended';
    const sig = `${after}-${run.phase === 'countdown'}-${Math.floor(this.clouds[0].x)}`;
    if (sig === this.skySig) return;
    this.skySig = sig;
    const g = this.skyG;
    g.clear();
    const top = after ? P.shadow : run.phase === 'countdown' ? P.redDark : P.sky;
    const bottom = after ? P.orangeDark : run.phase === 'countdown' ? P.orange : P.skyLight;
    const bands = 7;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(top), Phaser.Display.Color.ValueToColor(bottom), bands - 1, i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      g.fillRect(-200, (SKY_H / bands) * i - 200 * (i === 0 ? 1 : 0), this.worldW + 400, SKY_H / bands + (i === 0 ? 200 : 1));
    }
    if (!after) {
      // Sol e nuvens.
      g.fillStyle(P.yellow);
      g.fillCircle(this.worldW - 40, 16, 7);
      for (const c of this.clouds) {
        g.fillStyle(P.white, 0.9);
        g.fillRect(c.x, c.y, c.w, 5);
        g.fillRect(c.x + 4, c.y - 3, c.w - 10, 4);
      }
      // Casa e árvore: a vida antes.
      g.fillStyle(P.paperDark);
      g.fillRect(40, SKY_H - 22, 22, 16);
      g.fillStyle(P.redDark);
      g.fillTriangle(36, SKY_H - 22, 51, SKY_H - 34, 66, SKY_H - 22);
      g.fillStyle(P.ink);
      g.fillRect(48, SKY_H - 14, 6, 8);
      g.fillStyle(P.dirt);
      g.fillRect(this.worldW - 80, SKY_H - 20, 4, 14);
      g.fillStyle(P.grass);
      g.fillCircle(this.worldW - 78, SKY_H - 24, 9);
    } else {
      // Ruínas e a cratera no horizonte.
      g.fillStyle(P.ink);
      g.fillRect(40, SKY_H - 14, 6, 8);
      g.fillRect(50, SKY_H - 10, 10, 4);
      g.fillRect(this.worldW - 78, SKY_H - 18, 3, 12);
      g.fillRect(this.worldW - 84, SKY_H - 14, 8, 2);
      g.fillStyle(P.dusk, 0.6);
      g.fillCircle(this.worldW / 2, -60, 90);
    }
  }

  private drawTerrain(run: RunState): void {
    const sig = run.terrain.join('') + '|' + run.rooms.map((r) => `${r.id}${r.collapsed ? 'x' : ''}`).join(',') + run.phase;
    if (sig === this.terrainSig) return;
    this.terrainSig = sig;
    const rt = this.terrainRT;
    rt.clear();
    const after = run.phase === 'survival' || run.phase === 'ended';
    const tunnel = tunnelKey(this.scene);
    const collapsedCells = new Set<number>();
    for (const r of run.rooms) if (r.collapsed) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) collapsedCells.add(y * run.width + x);
    rt.beginDraw();
    for (let y = 0; y < run.height; y++) {
      for (let x = 0; x < run.width; x++) {
        const i = y * run.width + x;
        const t = run.terrain[i];
        const v = (x * 7 + y * 13) % 4;
        let key: string;
        if (collapsedCells.has(i)) key = rubbleKey(this.scene, v);
        else if (t === DUG) key = tunnel;
        else if (t === ROCK) key = rockKey(this.scene, v);
        else key = dirtKey(this.scene, v, y);
        rt.batchDraw(key, x * TILE, y * TILE);
      }
    }
    const grass = grassKey(this.scene, after);
    for (let x = 0; x < run.width; x++) {
      const dug = run.terrain[x] === DUG;
      if (!dug) rt.batchDraw(grass, x * TILE, -1);
    }
    rt.endDraw();
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
    const img = sc.add.image(x, y, key).setOrigin(0, 0);
    const cracks = sc.add.tileSprite(x, y, W, H, crackKey(sc, 0)).setOrigin(0, 0).setVisible(false);
    const dark = sc.add.rectangle(x, y, W, H, P.ink, 0.6).setOrigin(0, 0).setVisible(false);
    const icons = sc.add.container(x + 2, y + 3);
    const v: RoomVisual = { sig, img, dark, cracks, icons, iconSig: '', leds: [], baseX: x };
    this.roomLayer.add([img, cracks]);
    if (!r.collapsed) {
      if (r.type === 'vent') {
        const size = Math.min(W, H) - 10;
        v.fan = sc.add.image(x + W / 2, y + H / 2, fanKey(sc, size));
        this.roomLayer.add(v.fan);
      }
      if (r.type === 'panel') {
        for (let i = 0; i < 4; i++) {
          const led = sc.add.image(x + 8 + i * 5, y + 7, i % 2 ? 'fx_ledred' : 'fx_led').setOrigin(0, 0);
          v.leds.push(led);
          this.roomLayer.add(led);
        }
      }
      if (r.type === 'reservoir') {
        v.water = sc.add.rectangle(x + 5, y + H - 4, W - 10, 1, P.blue, 0.85).setOrigin(0, 1);
        this.roomLayer.add(v.water);
      }
      if (r.type === 'greenhouse') {
        v.glow = sc.add.rectangle(x, y, W, H, P.purple, 0.12).setOrigin(0, 0).setBlendMode(Phaser.BlendModes.ADD);
        this.roomLayer.add(v.glow);
      }
      if (isEntrance(r)) {
        v.hatch = sc.add.image(x - 2, y - 8, hatchKey(sc, true)).setOrigin(0, 0);
        this.roomLayer.add(v.hatch);
      }
      if (r.type === 'generator') {
        v.smoke = sc.add.particles(x + W - 7, y + 4, 'fx_smoke', {
          lifespan: 1400, speedY: { min: -14, max: -8 }, speedX: { min: -3, max: 3 }, scale: { start: 0.6, end: 1.4 },
          alpha: { start: 0.7, end: 0 }, frequency: 450, emitting: false,
        });
        this.fxLayer.add(v.smoke);
      }
      if (r.type === 'kitchen') {
        v.steam = sc.add.particles(x + 10, y + H - 20, 'fx_smoke', {
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
    for (const o of [v.img, v.dark, v.glow, v.cracks, v.icons, v.fan, v.water, v.hatch, v.smoke, v.dust, v.wind, v.bugs, v.haze, v.steam, ...v.leds]) o?.destroy();
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
    if (crackLevel >= 0) v.cracks.setTexture(crackKey(this.scene, crackLevel));
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
      v.water.height = Math.max(1, (r.h * TILE - 9) * frac);
      v.water.fillColor = run.waterContaminated ? P.green : P.blue;
    }
    if (v.hatch) v.hatch.setTexture(hatchKey(this.scene, run.hatchOpen));

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
        const bg = this.scene.add.rectangle(i * 11 - 1, -1, 12, 12, P.ink, 0.8).setOrigin(0, 0);
        v.icons.add([bg, this.scene.add.image(i * 11, 0, iconKey(this.scene, k)).setOrigin(0, 0)]);
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
          sprite: this.scene.add.image(pos.x, pos.y, personKey(this.scene, p.look, p.archetype, 'ok', 0)).setOrigin(0.5, 1),
          roomId: loc?.id ?? null, targetX: pos.x, nextMove: 0, frameT: 0, frame: 0, gestureUntil: 0, bubbleUntil: 0,
        };
        this.peopleLayer.add(v.sprite);
        this.people.set(p.id, v);
      }
      if ((loc?.id ?? null) !== v.roomId) {
        // Mudou de sala: aparece na nova (o bunker é pequeno, ninguém se perde no caminho).
        const pos = this.spotIn(loc, p.id);
        v.sprite.setPosition(pos.x, pos.y);
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
    return { x: x + 5 + ((seed * 37) % span), y: y + r.h * TILE - 3 };
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
      fontFamily: FONT, fontSize: `${fontSize(12)}px`, color: '#14101c', wordWrap: { width: 110 }, resolution: 2,
    }).setOrigin(0.5, 1);
    const bg = this.scene.add.rectangle(0, 2, t.width + 6, t.height + 4, P.paper).setOrigin(0.5, 1).setStrokeStyle(1, P.ink);
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
    // Nuvens andando antes da explosão.
    if (run.phase === 'build') {
      for (const c of this.clouds) {
        c.x += dt * 3;
        if (c.x > this.worldW + 20) c.x = -c.w - 20;
      }
      this.drawSky(run);
    }
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
