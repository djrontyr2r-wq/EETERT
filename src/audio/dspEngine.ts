/**
 * Web Audio DSP Processing Engine replicating the JUCE C++ Mastering Pipeline.
 * Chains 5-Band EQ, 3-Band Dynamics, Stereo Imager, Harmonic Waveshaper, and Smart Limiter.
 */

import {
  EQBand,
  MultibandCompState,
  StereoImagerState,
  HarmonicExciterState,
  SmartLimiterState,
  AudioAnalysisMetrics,
  Genre
} from '../types';

export class MasteringDSPEngine {
  public ctx: AudioContext;

  // Nodes
  private inputNode: GainNode;
  private preAnalyzer: AnalyserNode;
  private postAnalyzer: AnalyserNode;
  private bypassDryGain: GainNode;
  private masterWetGain: GainNode;
  private outputMasterGain: GainNode;

  // EQ Biquad Filters (5 bands)
  private eqFilters: BiquadFilterNode[] = [];
  private compInputGain: GainNode;
  private eqAuditionGain: GainNode;

  // Multiband Compressor LR-4 Linkwitz-Riley 4th-order Crossover Nodes
  private compLowFilter1: BiquadFilterNode;
  private compLowFilter2: BiquadFilterNode;
  private compMidHpFilter1: BiquadFilterNode;
  private compMidHpFilter2: BiquadFilterNode;
  private compMidLpFilter1: BiquadFilterNode;
  private compMidLpFilter2: BiquadFilterNode;
  private compHighFilter1: BiquadFilterNode;
  private compHighFilter2: BiquadFilterNode;
  private compLowNode: DynamicsCompressorNode;
  private compMidNode: DynamicsCompressorNode;
  private compHighNode: DynamicsCompressorNode;
  private compLowMakeup: GainNode;
  private compMidMakeup: GainNode;
  private compHighMakeup: GainNode;
  private compLowBandGain: GainNode;
  private compMidBandGain: GainNode;
  private compHighBandGain: GainNode;
  private compSummingNode: GainNode;

  // Stereo Imager Nodes (Mid-Side 3-band + Stereoizer + Solo)
  private imagerSplitter: ChannelSplitterNode;
  private imagerMerger: ChannelMergerNode;
  private midGain: GainNode;
  private sideSummingNode: GainNode;
  private sideLowFilter: BiquadFilterNode;
  private sideLowGain: GainNode;
  private sideMidHighpass: BiquadFilterNode;
  private sideMidLowpass: BiquadFilterNode;
  private sideMidGain: GainNode;
  private sideHighFilter: BiquadFilterNode;
  private sideHighGain: GainNode;
  private stereoizerDelay: DelayNode;
  private stereoizerFilter: BiquadFilterNode;
  private stereoizerGain: GainNode;
  private midToL: GainNode;
  private midToR: GainNode;
  private sideToL: GainNode;
  private sideToR: GainNode;

  // Harmonic Exciter
  private exciterDryGain: GainNode;
  private exciterWetGain: GainNode;
  private exciterWaveshaper: WaveShaperNode;
  private exciterToneFilter: BiquadFilterNode;

  // Smart Limiter
  private limiterNode: DynamicsCompressorNode;
  private limiterCeilingGain: GainNode;
  private limiterMakeupGain: GainNode;

  // Analysis buffers
  private timeDomainBufferL: Float32Array;
  private timeDomainBufferR: Float32Array;
  private splitterForAnalysis: ChannelSplitterNode;
  private analyzerL: AnalyserNode;
  private analyzerR: AnalyserNode;

  // Bypass state
  private isBypassed: boolean = false;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    this.inputNode = this.ctx.createGain();
    this.inputNode.channelCount = 2;
    this.inputNode.channelCountMode = 'explicit';
    this.inputNode.channelInterpretation = 'speakers';
    this.outputMasterGain = this.ctx.createGain();

    // Analyzers
    this.preAnalyzer = this.ctx.createAnalyser();
    this.preAnalyzer.fftSize = 2048;
    this.preAnalyzer.smoothingTimeConstant = 0.82;

    this.postAnalyzer = this.ctx.createAnalyser();
    this.postAnalyzer.fftSize = 2048;
    this.postAnalyzer.smoothingTimeConstant = 0.82;

    this.analyzerL = this.ctx.createAnalyser();
    this.analyzerR = this.ctx.createAnalyser();
    this.analyzerL.fftSize = 1024;
    this.analyzerR.fftSize = 1024;
    this.timeDomainBufferL = new Float32Array(1024);
    this.timeDomainBufferR = new Float32Array(1024);

    this.splitterForAnalysis = this.ctx.createChannelSplitter(2);

    // Bypass & Wet routing
    this.bypassDryGain = this.ctx.createGain();
    this.masterWetGain = this.ctx.createGain();
    this.bypassDryGain.gain.value = 0.0;
    this.masterWetGain.gain.value = 1.0;

    // Connect input to pre-analyzer & dry path
    this.inputNode.connect(this.preAnalyzer);
    this.inputNode.connect(this.bypassDryGain);
    this.bypassDryGain.connect(this.outputMasterGain);

    // --- 1. EQ STAGE ---
    const defaultEqFrequencies = [50, 250, 1000, 4500, 12000];
    const defaultTypes: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

