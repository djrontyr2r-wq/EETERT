import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  EQBand,
  MultibandCompState,
  StereoImagerState,
  HarmonicExciterState,
  SmartLimiterState,
  AudioAnalysisMetrics,
  MasteringMode,
  Genre,
  TrackGenre,
  ExciterMode
} from './types';
import { MASTERING_PRESETS } from './data/presets';
import { MasteringDSPEngine } from './audio/dspEngine';
import { DemoTrackEngine } from './audio/audioGenerator';
import { computeAIMastering, requestAIMastering, AIMasteringResult } from './audio/aiMastering';
import { Knob } from './components/Knob';
import { SpectrumAnalyzer } from './components/SpectrumAnalyzer';
import { GainReductionMeter } from './components/GainReductionMeter';
import { MasterMeter } from './components/MasterMeter';
import { StereoVectorscope } from './components/StereoVectorscope';
import { JuceCodeViewer } from './components/JuceCodeViewer';
import { AIMasteringModal } from './components/AIMasteringModal';
import { AudioExportModal } from './components/AudioExportModal';
import { R2RLogo } from './components/R2RLogo';
import { R2RLogoModal } from './components/R2RLogoModal';
import {
  Play,
  Square,
  Sparkles,
  Code,
  Upload,
  Download,
  RotateCcw,
  Sliders,
  VolumeX,
  Volume2,
  Headphones,
  FileAudio,
  Power,
  Activity,
  Filter,
  Eye
} from 'lucide-react';

