import React from 'react';
import { AudioAnalysisMetrics } from '../types';

interface MasterMeterProps {
  metrics: AudioAnalysisMetrics;
  targetLufs: number;
}

export const MasterMeter: React.FC<MasterMeterProps> = ({
  metrics,
  targetLufs
}) => {
  const isClipping = metrics.peakDb >= -0.05;

  // Normalized heights for bar meters (-60 dB to 0 dB)
  const peakNorm = Math.max(0, Math.min(1, (metrics.peakDb + 60) / 60));
  const lufsNorm = Math.max(0, Math.min(1, (metrics.lufsShortTerm + 60) / 60));
  const targetNorm = Math.max(0, Math.min(1, (targetLufs + 60) / 60));

  // Phase correlation: -1 to +1 mapped to 0% to 100%
  const corrNorm = Math.max(0, Math.min(1, (metrics.correlation + 1) / 2));

  return (
    <div className="flex flex-col h-full justify-between p-2.5 rounded-xl border border-slate-800/80 bg-[#0a0b12]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
        <span className="text-[11px] font-display uppercase tracking-wider text-slate-300 font-bold">
          MASTER OUTPUT
        </span>
        <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
          isClipping ? 'bg-rose-500 text-white shadow-[0_0_8px_#f43f5e]' : 'bg-slate-800 text-slate-400'
        }`}>
          {isClipping ? 'CLIP' : '0 dBFS'}
        </div>
      </div>

      {/* Main Meters Grid */}
      <div className="flex items-stretch justify-around gap-2 py-2 flex-1">
        {/* Peak Bar */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-display font-bold text-slate-400">PEAK</span>
          <div className="relative w-4 h-28 rounded bg-[#0e101a] border border-slate-800/80 overflow-hidden flex flex-col justify-end">
            <div
              className={`w-full transition-all duration-75 ${
                metrics.peakDb > -1
                  ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                  : metrics.peakDb > -6
                  ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]'
                  : 'bg-cyan-400 shadow-[0_0_6px_#06b6d4]'
              }`}
              style={{ height: `${peakNorm * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-cyan-300 font-medium">
            {metrics.peakDb.toFixed(1)}
          </span>
        </div>

        {/* LUFS Bar with Target Indicator */}
        <div className="flex flex-col items-center gap-1 flex-1">
          <span className="text-[10px] font-display font-bold text-slate-400">LUFS</span>
          <div className="relative w-4 h-28 rounded bg-[#0e101a] border border-slate-800/80 overflow-hidden flex flex-col justify-end">
            {/* Target line */}
            <div
              className="absolute left-0 right-0 h-[2px] bg-emerald-400 z-10 shadow-[0_0_6px_#34d399]"
              style={{ bottom: `${targetNorm * 100}%` }}
            />
            {/* Actual LUFS fill */}
            <div
              className="w-full bg-emerald-500/80 transition-all duration-100 shadow-[0_0_6px_#10b981]"
              style={{ height: `${lufsNorm * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            {metrics.lufsIntegrated.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Footer Metrics: Phase Correlation & Crest Factor */}
      <div className="border-t border-slate-800/60 pt-2 flex flex-col gap-1.5 text-[9px] font-mono">
        <div className="flex items-center justify-between text-slate-400">
          <span>CORRELATION</span>
          <span className={metrics.correlation < 0 ? 'text-rose-400' : 'text-emerald-400'}>
            {metrics.correlation > 0 ? `+${metrics.correlation.toFixed(2)}` : metrics.correlation.toFixed(2)}
          </span>
        </div>

        {/* Phase Correlation Bar */}
        <div className="relative w-full h-1.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
          <div className="absolute top-0 bottom-0 left-1/2 w-[1px] bg-slate-700" />
          <div
            className="absolute top-0 bottom-0 w-2 rounded-full bg-cyan-400 transition-all duration-100 shadow-[0_0_6px_#06b6d4]"
            style={{ left: `calc(${corrNorm * 100}% - 4px)` }}
          />
        </div>

        <div className="flex items-center justify-between text-slate-400 mt-0.5">
          <span>CREST (DYN)</span>
          <span className="text-purple-300 font-bold">{metrics.crestFactor.toFixed(1)} dB</span>
        </div>
      </div>
    </div>
  );
};
