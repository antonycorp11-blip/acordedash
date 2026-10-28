// Sons gerados com Web Audio: osciladores, ruído e envelopes. Nenhum arquivo.

type Sfx =
  | 'click' | 'dig' | 'build' | 'explosion' | 'alert' | 'mutiny' | 'victory' | 'defeat'
  | 'knock' | 'collapse' | 'beep' | 'repair' | 'error' | 'page';

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private volume = 0.7;
  private musicOn = true;
  private musicTimer: number | null = null;
  private mood: 'build' | 'survival' | 'menu' | 'none' = 'none';
  private step = 0;

  /** Precisa de um gesto do jogador para começar (regra dos navegadores). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.18;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    // Ruído com semente fixa: o som é sempre o mesmo.
    let x = 12345;
    for (let i = 0; i < len; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      data[i] = (x / 0x7fffffff) * 2 - 1;
    }
    if (this.mood !== 'none') this.startMusic();
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (!on) this.stopMusic();
    else if (this.mood !== 'none') this.startMusic();
  }

  setMood(m: 'build' | 'survival' | 'menu' | 'none'): void {
    if (m === this.mood) return;
    this.mood = m;
    this.stopMusic();
    if (m !== 'none') this.startMusic();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, dest?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, when = 0, filterFreq = 1200, slideTo?: number): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(name: Sfx): void {
    if (!this.ctx) return;
    switch (name) {
      case 'click': this.tone(660, 0.05, 'square', 0.08); break;
      case 'page': this.noise(0.12, 0.15, 0, 3000, 800); break;
      case 'error': this.tone(180, 0.12, 'square', 0.1); this.tone(140, 0.15, 'square', 0.1, 0.1); break;
      case 'dig': this.noise(0.14, 0.35, 0, 900, 200); this.tone(90, 0.1, 'triangle', 0.15); break;
      case 'build':
        for (let i = 0; i < 3; i++) { this.noise(0.05, 0.3, i * 0.11, 2500); this.tone(220, 0.05, 'square', 0.08, i * 0.11); }
        break;
      case 'repair': this.tone(880, 0.06, 'square', 0.07); this.tone(1100, 0.08, 'square', 0.07, 0.07); break;
      case 'knock': for (let i = 0; i < 3; i++) this.noise(0.08, 0.5, i * 0.18, 400); break;
      case 'beep': this.tone(990, 0.12, 'sine', 0.12); break;
      case 'alert': this.tone(740, 0.12, 'square', 0.1); this.tone(554, 0.16, 'square', 0.1, 0.13); break;
      case 'collapse': this.noise(1.2, 0.6, 0, 600, 60); this.tone(60, 1, 'sawtooth', 0.15, 0, 30); break;
      case 'explosion':
        this.noise(3, 0.9, 0, 2000, 40);
        this.tone(80, 2.5, 'sawtooth', 0.35, 0, 25);
        this.tone(45, 3, 'sine', 0.4, 0.1, 20);
        break;
      case 'mutiny': for (let i = 0; i < 4; i++) this.tone(150 + (i % 2) * 40, 0.18, 'sawtooth', 0.12, i * 0.2); break;
      case 'victory': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.15, i * 0.16)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.15, i * 0.25)); break;
    }
  }

  /** Trilha simples: baixo e arpejo em loop, mais tenso na sobrevivência. */
  private startMusic(): void {
    if (!this.ctx || !this.musicOn || this.musicTimer != null) return;
    const scales: Record<string, number[]> = {
      menu: [220, 261.6, 329.6, 392, 329.6, 261.6],
      build: [196, 246.9, 293.7, 246.9, 220, 261.6],
      survival: [146.8, 174.6, 220, 207.7, 174.6, 155.6],
    };
    const beat = this.mood === 'survival' ? 0.42 : 0.34;
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      const notes = scales[this.mood] ?? scales.menu;
      const n = notes[this.step % notes.length];
      if (this.step % 4 === 0) this.tone(n / 2, beat * 3.5, 'triangle', 0.5, 0, undefined, this.musicGain);
      this.tone(n * 2, beat * 0.8, 'square', 0.12, 0, undefined, this.musicGain);
      this.step++;
    }, beat * 1000);
  }

  private stopMusic(): void {
    if (this.musicTimer != null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
}

export const audio = new Audio();
