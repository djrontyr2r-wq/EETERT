/**
 * High-quality multi-genre procedural audio loop generator for real-time mastering testing.
 * Uses Web Audio API synthesizers, noise generators, and sample-accurate rhythm sequencing.
 */

export class DemoTrackEngine {
  private ctx: BaseAudioContext;
  private isRunning: boolean = false;
  private currentGenre: string = 'EDM';
  private timerId: number | null = null;
  private masterNode: GainNode;
  private currentStep: number = 0;
  private bpm: number = 128;

  constructor(ctx: BaseAudioContext, destination: AudioNode) {
    this.ctx = ctx;
    this.masterNode = ctx.createGain();
    this.masterNode.channelCount = 2;
    this.masterNode.channelCountMode = 'explicit';
    this.masterNode.channelInterpretation = 'speakers';
    this.masterNode.gain.value = 0.85;
    this.masterNode.connect(destination);
  }

  private routeToMaster(sourceNode: AudioNode, pan: number = 0) {
    const AudioCtxAny = this.ctx as unknown as { createStereoPanner?: (this: BaseAudioContext) => StereoPannerNode };
    if (typeof AudioCtxAny.createStereoPanner === 'function') {
      const panner = AudioCtxAny.createStereoPanner.call(this.ctx);
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      sourceNode.connect(panner);
      panner.connect(this.masterNode);
    } else {
      sourceNode.connect(this.masterNode);
    }
  }

  public getBpm(): number {
    return this.bpm;
  }

  public static async renderDemoTrackBuffer(
    genre: 'EDM' | 'Bollywood' | 'Hip-Hop' | 'Deep House' | 'Techno',
    durationSeconds: number = 30,
    sampleRate: number = 44100
  ): Promise<AudioBuffer> {
    const totalFrames = Math.floor(sampleRate * durationSeconds);
    const offlineCtx = new OfflineAudioContext(2, totalFrames, sampleRate);
    const engine = new DemoTrackEngine(offlineCtx, offlineCtx.destination);
    engine.setGenre(genre);

    const stepDuration = 60 / engine.bpm / 4;
    const totalSteps = Math.ceil(durationSeconds / stepDuration);
    for (let s = 0; s < totalSteps; s++) {
      const time = s * stepDuration;
      engine.playStep(s % 32, time);
    }

    return await offlineCtx.startRendering();
  }

  public setGenre(genre: 'EDM' | 'Bollywood' | 'Hip-Hop' | 'Deep House' | 'Techno') {
    this.currentGenre = genre;
    switch (genre) {
      case 'EDM':
        this.bpm = 128;
        break;
      case 'Bollywood':
        this.bpm = 130;
        break;
      case 'Hip-Hop':
        this.bpm = 140; // 70 half-time
        break;
      case 'Deep House':
        this.bpm = 122;
        break;
      case 'Techno':
        this.bpm = 132;
        break;
    }
  }

  public getGenre() {
    return this.currentGenre;
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentStep = 0;
    this.scheduleNextBeat();
  }