    let lastNode: AudioNode = this.inputNode;
    for (let i = 0; i < 5; i++) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = defaultTypes[i];
      filter.frequency.value = defaultEqFrequencies[i];
      filter.gain.value = 0;
      filter.Q.value = 1.0;
      lastNode.connect(filter);
      lastNode = filter;
      this.eqFilters.push(filter);
    }
    const eqOutputNode = lastNode;

    // --- 2. MULTIBAND COMPRESSOR STAGE (LR-4 Linkwitz-Riley 4th-order Crossovers) ---
    // Q = Math.SQRT1_2 (0.7071) for cascaded 2nd-order Butterworth filters yields a perfect LR-4 flat 0.00 dB sum.
    const Q_LR = Math.SQRT1_2;

    // Low Band Crossover (LP_L ^ 2)
    this.compLowFilter1 = this.ctx.createBiquadFilter();
    this.compLowFilter1.type = 'lowpass';
    this.compLowFilter1.frequency.value = 250;
    this.compLowFilter1.Q.value = Q_LR;

    this.compLowFilter2 = this.ctx.createBiquadFilter();
    this.compLowFilter2.type = 'lowpass';
    this.compLowFilter2.frequency.value = 250;
    this.compLowFilter2.Q.value = Q_LR;

    // Mid Band Crossover (HP_L ^ 2 * LP_H ^ 2)
    this.compMidHpFilter1 = this.ctx.createBiquadFilter();
    this.compMidHpFilter1.type = 'highpass';
    this.compMidHpFilter1.frequency.value = 250;
    this.compMidHpFilter1.Q.value = Q_LR;

    this.compMidHpFilter2 = this.ctx.createBiquadFilter();
    this.compMidHpFilter2.type = 'highpass';
    this.compMidHpFilter2.frequency.value = 250;
    this.compMidHpFilter2.Q.value = Q_LR;

    this.compMidLpFilter1 = this.ctx.createBiquadFilter();
    this.compMidLpFilter1.type = 'lowpass';
    this.compMidLpFilter1.frequency.value = 4000;
    this.compMidLpFilter1.Q.value = Q_LR;

    this.compMidLpFilter2 = this.ctx.createBiquadFilter();
    this.compMidLpFilter2.type = 'lowpass';
    this.compMidLpFilter2.frequency.value = 4000;
    this.compMidLpFilter2.Q.value = Q_LR;

    // High Band Crossover (HP_H ^ 2)
    this.compHighFilter1 = this.ctx.createBiquadFilter();
    this.compHighFilter1.type = 'highpass';
    this.compHighFilter1.frequency.value = 4000;
    this.compHighFilter1.Q.value = Q_LR;

    this.compHighFilter2 = this.ctx.createBiquadFilter();
    this.compHighFilter2.type = 'highpass';
    this.compHighFilter2.frequency.value = 4000;
    this.compHighFilter2.Q.value = Q_LR;

    this.compLowNode = this.ctx.createDynamicsCompressor();
    this.compMidNode = this.ctx.createDynamicsCompressor();
    this.compHighNode = this.ctx.createDynamicsCompressor();

    this.compLowMakeup = this.ctx.createGain();
    this.compMidMakeup = this.ctx.createGain();
    this.compHighMakeup = this.ctx.createGain();

    this.compLowBandGain = this.ctx.createGain();
    this.compMidBandGain = this.ctx.createGain();
    this.compHighBandGain = this.ctx.createGain();

    this.compSummingNode = this.ctx.createGain();
    this.compSummingNode.channelCount = 2;
    this.compSummingNode.channelCountMode = 'explicit';
    this.compSummingNode.channelInterpretation = 'speakers';

    // Route EQ to 3 bands via LR-4 crossovers or directly to audition bus during EQ Band Solo
    this.compInputGain = this.ctx.createGain();
    this.compInputGain.gain.value = 1.0;
    this.eqAuditionGain = this.ctx.createGain();
    this.eqAuditionGain.gain.value = 0.0;

    eqOutputNode.connect(this.compInputGain);
    eqOutputNode.connect(this.eqAuditionGain);

    // Low Band: LP_L ^ 2 -> comp -> makeup -> bandGain -> sum
    this.compInputGain.connect(this.compLowFilter1);
    this.compLowFilter1.connect(this.compLowFilter2);
    this.compLowFilter2.connect(this.compLowNode);
    this.compLowNode.connect(this.compLowMakeup);
    this.compLowMakeup.connect(this.compLowBandGain);
    this.compLowBandGain.connect(this.compSummingNode);

    // Mid Band: HP_L ^ 2 -> LP_H ^ 2 -> comp -> makeup -> bandGain -> sum
    this.compInputGain.connect(this.compMidHpFilter1);
    this.compMidHpFilter1.connect(this.compMidHpFilter2);
    this.compMidHpFilter2.connect(this.compMidLpFilter1);
    this.compMidLpFilter1.connect(this.compMidLpFilter2);
    this.compMidLpFilter2.connect(this.compMidNode);
    this.compMidNode.connect(this.compMidMakeup);
    this.compMidMakeup.connect(this.compMidBandGain);
    this.compMidBandGain.connect(this.compSummingNode);

    // High Band: HP_H ^ 2 -> comp -> makeup -> bandGain -> sum
    this.compInputGain.connect(this.compHighFilter1);
    this.compHighFilter1.connect(this.compHighFilter2);
    this.compHighFilter2.connect(this.compHighNode);
    this.compHighNode.connect(this.compHighMakeup);
    this.compHighMakeup.connect(this.compHighBandGain);
    this.compHighBandGain.connect(this.compSummingNode);

    // --- 3. STEREO IMAGER STAGE (Multiband M/S Matrix + Stereoizer + Solo) ---
    this.imagerSplitter = this.ctx.createChannelSplitter(2);
    this.imagerMerger = this.ctx.createChannelMerger(2);
    this.midGain = this.ctx.createGain();
    this.sideSummingNode = this.ctx.createGain();

    // 3-Band Side filters
    // Low band (bass mono fold)
    this.sideLowFilter = this.ctx.createBiquadFilter();
    this.sideLowFilter.type = "lowpass";
    this.sideLowFilter.frequency.value = 130;
    this.sideLowGain = this.ctx.createGain();
    this.sideLowGain.gain.value = 0.0; // mono bass by default

    // Mid band (130 Hz - 2500 Hz)
    this.sideMidHighpass = this.ctx.createBiquadFilter();
    this.sideMidHighpass.type = "highpass";
    this.sideMidHighpass.frequency.value = 130;
    this.sideMidLowpass = this.ctx.createBiquadFilter();
    this.sideMidLowpass.type = "lowpass";
    this.sideMidLowpass.frequency.value = 2500;
    this.sideMidGain = this.ctx.createGain();
    this.sideMidGain.gain.value = 1.0;

    // High band (> 2500 Hz)
    this.sideHighFilter = this.ctx.createBiquadFilter();
    this.sideHighFilter.type = "highpass";
    this.sideHighFilter.frequency.value = 2500;
    this.sideHighGain = this.ctx.createGain();
    this.sideHighGain.gain.value = 1.25;

    // Haas Stereoizer Decorrelator (Spatial widening for mono & narrow audio)
    this.stereoizerDelay = this.ctx.createDelay(0.05);
    this.stereoizerDelay.delayTime.value = 0.014; // 14ms Haas psychoacoustic delay
    this.stereoizerFilter = this.ctx.createBiquadFilter();
    this.stereoizerFilter.type = "highpass";
    this.stereoizerFilter.frequency.value = 800; // Keep Haas delay out of sub & low-mids
    this.stereoizerGain = this.ctx.createGain();
    this.stereoizerGain.gain.value = 0.0;

    // Route compSummingNode to imagerSplitter
    this.compSummingNode.connect(this.imagerSplitter);

    // Mid extraction: (L + R) * 0.5
    const leftGainToMid = this.ctx.createGain();
    const rightGainToMid = this.ctx.createGain();
    leftGainToMid.gain.value = 0.5;
    rightGainToMid.gain.value = 0.5;

    this.imagerSplitter.connect(leftGainToMid, 0);
    this.imagerSplitter.connect(rightGainToMid, 1);
    leftGainToMid.connect(this.midGain);
    rightGainToMid.connect(this.midGain);

    // Side extraction: (L - R) * 0.5
    const rawSideNode = this.ctx.createGain();
    const leftGainToSide = this.ctx.createGain();
    const rightGainToSide = this.ctx.createGain();
    leftGainToSide.gain.value = 0.5;
    rightGainToSide.gain.value = -0.5;

    this.imagerSplitter.connect(leftGainToSide, 0);
    this.imagerSplitter.connect(rightGainToSide, 1);
    leftGainToSide.connect(rawSideNode);
    rightGainToSide.connect(rawSideNode);

    // Side Low Band routing (Lowpass -> Low Gain -> Side Summing)
    rawSideNode.connect(this.sideLowFilter);
    this.sideLowFilter.connect(this.sideLowGain);
    this.sideLowGain.connect(this.sideSummingNode);

    // Side Mid Band routing (Highpass -> Lowpass -> Mid Gain -> Side Summing)
    rawSideNode.connect(this.sideMidHighpass);
    this.sideMidHighpass.connect(this.sideMidLowpass);
    this.sideMidLowpass.connect(this.sideMidGain);
    this.sideMidGain.connect(this.sideSummingNode);

    // Side High Band routing (Highpass -> High Gain -> Side Summing)
    rawSideNode.connect(this.sideHighFilter);
    this.sideHighFilter.connect(this.sideHighGain);
    this.sideHighGain.connect(this.sideSummingNode);

    // Stereoizer Haas routing: Mid -> Delay -> Highpass -> Gain -> Side Summing
    this.midGain.connect(this.stereoizerDelay);
    this.stereoizerDelay.connect(this.stereoizerFilter);
    this.stereoizerFilter.connect(this.stereoizerGain);
    this.stereoizerGain.connect(this.sideSummingNode);

    // Reconstruct L = Mid + Side, R = Mid - Side
    this.midToL = this.ctx.createGain();
    this.midToR = this.ctx.createGain();
    this.sideToL = this.ctx.createGain();
    this.sideToR = this.ctx.createGain();
    this.midToL.gain.value = 1.0;
    this.midToR.gain.value = 1.0;
    this.sideToL.gain.value = 1.0;
    this.sideToR.gain.value = -1.0;

    this.midGain.connect(this.midToL);
    this.midGain.connect(this.midToR);
    this.sideSummingNode.connect(this.sideToL);
    this.sideSummingNode.connect(this.sideToR);

    this.midToL.connect(this.imagerMerger, 0, 0);
    this.sideToL.connect(this.imagerMerger, 0, 0);
    this.midToR.connect(this.imagerMerger, 0, 1);
    this.sideToR.connect(this.imagerMerger, 0, 1);

    // --- 4. HARMONIC EXCITER STAGE ---
    this.exciterDryGain = this.ctx.createGain();
    this.exciterWetGain = this.ctx.createGain();
    this.exciterWaveshaper = this.ctx.createWaveShaper();
    this.exciterWaveshaper.oversample = '4x';
    this.exciterToneFilter = this.ctx.createBiquadFilter();
    this.exciterToneFilter.type = 'highshelf';
    this.exciterToneFilter.frequency.value = 3500;
    this.exciterToneFilter.gain.value = 3.0;

    const exciterSum = this.ctx.createGain();

    this.imagerMerger.connect(this.exciterDryGain);
    this.imagerMerger.connect(this.exciterWaveshaper);
    this.exciterWaveshaper.connect(this.exciterToneFilter);
    this.exciterToneFilter.connect(this.exciterWetGain);

    this.exciterDryGain.connect(exciterSum);
    this.exciterWetGain.connect(exciterSum);

    this.updateExciterCurve('tape', 40);

    // --- 5. SMART LIMITER STAGE ---
    this.limiterMakeupGain = this.ctx.createGain();
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = -0.5;
    this.limiterNode.knee.value = 0.0; // hard knee for brickwall
    this.limiterNode.ratio.value = 20.0;
    this.limiterNode.attack.value = 0.001; // 1ms
    this.limiterNode.release.value = 0.05; // 50ms
    this.limiterCeilingGain = this.ctx.createGain();
    this.limiterCeilingGain.gain.value = 0.98; // -0.2 dBFS ceiling

    exciterSum.connect(this.limiterMakeupGain);
    this.eqAuditionGain.connect(this.limiterMakeupGain);
    this.limiterMakeupGain.connect(this.limiterNode);
    this.limiterNode.connect(this.limiterCeilingGain);

    // Connect wet output to post analyzer and master output
    this.limiterCeilingGain.connect(this.masterWetGain);
    this.masterWetGain.connect(this.outputMasterGain);

    this.outputMasterGain.connect(this.postAnalyzer);
    this.outputMasterGain.connect(this.splitterForAnalysis);
    this.splitterForAnalysis.connect(this.analyzerL, 0);
    this.splitterForAnalysis.connect(this.analyzerR, 1);

    // Connect master to speakers
    this.outputMasterGain.connect(this.ctx.destination);
  }

  public getInputNode(): GainNode {
    return this.inputNode;
  }

  public resumeContext() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setBypass(bypass: boolean) {
    this.isBypassed = bypass;
    const now = this.ctx.currentTime;
    if (bypass) {
      this.masterWetGain.gain.setTargetAtTime(0.0, now, 0.02);
      this.bypassDryGain.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      this.masterWetGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.bypassDryGain.gain.setTargetAtTime(0.0, now, 0.02);
    }
  }

  public getBypass(): boolean {
    return this.isBypassed;
  }

  // --- PARAMETER UPDATES ---

  public updateEQ(bands: EQBand[]) {
    const soloIdx = bands.findIndex(b => Boolean(b.solo));
    const isSoloActive = soloIdx !== -1;
    const now = this.ctx.currentTime;
    const isSuspended = this.ctx.state === 'suspended' || now < 0.05;

    // Switch between normal compressor processing path and isolated audition bus
    if (this.compInputGain && this.eqAuditionGain) {
      if (isSoloActive) {
        this.compInputGain.gain.setTargetAtTime(0.0, now, 0.01);
        this.eqAuditionGain.gain.setTargetAtTime(1.5, now, 0.01);
      } else {
        this.compInputGain.gain.setTargetAtTime(1.0, now, 0.01);
        this.eqAuditionGain.gain.setTargetAtTime(0.0, now, 0.01);
      }
    }

    if (isSoloActive) {
      // SOLO AUDITION MODE:
      // Isolate the selected frequency band with a steep 4th-order (24 dB/octave) filter
      const soloBand = bands[soloIdx];
      const targetFreq = Math.max(20, Math.min(20000, soloBand.freq));
      const targetQ = Math.max(0.2, Math.min(18, soloBand.q));

      let auditionType: BiquadFilterType = 'bandpass';
      let auditionQ = Math.max(1.2, targetQ);

      if (soloBand.type === 'lowshelf' || soloBand.type === 'lowpass') {
        auditionType = 'lowpass';
        auditionQ = Math.SQRT1_2; // 0.7071 Butterworth
      } else if (soloBand.type === 'highshelf' || soloBand.type === 'highpass') {
        auditionType = 'highpass';
        auditionQ = Math.SQRT1_2; // 0.7071 Butterworth
      } else {
        auditionType = 'bandpass';
        auditionQ = Math.max(1.2, targetQ);
      }

      // Cascade 2 filters to form a 4th-order audition filter at targetFreq
      const secondAuditionIdx = (soloIdx + 1) % this.eqFilters.length;

      this.eqFilters.forEach((filter, idx) => {
        if (idx === soloIdx || idx === secondAuditionIdx) {
          if (filter.type !== auditionType) {
            try { filter.type = auditionType; } catch {}
          }
          if (isSuspended) {
            filter.frequency.value = targetFreq;
            filter.Q.value = auditionQ;
            filter.gain.value = 0;
          } else {
            filter.frequency.setTargetAtTime(targetFreq, now, 0.005);
            filter.Q.setTargetAtTime(auditionQ, now, 0.005);
            filter.gain.setTargetAtTime(0, now, 0.005);
          }
        } else {
          // Neutral pass-through wire
          if (filter.type !== 'peaking') {
            try { filter.type = 'peaking'; } catch {}
          }
          if (isSuspended) {
            filter.gain.value = 0;
          } else {
            filter.gain.setTargetAtTime(0, now, 0.005);
          }
        }
      });
    } else {
      // NORMAL MULTI-BAND EQ MODE
      bands.forEach((band, idx) => {
        const filter = this.eqFilters[idx];
        if (!filter) return;

        if (!band.enabled) {
          // Neutralize disabled filter completely so it acts as transparent wire
          if (filter.type !== 'peaking') {
            try { filter.type = 'peaking'; } catch {}
          }
          if (isSuspended) {
            filter.gain.value = 0;
          } else {
            filter.gain.setTargetAtTime(0, now, 0.005);
          }
          return;
        }

        // Active band: apply user filter curve
        if (filter.type !== band.type) {
          try {
            filter.type = band.type;
          } catch (e) {
            console.warn('Filter type error:', e);
          }
        }

        const targetGain = band.gain;
        const targetFreq = Math.max(20, Math.min(20000, band.freq));
        const targetQ = Math.max(0.1, Math.min(18, band.q));

        if (isSuspended) {
          filter.frequency.value = targetFreq;
          filter.gain.value = targetGain;
          filter.Q.value = targetQ;
        } else {
          try {
            filter.frequency.setTargetAtTime(targetFreq, now, 0.005);
            filter.gain.setTargetAtTime(targetGain, now, 0.005);
            filter.Q.setTargetAtTime(targetQ, now, 0.005);
          } catch {
            filter.frequency.value = targetFreq;
            filter.gain.value = targetGain;
            filter.Q.value = targetQ;
          }
        }
      });
    }
  }

  /**
   * Computes the exact composite frequency response (in dB) of all 5 EQ filters combined.
   */
  public getEQFrequencyResponse(freqs: Float32Array): Float32Array {
    const n = freqs.length;
    const totalDb = new Float32Array(n);
    const magResponse = new Float32Array(n);
    const phaseResponse = new Float32Array(n);

    for (const filter of this.eqFilters) {
      filter.getFrequencyResponse(freqs as any, magResponse, phaseResponse);
      for (let i = 0; i < n; i++) {
        const mag = magResponse[i];
        if (mag > 0.00001) {
          totalDb[i] += 20 * Math.log10(mag);
        }
      }
    }
    return totalDb;
  }

  public getEQFilters(): BiquadFilterNode[] {
    return this.eqFilters;
  }

  public updateCompressor(state: MultibandCompState) {
    const now = this.ctx.currentTime;
    const lowCross = Math.max(60, Math.min(1000, state.lowCrossover || 250));
    const highCross = Math.max(1000, Math.min(12000, state.highCrossover || 4000));

    // Update LR-4 Linkwitz-Riley crossover frequencies
    this.compLowFilter1.frequency.setTargetAtTime(lowCross, now, 0.02);
    this.compLowFilter2.frequency.setTargetAtTime(lowCross, now, 0.02);
    this.compMidHpFilter1.frequency.setTargetAtTime(lowCross, now, 0.02);
    this.compMidHpFilter2.frequency.setTargetAtTime(lowCross, now, 0.02);

    this.compMidLpFilter1.frequency.setTargetAtTime(highCross, now, 0.02);
    this.compMidLpFilter2.frequency.setTargetAtTime(highCross, now, 0.02);
    this.compHighFilter1.frequency.setTargetAtTime(highCross, now, 0.02);
    this.compHighFilter2.frequency.setTargetAtTime(highCross, now, 0.02);

    // Solo Audition Logic: isolate Low, Mid, or High dynamics
    const solo = state.soloBand || 'none';
    const lowActive = solo === 'none' || solo === 'low';
    const midActive = solo === 'none' || solo === 'mid';
    const highActive = solo === 'none' || solo === 'high';

    this.compLowBandGain.gain.setTargetAtTime(lowActive ? 1 : 0, now, 0.02);
    this.compMidBandGain.gain.setTargetAtTime(midActive ? 1 : 0, now, 0.02);
    this.compHighBandGain.gain.setTargetAtTime(highActive ? 1 : 0, now, 0.02);

    // Master Bypass Check: if disabled, set linear 1:1 pass-through with 0dB makeup
    if (!state.enabled) {
      this.compLowNode.threshold.setTargetAtTime(0, now, 0.02);
      this.compLowNode.ratio.setTargetAtTime(1.0, now, 0.02);
      this.compLowMakeup.gain.setTargetAtTime(1.0, now, 0.02);

      this.compMidNode.threshold.setTargetAtTime(0, now, 0.02);
      this.compMidNode.ratio.setTargetAtTime(1.0, now, 0.02);
      this.compMidMakeup.gain.setTargetAtTime(1.0, now, 0.02);

      this.compHighNode.threshold.setTargetAtTime(0, now, 0.02);
      this.compHighNode.ratio.setTargetAtTime(1.0, now, 0.02);
      this.compHighMakeup.gain.setTargetAtTime(1.0, now, 0.02);
      return;
    }

    // Low band dynamics
    if (state.low.bypassed) {
      this.compLowNode.threshold.setTargetAtTime(0, now, 0.02);
      this.compLowNode.ratio.setTargetAtTime(1.0, now, 0.02);
      this.compLowMakeup.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      this.compLowNode.threshold.setTargetAtTime(state.low.threshold, now, 0.02);
      this.compLowNode.ratio.setTargetAtTime(Math.max(1.0, state.low.ratio || 4.0), now, 0.02);
      this.compLowNode.attack.setTargetAtTime(Math.max(0.001, (state.low.attack || 25) / 1000), now, 0.02);
      this.compLowNode.release.setTargetAtTime(Math.max(0.01, (state.low.release || 80) / 1000), now, 0.02);
      this.compLowMakeup.gain.setTargetAtTime(Math.pow(10, (state.low.makeup || 0) / 20), now, 0.02);
    }

    // Mid band dynamics
    if (state.mid.bypassed) {
      this.compMidNode.threshold.setTargetAtTime(0, now, 0.02);
      this.compMidNode.ratio.setTargetAtTime(1.0, now, 0.02);
      this.compMidMakeup.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      this.compMidNode.threshold.setTargetAtTime(state.mid.threshold, now, 0.02);
      this.compMidNode.ratio.setTargetAtTime(Math.max(1.0, state.mid.ratio || 2.5), now, 0.02);
      this.compMidNode.attack.setTargetAtTime(Math.max(0.001, (state.mid.attack || 15) / 1000), now, 0.02);
      this.compMidNode.release.setTargetAtTime(Math.max(0.01, (state.mid.release || 120) / 1000), now, 0.02);
      this.compMidMakeup.gain.setTargetAtTime(Math.pow(10, (state.mid.makeup || 0) / 20), now, 0.02);
    }

    // High band dynamics
    if (state.high.bypassed) {
      this.compHighNode.threshold.setTargetAtTime(0, now, 0.02);
      this.compHighNode.ratio.setTargetAtTime(1.0, now, 0.02);
      this.compHighMakeup.gain.setTargetAtTime(1.0, now, 0.02);
    } else {
      this.compHighNode.threshold.setTargetAtTime(state.high.threshold, now, 0.02);
      this.compHighNode.ratio.setTargetAtTime(Math.max(1.0, state.high.ratio || 3.0), now, 0.02);
      this.compHighNode.attack.setTargetAtTime(Math.max(0.001, (state.high.attack || 8) / 1000), now, 0.02);
      this.compHighNode.release.setTargetAtTime(Math.max(0.01, (state.high.release || 60) / 1000), now, 0.02);
      this.compHighMakeup.gain.setTargetAtTime(Math.pow(10, (state.high.makeup || 0) / 20), now, 0.02);
    }
  }

  public getLiveGainReduction(): { low: number; mid: number; high: number } {
    return {
      low: Math.abs(this.compLowNode.reduction || 0),
      mid: Math.abs(this.compMidNode.reduction || 0),
      high: Math.abs(this.compHighNode.reduction || 0)
    };
  }

  public updateStereoImager(state: StereoImagerState) {
    const now = this.ctx.currentTime;
    if (!state.enabled) {
      this.midGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideLowGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideMidGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideHighGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.stereoizerGain.gain.setTargetAtTime(0.0, now, 0.02);
      this.midToL.gain.setTargetAtTime(1.0, now, 0.02);
      this.midToR.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideToL.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideToR.gain.setTargetAtTime(-1.0, now, 0.02);
      return;
    }

    const bassFreq = Math.max(20, Math.min(400, state.monoBassFreq));
    this.sideLowFilter.frequency.setTargetAtTime(bassFreq, now, 0.02);
    this.sideMidHighpass.frequency.setTargetAtTime(bassFreq, now, 0.02);

    const lowWidth = (state.stereoWidthLow ?? 0) / 100;
    const midWidth = (state.stereoWidthMid ?? 100) / 100;
    const highWidth = (state.stereoWidthHigh ?? 100) / 100;

    this.sideLowGain.gain.setTargetAtTime(lowWidth, now, 0.02);
    this.sideMidGain.gain.setTargetAtTime(midWidth, now, 0.02);
    this.sideHighGain.gain.setTargetAtTime(highWidth, now, 0.02);
    this.midGain.gain.setTargetAtTime(1.0, now, 0.02);

    // Stereoizer Haas decorrelation
    const stereoizerVal = state.stereoize ? ((state.stereoizeAmount ?? 35) / 100) * 0.45 : 0;
    this.stereoizerGain.gain.setTargetAtTime(stereoizerVal, now, 0.02);

    // Audition Solo Modes
    if (state.soloMode === 'mid') {
      this.midToL.gain.setTargetAtTime(1.0, now, 0.02);
      this.midToR.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideToL.gain.setTargetAtTime(0.0, now, 0.02);
      this.sideToR.gain.setTargetAtTime(0.0, now, 0.02);
    } else if (state.soloMode === 'side') {
      this.midToL.gain.setTargetAtTime(0.0, now, 0.02);
      this.midToR.gain.setTargetAtTime(0.0, now, 0.02);
      this.sideToL.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideToR.gain.setTargetAtTime(-1.0, now, 0.02);
    } else {
      this.midToL.gain.setTargetAtTime(1.0, now, 0.02);
      this.midToR.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideToL.gain.setTargetAtTime(1.0, now, 0.02);
      this.sideToR.gain.setTargetAtTime(-1.0, now, 0.02);
    }
  }

  public updateHarmonicExciter(state: HarmonicExciterState) {
    const now = this.ctx.currentTime;
    if (!state.enabled) {
      this.exciterDryGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.exciterWetGain.gain.setTargetAtTime(0.0, now, 0.02);
      return;
    }

    const wet = state.mix / 100;
    const dry = 1.0 - wet * 0.4;
    this.exciterDryGain.gain.setTargetAtTime(dry, now, 0.02);
    this.exciterWetGain.gain.setTargetAtTime(wet, now, 0.02);

    this.exciterToneFilter.gain.setTargetAtTime((state.color - 50) * 0.15, now, 0.02);
    this.updateExciterCurve(state.mode, state.drive);
  }

  private updateExciterCurve(mode: 'warm' | 'analog' | 'tape', drivePercent: number) {
    const n_samples = 4096;
    const curve = new Float32Array(n_samples);
    const drive = Math.max(1.0, (drivePercent / 100) * 4.5);

    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      let y = x;

      if (mode === 'tape') {
        // Tanh soft saturation (rich symmetric odd harmonics)
        y = Math.tanh(x * drive) / Math.tanh(drive);
      } else if (mode === 'warm') {
        // Asymmetric tube triode curve (even harmonics: octave overtone warmth)
        const sign = x < 0 ? -1 : 1;
        const absX = Math.abs(x);
        y = sign * (1 - Math.exp(-absX * drive)) + 0.12 * Math.pow(x, 2) * (drive * 0.2);
      } else if (mode === 'analog') {
        // Polynomial soft clipper (solid-state console transformer saturation)
        const inVal = x * drive;
        if (inVal < -1.5) {
          y = -1;
        } else if (inVal > 1.5) {
          y = 1;
        } else {
          y = (inVal - Math.pow(inVal, 3) / 27);
        }
      }
      curve[i] = Math.max(-1, Math.min(1, y));
    }
    this.exciterWaveshaper.curve = curve;
  }

  public updateSmartLimiter(state: SmartLimiterState) {
    const now = this.ctx.currentTime;
    if (!state.enabled) {
      this.limiterMakeupGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.limiterCeilingGain.gain.setTargetAtTime(1.0, now, 0.02);
      this.limiterNode.threshold.setTargetAtTime(0.0, now, 0.02);
      return;
    }

    // Convert threshold to makeup gain (pushing input into limiter)
    const pushDb = -state.threshold; // e.g. -6 dB threshold means +6 dB push
    const makeupGain = Math.pow(10, pushDb / 20);
    this.limiterMakeupGain.gain.setTargetAtTime(makeupGain, now, 0.02);

    this.limiterNode.threshold.setTargetAtTime(-0.2, now, 0.02);
    this.limiterNode.release.setTargetAtTime(state.release / 1000, now, 0.02);

    const ceilingLinear = Math.pow(10, state.ceiling / 20);
    this.limiterCeilingGain.gain.setTargetAtTime(ceilingLinear, now, 0.02);
  }

  // --- ANALYZER & METERING DATA ---

  public getPreFrequencyData(dataArray: Uint8Array) {
    (this.preAnalyzer.getByteFrequencyData as unknown as (arr: Uint8Array) => void)(dataArray);
  }

  public getPostFrequencyData(dataArray: Uint8Array) {
    (this.postAnalyzer.getByteFrequencyData as unknown as (arr: Uint8Array) => void)(dataArray);
  }

  public getLiveTimeDomainData(left: Float32Array, right: Float32Array) {
    (this.analyzerL.getFloatTimeDomainData as unknown as (arr: Float32Array) => void)(left);
    (this.analyzerR.getFloatTimeDomainData as unknown as (arr: Float32Array) => void)(right);
  }

  public getLiveMetrics(): AudioAnalysisMetrics {
    (this.analyzerL.getFloatTimeDomainData as unknown as (arr: Float32Array) => void)(this.timeDomainBufferL);
    (this.analyzerR.getFloatTimeDomainData as unknown as (arr: Float32Array) => void)(this.timeDomainBufferR);

    let sumL2 = 0;
    let sumR2 = 0;
    let dotLR = 0;
    let peakL = 0;
    let peakR = 0;

    const len = this.timeDomainBufferL.length;
    for (let i = 0; i < len; i++) {
      const l = this.timeDomainBufferL[i];
      const r = this.timeDomainBufferR[i];
      sumL2 += l * l;
      sumR2 += r * r;
      dotLR += l * r;
      const absL = Math.abs(l);
      const absR = Math.abs(r);
      if (absL > peakL) peakL = absL;
      if (absR > peakR) peakR = absR;
    }

    const rmsL = Math.sqrt(sumL2 / len);
    const rmsR = Math.sqrt(sumR2 / len);
    const rmsAvg = Math.max(0.00001, (rmsL + rmsR) * 0.5);
    const rmsDb = 20 * Math.log10(rmsAvg);

    const maxPeak = Math.max(0.00001, Math.max(peakL, peakR));
    const peakDb = 20 * Math.log10(maxPeak);

    // Stereo phase correlation
    const denom = Math.sqrt(sumL2 * sumR2);
    const correlation = denom > 0.0001 ? Math.max(-1, Math.min(1, dotLR / denom)) : 1.0;
    const stereoWidth = Math.max(0, Math.min(1, (1 - correlation) * 0.8 + (Math.abs(rmsL - rmsR) / (rmsAvg + 0.0001)) * 0.2));

    // LUFS estimation (ITU-R BS.1770 K-weighting approximation)
    const lufsShortTerm = Math.max(-60, rmsDb + 3.1);
    const lufsIntegrated = lufsShortTerm * 0.95; // smoothed approximation

    const crestFactor = Math.max(0, peakDb - rmsDb);

    // Spectral distribution
    const freqData = new Uint8Array(512);
    this.postAnalyzer.getByteFrequencyData(freqData);

    const sub = this.getBandAvg(freqData, 1, 4);      // ~20-80 Hz
    const bass = this.getBandAvg(freqData, 4, 15);    // ~80-300 Hz
    const mid = this.getBandAvg(freqData, 15, 140);   // ~300-3000 Hz
    const presence = this.getBandAvg(freqData, 140, 360); // ~3k-8kHz
    const air = this.getBandAvg(freqData, 360, 510);  // ~8k-20kHz

    // Heuristic genre detection based on crest factor, sub-bass ratio, and mid-range balance
    const { detectedGenre, confidence } = this.classifyGenre({
      sub,
      bass,
      mid,
      presence,
      air,
      crestFactor,
      rmsDb,
      stereoWidth
    });

    return {
      rmsDb: Math.max(-60, rmsDb),
      lufsIntegrated: Math.max(-60, lufsIntegrated),
      lufsShortTerm: Math.max(-60, lufsShortTerm),
      peakDb: Math.max(-60, peakDb),
      stereoWidth,
      correlation,
      crestFactor,
      spectralBalance: { sub, bass, mid, presence, air },
      detectedGenre,
      confidence
    };
  }

  private getBandAvg(freqs: Uint8Array, startBin: number, endBin: number): number {
    let sum = 0;
    const count = endBin - startBin;
    if (count <= 0) return 0;
    for (let i = startBin; i < endBin; i++) {
      sum += freqs[i];
    }
    return sum / count / 255; // 0 to 1
  }

  private classifyGenre(data: {
    sub: number;
    bass: number;
    mid: number;
    presence: number;
    air: number;
    crestFactor: number;
    rmsDb: number;
    stereoWidth: number;
  }): { detectedGenre: Genre; confidence: number } {
    // If quiet or silence
    if (data.rmsDb < -45) {
      return { detectedGenre: 'Unknown', confidence: 0 };
    }

    // Heuristic signature scoring
    const scores: Record<Genre, number> = {
      'EDM': 0,
      'Bollywood': 0,
      'Hip-Hop': 0,
      'Deep House': 0,
      'Techno': 0,
      'Unknown': 0
    };

    // EDM: high sub energy, high presence, aggressive compression (lower crest factor ~6-9dB), wide stereo
    if (data.sub > 0.45 && data.air > 0.25) scores['EDM'] += 2.5;
    if (data.crestFactor < 10) scores['EDM'] += 1.5;
    if (data.stereoWidth > 0.3) scores['EDM'] += 1.0;

    // Bollywood: strong mid presence (vocals/tabla ~1.5k-4k), warm bass, high harmonic richness
    if (data.mid > 0.35 && data.presence > 0.3) scores['Bollywood'] += 2.8;
    if (data.bass > 0.4 && data.sub > 0.3) scores['Bollywood'] += 1.2;
    if (data.stereoWidth > 0.35) scores['Bollywood'] += 1.2;

    // Hip-Hop: massive sub (808), scooped lower mids, high crest factor (dynamic snare transient)
    if (data.sub > 0.55 && data.sub > data.mid * 1.3) scores['Hip-Hop'] += 3.0;
    if (data.mid < 0.35) scores['Hip-Hop'] += 1.5;
    if (data.air > 0.2) scores['Hip-Hop'] += 1.0;

    // Deep House: warm bass (80-300Hz), subtle air, gentle crest factor (~10-13dB)
    if (data.bass > data.sub && data.bass > 0.35) scores['Deep House'] += 2.2;
    if (data.mid > 0.25 && data.mid < 0.45) scores['Deep House'] += 1.4;

    // Techno: heavy low-end rumble, piercing hats, fast relentless pulse
    if (data.sub > 0.4 && data.presence > 0.35 && data.crestFactor < 8.5) scores['Techno'] += 2.6;

    let bestGenre: Genre = 'EDM';
    let maxScore = -1;
    (Object.keys(scores) as Genre[]).forEach(g => {
      if (g !== 'Unknown' && scores[g] > maxScore) {
        maxScore = scores[g];
        bestGenre = g;
      }
    });

    const confidence = Math.min(0.96, Math.max(0.45, maxScore / 5.5));
    return { detectedGenre: bestGenre, confidence };
  }
}
