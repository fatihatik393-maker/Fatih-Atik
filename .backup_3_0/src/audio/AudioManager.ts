export class AudioManager {
  private ctx: AudioContext | null = null;
  private sizzleSource: AudioBufferSourceNode | null = null;
  private sizzleFilter: BiquadFilterNode | null = null;
  private sizzleGain: GainNode | null = null;
  masterVolume = 0.7;
  muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || this.masterVolume <= 0.01) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainScale = 0.18
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    const detuneFactor = 0.96 + Math.random() * 0.08;
    osc.frequency.setValueAtTime(freq * detuneFactor, ctx.currentTime);

    const vol = Math.max(0.001, this.masterVolume * gainScale);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playFootstep(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Soft low-frequency floor thud with pitch variation
    this.playTone(95 + Math.random() * 22, 0.065, 'triangle', 0.07);
  }

  playPickup(): void {
    this.playTone(520, 0.09, 'triangle', 0.16);
  }

  playPlaceOnCounter(): void {
    this.playTone(340, 0.11, 'sine', 0.18);
  }

  playDrop(): void {
    this.playTone(210, 0.14, 'triangle', 0.16);
  }

  playMenuClick(): void {
    this.playTone(660, 0.06, 'sine', 0.12);
  }

  playCashRegister(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.playTone(987.77, 0.1, 'sine', 0.18);
    setTimeout(() => this.playTone(1318.5, 0.22, 'sine', 0.2), 75);
  }

  playOrderSuccess(): void {
    this.playTone(523.25, 0.12, 'triangle', 0.2);
    setTimeout(() => this.playTone(659.25, 0.12, 'triangle', 0.2), 90);
    setTimeout(() => this.playTone(783.99, 0.25, 'triangle', 0.22), 180);
  }

  playOrderFail(): void {
    this.playTone(220, 0.18, 'sawtooth', 0.15);
    setTimeout(() => this.playTone(175, 0.26, 'sawtooth', 0.15), 120);
  }

  playCookedDing(): void {
    this.playTone(1174.66, 0.28, 'sine', 0.2);
  }

  playDayComplete(): void {
    this.playTone(440, 0.15, 'triangle', 0.2);
    setTimeout(() => this.playTone(554.37, 0.15, 'triangle', 0.2), 120);
    setTimeout(() => this.playTone(659.25, 0.35, 'triangle', 0.24), 240);
  }

  playDoorBell(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Warm two-tone brass shop entrance chime
    this.playTone(783.99, 0.16, 'sine', 0.14);
    setTimeout(() => this.playTone(659.25, 0.28, 'sine', 0.14), 110);
  }

  playSeatSit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    // Soft upholstered booth cushion settle thud
    this.playTone(135, 0.09, 'triangle', 0.08);
  }

  playTableWipe(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // Two rhythmic microfiber cloth wiping swishes across oak tabletop
    for (const delayMs of [0, 180]) {
      setTimeout(() => {
        if (!this.ctx || this.muted) return;
        const duration = 0.16;
        const bufSize = Math.floor(this.ctx.sampleRate * duration);
        const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
          const env = Math.sin((i / bufSize) * Math.PI);
          data[i] = (Math.random() * 2 - 1) * env * 0.45;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1650 + delayMs * 2, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(Math.max(0.001, this.masterVolume * 0.16), this.ctx.currentTime);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        src.start();
      }, delayMs);
    }
  }

  updateSizzle(active: boolean): void {
    if (!active || this.muted || this.masterVolume <= 0.01) {
      if (this.sizzleGain && this.ctx) {
        this.sizzleGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    if (!this.sizzleSource || !this.sizzleGain || !this.sizzleFilter) {
      // Create 1.5s looping crackling noise buffer for realistic grill sizzle
      const bufferSize = Math.floor(ctx.sampleRate * 1.5);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Occasional crisp oil pop impulse
        const pop = Math.random() > 0.985 ? (Math.random() * 2 - 1) * 2.2 : 1.0;
        data[i] = white * pop * 0.5;
      }

      this.sizzleSource = ctx.createBufferSource();
      this.sizzleSource.buffer = noiseBuffer;
      this.sizzleSource.loop = true;

      this.sizzleFilter = ctx.createBiquadFilter();
      this.sizzleFilter.type = 'bandpass';
      this.sizzleFilter.frequency.setValueAtTime(3200, ctx.currentTime);
      this.sizzleFilter.Q.setValueAtTime(1.4, ctx.currentTime);

      this.sizzleGain = ctx.createGain();
      this.sizzleGain.gain.setValueAtTime(0.0001, ctx.currentTime);

      this.sizzleSource.connect(this.sizzleFilter);
      this.sizzleFilter.connect(this.sizzleGain);
      this.sizzleGain.connect(ctx.destination);
      this.sizzleSource.start();
    }

    const targetGain = this.masterVolume * 0.045 * (0.85 + Math.random() * 0.3);
    this.sizzleGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    this.sizzleFilter.frequency.setTargetAtTime(2800 + Math.random() * 900, ctx.currentTime, 0.06);
  }

  silenceAll(): void {
    this.updateSizzle(false);
  }
}


