import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EQBand } from '../types';

interface SpectrumAnalyzerProps {
  getPreData: (array: Uint8Array) => void;
  getPostData: (array: Uint8Array) => void;
  eqBands: EQBand[];
  isPlaying: boolean;
  className?: string;
  onUpdateBand?: (index: number, updated: Partial<EQBand>) => void;
  activeBandIndex?: number;
  onSelectBand?: (index: number) => void;
  getEQResponse?: (freqs: Float32Array) => Float32Array;
}

const BAND_COLORS = [
  { stroke: '#06b6d4', glow: 'rgba(6, 182, 212, 0.6)', fill: '#0891b2', text: 'text-cyan-400' },
  { stroke: '#c084fc', glow: 'rgba(192, 132, 252, 0.6)', fill: '#9333ea', text: 'text-purple-400' },
  { stroke: '#34d399', glow: 'rgba(52, 211, 153, 0.6)', fill: '#059669', text: 'text-emerald-400' },
  { stroke: '#fbbf24', glow: 'rgba(251, 191, 36, 0.6)', fill: '#d97706', text: 'text-amber-400' },
  { stroke: '#fb7185', glow: 'rgba(251, 113, 133, 0.6)', fill: '#e11d48', text: 'text-rose-400' }
];

export const SpectrumAnalyzer: React.FC<SpectrumAnalyzerProps> = ({
  getPreData,
  getPostData,
  eqBands,
  isPlaying,
  className = '',
  onUpdateBand,
  activeBandIndex = 0,
  onSelectBand,
  getEQResponse
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const peakHoldRef = useRef<Float32Array | null>(null);
  const [hoveredBand, setHoveredBand] = useState<number | null>(null);
  const [draggingBand, setDraggingBand] = useState<number | null>(null);
  const draggingBandRef = useRef<number | null>(null);
  const eqBandsRef = useRef<EQBand[]>(eqBands);
  eqBandsRef.current = eqBands;

  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);

  // Helper: map frequency (Hz) to X coordinate
  const freqToX = useCallback((freq: number, width: number) => {
    const clamped = Math.max(20, Math.min(20000, freq));
    return ((Math.log10(clamped) - minLog) / (maxLog - minLog)) * width;
  }, [minLog, maxLog]);

  // Helper: map X coordinate to frequency (Hz)
  const xToFreq = useCallback((x: number, width: number) => {
    const norm = Math.max(0, Math.min(1, x / width));
    return Math.round(Math.pow(10, minLog + norm * (maxLog - minLog)));
  }, [minLog, maxLog]);

  // Helper: map gain (dB) to Y coordinate (0dB is at 0.45 * height, +12dB at 0.1*height, -12dB at 0.8*height)
  const gainToY = useCallback((gain: number, height: number) => {
    const zeroY = 0.45 * height;
    const dbScale = (0.35 * height) / 12; // 12 dB = 0.35 of height
    return zeroY - gain * dbScale;
  }, []);

  // Helper: map Y coordinate to gain (dB)
  const yToGain = useCallback((y: number, height: number) => {
    const zeroY = 0.45 * height;
    const dbScale = (0.35 * height) / 12;
    const rawGain = (zeroY - y) / dbScale;
    return Math.max(-12, Math.min(12, Math.round(rawGain * 10) / 10));
  }, []);

  // Analytical fallback for EQ curve calculation if native getEQResponse is not yet attached
  const calculateEQCurvePoints = useCallback((numPoints: number): { freqs: Float32Array; dbs: Float32Array } => {
    const freqs = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      const norm = i / (numPoints - 1);
      freqs[i] = Math.pow(10, minLog + norm * (maxLog - minLog));
    }

    if (getEQResponse) {
      try {
        const dbs = getEQResponse(freqs);
        return { freqs, dbs };
      } catch {
        // fallback
      }
    }

    // Analytical calculation of combined biquad response
    const dbs = new Float32Array(numPoints);
    const bands = eqBandsRef.current;
    const soloIdx = bands.findIndex(b => Boolean(b.solo));
    const isSoloActive = soloIdx !== -1;

    for (let i = 0; i < numPoints; i++) {
      const f = freqs[i];
      let totalDb = 0;

      for (let bIdx = 0; bIdx < bands.length; bIdx++) {
        const band = bands[bIdx];
        if (isSoloActive && bIdx !== soloIdx) continue;
        if (!isSoloActive && (!band.enabled || band.gain === 0)) continue;
        const f0 = band.freq;
        const G = isSoloActive ? (band.gain || 6) : band.gain;
        const Q = Math.max(0.2, band.q);

        if (band.type === 'peaking' || isSoloActive) {
          // Bell filter response approximation
          const ratio = Math.log2(f / f0);
          const bandwidthOctaves = 1 / Q;
          const factor = Math.exp(-Math.pow(ratio / (bandwidthOctaves * 0.7), 2));
          totalDb += G * factor;
        } else if (band.type === 'lowshelf') {
          if (f < f0) {
            const factor = 1 / (1 + Math.pow(f / f0, 2 * Q));
            totalDb += G * factor;
          } else {
            const factor = Math.max(0, 1 - (f - f0) / f0);
            totalDb += G * factor * 0.2;
          }
        } else if (band.type === 'highshelf') {
          if (f > f0) {
            const factor = 1 - 1 / (1 + Math.pow(f / f0, 2 * Q));
            totalDb += G * factor;
          } else {
            const factor = Math.max(0, 1 - (f0 - f) / f0);
            totalDb += G * factor * 0.2;
          }
        }
      }
      dbs[i] = Math.max(-18, Math.min(18, totalDb));
    }

    return { freqs, dbs };
  }, [minLog, maxLog, getEQResponse]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const fftSize = 512;
    const preArray = new Uint8Array(fftSize);
    const postArray = new Uint8Array(fftSize);

    if (!peakHoldRef.current || peakHoldRef.current.length !== fftSize) {
      peakHoldRef.current = new Float32Array(fftSize);
    }
    const peakHold = peakHoldRef.current;

    const render = () => {
      animationFrameId = requestAnimationFrame(render);

      const width = canvas.width;
      const height = canvas.height;

      // 1. Clear background
      ctx.fillStyle = '#0a0b12';
      ctx.fillRect(0, 0, width, height);

      // 2. Grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#161928';
      ctx.fillStyle = '#475569';
      ctx.font = '9px JetBrains Mono, monospace';

      // Horizontal dB lines
      const dbLines = [
        { label: '+12 dB', gain: 12 },
        { label: '+6 dB', gain: 6 },
        { label: '0 dB', gain: 0 },
        { label: '-6 dB', gain: -6 },
        { label: '-12 dB', gain: -12 }
      ];

      dbLines.forEach(line => {
        const y = gainToY(line.gain, height);
        ctx.beginPath();
        ctx.strokeStyle = line.gain === 0 ? '#1e293b' : '#141724';
        ctx.lineWidth = line.gain === 0 ? 1.5 : 1;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        ctx.fillStyle = line.gain === 0 ? '#64748b' : '#334155';
        ctx.fillText(line.label, width - 46, y - 3);
      });

      // Frequency grid lines
      const freqsGrid = [
        { hz: 50, label: '50' },
        { hz: 100, label: '100' },
        { hz: 250, label: '250' },
        { hz: 500, label: '500' },
        { hz: 1000, label: '1k' },
        { hz: 2500, label: '2.5k' },
        { hz: 5000, label: '5k' },
        { hz: 10000, label: '10k' },
        { hz: 16000, label: '16k' }
      ];

      freqsGrid.forEach(f => {
        const x = freqToX(f.hz, width);
        ctx.beginPath();
        ctx.strokeStyle = '#141724';
        ctx.lineWidth = 1;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.fillStyle = '#334155';
        ctx.fillText(f.label, x + 3, height - 6);
      });

      // 3. Draw Real-time FFT spectrums if audio is playing
      getPreData(preArray);
      getPostData(postArray);

      // Decay peak hold
      for (let i = 0; i < fftSize; i++) {
        peakHold[i] = Math.max(postArray[i], peakHold[i] * 0.985);
      }

      if (isPlaying) {
        // Draw Pre-DSP Input Curve (faint outline)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1.2;
        let started = false;
        for (let i = 2; i < fftSize; i++) {
          const freq = (i / fftSize) * 22050;
          if (freq < 20 || freq > 20000) continue;
          const x = freqToX(freq, width);
          const normVal = preArray[i] / 255;
          const y = height - normVal * height * 0.9;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        // Draw Post-Master Neon Filled Spectrum
        ctx.beginPath();
        ctx.moveTo(0, height);
        started = false;
        for (let i = 2; i < fftSize; i++) {
          const freq = (i / fftSize) * 22050;
          if (freq < 20 || freq > 20000) continue;
          const x = freqToX(freq, width);
          const normVal = postArray[i] / 255;
          const y = height - normVal * height * 0.9;
          if (!started) {
            ctx.lineTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
        grad.addColorStop(0.5, 'rgba(168, 85, 247, 0.15)');
        grad.addColorStop(1, 'rgba(15, 23, 42, 0.02)');
        ctx.fillStyle = grad;
        ctx.fill();

        // Top Post Stroke
        ctx.beginPath();
        started = false;
        for (let i = 2; i < fftSize; i++) {
          const freq = (i / fftSize) * 22050;
          if (freq < 20 || freq > 20000) continue;
          const x = freqToX(freq, width);
          const normVal = postArray[i] / 255;
          const y = height - normVal * height * 0.9;
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 4. DRAW 5-BAND PARAMETRIC EQ CURVE (Composite frequency response)
      const { freqs, dbs } = calculateEQCurvePoints(160);
      const zeroY = gainToY(0, height);

      // Draw EQ Curve Gradient Fill between 0dB and response curve
      ctx.beginPath();
      ctx.moveTo(freqToX(freqs[0], width), zeroY);
      for (let i = 0; i < freqs.length; i++) {
        const x = freqToX(freqs[i], width);
        const y = gainToY(dbs[i], height);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(freqToX(freqs[freqs.length - 1], width), zeroY);
      ctx.closePath();

      const eqFill = ctx.createLinearGradient(0, zeroY - 40, 0, zeroY + 40);
      eqFill.addColorStop(0, 'rgba(6, 182, 212, 0.18)');
      eqFill.addColorStop(0.5, 'rgba(56, 189, 248, 0.08)');
      eqFill.addColorStop(1, 'rgba(168, 85, 247, 0.12)');
      ctx.fillStyle = eqFill;
      ctx.fill();

      // Draw EQ Neon Line
      ctx.beginPath();
      for (let i = 0; i < freqs.length; i++) {
        const x = freqToX(freqs[i], width);
        const y = gainToY(dbs[i], height);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // 5. DRAW INTERACTIVE EQ NODES (B1 - B5)
      const bands = eqBandsRef.current;
      bands.forEach((band, idx) => {
        const x = freqToX(band.freq, width);
        const y = gainToY(band.gain, height);
        const isHovered = hoveredBand === idx;
        const isSelected = activeBandIndex === idx;
        const isDraggingThis = draggingBand === idx;
        const isSolo = Boolean(band.solo);
        const color = BAND_COLORS[idx] || BAND_COLORS[0];

        // Draw translucent audition zone column if band is soloed
        if (isSolo) {
          const qVal = Math.max(0.3, band.q);
          const lowF = Math.max(20, band.freq / Math.pow(2, 0.8 / qVal));
          const highF = Math.min(20000, band.freq * Math.pow(2, 0.8 / qVal));
          const x1 = freqToX(lowF, width);
          const x2 = freqToX(highF, width);
          const zoneWidth = Math.max(10, x2 - x1);

          ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
          ctx.fillRect(x1, 0, zoneWidth, height);
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.setLineDash([3, 3]);
          ctx.lineWidth = 1;
          ctx.strokeRect(x1, 0, zoneWidth, height);
          ctx.setLineDash([]);
        }

        // Draw connecting vertical guide line if selected/dragged/soloed
        if (isSolo || isSelected || isDraggingThis) {
          ctx.beginPath();
          ctx.strokeStyle = isSolo ? 'rgba(245, 158, 11, 0.8)' : color.glow;
          ctx.setLineDash([2, 2]);
          ctx.lineWidth = 1;
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Pulse ring if active or hovered or soloed
        if (isSolo || isSelected || isHovered || isDraggingThis) {
          ctx.beginPath();
          ctx.arc(x, y, isSolo ? 14 : isDraggingThis ? 14 : 11, 0, Math.PI * 2);
          ctx.fillStyle = isSolo ? 'rgba(245, 158, 11, 0.3)' : color.glow;
          ctx.fill();
        }

        // Outer rim
        ctx.beginPath();
        ctx.arc(x, y, isSolo ? 8 : 7, 0, Math.PI * 2);
        ctx.fillStyle = isSolo ? '#f59e0b' : band.enabled ? color.stroke : '#475569';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = isSolo ? '#fef08a' : '#ffffff';
        ctx.stroke();

        // Inner core
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0b12';
        ctx.fill();

        // Badge pill with label & values
        const label = isSolo ? `B${idx + 1} SOLO` : `B${idx + 1}`;
        ctx.font = 'bold 10px Rajdhani, sans-serif';
        const labelWidth = ctx.measureText(label).width;

        // Draw pill background
        const pillX = x - labelWidth / 2 - 4;
        const pillY = y - 22;
        ctx.fillStyle = isSolo ? '#451a03' : isSelected ? '#1e293b' : 'rgba(15, 23, 42, 0.85)';
        ctx.strokeStyle = isSolo ? '#f59e0b' : isSelected ? color.stroke : '#334155';
        ctx.lineWidth = 1;

        // Rounded rect for pill
        ctx.beginPath();
        ctx.roundRect(pillX, pillY, labelWidth + 8, 14, 3);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = isSolo ? '#fef08a' : isSelected ? '#ffffff' : color.stroke;
        ctx.fillText(label, pillX + 4, pillY + 10);

        // Tooltip with live Hz & dB when dragging, hovering, or soloed
        if (isDraggingThis || isHovered || isSolo) {
          const freqStr = band.freq >= 1000 ? `${(band.freq / 1000).toFixed(1)}kHz` : `${band.freq}Hz`;
          const gainStr = `${band.gain > 0 ? '+' : ''}${band.gain.toFixed(1)}dB`;
          const infoStr = isSolo
            ? `SOLO AUDITION: ${freqStr} | Q:${band.q.toFixed(1)}`
            : `${freqStr} | ${gainStr} | Q:${band.q.toFixed(1)}`;

          ctx.font = '10px JetBrains Mono, monospace';
          const infoW = ctx.measureText(infoStr).width;
          const infoX = Math.max(10, Math.min(width - infoW - 14, x - infoW / 2));
          const infoY = y > height - 45 ? y - 36 : y + 16;

          ctx.fillStyle = isSolo ? '#1c1917' : '#090d16';
          ctx.strokeStyle = isSolo ? '#f59e0b' : color.stroke;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(infoX - 5, infoY - 11, infoW + 10, 16, 4);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isSolo ? '#fef08a' : '#f8fafc';
          ctx.fillText(infoStr, infoX, infoY);
        }
      });
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    getPreData,
    getPostData,
    isPlaying,
    hoveredBand,
    draggingBand,
    activeBandIndex,
    calculateEQCurvePoints,
    freqToX,
    gainToY
  ]);

  // Pointer interaction: Find closest band node within hit radius
  const findBandAtCoords = useCallback((clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const bands = eqBandsRef.current;
    for (let i = 0; i < bands.length; i++) {
      const bx = freqToX(bands[i].freq, canvas.width);
      const by = gainToY(bands[i].gain, canvas.height);
      const dist = Math.hypot(x - bx, y - by);
      if (dist <= 24) {
        return i;
      }
    }
    return null;
  }, [freqToX, gainToY]);

  // Handle pointer down on canvas
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click
    const targetBand = findBandAtCoords(e.clientX, e.clientY);

    if (targetBand !== null) {
      e.preventDefault();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      draggingBandRef.current = targetBand;
      setDraggingBand(targetBand);
      onSelectBand?.(targetBand);
    } else {
      // Clicked on canvas background: select the band closest along frequency axis
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const clickedFreq = xToFreq(x, canvas.width);

      let closestIdx = 0;
      let minDiff = Infinity;
      eqBandsRef.current.forEach((b, idx) => {
        const diff = Math.abs(Math.log10(b.freq) - Math.log10(clickedFreq));
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = idx;
        }
      });
      onSelectBand?.(closestIdx);
    }
  };

  // Handle pointer move (dragging node or updating hover)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    if (draggingBandRef.current !== null && onUpdateBand) {
      e.preventDefault();
      const bandIdx = draggingBandRef.current;
      const newFreq = xToFreq(x, canvas.width);
      const newGain = yToGain(y, canvas.height);

      onUpdateBand(bandIdx, {
        freq: newFreq,
        gain: newGain
      });
    } else {
      // Check hover
      const hovered = findBandAtCoords(e.clientX, e.clientY);
      setHoveredBand(hovered);
    }
  };

  // Handle pointer up/cancel
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (draggingBandRef.current !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      draggingBandRef.current = null;
      setDraggingBand(null);
    }
  };

  // Double click resets node gain to 0 dB
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const target = findBandAtCoords(e.clientX, e.clientY);
    if (target !== null && onUpdateBand) {
      onUpdateBand(target, { gain: 0 });
    }
  };

  // Mouse wheel over node adjusts Q / bandwidth
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const target = findBandAtCoords(e.clientX, e.clientY);
    if (target !== null && onUpdateBand) {
      const currentQ = eqBandsRef.current[target]?.q || 1.0;
      const direction = e.deltaY < 0 ? 0.2 : -0.2;
      const newQ = Math.max(0.2, Math.min(12, Math.round((currentQ + direction) * 10) / 10));
      onUpdateBand(target, { q: newQ });
    }
  };

  return (
    <div className={`relative rounded-xl border border-slate-800/80 bg-[#0a0b12] p-2.5 overflow-hidden shadow-2xl ${className}`}>
      {/* Top Overlay Legend & Status */}
      <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-[10px] font-mono select-none z-10 pointer-events-none">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#06b6d4]" />
            ACTIVE EQ CURVE (DRAGGABLE NODES)
          </span>
          <span className="flex items-center gap-1.5 text-sky-400/80">
            <span className="w-2 h-2 rounded-full border border-sky-400" />
            SPECTRUM FFT
          </span>
        </div>

        <div className="text-slate-500 hidden sm:flex items-center gap-2">
          <span>Drag nodes to adjust Hz / dB</span>
          <span>•</span>
          <span>Double-click to reset</span>
          <span>•</span>
          <span>Scroll wheel for Q</span>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={740}
        height={220}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className={`w-full h-full block rounded-lg touch-none ${
          draggingBand !== null ? 'cursor-grabbing' : hoveredBand !== null ? 'cursor-grab' : 'cursor-crosshair'
        }`}
      />
    </div>
  );
};
