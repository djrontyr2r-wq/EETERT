import { MasteringPreset } from '../types';

export const MASTERING_PRESETS: MasteringPreset[] = [
  {
    id: 'edm-anthem',
    name: 'EDM Peak Time Anthem',
    genre: 'EDM',
    description: 'High-energy club master with tight sub-bass punch, bright synth presence, and aggressive sidechain-style multiband control.',
    eq: [
      { id: 'sub', name: 'Sub Low', type: 'lowshelf', freq: 45, gain: 2.8, q: 0.7, enabled: true },
      { id: 'mud', name: 'Low-Mid Cut', type: 'peaking', freq: 280, gain: -2.2, q: 1.6, enabled: true },
      { id: 'mid', name: 'Synth Punch', type: 'peaking', freq: 1200, gain: 1.0, q: 1.2, enabled: true },
      { id: 'pres', name: 'Presence', type: 'peaking', freq: 4500, gain: 2.4, q: 1.4, enabled: true },
      { id: 'air', name: 'Air Shimmer', type: 'highshelf', freq: 11500, gain: 3.2, q: 0.8, enabled: true }
    ],
    comp: {
      lowCrossover: 220,
      highCrossover: 4500,
      enabled: true,
      low: { threshold: -18, ratio: 4.0, attack: 25, release: 80, makeup: 2.5 },
      mid: { threshold: -14, ratio: 2.5, attack: 15, release: 120, makeup: 1.5 },
      high: { threshold: -16, ratio: 3.0, attack: 8, release: 60, makeup: 2.0 }
    },
    imager: {
      monoBassFreq: 130,
      stereoWidthLow: 0,
      stereoWidthMid: 110,
      stereoWidthHigh: 145,
      enabled: true
    },
    exciter: {
      mode: 'tape',
      drive: 42,
      color: 65,
      mix: 40,
      enabled: true
    },
    limiter: {
      ceiling: -0.2,
      threshold: -6.5,
      release: 60,
      targetLufs: -7.0,
      lookahead: 2.5,
      enabled: true
    }
  },
  {
    id: 'bollywood-remix',
    name: 'Bollywood Club Remix',
    genre: 'Bollywood',
    description: 'Tuned for modern Indian club hits: prominent dhol/bass impact, crystal vocal articulation, wide strings, and rich tape warmth.',
    eq: [
      { id: 'sub', name: 'Dhol Sub', type: 'lowshelf', freq: 55, gain: 2.2, q: 0.8, enabled: true },
      { id: 'mud', name: 'Boxiness Cut', type: 'peaking', freq: 350, gain: -2.8, q: 1.8, enabled: true },
      { id: 'mid', name: 'Vocal Forward', type: 'peaking', freq: 2400, gain: 2.6, q: 1.5, enabled: true },
      { id: 'pres', name: 'Tabla Snap', type: 'peaking', freq: 6200, gain: 2.0, q: 1.3, enabled: true },
      { id: 'air', name: 'Bollywood Sheen', type: 'highshelf', freq: 12000, gain: 2.8, q: 0.7, enabled: true }
    ],
    comp: {
      lowCrossover: 240,
      highCrossover: 3800,
      enabled: true,
      low: { threshold: -16, ratio: 3.5, attack: 30, release: 90, makeup: 2.0 },
      mid: { threshold: -12, ratio: 2.0, attack: 18, release: 140, makeup: 1.2 },
      high: { threshold: -15, ratio: 2.8, attack: 10, release: 80, makeup: 1.8 }
    },
    imager: {
      monoBassFreq: 140,
      stereoWidthLow: 0,
      stereoWidthMid: 115,
      stereoWidthHigh: 155,
      enabled: true
    },
    exciter: {
      mode: 'warm',
      drive: 48,
      color: 55,
      mix: 45,
      enabled: true
    },
    limiter: {
      ceiling: -0.3,
      threshold: -5.8,
      release: 75,
      targetLufs: -7.5,
      lookahead: 2.0,
      enabled: true
    }
  },
  {
    id: 'hip-hop-808',
    name: 'Hip-Hop 808 Slam',
    genre: 'Hip-Hop',
    description: 'Deep heavy 808 foundation, clean scooped lower-mids to leave space for vocals, crisp hi-hat air, and hard-hitting transient punch.',
    eq: [
      { id: 'sub', name: '808 Weight', type: 'lowshelf', freq: 40, gain: 3.5, q: 0.7, enabled: true },
      { id: 'mud', name: 'Low Mud Cut', type: 'peaking', freq: 240, gain: -3.0, q: 1.5, enabled: true },
      { id: 'mid', name: 'Snare Crack', type: 'peaking', freq: 1800, gain: 1.5, q: 1.4, enabled: true },
      { id: 'pres', name: 'Hat Sizzle', type: 'peaking', freq: 8000, gain: 2.4, q: 1.2, enabled: true },
      { id: 'air', name: 'Ultra Air', type: 'highshelf', freq: 13500, gain: 2.2, q: 0.8, enabled: true }
    ],
    comp: {
      lowCrossover: 200,
      highCrossover: 3500,
      enabled: true,
      low: { threshold: -20, ratio: 4.5, attack: 35, release: 70, makeup: 3.0 },
      mid: { threshold: -15, ratio: 2.2, attack: 12, release: 100, makeup: 1.4 },
      high: { threshold: -14, ratio: 2.5, attack: 5, release: 50, makeup: 1.6 }
    },
    imager: {
      monoBassFreq: 150,
      stereoWidthLow: 0,
      stereoWidthMid: 105,
      stereoWidthHigh: 135,
      enabled: true
    },
    exciter: {
      mode: 'analog',
      drive: 50,
      color: 70,
      mix: 38,
      enabled: true
    },
    limiter: {
      ceiling: -0.1,
      threshold: -6.0,
      release: 50,
      targetLufs: -8.0,
      lookahead: 3.0,
      enabled: true
    }
  },
  {
    id: 'deep-house-groove',
    name: 'Deep House Warmth',
    genre: 'Deep House',
    description: 'Smooth analog roundness, velvety top end, tight mono kick & sub bass with wide lush Rhodes and pad diffusion.',
    eq: [
      { id: 'sub', name: 'Warm Sub', type: 'lowshelf', freq: 50, gain: 2.0, q: 0.8, enabled: true },
      { id: 'mud', name: 'Warm Mid', type: 'peaking', freq: 400, gain: -1.0, q: 1.0, enabled: true },
      { id: 'mid', name: 'Groove Body', type: 'peaking', freq: 1500, gain: 0.8, q: 1.0, enabled: true },
      { id: 'pres', name: 'Percussion', type: 'peaking', freq: 5500, gain: 1.8, q: 1.2, enabled: true },
      { id: 'air', name: 'Velvet Top', type: 'highshelf', freq: 10500, gain: 2.0, q: 0.7, enabled: true }
    ],
    comp: {
      lowCrossover: 220,
      highCrossover: 3200,
      enabled: true,
      low: { threshold: -15, ratio: 2.8, attack: 40, release: 110, makeup: 1.8 },
      mid: { threshold: -12, ratio: 1.8, attack: 25, release: 160, makeup: 1.0 },
      high: { threshold: -13, ratio: 2.0, attack: 15, release: 120, makeup: 1.2 }
    },
    imager: {
      monoBassFreq: 120,
      stereoWidthLow: 0,
      stereoWidthMid: 120,
      stereoWidthHigh: 160,
      enabled: true
    },
    exciter: {
      mode: 'warm',
      drive: 35,
      color: 45,
      mix: 50,
      enabled: true
    },
    limiter: {
      ceiling: -0.5,
      threshold: -4.5,
      release: 100,
      targetLufs: -9.5,
      lookahead: 2.0,
      enabled: true
    }
  },
  {
    id: 'techno-warehouse',
    name: 'Techno Warehouse Peak',
    genre: 'Techno',
    description: 'Industrial rolling rumble, razor-sharp transient precision, aggressive saturation, and focused club power.',
    eq: [
      { id: 'sub', name: 'Rumble Sub', type: 'lowshelf', freq: 42, gain: 3.2, q: 0.8, enabled: true },
      { id: 'mud', name: 'Rumble Control', type: 'peaking', freq: 200, gain: -1.8, q: 2.0, enabled: true },
      { id: 'mid', name: 'Clap Attack', type: 'peaking', freq: 2000, gain: 1.8, q: 1.5, enabled: true },
      { id: 'pres', name: 'Hats Edge', type: 'peaking', freq: 7000, gain: 2.5, q: 1.4, enabled: true },
      { id: 'air', name: 'Industrial Air', type: 'highshelf', freq: 11000, gain: 2.6, q: 0.8, enabled: true }
    ],
    comp: {
      lowCrossover: 180,
      highCrossover: 4000,
      enabled: true,
      low: { threshold: -18, ratio: 4.2, attack: 20, release: 75, makeup: 2.8 },
      mid: { threshold: -14, ratio: 2.6, attack: 10, release: 90, makeup: 1.6 },
      high: { threshold: -16, ratio: 3.2, attack: 6, release: 50, makeup: 2.0 }
    },
    imager: {
      monoBassFreq: 135,
      stereoWidthLow: 0,
      stereoWidthMid: 105,
      stereoWidthHigh: 140,
      enabled: true
    },
    exciter: {
      mode: 'tape',
      drive: 45,
      color: 60,
      mix: 42,
      enabled: true
    },
    limiter: {
      ceiling: -0.1,
      threshold: -7.0,
      release: 45,
      targetLufs: -7.0,
      lookahead: 2.5,
      enabled: true
    }
  }
];