  public stop() {
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  public isPlaying() {
    return this.isRunning;
  }

  private scheduleNextBeat() {
    if (!this.isRunning) return;

    const stepDuration = 60 / this.bpm / 4; // 16th note
    const now = this.ctx.currentTime;

    this.playStep(this.currentStep, now);
    this.currentStep = (this.currentStep + 1) % 32;

    const interval = stepDuration * 1000;
    this.timerId = window.setTimeout(() => this.scheduleNextBeat(), interval);
  }

  public playStep(step: number, time: number) {
    switch (this.currentGenre) {
      case 'EDM':
        this.playEDMStep(step, time);
        break;
      case 'Bollywood':
        this.playBollywoodStep(step, time);
        break;
      case 'Hip-Hop':
        this.playHipHopStep(step, time);
        break;
      case 'Deep House':
        this.playDeepHouseStep(step, time);
        break;
      case 'Techno':
        this.playTechnoStep(step, time);
        break;
    }
  }

  // --- EDM: 4-on-the-floor kick, punchy sidechained saw chord, rolling bass, hats ---
  private playEDMStep(step: number, time: number) {
    // Kick on 0, 4, 8, 12, 16, 20, 24, 28 (every quarter note)
    if (step % 4 === 0) {
      this.triggerKick(time, 150, 42, 0.28, 1.0);
    }

    // Offbeat hi-hat on 2, 6, 10, 14, 18, 22, 26, 30
    if (step % 4 === 2) {
      this.triggerHiHat(time, 0.08, 0.45, true);
    } else if (step % 2 === 0) {
      this.triggerHiHat(time, 0.04, 0.2, false);
    }

    // Snare / Clap on 4, 12, 20, 28
    if (step % 8 === 4) {
      this.triggerSnareClap(time, 0.7);
    }

    // Rolling bassline (16th notes with sidechain ducking on kick)
    const notes = [40, 40, 43, 40, 40, 45, 40, 43];
    const note = notes[step % 8];
    const isKickStep = step % 4 === 0;
    const bassVol = isKickStep ? 0.25 : 0.65;
    this.triggerSynthBass(time, this.midiToFreq(note), 0.12, bassVol, 'sawtooth');

    // Supersaw chords on certain 16th beats
    if ([0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27, 30].includes(step)) {
      const chord = [60, 63, 67, 70]; // Cm7
      this.triggerSupersawChord(time, chord, 0.16, 0.35);
    }
  }

  // --- Bollywood: 130 BPM Dholak/Dhol bounce, punchy kick, tabla accents, brass/vocal melody ---
  private playBollywoodStep(step: number, time: number) {
    // Dhol bass boom (quarter notes + syncopated pickup)
    if (step % 4 === 0 || step === 14 || step === 30) {
      this.triggerKick(time, 130, 48, 0.32, 0.95);
    }

    // Dhol trebly stick hit (chaati) & tabla tak (steps 2, 6, 10, 14, and 16th rolls)
    if ([2, 5, 7, 10, 13, 15, 18, 21, 23, 26, 29, 31].includes(step)) {
      this.triggerTablaClick(time, 0.35);
    }

    // Snare / Dhol clap
    if (step % 8 === 4) {
      this.triggerSnareClap(time, 0.75);
    }

    // Tabla Bayan pitch-bent bass stroke on steps 3, 11, 19, 27
    if (step % 8 === 3) {
      this.triggerTablaBayan(time, 0.5);
    }

    // Indian melody riff (Bhairavi / Dorian vibe)
    const melodyPattern = [
      67, null, 70, 72, null, 74, 75, 74,
      72, null, 70, 68, 67, null, 68, 70,
      72, null, 74, 75, null, 77, 75, 74,
      72, 70, 68, 67, 65, 67, null, null
    ];
    const pitch = melodyPattern[step];
    if (pitch) {
      this.triggerLeadSynth(time, this.midiToFreq(pitch), 0.14, 0.45);
    }

    // Sub-bass groove
    if (step % 4 !== 0) {
      this.triggerSynthBass(time, this.midiToFreq(36), 0.1, 0.4, 'sine');
    }
  }

  // --- Hip-Hop 808: Booming sustained sub bass, rolling trap hi-hats, crisp claps ---
  private playHipHopStep(step: number, time: number) {
    // 808 Boom on step 0, 6, 16, 22
    if (step === 0 || step === 16) {
      this.trigger808Bass(time, 38, 0.85, 0.9);
    } else if (step === 6 || step === 22) {
      this.trigger808Bass(time, 41, 0.65, 0.85);
    }

    // Kick transient
    if (step === 0 || step === 6 || step === 16 || step === 22 || step === 28) {
      this.triggerKick(time, 180, 50, 0.18, 0.85);
    }

    // Trap Clap on step 8 and 24 (beats 2 and 4 in half-time)
    if (step === 8 || step === 24) {
      this.triggerSnareClap(time, 0.85);
    }

    // Trap Hi-hats with triplets / rolls on steps 12-15 and 28-31
    if (step >= 12 && step <= 15) {
      this.triggerHiHat(time, 0.02, 0.4, false);
      this.triggerHiHat(time + 0.05, 0.02, 0.35, false);
    } else if (step % 2 === 0) {
      this.triggerHiHat(time, 0.04, 0.3, false);
    }

    // Dark bell melody
    const bellNotes = [60, null, 63, null, 67, null, 65, null, 58, null, 62, null, 65, null, 63, null];
    const note = bellNotes[step % 16];
    if (note) {
      this.triggerBell(time, this.midiToFreq(note), 0.4);
    }
  }

  // --- Deep House: Warm Rhodes chords, 909 kick, shakers, warm sub ---
  private playDeepHouseStep(step: number, time: number) {
    // 909 Kick on quarter notes
    if (step % 4 === 0) {
      this.triggerKick(time, 125, 45, 0.3, 0.85);
    }

    // Shakers / Open Hat
    if (step % 4 === 2) {
      this.triggerHiHat(time, 0.12, 0.4, true);
    } else {
      this.triggerHiHat(time, 0.03, 0.15, false);
    }

    // Clap on 4, 12, 20, 28
    if (step % 8 === 4) {
      this.triggerSnareClap(time, 0.5);
    }

    // Warm rhodes chord on syncopated steps
    if ([0, 3, 6, 14, 16, 19, 22, 30].includes(step)) {
      const chord = [57, 60, 64, 67]; // Am7
      this.triggerRhodesChord(time, chord, 0.25, 0.35);
    }

    // Deep sub bass
    if (step % 2 === 0 && step % 4 !== 0) {
      this.triggerSynthBass(time, this.midiToFreq(33), 0.18, 0.6, 'triangle');
    }
  }

  // --- Techno: Industrial punchy rolling rumble, piercing open hats, aggressive rim ---
  private playTechnoStep(step: number, time: number) {
    // Heavy industrial kick
    if (step % 4 === 0) {
      this.triggerKick(time, 160, 38, 0.35, 1.1);
      // Kick rumble
      this.triggerSynthBass(time + 0.08, 48, 0.22, 0.5, 'sine');
    }

    // Sizzling offbeat open hi-hat
    if (step % 4 === 2) {
      this.triggerHiHat(time, 0.14, 0.55, true);
    } else if (step % 2 === 1) {
      this.triggerHiHat(time, 0.03, 0.25, false);
    }

    // Industrial Clap / Rimshot on 4, 12, 20, 28
    if (step % 8 === 4) {
      this.triggerSnareClap(time, 0.7);
    }

    // Rolling hypnotic 16th sub rumble
    this.triggerSynthBass(time, 42, 0.08, 0.35, 'sawtooth');
  }

  // --- DSP SYNTHESIS PRIMITIVES ---

  private triggerKick(time: number, startFreq: number, endFreq: number, duration: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration * 0.4);
    osc.frequency.setValueAtTime(endFreq, time + duration);

    gain.gain.setValueAtTime(vol * 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    this.routeToMaster(gain, 0.0); // Mono center kick

    osc.start(time);
    osc.stop(time + duration);
  }

  private trigger808Bass(time: number, midiNote: number, duration: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const freq = this.midiToFreq(midiNote);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, time);
    osc.frequency.exponentialRampToValueAtTime(freq, time + 0.05);

    gain.gain.setValueAtTime(vol * 0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    this.routeToMaster(gain, 0.0); // Mono center sub

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerHiHat(time: number, duration: number, vol: number, isOpen: boolean) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = isOpen ? 7000 : 9000;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    // Pan open hat right, closed hat left
    this.routeToMaster(gain, isOpen ? 0.35 : -0.28);

    noise.start(time);
    noise.stop(time + duration);
  }

  private triggerSnareClap(time: number, vol: number) {
    const duration = 0.22;
    // Noise component
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol * 0.7, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    noise.connect(filter);
    filter.connect(gain);
    this.routeToMaster(gain, -0.15); // Slightly panned clap/snare

    noise.start(time);
    noise.stop(time + duration);

    // Tonal body
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.frequency.setValueAtTime(240, time);
    osc.frequency.exponentialRampToValueAtTime(140, time + 0.08);

    oscGain.gain.setValueAtTime(vol * 0.5, time);
    oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(oscGain);
    this.routeToMaster(oscGain, 0.0);

    osc.start(time);
    osc.stop(time + 0.09);
  }

  private triggerTablaClick(time: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(950, time);
    osc.frequency.exponentialRampToValueAtTime(450, time + 0.04);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    this.routeToMaster(gain, 0.38); // Tabla Dayan on right
    osc.start(time);
    osc.stop(time + 0.05);
  }

  private triggerTablaBayan(time: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.frequency.setValueAtTime(90, time);
    osc.frequency.linearRampToValueAtTime(140, time + 0.12);
    osc.frequency.exponentialRampToValueAtTime(80, time + 0.3);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.32);

    osc.connect(gain);
    this.routeToMaster(gain, -0.22); // Tabla Bayan bass on left
    osc.start(time);
    osc.stop(time + 0.32);
  }

