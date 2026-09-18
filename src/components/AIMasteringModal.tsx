import React, { useEffect, useState } from 'react';
import { AIMasteringResult } from '../audio/aiMastering';
import { Sparkles, CheckCircle, Activity, Disc, Zap, Volume2, Cpu, ArrowRight } from 'lucide-react';

interface AIMasteringModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  result: AIMasteringResult | null;
  onApply: () => void;
  onClose: () => void;
}

export const AIMasteringModal: React.FC<AIMasteringModalProps> = ({
  isOpen,
  isLoading = false,
  result,
  onApply,
  onClose
}) => {
  const [step, setStep] = useState<number>(4);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      const timer1 = setTimeout(() => setStep(2), 250);
      const timer2 = setTimeout(() => setStep(3), 500);
      const timer3 = setTimeout(() => setStep(4), 750);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-2xl rounded-2xl border border-purple-500/40 bg-[#0d0f1a] shadow-[0_0_50px_rgba(168,85,247,0.3)] overflow-hidden text-slate-100 p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white tracking-wider flex items-center gap-2">
                R2R AI MASTERING ASSISTANT
                {result?.isGeminiAi ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.3)] flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-cyan-400" /> GEMINI 3.8 FLASH
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-cyan-400" /> DSP INTELLIGENCE
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Real-time acoustic profiling, crest dynamics, and target loudness calibration
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 text-sm font-mono cursor-pointer p-1"
          >
            ✕
          </button>
        </div>

        {/* Loading Spinner or Results */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 border-t-purple-400 animate-spin" />
              <div className="absolute inset-2 rounded-full border-2 border-cyan-500/20 border-b-cyan-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-display font-bold text-white tracking-wider">
                ANALYZING AUDIO BUFFER WITH AI...
              </p>
              <p className="text-xs font-mono text-slate-400">
                Measuring spectral tilt, stereo correlation, and LUFS dynamics
              </p>
            </div>
          </div>
        ) : result ? (
          <div className="my-5 space-y-3">
            {/* Step 1: Feature Extraction */}
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              step >= 1 ? 'border-cyan-500/40 bg-cyan-950/20' : 'border-slate-800 bg-slate-900/40 opacity-40'
            }`}>
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-mono">Spectral & Crest Factor Analysis</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 font-bold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-cyan-400" /> COMPLETE
              </span>
            </div>

            {/* Step 2: Genre Signature Detection */}
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              step >= 2 ? 'border-purple-500/40 bg-purple-950/20' : 'border-slate-800 bg-slate-900/40 opacity-40'
            }`}>
              <div className="flex items-center gap-3">
                <Disc className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-mono">Detected Musical Signature / Genre:</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-display font-bold bg-purple-500/30 text-purple-200 border border-purple-400/50 shadow-[0_0_12px_rgba(168,85,247,0.4)]">
                {result.detectedGenre.toUpperCase()}
              </span>
            </div>

            {/* Step 3: Loudness & Target Calibration */}
            <div className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              step >= 3 ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/40 opacity-40'
            }`}>
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-mono">Mastering Loudness Target:</span>
              </div>
              <span className="text-xs font-mono text-emerald-300 font-bold">
                {result.targetMode.toUpperCase()} ({result.targetLufs} LUFS) • CEILING: {result.limiter.ceiling} dBFS
              </span>
            </div>

            {/* Step 4: DSP Adjustments Log */}
            <div className="p-4 rounded-xl border border-slate-700/80 bg-[#090a12] space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-display font-bold text-cyan-300 uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5" /> AI Recommended DSP Parameters:
                </div>
                <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/60">
                  Ready to Apply
                </span>
              </div>
              <ul className="text-xs font-mono text-slate-300 space-y-1.5 list-disc list-inside">
                {result.explanation.map((item, idx) => (
                  <li key={idx} className="leading-relaxed text-slate-300">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-mono text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            DISMISS
          </button>
          <button
            id="btn-confirm-apply-ai-master"
            onClick={() => {
              onApply();
              onClose();
            }}
            disabled={isLoading || !result}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 text-white text-xs font-display font-bold tracking-wider shadow-[0_0_20px_rgba(168,85,247,0.4)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all cursor-pointer disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4" />
            ENGAGE AI MASTERING PARAMETERS
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
