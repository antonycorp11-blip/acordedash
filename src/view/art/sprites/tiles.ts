// Texturas de terreno: terra, rocha, túnel, grama, entulho e rachaduras.

import Phaser from 'phaser';
import { P } from '../palette';
import { makeTexture, type Pix } from '../pixel';

export const TILE = 16;

export function dirtKey(scene: Phaser.Scene, variant: number, depth: number): string {
  const v = variant % 4;
  const deep = depth > 8 ? 1 : 0;
  return makeTexture(scene, `t_dirt_${v}_${deep}`, TILE, TILE, (p) => {
    const base = deep ? P.dirtDark : P.dirt;
    p.rect(0, 0, TILE, TILE, base);
    p.speckle(0, 0, TILE, TILE, deep ? [P.dirt, P.shadow, P.tunnel] : [P.dirtLight, P.dirtDark, P.clay], 0.18, 100 + v * 31 + deep);
    if (v === 1) pebble(p, 4, 9, P.rockLight);
    if (v === 3) pebble(p, 10, 4, P.paperDark);
  });
}

function pebble(p: Pix, x: number, y: number, c: number): void {
  p.rect(x, y, 3, 2, c);
  p.px(x, y + 1, P.ink);
  p.px(x + 2, y + 1, P.ink);
}

export function rockKey(scene: Phaser.Scene, variant: number): string {
  const v = variant % 3;
  return makeTexture(scene, `t_rock_${v}`, TILE, TILE, (p) => {
    p.rect(0, 0, TILE, TILE, P.rock);
    p.speckle(0, 0, TILE, TILE, [P.rockDark, P.rockLight], 0.15, 300 + v * 17);
    // Facetas da pedra.
    p.hline(2, 3 + v, 7, P.rockLight);
    p.vline(9 + v, 4, 6, P.rockDark);
    p.hline(4, 12 - v, 9, P.rockDark);
    p.px(3, 3 + v, P.white);
  });
}

export function tunnelKey(scene: Phaser.Scene): string {
  return makeTexture(scene, 't_tunnel', TILE, TILE, (p) => {
    p.rect(0, 0, TILE, TILE, P.tunnel);
    p.speckle(0, 0, TILE, TILE, [P.shadow, P.ink], 0.12, 777);
  });
}

export function grassKey(scene: Phaser.Scene, ash: boolean): string {
  return makeTexture(scene, `t_grass_${ash ? 1 : 0}`, TILE, 6, (p) => {
    const top = ash ? P.ash : P.grassLight;
    const mid = ash ? P.shadow : P.grass;
    p.rect(0, 2, TILE, 4, mid);
    for (let x = 0; x < TILE; x += 2) p.rect(x, (x * 7) % 3, 1, 3, top);
    p.hline(0, 5, TILE, P.dirtDark);
  });
}

export function rubbleKey(scene: Phaser.Scene, variant: number): string {
  const v = variant % 3;
  return makeTexture(scene, `t_rubble_${v}`, TILE, TILE, (p) => {
    p.rect(0, 0, TILE, TILE, P.shadow);
    const s = 900 + v * 13;
    p.speckle(0, 0, TILE, TILE, [P.rock, P.rockDark, P.dirt, P.ash], 0.45, s);
    p.box(2 + v, 8, 6, 5, P.rock, P.ink);
    p.box(8, 3 + v, 5, 4, P.dirtLight, P.ink);
  });
}

/** Rachaduras em três níveis, para sobrepor à sala. */
export function crackKey(scene: Phaser.Scene, level: number): string {
  return makeTexture(scene, `t_crack_${level}`, 32, 16, (p) => {
    const paths: [number, number][][] = [
      [[3, 0], [5, 3], [4, 6], [7, 9]],
      [[20, 0], [18, 4], [21, 7], [19, 11], [22, 15]],
      [[30, 2], [27, 5], [28, 8]],
      [[10, 16], [12, 12], [11, 9], [14, 6]],
    ];
    const n = Math.min(paths.length, level + 1);
    for (let i = 0; i < n; i++) {
      const path = paths[i];
      for (let k = 0; k < path.length - 1; k++) {
        const [x0, y0] = path[k];
        const [x1, y1] = path[k + 1];
        const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let st = 0; st <= steps; st++) {
          const x = Math.round(x0 + ((x1 - x0) * st) / steps);
          const y = Math.round(y0 + ((y1 - y0) * st) / steps);
          p.px(x, y, P.ink);
          if (level > 1) p.px(x + 1, y, P.ink, 0.6);
        }
      }
    }
  });
}

/** Escotilha da entrada, aberta ou fechada. */
export function hatchKey(scene: Phaser.Scene, open: boolean): string {
  return makeTexture(scene, `t_hatch_${open ? 1 : 0}`, TILE + 4, 8, (p) => {
    if (open) {
      p.box(0, 0, 4, 8, P.rock, P.ink);
      p.rect(1, 2, 2, 1, P.yellow);
      p.rect(1, 5, 2, 1, P.yellow);
    } else {
      p.box(0, 4, TILE + 4, 4, P.rock, P.ink);
      p.rect(4, 5, 3, 2, P.yellow);
      p.rect(13, 5, 3, 2, P.yellow);
      p.box(8, 2, 4, 3, P.rockLight, P.ink);
    }
  });
}
