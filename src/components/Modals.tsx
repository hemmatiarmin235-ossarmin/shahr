import React from 'react';
import { AlertTriangle, Award, Play, RotateCcw } from 'lucide-react';
import { t } from '../game/i18n';
import { CityCrisisEvent, CitySimulationState, LanguageCode } from '../game/types';

export const PauseModal: React.FC<{
  lang: LanguageCode;
  sim: CitySimulationState;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}> = ({ lang, sim, onResume, onRestart, onTitle }) => {
  const isRtl = lang === 'fa';
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75"
    >
      <div
        role="dialog"
        aria-label={t(lang, 'pausedTitle')}
        className="w-full max-w-md rounded-2xl border border-amber-400/35 bg-[#0b1322] p-6 shadow-2xl space-y-5 text-center"
      >
        <h2 className="text-2xl font-black text-white">{t(lang, 'pausedTitle')}</h2>
        <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
            <div className="text-slate-400">{t(lang, 'day')}</div>
            <div className="text-base font-extrabold text-amber-300">{sim.day}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
            <div className="text-slate-400">{t(lang, 'pop')}</div>
            <div className="text-base font-extrabold text-white">{sim.metrics.population.toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700/80">
            <div className="text-slate-400">{t(lang, 'approval')}</div>
            <div className="text-base font-extrabold text-emerald-400">{sim.metrics.approval}%</div>
          </div>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold flex items-center justify-center gap-2 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>{t(lang, 'resume')}</span>
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t(lang, 'restart')}</span>
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-2.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-300 font-bold cursor-pointer"
          >
            {t(lang, 'backToTitle')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const OutcomeModal: React.FC<{
  lang: LanguageCode;
  sim: CitySimulationState;
  onRestart: () => void;
}> = ({ lang, sim, onRestart }) => {
  const isRtl = lang === 'fa';
  const victory = sim.outcome === 'metropolis_triumph';
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"
    >
      <div
        role="dialog"
        aria-label={victory ? 'Victory' : 'Game Over'}
        className="w-full max-w-md rounded-2xl border border-amber-400/45 bg-[#0b1322] p-6 shadow-2xl space-y-5 text-center"
      >
        <div className="flex justify-center">
          {victory ? (
            <Award className="w-12 h-12 text-amber-400" />
          ) : (
            <AlertTriangle className="w-12 h-12 text-rose-400" />
          )}
        </div>
        <h2 className="text-2xl font-black text-white">
          {victory
            ? lang === 'fa'
              ? 'کلان‌شهر نمونه جهانی!'
              : 'Metropolis Triumph!'
            : lang === 'fa'
              ? 'پایان دوره مدیریت'
              : 'Term Ended'}
        </h2>
        <p className="text-sm text-slate-300">
          {lang === 'fa' ? sim.outcomeReasonFa : sim.outcomeReasonEn}
        </p>

        <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
            <div className="text-slate-400">{t(lang, 'day')}</div>
            <div className="text-base font-extrabold text-amber-300">{sim.day}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
            <div className="text-slate-400">{t(lang, 'pop')}</div>
            <div className="text-base font-extrabold text-white">{sim.metrics.population.toLocaleString()}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-700">
            <div className="text-slate-400">{t(lang, 'treasury')}</div>
            <div className="text-base font-extrabold text-emerald-400">${sim.metrics.treasury.toLocaleString()}</div>
          </div>
        </div>

        <button
          type="button"
          data-start="true"
          onClick={onRestart}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold cursor-pointer"
        >
          {t(lang, 'tryAgain')}
        </button>
      </div>
    </div>
  );
};

export const CrisisBannerModal: React.FC<{
  lang: LanguageCode;
  crisis: CityCrisisEvent;
  onChoose: (optionId: string) => void;
}> = ({ lang, crisis, onChoose }) => {
  const isRtl = lang === 'fa';
  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-35 w-[min(560px,92vw)] pointer-events-auto"
    >
      <div
        role="alertdialog"
        aria-label={lang === 'fa' ? crisis.titleFa : crisis.titleEn}
        className="rounded-xl border border-amber-400/60 bg-[#0d1729]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.8)] space-y-3"
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-extrabold text-white">
              {lang === 'fa' ? crisis.titleFa : crisis.titleEn}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {lang === 'fa' ? crisis.descFa : crisis.descEn}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {crisis.options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChoose(opt.id)}
              className="p-2.5 rounded-lg border border-amber-400/35 bg-slate-900 hover:bg-amber-500 hover:text-slate-950 text-amber-200 text-xs font-bold text-start transition-colors cursor-pointer"
            >
              {lang === 'fa' ? opt.labelFa : opt.labelEn}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