  private triggerSynthBass(time: number, freq: number, duration: number, vol: number, type: OscillatorType) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration);

    gain.gain.setValueAtTime(vol * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    this.routeToMaster(gain, 0.0); // Bass is mono center for tight low-end

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerLeadSynth(time: number, freq: number, duration: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq * 2.2, time);
    filter.Q.value = 2.5;

    gain.gain.setValueAtTime(vol * 0.45, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    this.routeToMaster(gain, 0.12);

    osc.start(time);
    osc.stop(time + duration);
  }

  private triggerSupersawChord(time: number, midiChord: number[], duration: number, vol: number) {
    midiChord.forEach((midi, idx) => {
      // Create wide stereo pair for each note in chord
      const panPositions = [-0.5, 0.5, -0.3, 0.3];
      const pan = panPositions[idx % panPositions.length];
      const detuneCents = (idx % 2 === 0 ? 5 : -5);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(midi), time);
      osc.detune.setValueAtTime(detuneCents, time);

      gain.gain.setValueAtTime(vol / midiChord.length, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      this.routeToMaster(gain, pan);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private triggerRhodesChord(time: number, midiChord: number[], duration: number, vol: number) {
    midiChord.forEach((midi, idx) => {
      const panPositions = [-0.4, 0.4, -0.2, 0.2];
      const pan = panPositions[idx % panPositions.length];

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(midi), time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);

      gain.gain.setValueAtTime(vol / midiChord.length, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      this.routeToMaster(gain, pan);

      osc.start(time);
      osc.stop(time + duration);
    });
  }

  private triggerBell(time: number, freq: number, vol: number) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(vol * 0.35, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);

    osc.connect(gain);
    this.routeToMaster(gain, 0.28);
    osc.start(time);
    osc.stop(time + 0.6);
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
}
