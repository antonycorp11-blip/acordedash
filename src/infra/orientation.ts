// Detecção de orientação: em retrato, mostra a tela "gire o celular".

import { isTouchDevice } from './settings';

export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

/** Liga o aviso de rotação. `onChange` recebe true quando o jogo deve pausar. */
export function watchOrientation(message: string, onChange: (blocked: boolean) => void): void {
  const overlay = document.getElementById('rotate');
  const text = document.getElementById('rotate-text');
  if (text) text.textContent = message;
  let last: boolean | null = null;
  const check = () => {
    const blocked = isTouchDevice() && isPortrait();
    overlay?.classList.toggle('show', blocked);
    if (blocked !== last) {
      last = blocked;
      onChange(blocked);
    }
  };
  window.addEventListener('resize', check);
  window.addEventListener('orientationchange', check);
  check();
}
