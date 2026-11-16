// Synthesized sound effects: one Web Audio context, no audio files. Every effect is a short
// oscillator envelope, so the game ships no sound assets and stays silent until the player
// first interacts (the context is created lazily, which browsers require).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
  }

  /** Create the context on the first user gesture; safe to call any time. */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.35;
  }

  /** One note: an oscillator with a fast attack and an exponential decay. */
  tone(freq, dur, type = 'sine', vol = 0.5, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  click() { this.tone(660, 0.06, 'triangle', 0.25); }
  place() { this.tone(180, 0.16, 'triangle', 0.5, 0, 90); this.tone(520, 0.09, 'sine', 0.3, 0.02); }
  upgrade() { this.tone(NOTE(64), 0.1, 'triangle', 0.4); this.tone(NOTE(71), 0.12, 'triangle', 0.4, 0.08); }
  sell() { this.tone(520, 0.1, 'sine', 0.3, 0, 260); }
  deny() { this.tone(140, 0.14, 'square', 0.22, 0, 110); }
  shoot(kind) {
    if (kind === 'spark') this.tone(880 + Math.random() * 120, 0.07, 'square', 0.1, 0, 420);
    else if (kind === 'frost') this.tone(1180, 0.12, 'sine', 0.12, 0, 700);
    else this.tone(220, 0.2, 'sawtooth', 0.22, 0, 70);
  }
  kill() { this.tone(740, 0.08, 'sine', 0.22); this.tone(988, 0.1, 'sine', 0.18, 0.05); }
  coin() { this.tone(1320, 0.06, 'sine', 0.14); }
  leak() { this.tone(90, 0.35, 'sawtooth', 0.5, 0, 45); this.tone(65, 0.4, 'square', 0.3, 0.05, 40); }
  horn() {
    this.tone(98, 0.7, 'sawtooth', 0.3, 0, 147);
    this.tone(147, 0.7, 'sawtooth', 0.22, 0.05, 196);
  }
  waveClear() { [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.16, 'triangle', 0.3, i * 0.09)); }
  victory() { [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.28, 'triangle', 0.35, i * 0.11)); }
  defeat() { [60, 58, 55, 51, 48].forEach((n, i) => this.tone(NOTE(n), 0.4, 'sawtooth', 0.25, i * 0.16)); }
}
