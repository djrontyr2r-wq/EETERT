import React, { useState } from 'react';
import { R2RLogo } from './R2RLogo';
import { X, Download, Sparkles, Check, Disc3, ShieldCheck } from 'lucide-react';

interface R2RLogoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const R2RLogoModal: React.FC<R2RLogoModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownloadPNG = () => {
    const link = document.createElement('a');
    link.href = '/rzr-logo.png';
    link.download = 'R2R-MUSIC-Logo.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopySVG = () => {
    const svgEl = document.getElementById('r2r-modal-svg');
    if (svgEl) {
      navigator.clipboard.writeText(svgEl.outerHTML);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl bg-[#0d0f1a] border border-red-500/30 p-6 shadow-[0_0_50px_rgba(238,0,24,0.25)] overflow-hidden">
        {/* Glow ambient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-red-600/15 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5 relative z-10">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <h2 className="text-sm font-display uppercase font-bold text-white tracking-wider">
              R2R MUSIC • OFFICIAL BRAND EMBLEM
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Master Logo Showcase Canvas */}
        <div className="relative flex flex-col items-center justify-center p-8 rounded-2xl bg-gradient-to-b from-[#141829] via-[#090b14] to-[#05060b] border border-slate-800 shadow-inner overflow-hidden mb-5">
          {/* Subtle Studio Grid pattern */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          <div id="r2r-modal-svg" className="py-4">
            <R2RLogo size="hero" showGlow animated />
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> VERIFIED STUDIO ASSET
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              VECTOR 600×380
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
              3D SHADOW & BEVEL
            </span>
          </div>
        </div>

        {/* Description & Audio Spec */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-[11px] font-mono text-slate-300">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
              <Disc3 className="w-3.5 h-3.5" />
              <span>PLUGIN RACK IDENTITY</span>
            </div>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Crafted with authentic Linkwitz-Riley crossovers, true-peak TP limiter, and neural mastering curve algorithms.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-red-400 font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>EXPORT INTEGRATION</span>
            </div>
            <p className="text-slate-400 text-[10px] leading-relaxed">
              Embedded into rendered 24-bit WAV ID3 metadata chunk tags and standalone JUCE C++ plugin skin assets.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <button
            onClick={handleCopySVG}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold transition-all cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
            {copied ? 'SVG COPIED TO CLIPBOARD' : 'COPY VECTOR SVG'}
          </button>

          <button
            onClick={handleDownloadPNG}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-display font-bold tracking-wider shadow-[0_0_18px_rgba(238,0,24,0.4)] transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            DOWNLOAD LOGO (PNG)
          </button>
        </div>
      </div>
    </div>
  );
};

export default R2RLogoModal;
