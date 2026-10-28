// Boot: gera as texturas compartilhadas e aplica as configurações.

import Phaser from 'phaser';
import { audio } from '../audio/sfx';
import { setColorblind } from '../art/palette';
import { fxTextures } from '../art/sprites/fx';
import { preloadIcons } from '../art/sprites/icons';
import { store } from '../store';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    fxTextures(this);
    preloadIcons(this);
    setColorblind(store.settings.colorblind);
    audio.setVolume(store.settings.volume);
    audio.setMusic(store.settings.music);
    this.scene.start('Title');
  }
}
