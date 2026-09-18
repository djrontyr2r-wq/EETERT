import React from 'react';

interface GainReductionMeterProps {
  lowGR: number;  // dB
  midGR: number;  // dB
  highGR: number; // dB
}

export const GainReductionMeter: React.FC<GainReductionMeterProps> = ({
  lowGR,
  midGR,
  highGR
}) => {
  const segments = [1, 2, 3, 4, 6, 8, 10, 12, 15, 18];

  const renderLadder = (grDb: number, label: string) => {
    return (
      <div className="flex flex-col items-center gap-1.5 flex-1">
        <span className="text-[10px] font-display font-bold text-slate-400">{label}</span>

        {/* LED Ladder bar */}
        <div className="flex flex-col gap-1 w-full max-w-[28px] p-1 rounded-md bg-[#0d0e18] border border-slate-800/80">
          {segments.map((thresh, idx) => {
            const isActive = grDb >= thresh;
            // High reduction (>8dB) turns neon red/orange, moderate is amber/yellow
            const colorClass = thresh > 8
              ? isActive ? 'bg-rose-500 shadow-[0_0_6px_#f43f5e]' : 'bg-rose-950/40'
              : thresh > 4
              ? isActive ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' : 'bg-amber-950/40'
              : isActive ? 'bg-orange-400 shadow-[0_0_5px_#fb923c]' : 'bg-orange-950/40';

            return (
              <div
                key={idx}
                className={`h-1.5 w-full rounded-xs transition-colors duration-75 ${colorClass}`}
              />
            );
          })}
        </div>

        {/* Numeric dB readout */}
        <span className="text-[11px] font-mono text-orange-400 font-medium">
          {grDb > 0.1 ? `-${grDb.toFixed(1)}` : '0.0'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full justify-between p-2.5 rounded-xl border border-slate-800/80 bg-[#0a0b12]">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
        <span className="text-[11px] font-display uppercase tracking-wider text-slate-300 font-bold">
          GR DYNAMICS
        </span>
        <span className="text-[9px] font-mono text-orange-400/80 uppercase">dB REDUCTION</span>
      </div>

      <div className="flex items-center justify-around gap-2 py-1 flex-1">
        {renderLadder(lowGR, 'LOW')}
        {renderLadder(midGR, 'MID')}
        {renderLadder(highGR, 'HIGH')}
      </div>
    </div>
  );
};
