import React, { useState } from 'react';
import {
  ArrowDownUp,
  Brain,
  Coins,
  Scale,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import { t } from '../game/i18n';
import { RESOURCE_KEYS, RESOURCE_LABELS } from '../game/simulation';
import {
  BudgetAllocation,
  CitySimulationState,
  LanguageCode,
  ResourceKey,
  TaxPolicy,
} from '../game/types';

interface GovernanceModalProps {
  lang: LanguageCode;
  sim: CitySimulationState;
  initialTab?: 'budget' | 'ordinances' | 'market' | 'advisor';
  onUpdateTaxes: (taxes: TaxPolicy) => void;
  onUpdateBudgets: (budgets: BudgetAllocation) => void;
  onToggleOrdinance: (id: string) => void;
  onTradeResource: (res: ResourceKey, qty: number) => void;
  onClose: () => void;
}

interface AdvisorResponse {
  diagnosis: string;
  strategicRiskLevel: string;
  recommendations: Array<{ title: string; action: string; expectedImpact: string }>;
  suggestedTaxAdjustment: string;
  priorityBuildFocus: string;
}

export const GovernanceModal: React.FC<GovernanceModalProps> = ({
  lang,
  sim,
  initialTab = 'budget',
  onUpdateTaxes,
  onUpdateBudgets,
  onToggleOrdinance,
  onTradeResource,
  onClose,
}) => {
  const [tab, setTab] = useState<'budget' | 'ordinances' | 'market' | 'advisor'>(initialTab);
  const [question, setQuestion] = useState(
    lang === 'fa'
      ? 'چطور همزمان بودجه شهر را مثبت نگه دارم، کمبود برق را حل کنم و رضایت شهروندان را به بالای ۸۵٪ برسانم؟'
      : 'How should I balance the municipal budget, grow clean power capacity, and push citizen happiness above 85%?'
  );
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AdvisorResponse | null>(null);

  const isRtl = lang === 'fa';

  const askAdvisor = async () => {
    if (!question.trim() || loadingAi) return;
    setLoadingAi(true);
    setAiError(null);
    try {
      const res = await fetch('/api/advisor/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          lang,
          citySnapshot: {
            day: sim.day,
            metrics: sim.metrics,
            taxes: sim.taxes,
            budgets: sim.budgets,
            resources: sim.resources,
            activeOrdinances: sim.ordinances.filter((o) => o.active).map((o) => o.nameEn),
            structuresCount: sim.structures.length,
            activeConstructions: sim.constructions.length,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Request failed');
      } else {
        setAiResult(data.analysis);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75"
    >
      <div
        role="dialog"
        aria-label={t(lang, 'governance')}
        className="w-full max-w-4xl rounded-2xl border border-amber-400/35 bg-[#0b1322] shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-slate-700/80 bg-[#101c31]">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('budget')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'budget' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'بودجه و مالیات' : 'Budget & Taxes'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('ordinances')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'ordinances' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'قوانین و مصوبات' : 'Ordinances'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('market')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'market' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
              <span>{lang === 'fa' ? 'بازار منابع بندری' : 'Resource Market'}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('advisor')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                tab === 'advisor' ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>{t(lang, 'advisor')}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'cancel')}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto civic-scroll space-y-5 text-xs">
          {tab === 'budget' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Fiscal Ledger */}
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-2.5 tabular-nums">
                <h3 className="text-sm font-extrabold text-amber-300 mb-2">
                  {lang === 'fa' ? 'ترازنامه مالی لحظه‌ای شهر' : 'Live Municipal Ledger'}
                </h3>
                <div className="flex justify-between">
                  <span className="text-slate-400">{lang === 'fa' ? 'خزانه فعلی:' : 'Treasury:'}</span>
                  <span className="font-bold text-white">${sim.metrics.treasury.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>{lang === 'fa' ? 'درآمد مالیاتی:' : 'Tax Revenue / min:'}</span>
                  <span>+${sim.metrics.taxIncomePerMin.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>{lang === 'fa' ? 'درآمد گمرک و صادرات:' : 'Trade Exports / min:'}</span>
                  <span>+${sim.metrics.tradeIncomePerMin.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>{lang === 'fa' ? 'هزینه نگهداری زیرساخت:' : 'City Upkeep / min:'}</span>
                  <span>-${sim.metrics.upkeepPerMin.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-rose-400">
                  <span>{lang === 'fa' ? 'هزینه مصوبات فعال:' : 'Ordinances / min:'}</span>
                  <span>-${sim.metrics.ordinanceCostPerMin.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-700 flex justify-between font-extrabold text-sm">
                  <span>{lang === 'fa' ? 'تراز خالص / دقیقه:' : 'Net Cashflow / min:'}</span>
                  <span className={sim.metrics.netCashflowPerMin >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {sim.metrics.netCashflowPerMin >= 0 ? '+' : ''}
                    ${sim.metrics.netCashflowPerMin.toLocaleString()}
                  </span>
                </div>
                <div className="pt-2 text-[11px] text-slate-400 flex justify-between">
                  <span>{lang === 'fa' ? 'تولید ناخالص سرانه:' : 'GDP / Capita:'}</span>
                  <span>${sim.metrics.gdpPerCapita.toLocaleString()}</span>
                </div>
              </div>

              {/* Tax Rates & Sector Budgets */}
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-3">
                  <h3 className="text-sm font-extrabold text-white">
                    {lang === 'fa' ? 'نرخ مالیات بخش‌ها' : 'District Tax Rates'}
                  </h3>
                  {(
                    [
                      ['residentialRate', lang === 'fa' ? 'مسکونی' : 'Residential'],
                      ['commercialRate', lang === 'fa' ? 'تجاری' : 'Commercial'],
                      ['industrialRate', lang === 'fa' ? 'صنعتی' : 'Industrial'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <div className="flex justify-between mb-1 tabular-nums">
                        <span className="text-slate-300">{label}</span>
                        <span className="font-bold text-amber-300">{sim.taxes[key]}%</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={22}
                        value={sim.taxes[key]}
                        onChange={(e) =>
                          onUpdateTaxes({ ...sim.taxes, [key]: parseInt(e.target.value, 10) })
                        }
                        className="w-full accent-amber-500"
                      />
                    </label>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-700/70 space-y-2.5">
                  <h3 className="text-sm font-extrabold text-white">
                    {lang === 'fa' ? 'تخصیص بودجه خدمات عمومی' : 'Public Sector Funding'}
                  </h3>
                  {(
                    [
                      ['infrastructure', lang === 'fa' ? 'عمران و ساخت‌وساز' : 'Infrastructure'],
                      ['healthcare', lang === 'fa' ? 'بهداشت و درمان' : 'Healthcare'],
                      ['education', lang === 'fa' ? 'آموزش و پژوهش' : 'Education'],
                      ['environment', lang === 'fa' ? 'محیط‌زیست' : 'Environment'],
                      ['security', lang === 'fa' ? 'امنیت و امداد' : 'Security'],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="block">
                      <div className="flex justify-between mb-0.5 tabular-nums">
                        <span className="text-slate-300">{label}</span>
                        <span className="font-bold text-sky-300">{sim.budgets[key]}%</span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={150}
                        step={5}
                        value={sim.budgets[key]}
                        onChange={(e) =>
                          onUpdateBudgets({ ...sim.budgets, [key]: parseInt(e.target.value, 10) })
                        }
                        className="w-full accent-sky-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'ordinances' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {sim.ordinances.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => onToggleOrdinance(ord.id)}
                  className={`p-4 rounded-xl border text-start cursor-pointer transition-colors flex flex-col justify-between gap-2 ${
                    ord.active
                      ? 'border-emerald-400 bg-emerald-950/35'
                      : 'border-slate-700 bg-slate-900/90 hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-extrabold text-sm text-white">
                      {lang === 'fa' ? ord.nameFa : ord.nameEn}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ord.active ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {ord.active ? (lang === 'fa' ? 'فعال' : 'ACTIVE') : lang === 'fa' ? 'غیرفعال' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    {lang === 'fa' ? ord.descFa : ord.descEn}
                  </p>
                  <div className="text-[11px] text-amber-300 tabular-nums font-bold">
                    {ord.upkeepPerMin > 0
                      ? `${lang === 'fa' ? 'هزینه:' : 'Cost:'} $${ord.upkeepPerMin}/min`
                      : lang === 'fa'
                        ? 'بدون هزینه مستقیم خزانه'
                        : 'No direct treasury cost'}
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === 'market' && (
            <div className="space-y-3">
              <div className="text-slate-300">
                {lang === 'fa'
                  ? 'مدیریت زنجیره تأمین منابع: مصالح مورد نیاز ساخت‌وساز را از بازار جهانی بندر بخرید یا مازاد تولید کارخانه‌ها را بفروشید.'
                  : 'Supply Chain Exchange: Import critical construction materials or export factory surpluses through the city harbor.'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 tabular-nums">
                {RESOURCE_KEYS.map((rk) => {
                  const stock = Math.round(sim.resources[rk]);
                  const price = sim.marketPrices[rk];
                  return (
                    <div
                      key={rk}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-sm text-white">{RESOURCE_LABELS[rk][lang]}</div>
                        <div className="text-[11px] text-slate-400">
                          {lang === 'fa' ? 'موجودی:' : 'Stock:'}{' '}
                          <span className="text-amber-300 font-bold">{stock}</span> ·{' '}
                          {lang === 'fa' ? 'قیمت واحد:' : 'Unit:'} ${price}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onTradeResource(rk, 25)}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                        >
                          +25 (${price * 25})
                        </button>
                        <button
                          type="button"
                          onClick={() => onTradeResource(rk, -25)}
                          className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-[11px] cursor-pointer"
                        >
                          -25
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'advisor' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-sky-950/35 border border-sky-500/35 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="text-slate-200 leading-relaxed">
                  {lang === 'fa'
                    ? 'مشاور راهبردی هوشمند (Gemini 4 · ThinkingLevel.HIGH) با تحلیل آمار زنده بودجه، شبکه برق، منابع و رضایت شهر، راهکارهای تخصصی ارائه می‌دهد.'
                    : 'Strategic AI Urban Advisor (Gemini 4 · ThinkingLevel.HIGH) analyzes your live city telemetry to propose high-impact fiscal and zoning policies.'}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') askAdvisor();
                  }}
                  aria-label={t(lang, 'advisor')}
                  className="flex-1 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={askAdvisor}
                  disabled={loadingAi}
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-60 text-slate-950 font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {loadingAi
                      ? lang === 'fa'
                        ? 'در حال تحلیل عمیق...'
                        : 'Thinking...'
                      : lang === 'fa'
                        ? 'تحلیل استراتژیک'
                        : 'Analyze City'}
                  </span>
                </button>
              </div>

              {aiError && (
                <div className="p-3.5 rounded-lg border border-rose-500/50 bg-rose-950/40 text-rose-200">
                  {aiError}
                </div>
              )}

              {aiResult && (
                <div className="space-y-3 p-4 rounded-xl bg-slate-900/95 border border-slate-700">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm text-sky-300">
                      {lang === 'fa' ? 'جمع‌بندی مشاور ارشد' : 'Executive Diagnosis'}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                      {aiResult.strategicRiskLevel}
                    </span>
                  </div>
                  <p className="text-slate-200 leading-relaxed">{aiResult.diagnosis}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {aiResult.recommendations.map((rec, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/70">
                        <div className="font-bold text-white mb-1">{rec.title}</div>
                        <div className="text-slate-300 mb-1">{rec.action}</div>
                        <div className="text-emerald-300 text-[11px]">{rec.expectedImpact}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px]">
                    <div className="p-2.5 rounded bg-slate-800/60 text-amber-200">
                      <strong>{lang === 'fa' ? 'پیشنهاد مالیاتی: ' : 'Tax Guidance: '}</strong>
                      {aiResult.suggestedTaxAdjustment}
                    </div>
                    <div className="p-2.5 rounded bg-slate-800/60 text-sky-200">
                      <strong>{lang === 'fa' ? 'اولویت ساخت: ' : 'Build Priority: '}</strong>
                      {aiResult.priorityBuildFocus}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