export default function App() {
  // Audio DSP & Demo Engines
  const dspEngineRef = useRef<MasteringDSPEngine | null>(null);
  const demoEngineRef = useRef<DemoTrackEngine | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Playing state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeDemoGenre, setActiveDemoGenre] = useState<TrackGenre>('EDM');
  const [isBypassed, setIsBypassed] = useState<boolean>(false);
  const [audioSource, setAudioSource] = useState<'demo' | 'uploaded'>('demo');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedAudioBuffer, setUploadedAudioBuffer] = useState<AudioBuffer | null>(null);
  const uploadedSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  // AI, Export & Mode State
  const [masteringMode, setMasteringMode] = useState<MasteringMode>('club');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('edm-anthem');
  const [isJuceModalOpen, setIsJuceModalOpen] = useState<boolean>(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AIMasteringResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiToastMessage, setAiToastMessage] = useState<string | null>(null);

  // Active DSP Parameters (Initialized from default preset)
  const defaultPreset = MASTERING_PRESETS[0];
  const [eqBands, setEqBands] = useState<EQBand[]>(defaultPreset.eq);
  const [selectedBandIdx, setSelectedBandIdx] = useState<number>(0);
  const [eqViewMode, setEqViewMode] = useState<'all' | 'detail'>('all');
  const [isEqMasterActive, setIsEqMasterActive] = useState<boolean>(true);
  const soloedBandIndex = eqBands.findIndex(b => Boolean(b.solo));

  const [compViewTab, setCompViewTab] = useState<'overview' | 'advanced'>('overview');
  const [compState, setCompState] = useState<MultibandCompState>({
    ...defaultPreset.comp,
    low: { ...defaultPreset.comp.low, gainReduction: 0, bypassed: false },
    mid: { ...defaultPreset.comp.mid, gainReduction: 0, bypassed: false },
    high: { ...defaultPreset.comp.high, gainReduction: 0, bypassed: false },
    soloBand: 'none'
  });
  const [imagerState, setImagerState] = useState<StereoImagerState>(defaultPreset.imager);
  const [exciterState, setExciterState] = useState<HarmonicExciterState>(defaultPreset.exciter);
  const [limiterState, setLimiterState] = useState<SmartLimiterState>(defaultPreset.limiter);

  // Real-time analysis metrics
  const [metrics, setMetrics] = useState<AudioAnalysisMetrics>({
    rmsDb: -60,
    lufsIntegrated: -60,
    lufsShortTerm: -60,
    peakDb: -60,
    stereoWidth: 0.5,
    correlation: 0.95,
    crestFactor: 12,
    spectralBalance: { sub: 0, bass: 0, mid: 0, presence: 0, air: 0 },
    detectedGenre: 'EDM',
    confidence: 0.8
  });

  const [gainReduction, setGainReduction] = useState({ low: 0, mid: 0, high: 0 });

  // Initialize Web Audio DSP Engine
  useEffect(() => {
    if (!dspEngineRef.current) {
      const dsp = new MasteringDSPEngine();
      dspEngineRef.current = dsp;

      const demo = new DemoTrackEngine(dsp.ctx, dsp.getInputNode());
      demoEngineRef.current = demo;

      // Initial DSP sync
      dsp.updateEQ(eqBands);
      dsp.updateCompressor(compState);
      dsp.updateStereoImager(imagerState);
      dsp.updateHarmonicExciter(exciterState);
      dsp.updateSmartLimiter(limiterState);
    }

    // Metering animation loop
    let animId: number;
    const updateMetrics = () => {
      if (dspEngineRef.current) {
        const liveMetrics = dspEngineRef.current.getLiveMetrics();
        setMetrics(liveMetrics);
        const liveGR = dspEngineRef.current.getLiveGainReduction();
        setGainReduction(liveGR);
      }
      animId = requestAnimationFrame(updateMetrics);
    };
    animId = requestAnimationFrame(updateMetrics);

    return () => {
      cancelAnimationFrame(animId);
      if (demoEngineRef.current) {
        demoEngineRef.current.stop();
      }
    };
  }, []);

  // Update DSP on parameter changes
  useEffect(() => {
    if (!dspEngineRef.current) return;
    const hasSolo = eqBands.some(b => Boolean(b.solo));
    if (isEqMasterActive || hasSolo) {
      dspEngineRef.current.updateEQ(eqBands);
    } else {
      dspEngineRef.current.updateEQ(eqBands.map(b => ({ ...b, enabled: false })));
    }
  }, [eqBands, isEqMasterActive]);

  // Direct band mutation callback for knobs, spectrum dragging, and detail inputs
  const handleUpdateBand = useCallback((idx: number, patch: Partial<EQBand>) => {
    setEqBands(prev => {
      const next = [...prev];
      if (!next[idx]) return prev;
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  // Solo toggle callback - isolates the selected band for steep 4th-order audition
  const handleToggleBandSolo = useCallback((idx: number) => {
    setEqBands(prev => {
      const isCurrentlySolo = Boolean(prev[idx]?.solo);
      const willSolo = !isCurrentlySolo;
      if (willSolo) {
        setIsEqMasterActive(true);
      }
      return prev.map((b, i) => ({
        ...b,
        solo: i === idx ? willSolo : false
      }));
    });
  }, []);

  // Reset EQ to flat 0 dB response
  const handleResetEQ = useCallback(() => {
    setEqBands([
      { id: 'sub', name: 'Sub Low', type: 'lowshelf', freq: 45, gain: 0, q: 0.7, enabled: true, solo: false },
      { id: 'mud', name: 'Low-Mid', type: 'peaking', freq: 280, gain: 0, q: 1.6, enabled: true, solo: false },
      { id: 'mid', name: 'Mid', type: 'peaking', freq: 1200, gain: 0, q: 1.2, enabled: true, solo: false },
      { id: 'pres', name: 'Presence', type: 'peaking', freq: 4500, gain: 0, q: 1.4, enabled: true, solo: false },
      { id: 'air', name: 'Air High', type: 'highshelf', freq: 11500, gain: 0, q: 0.8, enabled: true, solo: false }
    ]);
  }, []);

  useEffect(() => {
    dspEngineRef.current?.updateCompressor(compState);
  }, [compState]);

  useEffect(() => {
    dspEngineRef.current?.updateStereoImager(imagerState);
  }, [imagerState]);

  useEffect(() => {
    dspEngineRef.current?.updateHarmonicExciter(exciterState);
  }, [exciterState]);

  useEffect(() => {
    dspEngineRef.current?.updateSmartLimiter(limiterState);
  }, [limiterState]);

  useEffect(() => {
    dspEngineRef.current?.setBypass(isBypassed);
  }, [isBypassed]);

  // Audio Play / Stop handlers
  const handleTogglePlay = () => {
    dspEngineRef.current?.resumeContext();
    if (!isPlaying) {
      if (audioSource === 'demo' && demoEngineRef.current) {
        demoEngineRef.current.setGenre(activeDemoGenre);
        demoEngineRef.current.start();
      } else if (audioSource === 'uploaded' && uploadedAudioBuffer && dspEngineRef.current) {
        if (uploadedSourceNodeRef.current) {
          try { uploadedSourceNodeRef.current.stop(); } catch { /* ignore */ }
        }
        const sourceNode = dspEngineRef.current.ctx.createBufferSource();
        sourceNode.buffer = uploadedAudioBuffer;
        sourceNode.loop = true;
        sourceNode.connect(dspEngineRef.current.getInputNode());
        sourceNode.start(0);
        uploadedSourceNodeRef.current = sourceNode;
      }
      setIsPlaying(true);
    } else {
      demoEngineRef.current?.stop();
      if (uploadedSourceNodeRef.current) {
        try { uploadedSourceNodeRef.current.stop(); } catch { /* ignore */ }
        uploadedSourceNodeRef.current = null;
      }
      setIsPlaying(false);
    }
  };

  const handleChangeDemoGenre = (genre: TrackGenre) => {
    setActiveDemoGenre(genre);
    setAudioSource('demo');
    if (uploadedSourceNodeRef.current) {
      try { uploadedSourceNodeRef.current.stop(); } catch { /* ignore */ }
      uploadedSourceNodeRef.current = null;
    }
    if (demoEngineRef.current) {
      demoEngineRef.current.setGenre(genre);
      if (isPlaying) {
        demoEngineRef.current.stop();
        demoEngineRef.current.start();
      }
    }
  };

  // Upload custom audio file
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dspEngineRef.current) return;

    dspEngineRef.current.resumeContext();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await dspEngineRef.current.ctx.decodeAudioData(arrayBuffer);

    // Stop demo track if running
    demoEngineRef.current?.stop();
    if (uploadedSourceNodeRef.current) {
      try { uploadedSourceNodeRef.current.stop(); } catch { /* ignore */ }
      uploadedSourceNodeRef.current = null;
    }

    setUploadedAudioBuffer(audioBuffer);
    setUploadedFileName(file.name);
    setAudioSource('uploaded');

    // Play uploaded file in loop
    const sourceNode = dspEngineRef.current.ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;
    sourceNode.loop = true;
    sourceNode.connect(dspEngineRef.current.getInputNode());
    sourceNode.start(0);
    uploadedSourceNodeRef.current = sourceNode;

    setIsPlaying(true);
  };

  // Load Preset
  const handleLoadPreset = (presetId: string) => {
    const preset = MASTERING_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setSelectedPresetId(presetId);
    setEqBands(preset.eq);
    setCompState({
      ...preset.comp,
      low: { ...preset.comp.low, gainReduction: 0 },
      mid: { ...preset.comp.mid, gainReduction: 0 },
      high: { ...preset.comp.high, gainReduction: 0 }
    });
    setImagerState(preset.imager);
    setExciterState(preset.exciter);
    setLimiterState(preset.limiter);
  };

  // Master AI Assistant Trigger - queries Gemini or intelligent DSP engine
  const handleTriggerAutoMaster = async () => {
    dspEngineRef.current?.resumeContext();
    setIsAiLoading(true);
    setIsAIModalOpen(true);

    try {
      const res = await requestAIMastering(metrics, masteringMode, {
        forcedGenre: activeDemoGenre,
        audioBuffer: uploadedAudioBuffer,
        audioSource,
        fileName: uploadedFileName || activeDemoGenre
      });
      setAiResult(res);
    } catch (err) {
      console.warn('AI Mastering error, using DSP fallback:', err);
      const fallback = computeAIMastering(metrics, masteringMode, activeDemoGenre);
      setAiResult(fallback);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Instant 1-Click Auto Master without waiting in modal
  const handleInstantAutoMaster = async () => {
    dspEngineRef.current?.resumeContext();
    setIsAiLoading(true);
    try {
      const res = await requestAIMastering(metrics, masteringMode, {
        forcedGenre: activeDemoGenre,
        audioBuffer: uploadedAudioBuffer,
        audioSource,
        fileName: uploadedFileName || activeDemoGenre
      });
      setAiResult(res);
      handleApplyAIResult(res);
    } catch (err) {
      const fallback = computeAIMastering(metrics, masteringMode, activeDemoGenre);
      setAiResult(fallback);
      handleApplyAIResult(fallback);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Apply AI Mastering result to DSP chain
  const handleApplyAIResult = (resultToApply?: AIMasteringResult) => {
    const res = resultToApply || aiResult;
    if (!res) return;

    setEqBands(res.eq.map(b => ({ ...b, solo: false })));
    setCompState({
      ...res.comp,
      soloBand: 'none',
      enabled: true
    });
    setImagerState({ ...res.imager, enabled: true });
    setExciterState({ ...res.exciter, enabled: true });
    setLimiterState({ ...res.limiter, enabled: true });

    // Always engage master EQ and turn off bypass so the user immediately hears the master!
    setIsEqMasterActive(true);
    setIsBypassed(false);

    // If audio is not currently playing, start playback with the new master active
    if (!isPlaying) {
      if (audioSource === 'demo' && demoEngineRef.current) {
        demoEngineRef.current.setGenre(activeDemoGenre);
        demoEngineRef.current.start();
        setIsPlaying(true);
      } else if (audioSource === 'uploaded' && uploadedAudioBuffer && dspEngineRef.current) {
        if (uploadedSourceNodeRef.current) {
          try { uploadedSourceNodeRef.current.stop(); } catch { /* ignore */ }
        }
        const sourceNode = dspEngineRef.current.ctx.createBufferSource();
        sourceNode.buffer = uploadedAudioBuffer;
        sourceNode.loop = true;
        sourceNode.connect(dspEngineRef.current.getInputNode());
        sourceNode.start(0);
        uploadedSourceNodeRef.current = sourceNode;
        setIsPlaying(true);
      }
    }

    // Prominent toast notification confirming active mastering parameters
    const engineLabel = res.isGeminiAi ? 'Gemini 3.8 Flash Neural Master' : 'DSP Intelligence Engine';
    setAiToastMessage(`✦ MASTER ENGAGED (${engineLabel}): Target ${res.targetLufs} LUFS • ${res.detectedGenre} EQ, Dynamics, & Limiter Active`);
    setTimeout(() => {
      setAiToastMessage(null);
    }, 4500);
  };

  // Safe Analyzer accessors for Spectrum Component
  const handleGetPreData = useCallback((arr: Uint8Array) => {
    dspEngineRef.current?.getPreFrequencyData(arr);
  }, []);

  const handleGetPostData = useCallback((arr: Uint8Array) => {
    dspEngineRef.current?.getPostFrequencyData(arr);
  }, []);

  return (
    <div className="min-h-screen bg-[#07080d] text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. TOP HARDWARE RACK HEADER */}
      <header className="border-b border-slate-800/80 bg-[#0c0e18] px-4 py-3 shadow-xl">
        <div className="max-w-[1550px] mx-auto flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo & Branding */}
          <div className="flex items-center gap-3.5">
            <button
              id="btn-open-logo-modal"
              onClick={() => setIsLogoModalOpen(true)}
              className="relative group p-1.5 rounded-xl bg-gradient-to-b from-[#181c2e] via-[#101322] to-[#07080f] border border-red-500/30 hover:border-red-500/70 shadow-[0_0_20px_rgba(238,0,24,0.2)] hover:shadow-[0_0_30px_rgba(238,0,24,0.45)] transition-all flex items-center justify-center cursor-pointer transform hover:scale-[1.03] active:scale-[0.98]"
              title="R2R MUSIC - Official Audio Mastering Brand Logo (Click for HD Specs & Assets)"
            >
              <R2RLogo size="md" showGlow animated />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-display font-bold tracking-wider text-white flex items-center gap-1.5">
                  <span>R2R</span>
                  <span className="text-red-500 font-black tracking-wide">MUSIC</span>
                  <span className="text-slate-300 font-medium">MASTERING SUITE</span>
                </h1>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  VST3 / AU
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  JUCE C++20
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400">
                Official R2R Studio Edition • 5-Band Dynamic EQ • Multiband Dynamics • Stereo Imager • Smart Limiter
              </p>
            </div>
          </div>

          {/* Master Transport & Audio Source */}
          <div className="flex items-center gap-3 bg-[#080910] p-1.5 rounded-xl border border-slate-800">
            {/* Play/Stop Button */}
            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-display font-bold tracking-wider transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:brightness-110'
              }`}
            >
              {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {isPlaying ? 'STOP DSP' : 'START DSP ENGINE'}
            </button>

            {/* Demo Genre Selector */}
            <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
              <span className="text-[10px] font-mono text-slate-400 px-1">TRACK:</span>
              {(['EDM', 'Bollywood', 'Hip-Hop', 'Deep House', 'Techno'] as TrackGenre[]).map(g => (
                <button
                  key={g}
                  onClick={() => handleChangeDemoGenre(g)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-display font-bold transition-all cursor-pointer ${
                    audioSource === 'demo' && activeDemoGenre === g
                      ? 'bg-purple-600 text-white shadow-[0_0_8px_#a855f7]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Custom Audio File Upload */}
            <div className="border-l border-slate-800 pl-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer ${
                  audioSource === 'uploaded'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Upload custom WAV/MP3 track"
              >
                <Upload className="w-3 h-3" />
                {audioSource === 'uploaded' ? uploadedFileName.slice(0, 12) + '...' : 'UPLOAD AUDIO'}
              </button>
            </div>
          </div>

          {/* Master AI Assistant Button & Mode Switch */}
          <div className="flex items-center gap-2.5">
            {/* Mastering Modes */}
            <div className="flex items-center p-1 rounded-lg bg-[#080910] border border-slate-800">
              {(['club', 'streaming', 'clean'] as MasteringMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setMasteringMode(mode)}
                  className={`px-2.5 py-1 rounded text-[10px] font-display uppercase font-bold tracking-wider transition-all cursor-pointer ${
                    masteringMode === mode
                      ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode} {mode === 'club' ? '(-7 LUFS)' : mode === 'streaming' ? '(-12 LUFS)' : '(-9 LUFS)'}
                </button>
              ))}
            </div>

            {/* MASTER AI BUTTON GROUP */}
            <div className="flex items-center rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 p-[1px] shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <button
                id="btn-auto-master"
                onClick={handleTriggerAutoMaster}
                disabled={isAiLoading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-l-xl bg-[#0e101c] hover:bg-[#15192c] text-white text-xs font-display font-bold tracking-wider transition-all cursor-pointer"
                title="Open AI Mastering Assistant to inspect analysis, prompt Gemini, and fine-tune"
              >
                <Sparkles className={`w-4 h-4 text-cyan-200 ${isAiLoading ? 'animate-spin' : ''}`} />
                {isAiLoading ? 'ANALYZING...' : 'AUTO MASTER (AI)'}
              </button>
              <button
                id="btn-instant-auto-master"
                onClick={handleInstantAutoMaster}
                disabled={isAiLoading}
                className="px-2.5 py-2 rounded-r-xl bg-gradient-to-r from-purple-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-[10px] font-mono font-bold tracking-wider transition-all cursor-pointer border-l border-white/20"
                title="Instant 1-Click Auto Master: Immediately analyze, engage EQ/Compressor/Limiter, and play"
              >
                1-CLICK
              </button>
            </div>

            {/* Preset Selector */}
            <select
              value={selectedPresetId}
              onChange={e => handleLoadPreset(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#0f111c] border border-slate-700/80 text-xs font-mono text-cyan-300 font-medium focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              {MASTERING_PRESETS.map(p => (
                <option key={p.id} value={p.id}>
                  PRESET: {p.name}
                </option>
              ))}
            </select>

            {/* Bypass A/B Toggle */}
            <button
              onClick={() => setIsBypassed(!isBypassed)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                isBypassed
                  ? 'bg-amber-500 text-black shadow-[0_0_10px_#f59e0b]'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isBypassed ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {isBypassed ? 'BYPASSED (DRY)' : 'DSP ACTIVE'}
            </button>

            {/* EXPORT MASTERED AUDIO / WAV TRIGGER */}
            <button
              id="btn-export-audio"
              onClick={() => setIsExportModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-display font-bold tracking-wider shadow-[0_0_18px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98]"
              title="Render DSP chain and download mastered track as WAV file"
            >
              <Download className="w-4 h-4 text-emerald-200" />
              EXPORT WAV
            </button>

            {/* JUCE C++ Code Export Modal Trigger */}
            <button
              id="btn-export-juce"
              onClick={() => setIsJuceModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-display font-bold tracking-wider transition-all cursor-pointer"
            >
              <Code className="w-4 h-4" />
              JUCE C++ EXPORT
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN HARDWARE CONSOLE BODY */}
      <main className="flex-1 max-w-[1550px] w-full mx-auto p-4 space-y-4">

        {/* Floating AI Toast Banner */}
        {aiToastMessage && (
          <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-950/90 via-slate-900/90 to-cyan-950/90 border border-cyan-400/50 text-cyan-200 text-xs font-mono shadow-[0_0_25px_rgba(6,182,212,0.4)] animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
              <span className="font-bold tracking-wide text-white">{aiToastMessage}</span>
            </div>
            <button
              onClick={() => setAiToastMessage(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-0.5 rounded bg-slate-800/80 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        
        {/* TOP VISUALIZER RACK: Real-Time Spectrum Analyzer + Dynamic Meters */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          
          {/* Real-Time FFT Spectrum Analyzer (7 cols) */}
          <div className="lg:col-span-7">
            <SpectrumAnalyzer
              getPreData={handleGetPreData}
              getPostData={handleGetPostData}
              eqBands={isEqMasterActive ? eqBands : eqBands.map(b => ({ ...b, enabled: false }))}
              isPlaying={isPlaying}
              className="h-[210px]"
              onUpdateBand={handleUpdateBand}
              activeBandIndex={selectedBandIdx}
              onSelectBand={idx => setSelectedBandIdx(idx)}
              getEQResponse={freqs => dspEngineRef.current?.getEQFrequencyResponse(freqs) || new Float32Array(freqs.length)}
            />
          </div>

          {/* Gain Reduction Multiband Meters (2 cols) */}
          <div className="lg:col-span-2">
            <GainReductionMeter
              lowGR={gainReduction.low}
              midGR={gainReduction.mid}
              highGR={gainReduction.high}
            />
          </div>

          {/* Goniometer / Vectorscope (1.5 cols) */}
          <div className="lg:col-span-1.5">
            <StereoVectorscope
              isPlaying={isPlaying}
              stereoWidth={metrics.stereoWidth}
              correlation={metrics.correlation}
            />
          </div>

          {/* Master Peak & LUFS Meter (1.5 cols) */}
          <div className="lg:col-span-1.5">
            <MasterMeter
              metrics={metrics}
              targetLufs={limiterState.targetLufs}
            />
          </div>
        </div>

        {/* BOTTOM DSP MODULES RACKS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* MODULE 1: 5-BAND PARAMETRIC EQ (lg:col-span-5) */}
          <section className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#0d0f1b] p-3.5 flex flex-col justify-between shadow-xl relative overflow-hidden">
            {/* Rack Header */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5 gap-2">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isEqMasterActive ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]' : 'bg-slate-600'}`} />
                <h2 className="text-xs font-display uppercase font-bold text-white tracking-wider">
                  5-BAND PARAMETRIC EQ
                </h2>
                <span className="text-[9px] font-mono text-cyan-400/80 bg-cyan-950/40 border border-cyan-900/50 px-1.5 py-0.5 rounded">
                  64-BIT IIR
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* View Mode Switch */}
                <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-slate-800 text-[10px] font-mono">
                  <button
                    onClick={() => setEqViewMode('all')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      eqViewMode === 'all'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    ALL 5
                  </button>
                  <button
                    onClick={() => setEqViewMode('detail')}
                    className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                      eqViewMode === 'detail'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    FOCUS
                  </button>
                </div>

                {/* Master EQ Power Toggle */}
                <button
                  onClick={() => setIsEqMasterActive(!isEqMasterActive)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer border ${
                    isEqMasterActive
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title={isEqMasterActive ? 'Bypass entire EQ' : 'Activate EQ'}
                >
                  <Power className="w-3 h-3" />
                  {isEqMasterActive ? 'ACTIVE' : 'BYPASS'}
                </button>

                {/* Reset EQ */}
                <button
                  onClick={handleResetEQ}
                  className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
                  title="Reset all EQ bands to 0 dB flat"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Solo Audition Alert Banner */}
            {soloedBandIndex !== -1 && (
              <div className="flex items-center justify-between px-3 py-1.5 mb-2 bg-amber-500/15 border border-amber-500/50 rounded-xl text-amber-300 text-[10px] font-mono shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
                  <span className="font-bold tracking-wider text-amber-400">SOLO AUDITION ACTIVE:</span>
                  <span className="text-white font-semibold">
                    BAND {soloedBandIndex + 1} ({eqBands[soloedBandIndex]?.name} — {eqBands[soloedBandIndex]?.freq >= 1000 ? `${(eqBands[soloedBandIndex].freq / 1000).toFixed(1)} kHz` : `${eqBands[soloedBandIndex]?.freq} Hz`})
                  </span>
                </div>
                <button
                  onClick={() => handleToggleBandSolo(soloedBandIndex)}
                  className="px-2.5 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all cursor-pointer text-[9px] shadow-sm"
                  title="Exit solo audition and restore all audio bands"
                >
                  EXIT SOLO
                </button>
              </div>
            )}

            {/* Quick Band Selector Tabs */}
            <div className="grid grid-cols-5 gap-1 mb-2 bg-[#080a13] p-1 rounded-xl border border-slate-800/60">
              {eqBands.map((band, idx) => {
                const isSelected = selectedBandIdx === idx;
                const colors = [
                  { border: 'border-cyan-500', text: 'text-cyan-400', bg: 'bg-cyan-500/15', dot: 'bg-cyan-400' },
                  { border: 'border-purple-500', text: 'text-purple-400', bg: 'bg-purple-500/15', dot: 'bg-purple-400' },
                  { border: 'border-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
                  { border: 'border-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/15', dot: 'bg-amber-400' },
                  { border: 'border-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/15', dot: 'bg-rose-400' }
                ][idx];

                return (
                  <button
                    key={band.id}
                    onClick={() => {
                      setSelectedBandIdx(idx);
                      if (eqViewMode !== 'detail' && isSelected) {
                        setEqViewMode('detail');
                      }
                    }}
                    className={`flex flex-col items-center py-1 px-0.5 rounded-lg text-center transition-all cursor-pointer border ${
                      band.solo
                        ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.4)] ring-1 ring-amber-400/80'
                        : isSelected
                        ? `${colors.border} ${colors.bg} shadow-md`
                        : 'border-transparent hover:bg-slate-800/40 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${band.solo ? 'bg-amber-400 shadow-[0_0_6px_#f59e0b]' : band.enabled ? colors.dot : 'bg-slate-600'}`} />
                      <span className={`text-[10px] font-bold font-mono ${band.solo ? 'text-amber-300 font-black' : isSelected ? colors.text : 'text-slate-300'}`}>
                        {band.solo ? `B${idx + 1} ★` : `B${idx + 1}`}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">
                      {band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}k` : `${band.freq}`}
                    </span>
                    <span className={`text-[9px] font-mono font-semibold ${band.solo ? 'text-amber-300' : band.gain > 0 ? 'text-cyan-400' : band.gain < 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                      {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)}dB
                    </span>
                  </button>
                );
              })}
            </div>

            {/* EQ CONTENT: ALL BANDS STRIPS OR DETAIL FOCUS */}
            {eqViewMode === 'all' ? (
              <div className="grid grid-cols-5 gap-1.5 py-1">
                {eqBands.map((band, idx) => {
                  const colors = [
                    { accent: 'cyan', text: 'text-cyan-400', badge: 'bg-cyan-950/60 text-cyan-300 border-cyan-800' },
                    { accent: 'purple', text: 'text-purple-400', badge: 'bg-purple-950/60 text-purple-300 border-purple-800' },
                    { accent: 'emerald', text: 'text-emerald-400', badge: 'bg-emerald-950/60 text-emerald-300 border-emerald-800' },
                    { accent: 'amber', text: 'text-amber-400', badge: 'bg-amber-950/60 text-amber-300 border-amber-800' },
                    { accent: 'rose', text: 'text-rose-400', badge: 'bg-rose-950/60 text-rose-300 border-rose-800' }
                  ][idx] as { accent: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose'; text: string; badge: string };

                  return (
                    <div
                      key={band.id}
                      className={`flex flex-col items-center p-1.5 rounded-xl border transition-all ${
                        band.solo
                          ? 'border-amber-400 bg-[#221302] ring-1 ring-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                          : selectedBandIdx === idx
                          ? 'border-cyan-500/50 bg-[#0d1020]'
                          : 'border-slate-800/80 bg-[#090b14] hover:border-slate-700'
                      }`}
                    >
                      {/* Strip Header: Name + On/Off + Solo */}
                      <div className="w-full flex items-center justify-between gap-1 mb-1">
                        <button
                          onClick={() => handleUpdateBand(idx, { enabled: !band.enabled })}
                          className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-mono font-bold transition-colors cursor-pointer ${
                            band.enabled ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                          title={band.enabled ? 'Bypass this band' : 'Enable this band'}
                        >
                          {band.enabled ? 'I' : '0'}
                        </button>

                        <button
                          onClick={() => {
                            setSelectedBandIdx(idx);
                            setEqViewMode('detail');
                          }}
                          className={`text-[10px] font-display font-bold uppercase truncate hover:underline ${colors.text}`}
                          title="Click to focus on this band"
                        >
                          {band.name}
                        </button>

                        <button
                          onClick={() => handleToggleBandSolo(idx)}
                          className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-mono font-bold transition-all cursor-pointer ${
                            band.solo
                              ? 'bg-amber-400 text-slate-950 font-black shadow-[0_0_10px_#f59e0b] border border-amber-300 scale-110 animate-pulse'
                              : 'bg-slate-800/80 text-slate-400 hover:text-amber-300 hover:bg-slate-700'
                          }`}
                          title={band.solo ? 'Exit band solo audition' : 'Solo band audition'}
                        >
                          S
                        </button>
                      </div>

                      {/* Filter Type Indicator */}
                      <span className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded border mb-1.5 ${colors.badge}`}>
                        {band.type.replace('peaking', 'bell')}
                      </span>

                      {/* 1. GAIN Knob */}
                      <Knob
                        id={`knob-eq-gain-${band.id}`}
                        label="GAIN"
                        value={band.gain}
                        min={-12}
                        max={12}
                        step={0.1}
                        unit=" dB"
                        defaultValue={0}
                        size={48}
                        accentColor={colors.accent}
                        onChange={val => handleUpdateBand(idx, { gain: val })}
                      />

                      {/* 2. FREQ Knob */}
                      <div className="mt-1.5">
                        <Knob
                          id={`knob-eq-freq-${band.id}`}
                          label="FREQ"
                          value={band.freq}
                          min={20}
                          max={20000}
                          step={1}
                          unit=" Hz"
                          defaultValue={band.freq}
                          size={44}
                          accentColor={colors.accent}
                          onChange={val => handleUpdateBand(idx, { freq: val })}
                        />
                      </div>

                      {/* 3. Q Factor Knob */}
                      <div className="mt-1.5">
                        <Knob
                          id={`knob-eq-q-${band.id}`}
                          label="Q"
                          value={band.q}
                          min={0.2}
                          max={10}
                          step={0.1}
                          unit=""
                          defaultValue={band.q}
                          size={40}
                          accentColor={colors.accent}
                          onChange={val => handleUpdateBand(idx, { q: val })}
                        />
                      </div>

                      {/* Focus button */}
                      <button
                        onClick={() => {
                          setSelectedBandIdx(idx);
                          setEqViewMode('detail');
                        }}
                        className="mt-2 text-[8px] font-mono text-slate-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        TUNE
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* DETAIL FOCUS VIEW FOR SELECTED BAND */
              <div className="bg-[#090b14] rounded-xl border border-slate-800 p-3 flex flex-col justify-between gap-3">
                {/* Selected Band Header & Type Selector */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-display font-bold text-white uppercase">
                      BAND {selectedBandIdx + 1}: {eqBands[selectedBandIdx]?.name}
                    </span>
                    <button
                      onClick={() => handleUpdateBand(selectedBandIdx, { enabled: !eqBands[selectedBandIdx]?.enabled })}
                      className={`text-[9px] font-mono px-2 py-0.5 rounded font-bold transition-colors cursor-pointer border ${
                        eqBands[selectedBandIdx]?.enabled
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {eqBands[selectedBandIdx]?.enabled ? 'ENABLED' : 'BYPASSED'}
                    </button>
                    <button
                      onClick={() => handleToggleBandSolo(selectedBandIdx)}
                      className={`text-[9px] font-mono px-2.5 py-0.5 rounded font-bold transition-all cursor-pointer border ${
                        eqBands[selectedBandIdx]?.solo
                          ? 'bg-amber-400 text-slate-950 font-black border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.6)] animate-pulse'
                          : 'bg-slate-800 text-slate-400 hover:text-amber-300 border-slate-700'
                      }`}
                      title={eqBands[selectedBandIdx]?.solo ? 'Exit solo audition mode' : 'Solo this band for isolated audition'}
                    >
                      {eqBands[selectedBandIdx]?.solo ? '★ SOLO AUDITION ACTIVE' : 'SOLO BAND'}
                    </button>
                  </div>

                  {/* Filter Type Pills */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { id: 'lowshelf', label: 'Low Shelf' },
                      { id: 'peaking', label: 'Bell / Peak' },
                      { id: 'highshelf', label: 'High Shelf' },
                      { id: 'highpass', label: 'Low Cut (HP)' },
                      { id: 'lowpass', label: 'High Cut (LP)' },
                      { id: 'notch', label: 'Notch' }
                    ].map(typeObj => (
                      <button
                        key={typeObj.id}
                        onClick={() => handleUpdateBand(selectedBandIdx, { type: typeObj.id as any })}
                        className={`text-[9px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer border ${
                          eqBands[selectedBandIdx]?.type === typeObj.id
                            ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 font-bold shadow-sm'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {typeObj.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3 Large Precision Knobs */}
                <div className="grid grid-cols-3 gap-4 items-center justify-center py-1">
                  {/* 1. GAIN */}
                  <div className="flex flex-col items-center bg-[#0d0f1c] p-2 rounded-xl border border-slate-800/80">
                    <Knob
                      id={`knob-focus-gain-${selectedBandIdx}`}
                      label="GAIN"
                      value={eqBands[selectedBandIdx]?.gain || 0}
                      min={-12}
                      max={12}
                      step={0.1}
                      unit=" dB"
                      defaultValue={0}
                      size={64}
                      accentColor={
                        selectedBandIdx === 0 ? 'cyan' : selectedBandIdx === 1 ? 'purple' : selectedBandIdx === 2 ? 'emerald' : selectedBandIdx === 3 ? 'amber' : 'rose'
                      }
                      onChange={val => handleUpdateBand(selectedBandIdx, { gain: val })}
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleUpdateBand(selectedBandIdx, { gain: Math.max(-12, (eqBands[selectedBandIdx]?.gain || 0) - 0.5) })}
                        className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-mono text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                      >
                        -0.5
                      </button>
                      <button
                        onClick={() => handleUpdateBand(selectedBandIdx, { gain: 0 })}
                        className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-mono text-cyan-400 rounded hover:bg-slate-700 cursor-pointer"
                      >
                        0 dB
                      </button>
                      <button
                        onClick={() => handleUpdateBand(selectedBandIdx, { gain: Math.min(12, (eqBands[selectedBandIdx]?.gain || 0) + 0.5) })}
                        className="px-1.5 py-0.5 bg-slate-800 text-[9px] font-mono text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                      >
                        +0.5
                      </button>
                    </div>
                  </div>

                  {/* 2. FREQUENCY */}
                  <div className="flex flex-col items-center bg-[#0d0f1c] p-2 rounded-xl border border-slate-800/80">
                    <Knob
                      id={`knob-focus-freq-${selectedBandIdx}`}
                      label="FREQUENCY"
                      value={eqBands[selectedBandIdx]?.freq || 1000}
                      min={20}
                      max={20000}
                      step={1}
                      unit=" Hz"
                      defaultValue={eqBands[selectedBandIdx]?.freq}
                      size={64}
                      accentColor={
                        selectedBandIdx === 0 ? 'cyan' : selectedBandIdx === 1 ? 'purple' : selectedBandIdx === 2 ? 'emerald' : selectedBandIdx === 3 ? 'amber' : 'rose'
                      }
                      onChange={val => handleUpdateBand(selectedBandIdx, { freq: val })}
                    />
                    {/* Quick Frequency Shortcuts for this band */}
                    <div className="flex gap-1 mt-2 flex-wrap justify-center">
                      {[
                        [30, 45, 60, 80],
                        [160, 250, 350, 500],
                        [800, 1200, 2000, 3000],
                        [3500, 4500, 6000, 8000],
                        [10000, 12000, 15000, 18000]
                      ][selectedBandIdx]?.map(hz => (
                        <button
                          key={hz}
                          onClick={() => handleUpdateBand(selectedBandIdx, { freq: hz })}
                          className={`px-1 py-0.5 text-[8px] font-mono rounded cursor-pointer ${
                            eqBands[selectedBandIdx]?.freq === hz
                              ? 'bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/50'
                              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {hz >= 1000 ? `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}k` : `${hz}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. Q FACTOR (BANDWIDTH) */}
                  <div className="flex flex-col items-center bg-[#0d0f1c] p-2 rounded-xl border border-slate-800/80">
                    <Knob
                      id={`knob-focus-q-${selectedBandIdx}`}
                      label="Q / BANDWIDTH"
                      value={eqBands[selectedBandIdx]?.q || 1.0}
                      min={0.2}
                      max={12}
                      step={0.1}
                      unit=""
                      defaultValue={1.0}
                      size={64}
                      accentColor={
                        selectedBandIdx === 0 ? 'cyan' : selectedBandIdx === 1 ? 'purple' : selectedBandIdx === 2 ? 'emerald' : selectedBandIdx === 3 ? 'amber' : 'rose'
                      }
                      onChange={val => handleUpdateBand(selectedBandIdx, { q: val })}
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={() => handleUpdateBand(selectedBandIdx, { q: 0.7 })}
                        className="px-1.5 py-0.5 bg-slate-800 text-[8px] font-mono text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                        title="Wide musical curve"
                      >
                        Broad
                      </button>
                      <button
                        onClick={() => handleUpdateBand(selectedBandIdx, { q: 1.4 })}
                        className="px-1.5 py-0.5 bg-slate-800 text-[8px] font-mono text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                        title="Standard curve"
                      >
                        Std
                      </button>
                      <button
                        onClick={() => handleUpdateBand(selectedBandIdx, { q: 4.0 })}
                        className="px-1.5 py-0.5 bg-slate-800 text-[8px] font-mono text-slate-300 rounded hover:bg-slate-700 cursor-pointer"
                        title="Narrow notch"
                      >
                        Narrow
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px] font-mono">
                  <span className="text-slate-400">
                    Band {selectedBandIdx + 1} Center: <strong className="text-white">{eqBands[selectedBandIdx]?.freq} Hz</strong> | Q: <strong className="text-white">{eqBands[selectedBandIdx]?.q.toFixed(1)}</strong>
                  </span>
                  <button
                    onClick={() => setEqViewMode('all')}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer underline"
                  >
                    View All 5 Channel Strips →
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* MODULE 2: MULTIBAND COMPRESSOR (4 cols) */}
          <section className={`lg:col-span-4 rounded-2xl border ${compState.enabled ? 'border-orange-800/60 bg-[#0d0f1b]' : 'border-slate-800/60 bg-[#0d0f1b]/60 opacity-80'} p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${compState.enabled ? 'bg-orange-400 shadow-[0_0_6px_#fb923c]' : 'bg-slate-600'}`} />
                <h2 className="text-xs font-display uppercase font-bold text-white tracking-wider">
                  MULTIBAND DYNAMICS
                </h2>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-950/60 text-orange-400 border border-orange-800/50">
                  LR-4
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* View tab switcher */}
                <div className="flex items-center bg-slate-900 rounded p-0.5 border border-slate-800 text-[9px] font-mono">
                  <button
                    id="btn-comp-view-overview"
                    onClick={() => setCompViewTab('overview')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                      compViewTab === 'overview' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    MAIN
                  </button>
                  <button
                    id="btn-comp-view-advanced"
                    onClick={() => setCompViewTab('advanced')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-all ${
                      compViewTab === 'advanced' ? 'bg-orange-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    TWEAK
                  </button>
                </div>

                {/* Master On/Bypass Button */}
                <button
                  id="btn-toggle-comp"
                  onClick={() => setCompState(prev => ({ ...prev, enabled: !prev.enabled }))}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer ${
                    compState.enabled
                      ? 'bg-orange-500/25 text-orange-300 border border-orange-500/50 shadow-[0_0_8px_rgba(249,115,22,0.3)]'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
                  }`}
                  title="Bypass or engage Multiband Dynamics"
                >
                  {compState.enabled ? 'ON' : 'BYPASS'}
                </button>
              </div>
            </div>

            {/* Solo Audition Mode Toolbar */}
            <div className="flex items-center justify-between gap-1 p-1 bg-slate-900/80 rounded-lg border border-slate-800/80 mb-2">
              <button
                id="btn-comp-solo-none"
                onClick={() => setCompState(prev => ({ ...prev, soloBand: 'none' }))}
                className={`flex-1 py-0.5 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  (!compState.soloBand || compState.soloBand === 'none')
                    ? 'bg-orange-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="All 3 bands active in master output"
              >
                FULL MIX
              </button>
              <button
                id="btn-comp-solo-low"
                onClick={() => setCompState(prev => ({ ...prev, soloBand: prev.soloBand === 'low' ? 'none' : 'low' }))}
                className={`flex-1 py-0.5 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  compState.soloBand === 'low'
                    ? 'bg-cyan-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
                }`}
                title="Solo Low Band: Audition kick punch & sub-bass dynamics"
              >
                SOLO LOW
              </button>
              <button
                id="btn-comp-solo-mid"
                onClick={() => setCompState(prev => ({ ...prev, soloBand: prev.soloBand === 'mid' ? 'none' : 'mid' }))}
                className={`flex-1 py-0.5 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  compState.soloBand === 'mid'
                    ? 'bg-purple-500 text-white font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800/60'
                }`}
                title="Solo Mid Band: Audition vocal body, snare & synths"
              >
                SOLO MID
              </button>
              <button
                id="btn-comp-solo-high"
                onClick={() => setCompState(prev => ({ ...prev, soloBand: prev.soloBand === 'high' ? 'none' : 'high' }))}
                className={`flex-1 py-0.5 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  compState.soloBand === 'high'
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                }`}
                title="Solo High Band: Audition cymbals, shimmer & presence"
              >
                SOLO HIGH
              </button>
            </div>

            {/* 3 Bands: Low, Mid, High */}
            <div className="grid grid-cols-3 gap-2 py-1">
              {/* LOW BAND */}
              <div className={`flex flex-col bg-[#090b14] p-2 rounded-xl border ${compState.low.bypassed ? 'border-slate-800 opacity-60' : 'border-cyan-900/40'}`}>
                {/* Band Header */}
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800/60">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[10px] font-display text-cyan-300 font-bold">LOW</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-slate-400">&lt;{compState.lowCrossover}Hz</span>
                    <button
                      id="btn-byp-low"
                      onClick={() => setCompState(prev => ({ ...prev, low: { ...prev.low, bypassed: !prev.low.bypassed } }))}
                      className={`px-1 py-0.2 rounded text-[8px] font-mono cursor-pointer ${
                        compState.low.bypassed ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Bypass low band dynamics"
                    >
                      {compState.low.bypassed ? 'BYP' : 'ON'}
                    </button>
                  </div>
                </div>

                {/* Mini Gain Reduction Meter */}
                <div className="flex items-center justify-between px-1 py-0.5 rounded bg-black/40 border border-slate-800/70 mb-1.5">
                  <span className="text-[8px] font-mono text-slate-400">GR</span>
                  <div className="flex-1 mx-1.5 h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-75 rounded-full"
                      style={{ width: `${Math.min(100, (gainReduction.low / 15) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400 font-bold">
                    {gainReduction.low > 0.1 ? `-${gainReduction.low.toFixed(1)}` : '0.0'}
                  </span>
                </div>

                {/* Knobs */}
                <div className="flex flex-col items-center gap-1">
                  <Knob
                    label="THRESH"
                    value={compState.low.threshold}
                    min={-40}
                    max={0}
                    step={0.5}
                    unit=" dB"
                    defaultValue={-18}
                    size={46}
                    accentColor="cyan"
                    onChange={val => setCompState(prev => ({ ...prev, low: { ...prev.low, threshold: val } }))}
                  />
                  <div className="grid grid-cols-2 gap-1 w-full mt-0.5">
                    <Knob
                      label="RATIO"
                      value={compState.low.ratio}
                      min={1.0}
                      max={20.0}
                      step={0.1}
                      unit=":1"
                      defaultValue={4.0}
                      size={40}
                      accentColor="cyan"
                      onChange={val => setCompState(prev => ({ ...prev, low: { ...prev.low, ratio: val } }))}
                    />
                    <Knob
                      label="GAIN"
                      value={compState.low.makeup}
                      min={-6}
                      max={12}
                      step={0.5}
                      unit=" dB"
                      defaultValue={2.5}
                      size={40}
                      accentColor="cyan"
                      onChange={val => setCompState(prev => ({ ...prev, low: { ...prev.low, makeup: val } }))}
                    />
                  </div>
                </div>

                {compViewTab === 'advanced' && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1 text-[8px] font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>ATK: {compState.low.attack}ms</span>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={compState.low.attack}
                        onChange={e => setCompState(prev => ({ ...prev, low: { ...prev.low, attack: Number(e.target.value) } }))}
                        className="w-14 accent-cyan-400 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>REL: {compState.low.release}ms</span>
                      <input
                        type="range"
                        min="20"
                        max="800"
                        value={compState.low.release}
                        onChange={e => setCompState(prev => ({ ...prev, low: { ...prev.low, release: Number(e.target.value) } }))}
                        className="w-14 accent-cyan-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* MID BAND */}
              <div className={`flex flex-col bg-[#090b14] p-2 rounded-xl border ${compState.mid.bypassed ? 'border-slate-800 opacity-60' : 'border-purple-900/40'}`}>
                {/* Band Header */}
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800/60">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span className="text-[10px] font-display text-purple-300 font-bold">MID</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-slate-400">{compState.lowCrossover}-{compState.highCrossover}</span>
                    <button
                      id="btn-byp-mid"
                      onClick={() => setCompState(prev => ({ ...prev, mid: { ...prev.mid, bypassed: !prev.mid.bypassed } }))}
                      className={`px-1 py-0.2 rounded text-[8px] font-mono cursor-pointer ${
                        compState.mid.bypassed ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Bypass mid band dynamics"
                    >
                      {compState.mid.bypassed ? 'BYP' : 'ON'}
                    </button>
                  </div>
                </div>

                {/* Mini Gain Reduction Meter */}
                <div className="flex items-center justify-between px-1 py-0.5 rounded bg-black/40 border border-slate-800/70 mb-1.5">
                  <span className="text-[8px] font-mono text-slate-400">GR</span>
                  <div className="flex-1 mx-1.5 h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-purple-400 transition-all duration-75 rounded-full"
                      style={{ width: `${Math.min(100, (gainReduction.mid / 15) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-purple-400 font-bold">
                    {gainReduction.mid > 0.1 ? `-${gainReduction.mid.toFixed(1)}` : '0.0'}
                  </span>
                </div>

                {/* Knobs */}
                <div className="flex flex-col items-center gap-1">
                  <Knob
                    label="THRESH"
                    value={compState.mid.threshold}
                    min={-40}
                    max={0}
                    step={0.5}
                    unit=" dB"
                    defaultValue={-14}
                    size={46}
                    accentColor="purple"
                    onChange={val => setCompState(prev => ({ ...prev, mid: { ...prev.mid, threshold: val } }))}
                  />
                  <div className="grid grid-cols-2 gap-1 w-full mt-0.5">
                    <Knob
                      label="RATIO"
                      value={compState.mid.ratio}
                      min={1.0}
                      max={20.0}
                      step={0.1}
                      unit=":1"
                      defaultValue={2.5}
                      size={40}
                      accentColor="purple"
                      onChange={val => setCompState(prev => ({ ...prev, mid: { ...prev.mid, ratio: val } }))}
                    />
                    <Knob
                      label="GAIN"
                      value={compState.mid.makeup}
                      min={-6}
                      max={12}
                      step={0.5}
                      unit=" dB"
                      defaultValue={1.5}
                      size={40}
                      accentColor="purple"
                      onChange={val => setCompState(prev => ({ ...prev, mid: { ...prev.mid, makeup: val } }))}
                    />
                  </div>
                </div>

                {compViewTab === 'advanced' && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1 text-[8px] font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>ATK: {compState.mid.attack}ms</span>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={compState.mid.attack}
                        onChange={e => setCompState(prev => ({ ...prev, mid: { ...prev.mid, attack: Number(e.target.value) } }))}
                        className="w-14 accent-purple-400 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>REL: {compState.mid.release}ms</span>
                      <input
                        type="range"
                        min="20"
                        max="800"
                        value={compState.mid.release}
                        onChange={e => setCompState(prev => ({ ...prev, mid: { ...prev.mid, release: Number(e.target.value) } }))}
                        className="w-14 accent-purple-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* HIGH BAND */}
              <div className={`flex flex-col bg-[#090b14] p-2 rounded-xl border ${compState.high.bypassed ? 'border-slate-800 opacity-60' : 'border-amber-900/40'}`}>
                {/* Band Header */}
                <div className="flex items-center justify-between mb-1 pb-1 border-b border-slate-800/60">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span className="text-[10px] font-display text-amber-300 font-bold">HIGH</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[8px] font-mono text-slate-400">&gt;{compState.highCrossover}Hz</span>
                    <button
                      id="btn-byp-high"
                      onClick={() => setCompState(prev => ({ ...prev, high: { ...prev.high, bypassed: !prev.high.bypassed } }))}
                      className={`px-1 py-0.2 rounded text-[8px] font-mono cursor-pointer ${
                        compState.high.bypassed ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60' : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                      title="Bypass high band dynamics"
                    >
                      {compState.high.bypassed ? 'BYP' : 'ON'}
                    </button>
                  </div>
                </div>

                {/* Mini Gain Reduction Meter */}
                <div className="flex items-center justify-between px-1 py-0.5 rounded bg-black/40 border border-slate-800/70 mb-1.5">
                  <span className="text-[8px] font-mono text-slate-400">GR</span>
                  <div className="flex-1 mx-1.5 h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75 rounded-full"
                      style={{ width: `${Math.min(100, (gainReduction.high / 15) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-amber-400 font-bold">
                    {gainReduction.high > 0.1 ? `-${gainReduction.high.toFixed(1)}` : '0.0'}
                  </span>
                </div>

                {/* Knobs */}
                <div className="flex flex-col items-center gap-1">
                  <Knob
                    label="THRESH"
                    value={compState.high.threshold}
                    min={-40}
                    max={0}
                    step={0.5}
                    unit=" dB"
                    defaultValue={-16}
                    size={46}
                    accentColor="amber"
                    onChange={val => setCompState(prev => ({ ...prev, high: { ...prev.high, threshold: val } }))}
                  />
                  <div className="grid grid-cols-2 gap-1 w-full mt-0.5">
                    <Knob
                      label="RATIO"
                      value={compState.high.ratio}
                      min={1.0}
                      max={20.0}
                      step={0.1}
                      unit=":1"
                      defaultValue={3.0}
                      size={40}
                      accentColor="amber"
                      onChange={val => setCompState(prev => ({ ...prev, high: { ...prev.high, ratio: val } }))}
                    />
                    <Knob
                      label="GAIN"
                      value={compState.high.makeup}
                      min={-6}
                      max={12}
                      step={0.5}
                      unit=" dB"
                      defaultValue={2.0}
                      size={40}
                      accentColor="amber"
                      onChange={val => setCompState(prev => ({ ...prev, high: { ...prev.high, makeup: val } }))}
                    />
                  </div>
                </div>

                {compViewTab === 'advanced' && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-col gap-1 text-[8px] font-mono text-slate-400">
                    <div className="flex items-center justify-between">
                      <span>ATK: {compState.high.attack}ms</span>
                      <input
                        type="range"
                        min="1"
                        max="100"
                        value={compState.high.attack}
                        onChange={e => setCompState(prev => ({ ...prev, high: { ...prev.high, attack: Number(e.target.value) } }))}
                        className="w-14 accent-amber-400 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>REL: {compState.high.release}ms</span>
                      <input
                        type="range"
                        min="20"
                        max="800"
                        value={compState.high.release}
                        onChange={e => setCompState(prev => ({ ...prev, high: { ...prev.high, release: Number(e.target.value) } }))}
                        className="w-14 accent-amber-400 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Linkwitz-Riley Crossover Bar */}
            <div className="border-t border-slate-800/60 pt-2 flex flex-col gap-1.5 text-[9px] font-mono text-slate-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-cyan-400 font-semibold">LOW-MID CROSS:</span>
                  <span className="text-white font-bold">{compState.lowCrossover} Hz</span>
                </div>
                <input
                  type="range"
                  min="80"
                  max="600"
                  step="10"
                  value={compState.lowCrossover}
                  onChange={e => setCompState(prev => ({ ...prev, lowCrossover: Number(e.target.value) }))}
                  className="w-24 accent-cyan-400 cursor-pointer"
                  title="Adjust Low-to-Mid Linkwitz-Riley Crossover frequency"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 font-semibold">MID-HIGH CROSS:</span>
                  <span className="text-white font-bold">{(compState.highCrossover / 1000).toFixed(1)} kHz</span>
                </div>
                <input
                  type="range"
                  min="1500"
                  max="9000"
                  step="100"
                  value={compState.highCrossover}
                  onChange={e => setCompState(prev => ({ ...prev, highCrossover: Number(e.target.value) }))}
                  className="w-24 accent-amber-400 cursor-pointer"
                  title="Adjust Mid-to-High Linkwitz-Riley Crossover frequency"
                />
              </div>
            </div>
          </section>

          {/* MODULE 3: STEREO IMAGER (3 cols) */}
          <section className={`lg:col-span-3 rounded-2xl border ${imagerState.enabled ? 'border-purple-800/60 bg-[#0d0f1b]' : 'border-slate-800/60 bg-[#0d0f1b]/60 opacity-80'} p-4 flex flex-col justify-between shadow-xl relative overflow-hidden transition-all`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${imagerState.enabled ? 'bg-purple-400 shadow-[0_0_6px_#a855f7]' : 'bg-slate-600'}`} />
                <h2 className="text-xs font-display uppercase font-bold text-white tracking-wider">
                  STEREO IMAGER
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-purple-400 font-semibold">M/S MATRIX</span>
                <button
                  id="btn-toggle-imager"
                  onClick={() => setImagerState({ ...imagerState, enabled: !imagerState.enabled })}
                  className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider transition-all cursor-pointer ${
                    imagerState.enabled
                      ? 'bg-purple-500/25 text-purple-300 border border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 hover:text-slate-300'
                  }`}
                  title="Bypass or engage Stereo Imager"
                >
                  {imagerState.enabled ? 'ON' : 'BYPASS'}
                </button>
              </div>
            </div>

            {/* Solo Audition Mode Buttons */}
            <div className="flex items-center justify-between gap-1 p-1 bg-slate-900/80 rounded-lg border border-slate-800/80 mb-2">
              <button
                id="btn-imager-solo-none"
                onClick={() => setImagerState({ ...imagerState, soloMode: 'none' })}
                className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  (imagerState.soloMode === 'none' || !imagerState.soloMode)
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="Full stereo output"
              >
                STEREO
              </button>
              <button
                id="btn-imager-solo-mid"
                onClick={() => setImagerState({ ...imagerState, soloMode: 'mid' })}
                className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  imagerState.soloMode === 'mid'
                    ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="Solo Mid channel (center phantom mono: kick, vocal, bass)"
              >
                SOLO MID
              </button>
              <button
                id="btn-imager-solo-side"
                onClick={() => setImagerState({ ...imagerState, soloMode: 'side' })}
                className={`flex-1 py-1 text-[9px] font-mono font-bold rounded transition-all cursor-pointer ${
                  imagerState.soloMode === 'side'
                    ? 'bg-cyan-400 text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title="Solo Side channel (spatial difference & wide instruments only)"
              >
                SOLO SIDE
              </button>
            </div>

            {/* Knobs row */}
            <div className="grid grid-cols-3 gap-1.5 items-center justify-center py-1">
              <Knob
                label="BASS MONO"
                value={imagerState.monoBassFreq}
                min={40}
                max={250}
                step={1}
                unit=" Hz"
                defaultValue={130}
                size={50}
                accentColor="purple"
                onChange={val => setImagerState({ ...imagerState, monoBassFreq: val })}
              />

              <Knob
                label="MID WIDTH"
                value={imagerState.stereoWidthMid ?? 100}
                min={0}
                max={200}
                step={1}
                unit=" %"
                defaultValue={100}
                size={50}
                accentColor="purple"
                onChange={val => setImagerState({ ...imagerState, stereoWidthMid: val })}
              />

              <Knob
                label="HIGH WIDTH"
                value={imagerState.stereoWidthHigh}
                min={50}
                max={200}
                step={1}
                unit=" %"
                defaultValue={140}
                size={50}
                accentColor="cyan"
                onChange={val => setImagerState({ ...imagerState, stereoWidthHigh: val })}
              />
            </div>

            {/* Haas Stereoizer Spatial Decorrelator */}
            <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
              <button
                id="btn-toggle-stereoizer"
                onClick={() => setImagerState({ ...imagerState, stereoize: !imagerState.stereoize })}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                  imagerState.stereoize
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_8px_rgba(219,39,119,0.35)]'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                }`}
                title="Psychoacoustic Haas delay decorrelator - widens mono or narrow stems"
              >
                <Sparkles className="w-3 h-3 text-pink-300" />
                <span>STEREOIZER</span>
              </button>

              <div className="flex-1 flex items-center gap-1.5 justify-end text-[9px] font-mono">
                <span className="text-slate-400">CORR:</span>
                <span className={`font-bold ${metrics.correlation < 0 ? 'text-rose-400' : metrics.correlation > 0.4 ? 'text-emerald-400' : 'text-purple-300'}`}>
                  {metrics.correlation >= 0 ? `+${metrics.correlation.toFixed(2)}` : metrics.correlation.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-1 text-[8.5px] font-mono text-slate-500 text-center">
              Mono below {imagerState.monoBassFreq}Hz • Mid (130-2.5k) {imagerState.stereoWidthMid ?? 100}% • High {imagerState.stereoWidthHigh}%
            </div>
          </section>
        </div>

        {/* BOTTOM ROW: Harmonic Exciter + Smart Brickwall Limiter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* MODULE 4: HARMONIC EXCITER (6 cols) */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-800/90 bg-[#0d0f1b] p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pink-400 shadow-[0_0_6px_#f43f5e]" />
                <h2 className="text-xs font-display uppercase font-bold text-white tracking-wider">
                  HARMONIC EXCITER
                </h2>
              </div>

              {/* Mode Buttons: Warm / Analog / Tape */}
              <div className="flex items-center p-1 rounded-lg bg-[#080910] border border-slate-800 gap-1">
                {(['warm', 'analog', 'tape'] as ExciterMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setExciterState({ ...exciterState, mode: m })}
                    className={`px-3 py-1 rounded text-[10px] font-display uppercase font-bold tracking-wider transition-all cursor-pointer ${
                      exciterState.mode === m
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {m === 'warm' ? 'WARM (TUBE)' : m === 'analog' ? 'ANALOG (CONSOLE)' : 'TAPE (SAT)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center justify-center py-2">
              <Knob
                label="DRIVE"
                value={exciterState.drive}
                min={0}
                max={100}
                step={1}
                unit=" %"
                defaultValue={40}
                size={58}
                accentColor="rose"
                onChange={val => setExciterState({ ...exciterState, drive: val })}
              />

              <Knob
                label="COLOR TILT"
                value={exciterState.color}
                min={0}
                max={100}
                step={1}
                unit=" %"
                defaultValue={50}
                size={58}
                accentColor="amber"
                onChange={val => setExciterState({ ...exciterState, color: val })}
              />

              <Knob
                label="WET MIX"
                value={exciterState.mix}
                min={0}
                max={100}
                step={1}
                unit=" %"
                defaultValue={40}
                size={58}
                accentColor="purple"
                onChange={val => setExciterState({ ...exciterState, mix: val })}
              />
            </div>

            <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span>MODE: {exciterState.mode.toUpperCase()} WAVESHAPER</span>
              <span>4X OVERSAMPLING ANTI-ALIASING</span>
            </div>
          </section>

          {/* MODULE 5: SMART BRICKWALL LIMITER (6 cols) */}
          <section className="lg:col-span-6 rounded-2xl border border-slate-800/90 bg-[#0d0f1b] p-4 flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
                <h2 className="text-xs font-display uppercase font-bold text-white tracking-wider">
                  SMART BRICKWALL LIMITER
                </h2>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                LOOKAHEAD 2.5ms • TRUE PEAK GUARD
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 items-center justify-center py-2">
              <Knob
                label="CEILING"
                value={limiterState.ceiling}
                min={-2.0}
                max={-0.1}
                step={0.1}
                unit=" dBFS"
                defaultValue={-0.2}
                size={58}
                accentColor="emerald"
                onChange={val => setLimiterState({ ...limiterState, ceiling: val })}
              />

              <Knob
                label="THRESHOLD"
                value={limiterState.threshold}
                min={-12.0}
                max={0.0}
                step={0.1}
                unit=" dB"
                defaultValue={-6.0}
                size={58}
                accentColor="cyan"
                onChange={val => setLimiterState({ ...limiterState, threshold: val })}
              />

              <Knob
                label="RELEASE"
                value={limiterState.release}
                min={20}
                max={300}
                step={5}
                unit=" ms"
                defaultValue={60}
                size={58}
                accentColor="amber"
                onChange={val => setLimiterState({ ...limiterState, release: val })}
              />
            </div>

            <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between text-[9px] font-mono text-slate-400">
              <span>TARGET LOUDNESS: {limiterState.targetLufs} LUFS</span>
              <span>INTER-SAMPLE CLIP PREVENT: ACTIVE</span>
            </div>
          </section>
        </div>
      </main>

      {/* 3. MODALS */}
      {/* C++ JUCE Project Source Code Viewer & Downloader Modal */}
      <JuceCodeViewer
        isOpen={isJuceModalOpen}
        onClose={() => setIsJuceModalOpen(false)}
      />

      {/* AI Auto Mastering Assistant Diagnosis Modal */}
      <AIMasteringModal
        isOpen={isAIModalOpen}
        isLoading={isAiLoading}
        result={aiResult}
        onApply={() => handleApplyAIResult()}
        onClose={() => setIsAIModalOpen(false)}
      />

      {/* Mastered Audio WAV Exporter & Downloader Modal */}
      <AudioExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        uploadedAudioBuffer={uploadedAudioBuffer}
        uploadedFileName={uploadedFileName}
        audioSource={audioSource}
        activeDemoGenre={activeDemoGenre}
        eqBands={eqBands}
        compState={compState}
        imagerState={imagerState}
        exciterState={exciterState}
        limiterState={limiterState}
        isBypassed={isBypassed}
        masteringMode={masteringMode}
      />

      {/* R2R Music Brand Insignia & Asset Downloader Modal */}
      <R2RLogoModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
      />
    </div>
  );
}
