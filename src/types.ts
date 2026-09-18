export type TrackGenre = 'EDM' | 'Bollywood' | 'Hip-Hop' | 'Deep House' | 'Techno';
export type Genre = TrackGenre | 'Unknown';

export type MasteringMode = 'club' | 'streaming' | 'clean';

export type ExciterMode = 'warm' | 'analog' | 'tape';

export type EQFilterType = 'lowshelf' | 'peaking' | 'highshelf' | 'highpass' | 'lowpass' | 'notch';

export interface EQBand {
  id: string;
  name: string;
  type: EQFilterType;
  freq: number;    // Hz
  gain: number;    // dB (-15 to +15)
  q: number;       // 0.2 to 12
  enabled: boolean;
  solo?: boolean;
}

export interface CompressorBand {
  threshold: number; // dB (-40 to 0)
  ratio: number;     // 1 to 20
  attack: number;    // ms (1 to 100)
  release: number;   // ms (20 to 1000)
  makeup: number;    // dB (0 to 12)
  gainReduction: number; // live dB
  bypassed?: boolean;
}

export interface MultibandCompState {
  lowCrossover: number;  // Hz (default 250)
  highCrossover: number; // Hz (default 4000)
  low: CompressorBand;
  mid: CompressorBand;
  high: CompressorBand;
  enabled: boolean;
  soloBand?: 'none' | 'low' | 'mid' | 'high';
}

export interface StereoImagerState {
  monoBassFreq: number; // Hz (e.g. 140Hz mono cutoff)
  stereoWidthLow: number;  // % (0-100%, usually 0-20% for mono)
  stereoWidthMid: number;  // % (50-150%)
  stereoWidthHigh: number; // % (80-200%)
  enabled: boolean;
  stereoize?: boolean;      // Haas spatial decorrelator for mono/narrow tracks
  stereoizeAmount?: number; // 0 to 100%
  soloMode?: 'none' | 'mid' | 'side'; // Solo Mid or Solo Side audition
}

export interface HarmonicExciterState {
  mode: ExciterMode;
  drive: number;     // 0 to 100%
  color: number;     // warm/bright tilt (0 to 100%)
  mix: number;       // dry/wet (0 to 100%)
  enabled: boolean;
}

export interface SmartLimiterState {
  ceiling: number;    // dBFS (-0.1 to -2.0)
  threshold: number;  // dB (-12 to 0)
  release: number;    // ms (10 to 500)
  targetLufs: number; // -7, -9, -12 etc.
  lookahead: number;  // ms (1 to 5)
  enabled: boolean;
}

export interface AudioAnalysisMetrics {
  rmsDb: number;
  lufsIntegrated: number;
  lufsShortTerm: number;
  peakDb: number;
  stereoWidth: number; // 0 (mono) to 1 (full wide)
  correlation: number; // -1 to +1
  crestFactor: number; // dynamic range dB
  spectralBalance: {
    sub: number;       // 20-80Hz
    bass: number;      // 80-300Hz
    mid: number;       // 300-3000Hz
    presence: number;  // 3k-8kHz
    air: number;       // 8k-20kHz
  };
  detectedGenre: Genre;
  confidence: number;  // 0 to 1
}

export interface MasteringPreset {
  id: string;
  name: string;
  genre: Genre;
  description: string;
  eq: EQBand[];
  comp: Omit<MultibandCompState, 'low' | 'mid' | 'high'> & {
    low: Omit<CompressorBand, 'gainReduction'>;
    mid: Omit<CompressorBand, 'gainReduction'>;
    high: Omit<CompressorBand, 'gainReduction'>;
  };
  imager: StereoImagerState;
  exciter: HarmonicExciterState;
  limiter: SmartLimiterState;
}

export interface JuceSourceFile {
  filename: string;
  path: string;
  category: 'core' | 'dsp' | 'gui' | 'config';
  description: string;
  content: string;
}
