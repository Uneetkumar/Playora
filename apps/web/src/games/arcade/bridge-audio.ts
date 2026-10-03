/**
 * Web Audio Synthesizer for Bridge Builder.
 * Synthesizes dynamic realistic bridge acoustics:
 * - Cable tension hums (frequency proportional to tension)
 * - Wood/Steel creaks under strain
 * - Structural beam snap/buckle
 * - Vehicle engine rumble
 * - Water splash on plunge
 * - Victory horn/cheer fanfare
 * - Node placement and removal feedback
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedAudioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        sharedAudioCtx = new AudioCtx();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

export class BridgeAudioSynthesizer {
  private muted = false;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private lastCreakTime = 0;
  private lastCableHumTime = 0;

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted && this.engineGain) {
      this.engineGain.gain.setValueAtTime(0, sharedAudioCtx?.currentTime ?? 0);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Snapping sound when a truss or road beam exceeds maximum stress.
   */
  public playSnap(material: "road" | "wood" | "steel" | "cable" = "wood"): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Noise burst for the fracture
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.03));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = material === "steel" ? "highpass" : "bandpass";
      filter.frequency.setValueAtTime(material === "steel" ? 1200 : 700, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // Low resonant thud of catastrophic failure
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(material === "cable" ? 340 : 130, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);

      oscGain.gain.setValueAtTime(0.4, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // AudioContext failure handling
    }
  }

  /**
   * Dynamic structural creak when bridge members reach high stress (> 70%).
   */
  public playCreak(stressRatio: number): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastCreakTime < 0.25) return; // rate limit creaks
    this.lastCreakTime = now;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sawtooth";
      const baseFreq = 180 + stressRatio * 140;
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.linearRampToValueAtTime(baseFreq + 60, now + 0.12);
      osc.frequency.linearRampToValueAtTime(baseFreq - 30, now + 0.22);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(500, now);
      filter.Q.setValueAtTime(4, now);

      const volume = Math.min(0.25, 0.08 + (stressRatio - 0.7) * 0.5);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // safe fallback
    }
  }

  /**
   * Tension hum for suspension cables under heavy load.
   * Pitch rises dynamically as tension increases.
   */
  public playCableHum(tensionStress: number): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (now - this.lastCableHumTime < 0.2) return;
    this.lastCableHumTime = now;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";

      // Higher tension = higher pitch
      const freq = 220 + tensionStress * 380;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.linearRampToValueAtTime(freq + 15, now + 0.15);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      // safe fallback
    }
  }

  /**
   * Vehicle engine sound running continuously during simulation.
   */
  public setEngine(active: boolean, speedRatio: number = 1): void {
    if (this.muted || !active) {
      if (this.engineGain && sharedAudioCtx) {
        this.engineGain.gain.setValueAtTime(0, sharedAudioCtx.currentTime);
      }
      return;
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (!this.engineOsc || !this.engineGain) {
        this.engineOsc = ctx.createOscillator();
        this.engineGain = ctx.createGain();

        this.engineOsc.type = "triangle";
        this.engineOsc.frequency.setValueAtTime(55, now);

        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(140, now);

        this.engineGain.gain.setValueAtTime(0.06, now);

        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);
        this.engineOsc.start(now);
      }

      const targetFreq = 48 + speedRatio * 32;
      this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.08);
      this.engineGain.gain.setTargetAtTime(0.07, now, 0.05);
    } catch {
      // safe fallback
    }
  }

  /**
   * Water splash sound when a vehicle or broken truss drops into the gorge.
   */
  public playSplash(): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.45;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.12));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(750, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.45);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
    } catch {
      // safe fallback
    }
  }

  /**
   * Triumphant horn + crowd celebration chime on safe bridge crossing.
   */
  public playSuccess(): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Two-tone truck air horn (Bb / D harmony)
      const hornFrequencies = [233.08, 293.66];
      hornFrequencies.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.45);
      });

      // Triumphant chime chord
      const chords = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      chords.forEach((freq, idx) => {
        const chime = ctx.createOscillator();
        const chimeGain = ctx.createGain();

        chime.type = "sine";
        chime.frequency.setValueAtTime(freq, now + 0.15 + idx * 0.08);

        chimeGain.gain.setValueAtTime(0.15, now + 0.15 + idx * 0.08);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8 + idx * 0.08);

        chime.connect(chimeGain);
        chimeGain.connect(ctx.destination);
        chime.start(now + 0.15 + idx * 0.08);
        chime.stop(now + 0.85 + idx * 0.08);
      });
    } catch {
      // safe fallback
    }
  }

  /**
   * Crisp UI feedback when creating or connecting a member.
   */
  public playPlaceMember(material: "road" | "wood" | "steel" | "cable" = "wood"): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freqMap = {
        road: 380,
        wood: 520,
        steel: 740,
        cable: 980,
      };

      osc.type = material === "steel" ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freqMap[material] || 500, now);
      osc.frequency.exponentialRampToValueAtTime(freqMap[material] * 1.25, now + 0.06);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch {
      // safe fallback
    }
  }

  /**
   * Sound effect when deleting or undoing a member.
   */
  public playDelete(): void {
    if (this.muted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.07);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // safe fallback
    }
  }

  public dispose(): void {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch {
        // ignore
      }
      this.engineOsc = null;
    }
  }
}

export const bridgeAudio = new BridgeAudioSynthesizer();
