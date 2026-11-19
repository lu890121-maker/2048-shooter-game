export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean;

  constructor(enabled = true) {
    this.enabled = enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delaySec = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durationSec);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playShoot(): void {
    this.playTone(320, 0.09, 'triangle', 0.1, 0, 540);
  }

  public playMerge(chainIndex: number): void {
    const base = 360 * Math.pow(1.12, Math.min(chainIndex - 1, 8));
    this.playTone(base, 0.14, 'sine', 0.14, 0, base * 1.25);
  }

  public playSwap(): void {
    this.playTone(440, 0.07, 'sine', 0.08, 0, 580);
  }

  public playInvalid(): void {
    this.playTone(170, 0.12, 'sawtooth', 0.08, 0, 120);
  }

  public playMilestone(value: number): void {
    if (value >= 2048) {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((n, idx) => {
        this.playTone(n, 0.28, 'triangle', 0.15, idx * 0.065);
      });
    } else if (value >= 1024) {
      const notes = [493.88, 659.25, 783.99, 987.77];
      notes.forEach((n, idx) => {
        this.playTone(n, 0.24, 'triangle', 0.14, idx * 0.065);
      });
    } else {
      // 256, 512: uplifting major triad chime
      const notes = value >= 512 ? [440, 554.37, 659.25, 880] : [392, 493.88, 587.33];
      notes.forEach((n, idx) => {
        this.playTone(n, 0.2, 'triangle', 0.13, idx * 0.065);
      });
    }
  }

  public play2048(): void {
    this.playMilestone(2048);
  }

  public playGameOver(): void {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((n, idx) => {
      this.playTone(n, 0.22, 'sine', 0.11, idx * 0.09);
    });
  }
}
