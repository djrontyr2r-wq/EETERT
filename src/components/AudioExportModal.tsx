import React, { useState, useEffect, useRef } from 'react';
import {
  EQBand,
  MultibandCompState,
  StereoImagerState,
  HarmonicExciterState,
  SmartLimiterState,
  TrackGenre,
  MasteringMode
} from '../types';
import {
  renderMasteredAudio,
  RenderMasterResult,
  triggerBlobDownload
} from '../audio/audioExporter';
import { DemoTrackEngine } from '../audio/audioGenerator';
import {
  Download,
  FileAudio,
  CheckCircle2,
  Sliders,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  X,
  Activity,
  Clock,
  Disc,
  Layers,
  Radio,
  Volume2,
  ExternalLink,
  ShieldCheck,
  Music2
} from 'lucide-react';

interface AudioExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadedAudioBuffer: AudioBuffer | null;
  uploadedFileName: string;
  audioSource: 'demo' | 'uploaded';
  activeDemoGenre: TrackGenre;
  eqBands: EQBand[];
  compState: MultibandCompState;
  imagerState: StereoImagerState;
  exciterState: HarmonicExciterState;
  limiterState: SmartLimiterState;
  isBypassed: boolean;
  masteringMode: MasteringMode;
}

export const AudioExportModal: React.FC<AudioExportModalProps> = ({
  isOpen,
  onClose,
  uploadedAudioBuffer,
  uploadedFileName,
  audioSource,
  activeDemoGenre,
  eqBands,
  compState,
  imagerState,
  exciterState,
  limiterState,
  isBypassed,
  masteringMode
}) => {
  // Export Settings
  const [selectedSource, setSelectedSource] = useState<'current' | 'uploaded' | 'demo'>(
    audioSource === 'uploaded' && uploadedAudioBuffer ? 'uploaded' : 'demo'
  );
  const [demoDurationSecs, setDemoDurationSecs] = useState<number>(30);
  const [bitDepth, setBitDepth] = useState<16 | 24>(24);
  const [fileName, setFileName] = useState<string>('');

  // Rendering State
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [renderProgress, setRenderProgress] = useState<number>(0);
  const [renderStatus, setRenderStatus] = useState<string>('');
  const [renderResult, setRenderResult] = useState<RenderMasterResult | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  // In-modal preview audio player
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState<number>(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize source and file name when modal opens
  useEffect(() => {
    if (isOpen) {
      const initialSource = audioSource === 'uploaded' && uploadedAudioBuffer ? 'uploaded' : 'demo';
      setSelectedSource(initialSource);

      const baseName = initialSource === 'uploaded' && uploadedFileName
        ? uploadedFileName.replace(/\.[^/.]+$/, '')
        : `${activeDemoGenre}_Master`;

      setFileName(`${baseName}_R2R_Mastered_${bitDepth}bit.wav`);
    } else {
      // Pause preview if modal closed
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      }
    }
  }, [isOpen, audioSource, uploadedAudioBuffer, uploadedFileName, activeDemoGenre, bitDepth]);

  // Update filename when bit depth changes
  const handleBitDepthChange = (depth: 16 | 24) => {
    setBitDepth(depth);
    setFileName(prev => {
      if (prev.includes('_16bit.wav')) {
        return prev.replace('_16bit.wav', `_${depth}bit.wav`);
      }
      if (prev.includes('_24bit.wav')) {
        return prev.replace('_24bit.wav', `_${depth}bit.wav`);
      }
      return prev.replace('.wav', `_${depth}bit.wav`);
    });
  };

  // Preview Audio Controller
  const handleTogglePreviewPlay = () => {
    if (!previewAudioRef.current) return;
    if (isPlayingPreview) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    } else {
      previewAudioRef.current.play().then(() => {
        setIsPlayingPreview(true);
      }).catch(err => {
        console.warn('Audio preview play error:', err);
      });
    }
  };

  const handlePreviewTimeUpdate = () => {
    if (previewAudioRef.current) {
      setPreviewCurrentTime(previewAudioRef.current.currentTime);
    }
  };

  const handlePreviewEnded = () => {
    setIsPlayingPreview(false);
    setPreviewCurrentTime(0);
  };

  const handleSeekPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = time;
      setPreviewCurrentTime(time);
    }
  };

  // Primary Master Render Function
  const handleStartRender = async () => {
    setIsRendering(true);
    setRenderProgress(5);
    setRenderStatus('Preparing audio source buffer...');
    setRenderError(null);

    // Stop current preview if playing
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlayingPreview(false);
    }

    try {
      let sourceBuffer: AudioBuffer;

      if (selectedSource === 'uploaded' && uploadedAudioBuffer) {
        sourceBuffer = uploadedAudioBuffer;
      } else {
        setRenderProgress(12);
        setRenderStatus(`Synthesizing high-definition ${activeDemoGenre} procedural audio loop...`);
        // Synthesize demo track offline into AudioBuffer
        sourceBuffer = await DemoTrackEngine.renderDemoTrackBuffer(
          activeDemoGenre,
          demoDurationSecs,
          44100
        );
      }

      // Execute DSP mastering pipeline offline
      const result = await renderMasteredAudio({
        sourceBuffer,
        eqBands,
        compState,
        imagerState,
        exciterState,
        limiterState,
        isBypassed,
        bitDepth,
        onProgress: (percent, status) => {
          setRenderProgress(percent);
          setRenderStatus(status);
        }
      });

      setRenderResult(result);
      setRenderProgress(100);
      setRenderStatus('Mastered audio rendered successfully!');
    } catch (err: unknown) {
      console.error('Audio rendering error:', err);
      const errMsg = err instanceof Error ? err.message : 'Unknown audio rendering failure';
      setRenderError(errMsg);
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownloadNow = () => {
    if (!renderResult) return;
    triggerBlobDownload(renderResult.blob, fileName || 'Mastered_Track.wav');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-3xl rounded-2xl border border-emerald-500/40 bg-[#0c0e18] shadow-[0_0_50px_rgba(16,185,129,0.2)] overflow-hidden text-slate-100 max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-[#080911]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-display font-bold text-white tracking-wider">
                  EXPORT MASTERED AUDIO
                </h2>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  PCM WAV 64-BIT DSP
                </span>
                <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {masteringMode.toUpperCase()} TARGET
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Renders full DSP chain into a standalone broadcast WAV file with telemetry verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Active DSP Chain Inspection Banner */}
          <div className="p-3 rounded-xl bg-[#080910] border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-2 text-slate-300">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">CHAIN:</span>
              <span className="text-cyan-300">5-Band EQ</span>
              <span className="text-slate-600">→</span>
              <span className="text-orange-300">3-Band Dynamics</span>
              <span className="text-slate-600">→</span>
              <span className="text-purple-300">M/S Imager</span>
              <span className="text-slate-600">→</span>
              <span className="text-pink-300">{exciterState.mode.toUpperCase()} Exciter</span>
              <span className="text-slate-600">→</span>
              <span className="text-emerald-300">Smart Limiter ({limiterState.ceiling} dBFS)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">STATE:</span>
              {isBypassed ? (
                <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  BYPASSED (DRY)
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  FULL DSP ACTIVE
                </span>
              )}
            </div>
          </div>

          {/* Configuration Grid: Source & Output Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Panel 1: Source Selection */}
            <div className="p-4 rounded-xl bg-[#090b14] border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-display font-bold text-white tracking-wider flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-400" /> AUDIO SOURCE
                </span>
                <span className="text-[10px] font-mono text-slate-400">INPUT SIGNAL</span>
              </div>

              {/* Source Options */}
              <div className="space-y-2">
                {uploadedAudioBuffer ? (
                  <label
                    onClick={() => setSelectedSource('uploaded')}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedSource === 'uploaded'
                        ? 'bg-cyan-950/25 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                        : 'bg-[#0c0e18] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="audio-source"
                      checked={selectedSource === 'uploaded'}
                      onChange={() => setSelectedSource('uploaded')}
                      className="mt-1 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono font-bold text-cyan-300 truncate">
                        {uploadedFileName || 'Uploaded Track'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5 flex items-center gap-2">
                        <span>{uploadedAudioBuffer.duration.toFixed(1)}s</span>
                        <span>•</span>
                        <span>{uploadedAudioBuffer.sampleRate} Hz</span>
                        <span>•</span>
                        <span>{uploadedAudioBuffer.numberOfChannels === 2 ? 'Stereo' : 'Mono'}</span>
                      </div>
                    </div>
                  </label>
                ) : null}

                <label
                  onClick={() => setSelectedSource('demo')}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedSource === 'demo'
                      ? 'bg-purple-950/25 border-purple-500/50 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
                      : 'bg-[#0c0e18] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="audio-source"
                    checked={selectedSource === 'demo'}
                    onChange={() => setSelectedSource('demo')}
                    className="mt-1 text-purple-500 focus:ring-purple-500 cursor-pointer"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono font-bold text-purple-300">
                      Procedural Demo Loop: {activeDemoGenre}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Multi-instrument synthesizer, kicks, basslines & rhythms
                    </div>

                    {/* Duration Buttons when Demo is active */}
                    {selectedSource === 'demo' && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-purple-400" /> DURATION:
                        </span>
                        {[15, 30, 60].map(secs => (
                          <button
                            key={secs}
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setDemoDurationSecs(secs);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer transition-all ${
                              demoDurationSecs === secs
                                ? 'bg-purple-600 text-white shadow-[0_0_8px_#a855f7]'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {secs}s ({secs === 15 ? '4 Bars' : secs === 30 ? '8 Bars' : '16 Bars'})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Panel 2: Format & Bit Depth */}
            <div className="p-4 rounded-xl bg-[#090b14] border border-slate-800/90 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-display font-bold text-white tracking-wider flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-emerald-400" /> EXPORT FORMAT & QUALITY
                </span>
                <span className="text-[10px] font-mono text-slate-400">UNCOMPRESSED WAV</span>
              </div>

              {/* Bit Depth Selector */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleBitDepthChange(24)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    bitDepth === 24
                      ? 'bg-emerald-950/25 border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                      : 'bg-[#0c0e18] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg mt-0.5 ${bitDepth === 24 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-2">
                      24-BIT PCM WAV
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-normal">
                        RECOMMENDED
                      </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Studio Master standard (144 dB dynamic range) • Ideal for Spotify, Apple Music, Beatport
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleBitDepthChange(16)}
                  className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    bitDepth === 16
                      ? 'bg-cyan-950/25 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-[#0c0e18] border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg mt-0.5 ${bitDepth === 16 ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400'}`}>
                    <FileAudio className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-mono font-bold text-cyan-300">
                      16-BIT PCM WAV
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Red Book CD Audio standard (96 dB dynamic range) • Maximum legacy device compatibility
                    </div>
                  </div>
                </button>
              </div>

              {/* Custom Filename */}
              <div className="pt-2 border-t border-slate-800/80">
                <label className="text-[10px] font-mono text-slate-400 block mb-1">
                  OUTPUT FILENAME:
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-[#0c0e18] border border-slate-700 text-xs font-mono text-cyan-300 focus:outline-none focus:border-emerald-500"
                  placeholder="Mastered_Track.wav"
                />
              </div>
            </div>
          </div>

          {/* Render Action Button or Rendering Progress Bar */}
          <div className="space-y-3">
            {isRendering ? (
              <div className="p-4 rounded-xl bg-[#090b14] border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    RENDERING AUDIO CHAIN...
                  </span>
                  <span className="text-emerald-300 font-bold">{renderProgress}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-green-400 transition-all duration-300 rounded-full"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <p className="text-[11px] font-mono text-slate-400 animate-pulse">
                  {renderStatus}
                </p>
              </div>
            ) : (
              <button
                id="btn-render-master"
                onClick={handleStartRender}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-display font-bold tracking-wider text-sm shadow-[0_0_25px_rgba(16,185,129,0.3)] hover:shadow-[0_0_35px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Sparkles className="w-4 h-4 text-emerald-200" />
                {renderResult ? 'RE-RENDER MASTER WITH CURRENT DSP' : 'START 64-BIT DSP MASTER RENDER'}
              </button>
            )}

            {/* Error notice */}
            {renderError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs font-mono">
                Error during render: {renderError}
              </div>
            )}
          </div>

          {/* Render Result & Download Link Section */}
          {renderResult && (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-[#0e1622] to-[#0a0c16] border border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] space-y-4 animate-in fade-in duration-300">
              
              {/* Success Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm font-display font-bold text-white tracking-wider">
                    MASTER RENDER COMPLETE
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    READY FOR EXPORT
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {renderResult.stats.fileSizeFormatted} • {renderResult.stats.durationFormatted} ({renderResult.stats.duration}s)
                </div>
              </div>

              {/* Loudness & Quality Telemetry Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                
                {/* Ceiling / Peak */}
                <div className="p-2.5 rounded-xl bg-[#080b13] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">TRUE PEAK</div>
                  <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5">
                    {renderResult.stats.peakDb >= 0 ? `+${renderResult.stats.peakDb}` : renderResult.stats.peakDb} dBFS
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                    Ceiling: {limiterState.ceiling} dBFS
                  </div>
                </div>

                {/* Integrated Loudness */}
                <div className="p-2.5 rounded-xl bg-[#080b13] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">INTEGRATED LUFS</div>
                  <div className="text-sm font-mono font-bold text-cyan-400 mt-0.5">
                    {renderResult.stats.lufsEstimate} LUFS
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                    Target: {limiterState.targetLufs} LUFS
                  </div>
                </div>

                {/* RMS Level */}
                <div className="p-2.5 rounded-xl bg-[#080b13] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">RMS ENERGY</div>
                  <div className="text-sm font-mono font-bold text-purple-400 mt-0.5">
                    {renderResult.stats.rmsDb} dBFS
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                    Dynamic range
                  </div>
                </div>

                {/* Crest Factor */}
                <div className="p-2.5 rounded-xl bg-[#080b13] border border-slate-800">
                  <div className="text-[10px] font-mono text-slate-400">CREST FACTOR</div>
                  <div className="text-sm font-mono font-bold text-amber-400 mt-0.5">
                    {renderResult.stats.crestFactor} dB
                  </div>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">
                    Transient punch
                  </div>
                </div>
              </div>

              {/* In-Modal Audio Audition Player */}
              <div className="p-3 rounded-xl bg-[#080911] border border-slate-800 flex items-center gap-3">
                <audio
                  ref={previewAudioRef}
                  src={renderResult.url}
                  onTimeUpdate={handlePreviewTimeUpdate}
                  onEnded={handlePreviewEnded}
                  preload="auto"
                />
                
                <button
                  onClick={handleTogglePreviewPlay}
                  className="p-2 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)] cursor-pointer transition-all"
                  title={isPlayingPreview ? 'Pause audition' : 'Audition mastered file'}
                >
                  {isPlayingPreview ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>

                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Volume2 className="w-3.5 h-3.5" />
                      AUDITION MASTERED WAV
                    </span>
                    <span>
                      {Math.floor(previewCurrentTime / 60)}:
                      {Math.floor(previewCurrentTime % 60).toString().padStart(2, '0')} / {renderResult.stats.durationFormatted}
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={renderResult.stats.duration}
                    step={0.1}
                    value={previewCurrentTime}
                    onChange={handleSeekPreview}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>

              {/* The Download Link & Direct Action Button */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                
                {/* HTML Direct Download Link (Satisfies explicit user link request) */}
                <a
                  id="link-download-wav"
                  href={renderResult.url}
                  download={fileName || 'Mastered_Track.wav'}
                  className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-black font-display font-bold tracking-wider text-sm shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] transition-all flex items-center justify-center gap-2 cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] text-center"
                >
                  <Download className="w-4 h-4" />
                  DOWNLOAD MASTERED WAV ({renderResult.stats.fileSizeFormatted})
                </a>

                {/* Secondary Button to trigger instant save */}
                <button
                  type="button"
                  onClick={handleDownloadNow}
                  className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  SAVE COPY
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800/80 px-6 py-3 bg-[#080911] flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Studio Precision: 64-bit float internal rendering → {bitDepth}-bit PCM RIFF</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
