// Área rolável: arrastar com o dedo ou a roda do mouse.

import Phaser from 'phaser';
import { ptr } from './buttons';

export class ScrollArea {
  readonly content: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private offset = 0;
  private dragging = false;
  private lastY = 0;
  private moved = 0;

  constructor(private scene: Phaser.Scene, public x: number, public y: number, public w: number, public h: number) {
    this.content = scene.add.container(x, y);
    this.maskShape = scene.make.graphics({}, false);
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(x, y, w, h);
    this.content.setMask(this.maskShape.createGeometryMask());

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.inside(p)) {
        this.dragging = true;
        this.lastY = ptr(p).y;
        this.moved = 0;
      }
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !p.isDown) return;
      const y = ptr(p).y;
      const dy = y - this.lastY;
      this.lastY = y;
      this.moved += Math.abs(dy);
      this.scrollBy(-dy);
    });
    scene.input.on('pointerup', () => (this.dragging = false));
    scene.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.inside(p)) this.scrollBy(dy * 0.5);
    });
  }

  private inside(pointer: Phaser.Input.Pointer): boolean {
    const p = ptr(pointer);
    return p.x >= this.x && p.x <= this.x + this.w && p.y >= this.y && p.y <= this.y + this.h;
  }

  /** Envolve a ação de um item: ignora arrastes e toques fora da área visível. */
  guard(fn: () => void): () => void {
    return () => {
      if (this.wasDrag() || !this.inside(this.scene.input.activePointer)) return;
      fn();
    };
  }

  /** Arraste longo não conta como toque nos itens. */
  wasDrag(): boolean {
    return this.moved > 6;
  }

  contentHeight(): number {
    let max = 0;
    for (const c of this.content.list as (Phaser.GameObjects.GameObject & { y: number; height?: number; displayHeight?: number })[]) {
      max = Math.max(max, c.y + (c.displayHeight ?? c.height ?? 0));
    }
    return max;
  }

  scrollBy(d: number): void {
    const maxOff = Math.max(0, this.contentHeight() - this.h + 8);
    this.offset = Phaser.Math.Clamp(this.offset + d, 0, maxOff);
    this.content.y = this.y - this.offset;
  }

  reset(): void {
    this.offset = 0;
    this.content.y = this.y;
  }

  clear(): void {
    this.content.removeAll(true);
    this.reset();
  }

  destroy(): void {
    this.content.destroy();
    this.maskShape.destroy();
  }
}
