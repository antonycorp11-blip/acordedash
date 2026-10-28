// Ponto de entrada: carrega as fontes, cria o jogo Phaser e liga a
// infraestrutura do navegador (orientação, salvamento ao sair, áudio).

import Phaser from 'phaser';
import { watchOrientation } from './infra/orientation';
import { isTouchDevice } from './infra/settings';
import { PT_BR } from './strings/pt-BR';
import { audio } from './view/audio/sfx';
import { Boot } from './view/scenes/Boot';
import { Build } from './view/scenes/Build';
import { Countdown } from './view/scenes/Countdown';
import { Defeat } from './view/scenes/Defeat';
import { Dev } from './view/scenes/Dev';
import { Diary } from './view/scenes/Diary';
import { Ending } from './view/scenes/Ending';
import { EventScene } from './view/scenes/Event';
import { Explosion } from './view/scenes/Explosion';
import { Intro } from './view/scenes/Intro';
import { Legist } from './view/scenes/Legist';
import { Settings } from './view/scenes/Settings';
import { Skills } from './view/scenes/Skills';
import { Survival } from './view/scenes/Survival';
import { Title } from './view/scenes/Title';
import { Victory } from './view/scenes/Victory';
import { store } from './view/store';
import { VH, VW } from './view/ui/buttons';

async function loadFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const wait = Promise.all([document.fonts.load("16px 'Fredoka'"), document.fonts.load("600 16px 'Fredoka'"), document.fonts.load("16px 'Lilita One'")]);
  // Sem rede, segue com a fonte do sistema depois de um instante.
  await Promise.race([wait, new Promise((r) => setTimeout(r, 2500))]).catch(() => undefined);
}

async function start(): Promise<void> {
  document.title = String(PT_BR['game.title']);
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    // Desenhado em 640×360 e renderizado em 2× (ver UI_ZOOM); a arte é vetorial em alta resolução.
    width: VW * 2,
    height: VH * 2,
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    backgroundColor: '#14101c',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 3 },
    fps: { target: 60 },
    scene: [Boot, Title, Intro, Build, Countdown, Explosion, Survival, EventScene, Victory, Defeat, Legist, Diary, Skills, Ending, Settings, Dev],
  });

  let speedBeforeBlock = store.speed;
  watchOrientation(String(PT_BR['rotate']), (blocked) => {
    if (blocked) {
      speedBeforeBlock = store.speed;
      store.speed = 0;
    } else if (store.speed === 0) store.speed = speedBeforeBlock;
  });
  const saveNow = () => store.save();
  document.addEventListener('visibilitychange', () => document.hidden && saveNow());
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('pointerdown', () => {
    audio.unlock();
    // Tela cheia no primeiro toque em celular (o navegador exige um gesto).
    if (isTouchDevice() && !game.scale.isFullscreen && store.settings.fullscreen) {
      try {
        game.scale.startFullscreen();
      } catch {
        // iPhone não permite: segue em janela.
      }
    }
  }, { passive: true });
  window.addEventListener('keydown', () => audio.unlock());
  // Só em desenvolvimento: acesso ao estado para testes automatizados no navegador.
  if (import.meta.env.DEV) Object.assign(window, { __store: store, __game: game });
}

void start();
