import React from 'react';

interface R2RLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
  showGlow?: boolean;
  animated?: boolean;
  onClick?: () => void;
}

export const R2RLogo: React.FC<R2RLogoProps> = ({
  className = '',
  size = 'md',
  showGlow = true,
  animated = false,
  onClick
}) => {
  // Height presets
  const sizeClasses = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-11',
    lg: 'h-14',
    hero: 'h-24'
  }[size];

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title="R2R MUSIC - Mastering Suite"
    >
      {/* Ambient Red & Cyan Underglow for Hardware Rack Depth */}
      {showGlow && (
        <div className="absolute inset-0 -z-10 blur-xl opacity-35 bg-gradient-to-r from-red-600/30 via-red-500/40 to-cyan-500/20 rounded-full scale-110 pointer-events-none" />
      )}

      <svg
        viewBox="0 0 600 380"
        className={`${sizeClasses} w-auto transition-transform duration-300 ${animated ? 'hover:scale-105' : ''}`}
        style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.75))' }}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="r2rRedGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff2233" />
            <stop offset="50%" stopColor="#ee0018" />
            <stop offset="100%" stopColor="#ba0010" />
          </linearGradient>

          <linearGradient id="r2rRedBevel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff5566" />
            <stop offset="100%" stopColor="#88000a" />
          </linearGradient>

          <linearGradient id="r2rWhiteGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="70%" stopColor="#f0f2f5" />
            <stop offset="100%" stopColor="#d5dbe2" />
          </linearGradient>

          <linearGradient id="r2rBarGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* 3D Drop Shadow Filters */}
          <filter id="r2rDropShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.85" />
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#ff0015" floodOpacity="0.3" />
          </filter>

          <filter id="r2rSoftShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.7" />
          </filter>
        </defs>

        <g filter="url(#r2rDropShadow)">
          {/* ================= TOP FRAMING BAR ================= */}
          <g>
            {/* 3D Depth Shadow */}
            <rect x="72" y="62" width="456" height="13" rx="2" fill="#000000" opacity="0.6" />
            {/* Main White Bar */}
            <rect x="70" y="60" width="460" height="13" rx="2" fill="url(#r2rWhiteGrad)" />
            {/* Top Highlight */}
            <rect x="71" y="60.5" width="458" height="2" rx="1" fill="#ffffff" opacity="0.9" />
            {/* Bottom Bevel */}
            <rect x="71" y="71" width="458" height="2" rx="1" fill="#a0a8b4" opacity="0.6" />
          </g>

          {/* ================= CENTRAL TYPOGRAPHY (R Z R) ================= */}

          {/* --- LEFT 'R' --- */}
          <g id="left-r">
            {/* 3D Extrusion Layer (Dark Red / Shadow) */}
            <path
              d="M 64 104 L 184 104 L 230 146 L 194 178 L 246 244 L 192 244 L 152 186 L 118 186 L 118 244 L 64 244 Z"
              fill="#5a0008"
              transform="translate(4, 5)"
              opacity="0.8"
            />
            {/* Red 3D Bevel Border */}
            <path
              d="M 66 102 L 186 102 L 232 144 L 196 176 L 248 242 L 194 242 L 154 184 L 120 184 L 120 242 L 66 242 Z"
              fill="url(#r2rRedBevel)"
            />
            {/* Inner Counter Hole Bevel */}
            <path
              d="M 120 128 L 176 128 L 194 146 L 176 162 L 120 162 Z"
              fill="#5a0008"
            />
            {/* Main White Face */}
            <path
              d="M 68 100 L 188 100 L 234 142 L 198 174 L 250 240 L 196 240 L 156 182 L 122 182 L 122 240 L 68 240 Z"
              fill="url(#r2rWhiteGrad)"
              stroke="#e2e8f0"
              strokeWidth="0.8"
            />
            {/* Left R Counter Hole */}
            <path
              d="M 122 126 L 178 126 L 196 144 L 178 160 L 122 160 Z"
              fill="#080911"
            />
            {/* Sleek metallic cut highlight on left R */}
            <path
              d="M 70 102 L 186 102 L 230 142 L 222 144 L 184 106 L 70 106 Z"
              fill="#ffffff"
              opacity="0.85"
            />
          </g>

          {/* --- CENTER 'Z' (OR 2) --- */}
          <g id="center-z">
            {/* 3D Shadow Layer */}
            <path
              d="M 218 99 L 360 99 L 360 137 L 290 199 L 362 199 L 362 241 L 214 241 L 214 203 L 284 141 L 218 141 Z"
              fill="#400005"
              transform="translate(4, 5)"
              opacity="0.9"
            />
            {/* Red 3D Extrusion Bevel */}
            <path
              d="M 219 98 L 361 98 L 361 136 L 291 198 L 363 198 L 363 240 L 215 240 L 215 202 L 285 140 L 219 140 Z"
              fill="#990010"
            />
            {/* Main Red Z Face */}
            <path
              d="M 220 96 L 362 96 L 362 134 L 292 196 L 364 196 L 364 238 L 216 238 L 216 200 L 286 138 L 220 138 Z"
              fill="url(#r2rRedGrad)"
              stroke="#ff4d5a"
              strokeWidth="0.75"
            />
            {/* Top Bar Edge Highlight */}
            <path
              d="M 221 97 L 361 97 L 361 103 L 221 103 Z"
              fill="#ff7785"
              opacity="0.6"
            />
            {/* Diagonal Slash Highlight */}
            <path
              d="M 362 134 L 292 196 L 302 196 L 362 144 Z"
              fill="#ffffff"
              opacity="0.3"
            />
            {/* Bottom Bar Highlight */}
            <path
              d="M 217 232 L 363 232 L 363 237 L 217 237 Z"
              fill="#ff4d5a"
              opacity="0.5"
            />
          </g>

          {/* --- RIGHT 'R' --- */}
          <g id="right-r">
            {/* 3D Extrusion Layer */}
            <path
              d="M 358 104 L 478 104 L 524 146 L 488 178 L 540 244 L 486 244 L 446 186 L 412 186 L 412 244 L 358 244 Z"
              fill="#5a0008"
              transform="translate(4, 5)"
              opacity="0.8"
            />
            {/* Red 3D Bevel Border */}
            <path
              d="M 360 102 L 480 102 L 526 144 L 490 176 L 542 242 L 488 242 L 448 184 L 414 184 L 414 242 L 360 242 Z"
              fill="url(#r2rRedBevel)"
            />
            {/* Inner Counter Hole Bevel */}
            <path
              d="M 414 128 L 470 128 L 488 146 L 470 162 L 414 162 Z"
              fill="#5a0008"
            />
            {/* Main White Face */}
            <path
              d="M 362 100 L 482 100 L 528 142 L 492 174 L 544 240 L 490 240 L 450 182 L 416 182 L 416 240 L 362 240 Z"
              fill="url(#r2rWhiteGrad)"
              stroke="#e2e8f0"
              strokeWidth="0.8"
            />
            {/* Right R Counter Hole */}
            <path
              d="M 416 126 L 472 126 L 490 144 L 472 160 L 416 160 Z"
              fill="#080911"
            />
            {/* Sleek metallic cut highlight on right R */}
            <path
              d="M 364 102 L 480 102 L 524 142 L 516 144 L 478 106 L 364 106 Z"
              fill="#ffffff"
              opacity="0.85"
            />
          </g>

          {/* ================= BOTTOM FRAMING BAR ================= */}
          <g>
            {/* 3D Depth Shadow */}
            <rect x="72" y="277" width="456" height="13" rx="2" fill="#000000" opacity="0.6" />
            {/* Main White Bar */}
            <rect x="70" y="275" width="460" height="13" rx="2" fill="url(#r2rWhiteGrad)" />
            {/* Top Highlight */}
            <rect x="71" y="275.5" width="458" height="2" rx="1" fill="#ffffff" opacity="0.9" />
            {/* Bottom Bevel */}
            <rect x="71" y="286" width="458" height="2" rx="1" fill="#a0a8b4" opacity="0.6" />
          </g>

          {/* ================= "MUSIC" FUTURISTIC STENCIL TEXT ================= */}
          <g filter="url(#r2rSoftShadow)">
            {/* 'M' */}
            <path
              d="M 174 310 L 192 310 L 208 334 L 224 310 L 242 310 L 242 344 L 226 344 L 226 324 L 214 342 L 202 342 L 190 324 L 190 344 L 174 344 Z"
              fill="url(#r2rWhiteGrad)"
            />
            {/* 'U' */}
            <path
              d="M 256 310 L 272 310 L 272 332 L 296 332 L 296 310 L 312 310 L 312 344 L 256 344 Z"
              fill="url(#r2rWhiteGrad)"
            />
            {/* 'S' */}
            <path
              d="M 326 310 L 372 310 L 372 322 L 344 322 L 344 325 L 372 329 L 372 344 L 326 344 L 326 332 L 354 332 L 354 329 L 326 325 Z"
              fill="url(#r2rWhiteGrad)"
            />
            {/* 'I' */}
            <path
              d="M 386 310 L 402 310 L 402 344 L 386 344 Z"
              fill="url(#r2rWhiteGrad)"
            />
            {/* 'C' */}
            <path
              d="M 416 310 L 464 310 L 464 322 L 434 322 L 434 332 L 464 332 L 464 344 L 416 344 Z"
              fill="url(#r2rWhiteGrad)"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};

export default R2RLogo;
