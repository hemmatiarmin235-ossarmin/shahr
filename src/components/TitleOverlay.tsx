import React from 'react';
import { t } from '../game/i18n';
import { LanguageCode } from '../game/types';

interface TitleOverlayProps {
  lang: LanguageCode;
  onToggleLang: () => void;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ lang, onToggleLang, onStart }) => {
  const isRtl = lang === 'fa';

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-30 flex flex-col justify-between p-8 md:p-14 pointer-events-none"
      style={{
        background: isRtl
          ? 'linear-gradient(255deg, rgba(7,13,25,0.90) 0%, rgba(7,13,25,0.62) 42%, rgba(7,13,25,0.12) 78%, rgba(7,13,25,0) 100%)'
          : 'linear-gradient(105deg, rgba(7,13,25,0.90) 0%, rgba(7,13,25,0.62) 42%, rgba(7,13,25,0.12) 78%, rgba(7,13,25,0) 100%)',
      }}
    >
      {/* Top Bar: Language Toggle */}
      <div className="flex items-center justify-end pointer-events-auto">
        <button
          type="button"
          onClick={onToggleLang}
          aria-label="Switch Language"
          className="px-3.5 py-1.5 text-xs font-bold tracking-wider uppercase rounded border border-amber-400/40 bg-[#0d1729]/90 text-amber-200 hover:bg-amber-500/20 transition-colors cursor-pointer"
        >
          {lang === 'fa' ? 'EN / فارسی' : 'FA / English'}
        </button>
      </div>

      {/* Main Title Lockup sitting cleanly over calm negative-space scrim */}
      <div className="max-w-xl my-auto pointer-events-auto">
        <div dir="ltr" className="w-80 md:w-[400px] mb-4">
          <svg
            viewBox="0 0 420 106"
            className="w-full h-auto drop-shadow-[0_4px_16px_rgba(0,0,0,0.75)]"
            aria-hidden="true"
          >
          <defs>
            <linearGradient id="crestGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>
          <polygon
            points="44,8 80,28 80,74 44,94 8,74 8,28"
            fill="#0f1b2e"
            stroke="url(#crestGold)"
            strokeWidth="2.5"
          />
          <rect x="24" y="48" width="9" height="30" fill="#94a3b8" />
          <rect x="37" y="30" width="14" height="48" fill="url(#crestGold)" />
          <polygon points="44,18 51,30 37,30" fill="#fef3c7" />
          <rect x="55" y="42" width="9" height="36" fill="#38bdf8" />
          <line x1="18" y1="78" x2="70" y2="78" stroke="#f8fafc" strokeWidth="2" />

          <text
            x="98"
            y="49"
            fill="#f8fafc"
            fontSize="32"
            fontWeight="800"
            letterSpacing="1.5"
            fontFamily="Inter, Vazirmatn, sans-serif"
          >
            SHAHRSAZ 3D
          </text>
          <text
            x="100"
            y="77"
            fill="#fbbf24"
            fontSize="14.5"
            fontWeight="600"
            letterSpacing="2.4"
            fontFamily="Inter, Vazirmatn, sans-serif"
          >
            METROPOLIS ARCHITECT
          </text>
          </svg>
        </div>

        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]">
          {t(lang, 'titleMain')}
        </h1>
        <p className="text-base md:text-lg text-slate-200 mb-7 font-medium drop-shadow-[0_1px_8px_rgba(0,0,0,0.85)]">
          {t(lang, 'titleSub')}
        </p>

        <button
          type="button"
          data-start="true"
          onClick={(e) => {
            e.currentTarget.blur();
            onStart();
          }}
          className="px-7 py-3.5 text-base md:text-lg font-extrabold rounded-md bg-amber-500 text-slate-950 hover:bg-amber-400 active:translate-y-0.5 shadow-[0_10px_28px_rgba(245,158,11,0.38)] transition-all cursor-pointer"
        >
          {t(lang, 'startBtn')}
        </button>
      </div>

      {/* Single flat borderless control hint line */}
      <div className="inline-block self-start px-3 py-1 rounded bg-[#070d19]/70 text-xs md:text-sm text-slate-100 font-medium tracking-wide">
        {t(lang, 'controlHint')}
      </div>
    </div>
  );
};
