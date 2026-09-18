import React, { useRef, useState, useCallback, useEffect } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  size?: number;
  accentColor?: 'cyan' | 'purple' | 'emerald' | 'amber' | 'rose';
  onChange: (value: number) => void;
  id?: string;
}

export const Knob: React.FC<KnobProps> = ({
  label,
  value,
  min,
  max,
  step = 0.1,
  unit = '',
  defaultValue,
  size = 64,
  accentColor = 'cyan',
  onChange,
  id
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>('');
  const startYRef = useRef<number>(0);
  const startXRef = useRef<number>(0);
  const startValRef = useRef<number>(0);

  const colors = {
    cyan: {
      led: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.45)',
      ringActive: '#38bdf8',
      text: 'text-cyan-400'
    },
    purple: {
      led: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.45)',
      ringActive: '#c084fc',
      text: 'text-purple-400'
    },
    emerald: {
      led: '#10b981',
      glow: 'rgba(16, 185, 129, 0.45)',
      ringActive: '#34d399',
      text: 'text-emerald-400'
    },
    amber: {
      led: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.45)',
      ringActive: '#fbbf24',
      text: 'text-amber-400'
    },
    rose: {
      led: '#f43f5e',
      glow: 'rgba(244, 63, 94, 0.45)',
      ringActive: '#fb7185',
      text: 'text-rose-400'
    }
  }[accentColor];

  // Normalized value (0 to 1)
  const norm = Math.max(0, Math.min(1, (value - min) / (max - min)));

  // Rotary angle: from -135deg (min) to +135deg (max), total range 270deg
  const startAngle = -135;
  const endAngle = 135;
  const currentAngle = startAngle + norm * (endAngle - startAngle);

  // SVG arc calculation
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth * 2) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = (270 / 360) * circumference;
  const strokeDashoffset = arcLength - norm * arcLength;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore if unsupported
    }

    setIsDragging(true);
    startYRef.current = e.clientY;
    startXRef.current = e.clientX;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();

    const deltaY = startYRef.current - e.clientY;
    const deltaX = e.clientX - startXRef.current;
    const range = max - min;
    const sensitivity = 160; // Pixels for full sweep

    // Allow natural upward or rightward diagonal dragging
    const netDelta = deltaY + deltaX * 0.6;
    const change = (netDelta / sensitivity) * range;
    const rawVal = startValRef.current + change;
    const clamped = Math.max(min, Math.min(max, rawVal));
    const stepped = Math.round(clamped / step) * step;

    // Preserve precision
    const precision = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    onChange(Number(stepped.toFixed(precision)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDragging(false);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const direction = e.deltaY < 0 ? 1 : -1;
    const range = max - min;
    const increment = (step || range / 100) * (e.shiftKey ? 0.2 : 1.0);
    const newVal = Math.max(min, Math.min(max, value + direction * increment));
    const precision = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    onChange(Number(newVal.toFixed(precision)));
  };

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const range = max - min;
    let increment = step || range / 100;
    if (e.shiftKey) increment *= 0.2;

    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      const newVal = Math.min(max, value + increment);
      onChange(Number(newVal.toFixed(step >= 1 ? 0 : 1)));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const newVal = Math.max(min, value - increment);
      onChange(Number(newVal.toFixed(step >= 1 ? 0 : 1)));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      onChange(max);
    }
  };

  // Submit direct typed value
  const handleEditSubmit = () => {
    setIsEditing(false);
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min, Math.min(max, parsed));
      const stepped = Math.round(clamped / step) * step;
      onChange(Number(stepped.toFixed(step >= 1 ? 0 : 1)));
    }
  };

  return (
    <div
      id={id}
      className="flex flex-col items-center select-none group focus:outline-none"
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Label */}
      <span className="text-[10px] font-display uppercase tracking-wider text-slate-400 mb-0.5 font-semibold group-hover:text-slate-200 transition-colors pointer-events-none">
        {label}
      </span>

      {/* Knob Body with LED Ring & Pointer Drag Capture */}
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={`relative cursor-ns-resize touch-none flex items-center justify-center rounded-full transition-transform ${
          isDragging ? 'scale-[1.04]' : 'hover:scale-[1.02]'
        }`}
        style={{ width: size, height: size }}
        title={`${label}: ${value} ${unit} (Drag up/down, scroll, or double-click to reset)`}
      >
        {/* SVG LED Ring */}
        <svg width={size} height={size} className="rotate-[135deg] pointer-events-none">
          {/* Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1c1f2e"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* LED Active Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.ringActive}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 6px ${colors.glow})`,
              transition: isDragging ? 'none' : 'stroke-dashoffset 0.08s ease-out'
            }}
          />
        </svg>

        {/* Center Metal Cap */}
        <div
          className="absolute rounded-full shadow-inner flex items-center justify-center border border-slate-700/60 bg-gradient-to-b from-[#252837] to-[#12141f]"
          style={{
            width: size - 14,
            height: size - 14,
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1), 0 4px 8px rgba(0,0,0,0.6)'
          }}
        >
          {/* Inner concentric ring */}
          <div className="w-[70%] h-[70%] rounded-full border border-slate-700/40 bg-gradient-to-br from-[#1b1e2a] to-[#0c0d14]" />

          {/* Indicator Dot / Notch */}
          <div
            className="absolute top-0 bottom-0 left-0 right-0 flex justify-center pointer-events-none"
            style={{
              transform: `rotate(${currentAngle}deg)`,
              transition: isDragging ? 'none' : 'transform 0.08s ease-out'
            }}
          >
            <div
              className="w-[3px] h-[7px] rounded-full mt-1.5"
              style={{
                backgroundColor: colors.led,
                boxShadow: `0 0 6px ${colors.led}`
              }}
            />
          </div>
        </div>
      </div>

      {/* Numerical readout / Click to type edit */}
      <div className="mt-0.5 flex items-baseline justify-center">
        {isEditing ? (
          <input
            type="number"
            autoFocus
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleEditSubmit}
            onKeyDown={e => {
              if (e.key === 'Enter') handleEditSubmit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            className="w-14 px-1 py-0.5 text-center text-[10px] font-mono bg-slate-900 border border-cyan-500 rounded text-cyan-300 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setEditValue(value.toString());
              setIsEditing(true);
            }}
            className="cursor-text hover:underline focus:outline-none flex items-baseline gap-0.5"
            title="Click to type exact value"
          >
            <span className={`text-[11px] font-mono font-bold ${colors.text}`}>
              {value > 0 && unit.includes('dB') ? `+${value.toFixed(step >= 1 ? 0 : 1)}` : value.toFixed(step >= 1 ? 0 : 1)}
            </span>
            <span className="text-[9px] font-mono text-slate-500">{unit}</span>
          </button>
        )}
      </div>
    </div>
  );
};
