// Audio chime & notification sound generator for Study Partner
class AudioAlertService {
  private audioCtx: AudioContext | null = null;

  public init() {
    this.getContext();
  }

  private async getContext(): Promise<AudioContext | null> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch (e) {
      console.warn('Web Audio API unavailable:', e);
      return null;
    }
  }

  // Distinctive "Ding Dong" chime for Hand Raise
  async playHandRaiseDingDong() {
    const ctx = await this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // "Ding" (Higher bell note G5 ~784 Hz + octave overtone)
    this.playBellNote(ctx, 783.99, now, 0.45, 0.35);
    this.playBellNote(ctx, 1567.98, now, 0.35, 0.12);

    // "Dong" (Lower bell note D5 ~587 Hz + octave overtone) - enters 220ms later
    this.playBellNote(ctx, 587.33, now + 0.22, 0.75, 0.4);
    this.playBellNote(ctx, 1174.66, now + 0.22, 0.55, 0.12);
  }

  // Connect chime: gentle rising tones
  async playConnectChime() {
    const ctx = await this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playSoftTone(ctx, 440, now, 0.16, 0.22); // A4
    this.playSoftTone(ctx, 554.37, now + 0.09, 0.18, 0.24); // C#5
    this.playSoftTone(ctx, 659.25, now + 0.18, 0.32, 0.28); // E5
  }

  // Disconnect chime: gentle falling tones
  async playDisconnectChime() {
    const ctx = await this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playSoftTone(ctx, 659.25, now, 0.16, 0.22); // E5
    this.playSoftTone(ctx, 440, now + 0.1, 0.18, 0.2); // A4
    this.playSoftTone(ctx, 329.63, now + 0.2, 0.35, 0.25); // E4
  }

  // Chat message pop notification sound
  async playMessagePop() {
    const ctx = await this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Pleasant crisp double-tone pop (G5 ~784Hz -> C6 ~1046Hz)
    this.playSoftTone(ctx, 783.99, now, 0.08, 0.3);
    this.playSoftTone(ctx, 1046.5, now + 0.07, 0.16, 0.35);
  }

  // High-priority urgent siren for critical security alerts
  async playCriticalSiren() {
    const ctx = await this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Urgent two-tone warning pulses
    this.playSoftTone(ctx, 880, now, 0.16, 0.45);
    this.playSoftTone(ctx, 520, now + 0.16, 0.16, 0.45);
    this.playSoftTone(ctx, 880, now + 0.32, 0.22, 0.45);
  }

  private playBellNote(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Bell envelope: sharp attack, natural exponential decay
      gain.gain.setValueAtTime(volume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.warn(e);
    }
  }

  private playSoftTone(
    ctx: AudioContext,
    freq: number,
    startTime: number,
    duration: number,
    volume: number,
  ) {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    } catch (e) {
      console.warn(e);
    }
  }
}

export const audioAlerts = new AudioAlertService();

// Pre-unlock AudioContext on first user interaction
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    audioAlerts.init();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}
