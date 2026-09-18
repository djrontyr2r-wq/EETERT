import React, { useState } from 'react';
import JSZip from 'jszip';
import { JUCE_PROJECT_FILES } from '../juce/juceProjectFiles';
import { JuceSourceFile } from '../types';
import {
  Code,
  Download,
  Copy,
  Check,
  Folder,
  FileCode,
  Cpu,
  Palette,
  Settings,
  X
} from 'lucide-react';

interface JuceCodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const JuceCodeViewer: React.FC<JuceCodeViewerProps> = ({ isOpen, onClose }) => {
  const [selectedFile, setSelectedFile] = useState<JuceSourceFile>(JUCE_PROJECT_FILES[0]);
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const rootFolder = zip.folder('R2R_AI_Mastering_Suite');

      JUCE_PROJECT_FILES.forEach(file => {
        if (rootFolder) {
          rootFolder.file(file.path, file.content);
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'R2R_AI_Mastering_Suite_JUCE_Cpp_Project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error creating ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const getCategoryIcon = (category: JuceSourceFile['category']) => {
    switch (category) {
      case 'core': return <Cpu className="w-3.5 h-3.5 text-cyan-400" />;
      case 'dsp': return <FileCode className="w-3.5 h-3.5 text-purple-400" />;
      case 'gui': return <Palette className="w-3.5 h-3.5 text-pink-400" />;
      case 'config': return <Settings className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-6xl h-[88vh] rounded-2xl border border-slate-700/80 bg-[#0c0d16] shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#111322]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-white tracking-wide flex items-center gap-2">
                R2R AI MASTERING SUITE — JUCE (C++) SOURCE EXPORT
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  VST3 + AU READY
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Complete modular C++20 JUCE project with DSP algorithms, APVTS parameter sync, and CMakeLists.txt
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadZip}
              disabled={isZipping}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-display font-bold tracking-wider shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isZipping ? 'PACKAGING ZIP...' : 'DOWNLOAD JUCE PROJECT (.ZIP)'}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* File Tree Sidebar */}
          <div className="w-64 border-r border-slate-800/80 bg-[#090a10] p-3 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider px-2 flex items-center gap-1.5 font-semibold">
                <Folder className="w-3.5 h-3.5 text-cyan-400" />
                PROJECT FILES ({JUCE_PROJECT_FILES.length})
              </div>

              <div className="space-y-1">
                {JUCE_PROJECT_FILES.map(file => {
                  const isSelected = selectedFile.path === file.path;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                      }`}
                    >
                      {getCategoryIcon(file.category)}
                      <span className="truncate">{file.filename}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick JUCE specs info */}
            <div className="mt-4 p-2.5 rounded-xl border border-slate-800 bg-[#0f111c] text-[10px] font-mono text-slate-400 space-y-1">
              <div className="text-cyan-400 font-bold">JUCE 7/8 SPECIFICATIONS:</div>
              <div>• Formats: VST3, AU, Standalone</div>
              <div>• Audio: 64-bit float Processing</div>
              <div>• Latency: 2.5ms (Limiter Lookahead)</div>
              <div>• C++ Standard: C++20</div>
            </div>
          </div>

          {/* Main Code View */}
          <div className="flex-1 flex flex-col bg-[#07080d] overflow-hidden">
            {/* File sub-header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-[#0e101b]">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-500">Path:</span>
                <span className="text-cyan-400 font-semibold">{selectedFile.path}</span>
                <span className="text-slate-600">—</span>
                <span className="text-slate-400 italic text-[11px]">{selectedFile.description}</span>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'COPIED!' : 'COPY CODE'}
              </button>
            </div>

            {/* Code Body */}
            <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300">
              <pre className="selection:bg-cyan-500/30 selection:text-cyan-200">
                <code>{selectedFile.content}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
