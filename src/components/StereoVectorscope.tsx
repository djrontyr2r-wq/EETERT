import React, { useRef, useEffect } from 'react';

interface StereoVectorscopeProps {
  isPlaying: boolean;
  stereoWidth: number;
  correlation: number;
}

export const StereoVectorscope: React.FC<StereoVectorscopeProps> = ({
  isPlaying,
  stereoWidth,
  correlation
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let phase = 0;

    const render = () => {
      animId = requestAnimationFrame(render);
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(cx, cy) - 8;

      // Dark translucent background for phosphor persistence trail
      ctx.fillStyle = 'rgba(10, 11, 18, 0.25)';
      ctx.fillRect(0, 0, w, h);

      // Draw circular polar grid
      ctx.strokeStyle = '#1a1d2e';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // Draw 45-degree axis lines (Left, Right, Mid, Side)
      ctx.beginPath();
      ctx.moveTo(cx, cy - radius);
      ctx.lineTo(cx, cy + radius); // M (center vertical)
      ctx.moveTo(cx - radius, cy);
      ctx.lineTo(cx + radius, cy); // S (horizontal)
      ctx.stroke();

      // Axis labels
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillStyle = '#475569';
      ctx.fillText('+M', cx - 6, cy - radius + 10);
      ctx.fillText('+S', cx + radius - 14, cy - 3);
      ctx.fillText('-S', cx - radius + 2, cy - 3);

      if (isPlaying) {
        phase += 0.08;
        ctx.save();
        ctx.translate(cx, cy);

        // Render animated Lissajous cloud based on stereo width & correlation
        const pointCount = 48;
        const widthScale = Math.max(0.1, stereoWidth * 1.4);
        const corrScale = Math.max(0.2, (correlation + 1) * 0.5);

        ctx.strokeStyle = correlation < 0 ? '#f43f5e' : '#a855f7';
        ctx.fillStyle = correlation < 0 ? 'rgba(244, 63, 94, 0.4)' : 'rgba(168, 85, 247, 0.3)';
        ctx.shadowColor = '#a855f7';
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        for (let i = 0; i < pointCount; i++) {
          const t = i * 0.25 + phase;
          const left = Math.sin(t * 1.8) * Math.cos(t * 0.9);
          const right = Math.sin(t * 1.8 + (1 - correlation) * 1.2) * Math.cos(t * 0.7);

          // Convert L/R to 45 degree Lissajous coordinates: X = (R - L)*scale, Y = -(R + L)*scale
          const x = (right - left) * radius * 0.65 * widthScale;
          const y = -(right + left) * radius * 0.65 * corrScale;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        ctx.shadowBlur = 0;
      }
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, stereoWidth, correlation]);

  return (
    <div className="flex flex-col h-full justify-between p-2.5 rounded-xl border border-slate-800/80 bg-[#0a0b12]">
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
        <span className="text-[11px] font-display uppercase tracking-wider text-slate-300 font-bold">
          VECTORSCOPE
        </span>
        <span className="text-[9px] font-mono text-purple-400">GONIOMETER</span>
      </div>

      <div className="flex items-center justify-center py-1 flex-1">
        <canvas ref={canvasRef} width={130} height={130} className="rounded-full" />
      </div>

      <div className="border-t border-slate-800/60 pt-1 flex items-center justify-between text-[9px] font-mono text-slate-400">
        <span>WIDTH:</span>
        <span className="text-cyan-400 font-bold">{(stereoWidth * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
};
