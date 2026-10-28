// Texturas de efeitos: poeira, fumaça, faísca, vento, gotas, insetos, brilho.

import Phaser from 'phaser';
import { P } from '../palette';
import { makeTexture } from '../pixel';

export function fxTextures(scene: Phaser.Scene): void {
  makeTexture(scene, 'fx_dust', 2, 2, (p) => p.rect(0, 0, 2, 2, P.paperDark));
  makeTexture(scene, 'fx_pebble', 3, 3, (p) => p.box(0, 0, 3, 3, P.rock, P.ink));
  makeTexture(scene, 'fx_smoke', 6, 6, (p) => {
    p.rect(1, 0, 4, 6, P.ash, 0.8);
    p.rect(0, 1, 6, 4, P.ash, 0.8);
    p.rect(2, 1, 2, 2, P.paperDark, 0.6);
  });
  makeTexture(scene, 'fx_blacksmoke', 6, 6, (p) => {
    p.rect(1, 0, 4, 6, P.shadow);
    p.rect(0, 1, 6, 4, P.shadow);
  });
  makeTexture(scene, 'fx_spark', 2, 2, (p) => {
    p.px(0, 0, P.yellow);
    p.px(1, 1, P.white);
  });
  makeTexture(scene, 'fx_wind', 6, 2, (p) => {
    p.hline(0, 0, 4, P.skyLight);
    p.hline(2, 1, 4, P.white);
  });
  makeTexture(scene, 'fx_drop', 2, 3, (p) => {
    p.px(0, 0, P.skyLight);
    p.rect(0, 1, 2, 2, P.blue);
  });
  makeTexture(scene, 'fx_bug', 3, 2, (p) => {
    p.rect(0, 0, 3, 2, P.greenDark);
    p.px(1, 0, P.ink);
  });
  makeTexture(scene, 'fx_haze', 8, 8, (p) => p.rect(0, 0, 8, 8, P.green, 0.35));
  makeTexture(scene, 'fx_snow', 2, 2, (p) => p.rect(0, 0, 2, 2, P.white));
  makeTexture(scene, 'fx_ember', 2, 2, (p) => p.rect(0, 0, 2, 2, P.orange));
  makeTexture(scene, 'fx_px', 1, 1, (p) => p.px(0, 0, P.white));
  makeTexture(scene, 'fx_led', 2, 2, (p) => p.rect(0, 0, 2, 2, P.green));
  makeTexture(scene, 'fx_ledred', 2, 2, (p) => p.rect(0, 0, 2, 2, P.red));
  makeTexture(scene, 'fx_flash', 4, 4, (p) => p.rect(0, 0, 4, 4, P.white));
}
