import React, { useMemo, useState } from 'react';
import { Clock, Hammer, Search, Users, X, Zap } from 'lucide-react';
import { CATALOG_ITEMS, CATALOG_MAP, CATEGORY_LABELS } from '../game/catalog';
import { t } from '../game/i18n';
import { canAffordProject, RESOURCE_LABELS } from '../game/simulation';
import {
  CatalogCategory,
  CatalogItem,
  CitySimulationState,
  LanguageCode,
  ResourceKey,
} from '../game/types';

interface CatalogDrawerProps {
  lang: LanguageCode;
  sim: CitySimulationState;
  armedItemId: string | null;
  initialTab?: 'catalog' | 'queue';
  onSelectBlueprint: (item: CatalogItem | null) => void;
  onClose: () => void;
}

const CATEGORIES: Array<CatalogCategory | 'all'> = [
  'all',
  'residential',
  'commercial',
  'industrial',
  'civic',
  'energy',
  'parks',
  'transit',
  'props',
  'agriculture',
  'tech',
];

export const CatalogDrawer: React.FC<CatalogDrawerProps> = ({
  lang,
  sim,
  armedItemId,
  initialTab = 'catalog',
  onSelectBlueprint,
  onClose,
}) => {
  const [tab, setTab] = useState<'catalog' | 'queue'>(initialTab);
  const [category, setCategory] = useState<CatalogCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const isRtl = lang === 'fa';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CATALOG_ITEMS.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (!q) return true;
      return (
        item.nameFa.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    });
  }, [category, query]);

  return (
    <section
      dir={isRtl ? 'rtl' : 'ltr'}
      aria-label={t(lang, 'build')}
      className="pointer-events-auto w-full max-w-5xl mx-auto rounded-xl border border-amber-400/30 bg-[#0b1322]/95 shadow-[0_20px_50px_rgba(0,0,0,0.75)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/70 bg-[#101c31]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('catalog')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'catalog'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>
              {t(lang, 'build')} ({CATALOG_ITEMS.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('queue')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              tab === 'queue'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>
              {t(lang, 'queue')} ({sim.constructions.length})
            </span>
          </button>
        </div>

        {tab === 'catalog' && (
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t(lang, 'searchPlaceholder')}
              aria-label={t(lang, 'searchPlaceholder')}
              className="w-full ps-8 pe-3 py-1.5 text-xs rounded-md bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label={t(lang, 'cancel')}
          className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {tab === 'catalog' ? (
        <div className="p-3">
          {/* Category Filter Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 civic-scroll">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              const label = cat === 'all' ? t(lang, 'allCategories') : CATEGORY_LABELS[cat][lang];
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                    active
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Item Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[38vh] overflow-y-auto pe-1 civic-scroll">
            {filtered.slice(0, 180).map((item) => {
              const afford = canAffordProject(sim, item.id);
              const isArmed = armedItemId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectBlueprint(isArmed ? null : item)}
                  className={`text-start p-2.5 rounded-lg border transition-colors cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isArmed
                      ? 'border-emerald-400 bg-emerald-950/50'
                      : afford.ok
                        ? 'border-slate-700/80 bg-slate-900/90 hover:border-amber-400/60 hover:bg-slate-800/90'
                        : 'border-rose-900/50 bg-slate-900/60 opacity-75'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {lang === 'fa' ? item.nameFa : item.nameEn}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {CATEGORY_LABELS[item.category][lang]} · {item.footprintW}×{item.footprintD}m · H:{item.heightM}m
                      </div>
                    </div>
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 mt-0.5 border border-white/20"
                      style={{ backgroundColor: item.accentColor }}
                    />
                  </div>

                  {/* Materials & Build Time */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-300 tabular-nums">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-bold">
                      ${item.cost.toLocaleString()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {item.buildTimeSec}
                      {t(lang, 'sec')}
                    </span>
                    {item.housing > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 flex items-center gap-0.5">
                        <Users className="w-2.5 h-2.5" />+{item.housing}
                      </span>
                    )}
                    {item.powerMW !== 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          item.powerMW > 0
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <Zap className="w-2.5 h-2.5" />
                        {item.powerMW > 0 ? `+${item.powerMW}` : item.powerMW}MW
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 text-[10px] text-slate-400">
                    {Object.entries(item.materials).map(([k, v]) => (
                      <span key={k} className="px-1 py-0.2 rounded bg-slate-800/90">
                        {RESOURCE_LABELS[k as ResourceKey][lang]}: {v}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          {filtered.length > 180 && (
            <div className="mt-2 text-[11px] text-slate-400 text-center">
              {lang === 'fa'
                ? `نمایش ۱۸۰ از ${filtered.length} آیتم — برای دسترسی دقیق‌تر جستجو یا دسته‌بندی را انتخاب کنید`
                : `Showing 180 of ${filtered.length} matching items — narrow by category or search`}
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 max-h-[38vh] overflow-y-auto civic-scroll space-y-2.5">
          {sim.constructions.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              {lang === 'fa'
                ? 'هیچ پروژه ساخت‌وسازی در حال اجرا نیست.'
                : 'No active construction sites at the moment.'}
            </div>
          ) : (
            sim.constructions.map((proj) => {
              const item = CATALOG_MAP.get(proj.itemId);
              if (!item) return null;
              const pct = Math.round(proj.progress * 100);
              const stageLabel =
                lang === 'fa'
                  ? {
                      foundation: 'پی‌ریزی و بتن‌ریزی',
                      framing: 'اسکلت فلزی و جرثقیل',
                      facade: 'نماسازی و تاسیسات',
                      finishing: 'نازک‌کاری نهایی',
                    }[proj.stage]
                  : proj.stage.toUpperCase();
              return (
                <div
                  key={proj.uid}
                  className="p-3 rounded-lg border border-slate-700/80 bg-slate-900/90 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-100">
                      {lang === 'fa' ? item.nameFa : item.nameEn}
                    </span>
                    <span className="text-amber-300 font-bold tabular-nums">{pct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 transition-all duration-150"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 tabular-nums">
                    <span>{stageLabel}</span>
                    <span>
                      ({Math.round(proj.x)}, {Math.round(proj.z)}) ·{' '}
                      {Math.max(0, Math.round(proj.totalSec - proj.elapsedSec))}
                      {t(lang, 'sec')}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
};
