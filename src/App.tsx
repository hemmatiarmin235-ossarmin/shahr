import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Brain,
  Car,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Crosshair,
  Eye,
  Footprints,
  Hammer,
  Pause,
  RotateCw,
  Scale,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CatalogDrawer } from './components/CatalogDrawer';
import { CharacterStudioModal } from './components/CharacterStudioModal';
import { GovernanceModal } from './components/GovernanceModal';
import { CrisisBannerModal, OutcomeModal, PauseModal } from './components/Modals';
import { TitleOverlay } from './components/TitleOverlay';
import { CATALOG_ITEMS } from './game/catalog';
import { t } from './game/i18n';
import {
  computeEconomyMetrics,
  createInitialCityState,
  resolveCityCrisis,
  startConstructionProject,
  stepCitySimulation,
  tradeMarketResource,
} from './game/simulation';
import {
  BudgetAllocation,
  CameraMode,
  CatalogItem,
  CharacterCustomization,
  CitySimulationState,
  GameState,
  LanguageCode,
  ResourceKey,
  TaxPolicy,
} from './game/types';
import { WorldEngine } from './three/WorldEngine';

type OpenPanel = 'none' | 'catalog' | 'queue' | 'character' | 'governance' | 'advisor';

export default function App() {
  const [lang, setLang] = useState<LanguageCode>('fa');
  const [gameState, setGameState] = useState<GameState>(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('autostart=1')) {
      return 'playing';
    }
    return 'title';
  });
  const [sim, setSim] = useState<CitySimulationState>(() => createInitialCityState());
  const [cameraMode, setCameraMode] = useState<CameraMode>('fps');
  const [openPanel, setOpenPanel] = useState<OpenPanel>('none');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [armedItem, setArmedItem] = useState<CatalogItem | null>(null);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);
  const [telemetry, setTelemetry] = useState({
    fpsSpeed: 0,
    stamina: 100,
    coords: { x: 0, z: 22 },
    canEnterCar: false,
    drivingSpeedKmh: 0,
    placementValid: true,
  });

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const simRef = useRef<CitySimulationState>(sim);
  const gameStateRef = useRef<GameState>(gameState);
  const langRef = useRef<LanguageCode>(lang);

  simRef.current = sim;
  gameStateRef.current = gameState;
  langRef.current = lang;

  const showToast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ text, kind });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 3200);
  }, []);

  // Sync document.body.dataset.state & engine game state
  useEffect(() => {
    document.body.dataset.state = gameState;
    engineRef.current?.setGameState(gameState);
  }, [gameState]);

  // Mount Three.js WorldEngine ONCE
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new WorldEngine(container, simRef.current, {
      onPlaceBlueprint: (itemId, x, z, rotationY) => {
        const res = startConstructionProject(simRef.current, itemId, x, z, rotationY);
        if (res.errorFa || res.errorEn) {
          showToast(langRef.current === 'fa' ? res.errorFa! : res.errorEn!, 'err');
          return;
        }
        setSim(res.nextState);
        engine.syncSimulationVisuals(res.nextState);
        showToast(
          langRef.current === 'fa'
            ? 'پروژه ساخت‌وساز با موفقیت آغاز شد!'
            : 'Construction site established!',
          'ok'
        );
      },
      onHudTelemetry: (info) => {
        setTelemetry(info);
      },
    });
    engineRef.current = engine;
    engine.setGameState(gameStateRef.current);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [showToast]);

  // Simulation Tick Loop (4 Hz deterministic step)
  useEffect(() => {
    if (gameState !== 'playing') return;
    const id = window.setInterval(() => {
      const { nextState, completedUids } = stepCitySimulation(simRef.current, 0.25);
      simRef.current = nextState;
      setSim(nextState);
      engineRef.current?.syncSimulationVisuals(nextState);
      if (completedUids.length > 0) {
        engineRef.current?.audio.playBuildComplete();
      }
      if (nextState.outcome !== 'none') {
        setGameState('gameover');
      }
    }, 250);
    return () => clearInterval(id);
  }, [gameState]);

  const handleStart = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setGameState('playing');
  }, []);

  const handleRestart = useCallback(() => {
    const fresh = createInitialCityState();
    simRef.current = fresh;
    setSim(fresh);
    setArmedItem(null);
    setOpenPanel('none');
    engineRef.current?.setArmedBlueprint(null);
    engineRef.current?.updateCharacterAppearance(fresh.character);
    engineRef.current?.syncSimulationVisuals(fresh);
    engineRef.current?.recentreToPlayer();
    setCameraMode('fps');
    engineRef.current?.setCameraMode('fps');
    setGameState('playing');
  }, []);

  const handleSelectCameraMode = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleSelectBlueprint = useCallback((item: CatalogItem | null) => {
    setArmedItem(item);
    engineRef.current?.setArmedBlueprint(item);
    if (item) {
      setOpenPanel('none');
    }
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (gameStateRef.current === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (e.code === 'Escape') {
        if (armedItem) {
          handleSelectBlueprint(null);
          return;
        }
        if (openPanel !== 'none') {
          setOpenPanel('none');
          return;
        }
        setGameState((prev) => (prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev));
        return;
      }

      if (gameStateRef.current !== 'playing') return;

      if (e.code === 'KeyP') {
        setGameState('paused');
      } else if (e.code === 'KeyB') {
        setOpenPanel((p) => (p === 'catalog' ? 'none' : 'catalog'));
      } else if (e.code === 'KeyC') {
        setOpenPanel((p) => (p === 'character' ? 'none' : 'character'));
      } else if (e.code === 'KeyG') {
        setOpenPanel((p) => (p === 'governance' ? 'none' : 'governance'));
      } else if (e.code === 'KeyH') {
        setDockCollapsed((c) => !c);
      } else if (e.code === 'KeyM') {
        setMuted((m) => {
          engineRef.current?.audio.setMuted(!m);
          return !m;
        });
      } else if (e.code === 'KeyF') {
        handleSelectCameraMode(cameraMode === 'drive' ? 'fps' : 'drive');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [armedItem, cameraMode, handleSelectBlueprint, handleSelectCameraMode, handleStart, openPanel]);

  const applyPolicyUpdate = (updater: (prev: CitySimulationState) => CitySimulationState) => {
    setSim((prev) => {
      const updated = updater(prev);
      const metrics = computeEconomyMetrics(updated, updated.metrics.treasury, updated.metrics.approval);
      const next = { ...updated, metrics };
      simRef.current = next;
      return next;
    });
    engineRef.current?.audio.playPolicyGavel();
  };

  const handleSaveCharacter = (char: CharacterCustomization) => {
    applyPolicyUpdate((prev) => ({ ...prev, character: char }));
    engineRef.current?.updateCharacterAppearance(char);
    setOpenPanel('none');
    showToast(lang === 'fa' ? 'تغییرات کاراکتر اعمال شد!' : 'Character appearance & perks applied!', 'ok');
  };

  const handleUpdateTaxes = (taxes: TaxPolicy) => {
    applyPolicyUpdate((prev) => ({ ...prev, taxes }));
  };

  const handleUpdateBudgets = (budgets: BudgetAllocation) => {
    applyPolicyUpdate((prev) => ({ ...prev, budgets }));
  };

  const handleToggleOrdinance = (id: string) => {
    applyPolicyUpdate((prev) => ({
      ...prev,
      ordinances: prev.ordinances.map((o) => (o.id === id ? { ...o, active: !o.active } : o)),
    }));
  };

  const handleTradeResource = (res: ResourceKey, qty: number) => {
    setSim((prev) => {
      const next = tradeMarketResource(prev, res, qty);
      simRef.current = next;
      return next;
    });
    engineRef.current?.audio.playPolicyGavel();
  };

  const handleResolveCrisis = (optId: string) => {
    setSim((prev) => {
      const next = resolveCityCrisis(prev, optId);
      simRef.current = next;
      return next;
    });
    engineRef.current?.audio.playPolicyGavel();
  };

  const formatHour = (h: number) => {
    const hh = Math.floor(h) % 24;
    const mm = Math.floor((h - Math.floor(h)) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const isRtl = lang === 'fa';
  const powerBalance = Math.round((sim.metrics.powerGeneratedMW - sim.metrics.powerDemandMW) * 10) / 10;
  const waterBalance = Math.round((sim.metrics.waterGeneratedML - sim.metrics.waterDemandML) * 10) / 10;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0b1320]">
      {/* Isolated Full-Bleed WebGL Canvas Container */}
      <div ref={mountRef} data-testid="world-canvas" className="fixed inset-0 z-0" />

      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleOverlay
          lang={lang}
          onToggleLang={() => setLang((l) => (l === 'fa' ? 'en' : 'fa'))}
          onStart={handleStart}
        />
      )}

      {/* Active Gameplay HUD (pointer-events-none wrapper keeping >= 85% viewport unobstructed) */}
      {gameState !== 'title' && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-3 md:p-4"
        >
          {/* Top Row: Compact Civic Vitals (Start) + Compact Camera & Utility Controls (End) */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            {/* Top-Start Civic Status Cluster */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-2 md:gap-3 px-3.5 py-2 rounded-xl border border-amber-400/25 bg-[#0b1322]/90 shadow-[0_8px_24px_rgba(0,0,0,0.55)] text-xs tabular-nums">
              <div>
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'treasury')}</div>
                <div dir="ltr" className="font-extrabold text-amber-300 text-sm">
                  ${sim.metrics.treasury.toLocaleString()}
                </div>
              </div>
              <div className="h-6 w-px bg-slate-700/80" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'cashflow')}</div>
                <div
                  dir="ltr"
                  className={`font-bold text-sm ${
                    sim.metrics.netCashflowPerMin >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {sim.metrics.netCashflowPerMin >= 0 ? '+' : ''}
                  ${sim.metrics.netCashflowPerMin.toLocaleString()}
                </div>
              </div>
              <div className="h-6 w-px bg-slate-700/80" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'pop')}</div>
                <div dir="ltr" className="font-bold text-white text-sm">{sim.metrics.population.toLocaleString()}</div>
              </div>
              <div className="h-6 w-px bg-slate-700/80 hidden sm:block" />
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'power')}</div>
                <div dir="ltr" className={`font-bold text-sm ${powerBalance >= 0 ? 'text-sky-300' : 'text-rose-400'}`}>
                  {powerBalance >= 0 ? `+${powerBalance}` : powerBalance}MW
                </div>
              </div>
              <div className="hidden md:block">
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'water')}</div>
                <div dir="ltr" className={`font-bold text-sm ${waterBalance >= 0 ? 'text-cyan-300' : 'text-rose-400'}`}>
                  {waterBalance >= 0 ? `+${waterBalance}` : waterBalance}ML
                </div>
              </div>
              <div className="h-6 w-px bg-slate-700/80" />
              <div>
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'happiness')}</div>
                <div className="font-bold text-emerald-300 text-sm">{sim.metrics.happiness}%</div>
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] text-slate-400 uppercase">{t(lang, 'approval')}</div>
                <div className="font-bold text-amber-200 text-sm">{sim.metrics.approval}%</div>
              </div>
              <div className="h-6 w-px bg-slate-700/80 hidden lg:block" />
              <div className="hidden lg:block text-slate-300">
                <div className="text-[10px] text-slate-400 uppercase">
                  {t(lang, 'day')} {sim.day}
                </div>
                <div className="font-bold text-xs">{formatHour(sim.timeOfDay)}</div>
              </div>
            </div>

            {/* Top-End Utility & Camera Mode Cluster */}
            <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-700/80 bg-[#0b1322]/90 shadow-[0_8px_24px_rgba(0,0,0,0.55)] text-xs">
              {(
                [
                  ['fps', Footprints, t(lang, 'walkFps')],
                  ['orbit', Eye, t(lang, 'orbit')],
                  ['pan', Compass, t(lang, 'pan')],
                  ['drive', Car, t(lang, 'drive')],
                ] as const
              ).map(([mode, Icon, label]) => (
                <button
                  key={mode}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    handleSelectCameraMode(mode);
                  }}
                  aria-label={label}
                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    cameraMode === mode
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{label}</span>
                </button>
              ))}

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  engineRef.current?.recentreToPlayer();
                }}
                aria-label={t(lang, 'recentre')}
                title={t(lang, 'recentre')}
                className="px-2 py-1.5 rounded-lg bg-slate-800/90 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                <Crosshair className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setSim((prev) => ({
                    ...prev,
                    simSpeed: prev.simSpeed === 1 ? 3 : prev.simSpeed === 3 ? 10 : 1,
                  }));
                }}
                aria-label={t(lang, 'speed')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800/90 text-sky-300 hover:bg-slate-700 font-bold tabular-nums cursor-pointer"
              >
                {sim.simSpeed}×
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setLang((l) => (l === 'fa' ? 'en' : 'fa'));
                }}
                aria-label="Language"
                className="px-2 py-1.5 rounded-lg bg-slate-800/90 text-amber-200 hover:bg-slate-700 font-bold cursor-pointer"
              >
                {lang === 'fa' ? 'EN' : 'فا'}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setMuted((m) => {
                    engineRef.current?.audio.setMuted(!m);
                    return !m;
                  });
                }}
                aria-label="Mute"
                className="p-1.5 rounded-lg bg-slate-800/90 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setGameState('paused');
                }}
                aria-label="Pause"
                className="p-1.5 rounded-lg bg-slate-800/90 text-slate-200 hover:bg-slate-700 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Crosshair (FPS mode without overlay) */}
          {cameraMode === 'fps' && openPanel === 'none' && gameState === 'playing' && (
            <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_4px_rgba(0,0,0,0.9)]" />
            </div>
          )}

          {/* Contextual Placement / Driving / Toast Feedback */}
          <div className="flex flex-col items-center gap-2 my-auto pointer-events-none">
            {armedItem && (
              <div className="pointer-events-auto px-4 py-2 rounded-xl border border-amber-400/50 bg-[#0b1322]/95 text-xs flex flex-wrap items-center gap-3 shadow-xl">
                <span className="font-extrabold text-amber-300">
                  {lang === 'fa' ? armedItem.nameFa : armedItem.nameEn}
                </span>
                <span className={telemetry.placementValid ? 'text-emerald-300 font-bold' : 'text-rose-400 font-bold'}>
                  {telemetry.placementValid ? t(lang, 'validSpot') : t(lang, 'invalidSpot')}
                </span>
                <button
                  type="button"
                  onClick={() => engineRef.current?.rotateArmedBlueprint()}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>[R]</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectBlueprint(null)}
                  className="px-2 py-1 rounded bg-rose-900/70 hover:bg-rose-800 text-rose-100 cursor-pointer"
                >
                  [Esc]
                </button>
              </div>
            )}

            {toast && (
              <div
                className={`px-4 py-2 rounded-lg text-xs font-bold shadow-lg border ${
                  toast.kind === 'ok'
                    ? 'bg-emerald-950/95 border-emerald-400/50 text-emerald-200'
                    : 'bg-rose-950/95 border-rose-400/50 text-rose-200'
                }`}
              >
                {toast.text}
              </div>
            )}
          </div>

          {/* Bottom Dock Area */}
          <div className="flex flex-col items-center gap-2.5">
            {(openPanel === 'catalog' || openPanel === 'queue') && (
              <CatalogDrawer
                lang={lang}
                sim={sim}
                armedItemId={armedItem?.id ?? null}
                initialTab={openPanel === 'queue' ? 'queue' : 'catalog'}
                onSelectBlueprint={handleSelectBlueprint}
                onClose={() => setOpenPanel('none')}
              />
            )}

            {/* Contextual Walk / Drive Telemetry Line */}
            {!dockCollapsed && openPanel === 'none' && (
              <div className="text-[11px] text-slate-200/90 font-semibold px-3 py-1 rounded-md bg-[#0b1322]/85 border border-slate-700/60 tabular-nums flex items-center gap-3">
                {cameraMode === 'drive' ? (
                  <span>
                    {telemetry.drivingSpeedKmh} km/h · {t(lang, 'exitCarHint')}
                  </span>
                ) : (
                  <>
                    <span>
                      ({telemetry.coords.x}m, {telemetry.coords.z}m) · {telemetry.fpsSpeed} km/h
                    </span>
                    {telemetry.canEnterCar && <span className="text-amber-300">{t(lang, 'enterCarHint')}</span>}
                  </>
                )}
              </div>
            )}

            {/* Collapse / Expand Handle */}
            <div className="pointer-events-auto flex flex-col items-center">
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setDockCollapsed((c) => !c);
                }}
                aria-label={dockCollapsed ? t(lang, 'showHud') : t(lang, 'hideHud')}
                className="px-3 py-0.5 rounded-t-lg border border-b-0 border-slate-700/80 bg-[#0b1322]/90 text-[10px] font-bold text-slate-300 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                {dockCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <span>{dockCollapsed ? t(lang, 'showHud') : t(lang, 'hideHud')}</span>
              </button>

              {!dockCollapsed && (
                <nav
                  aria-label="Civic Command Dock"
                  className="flex flex-wrap items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-amber-400/30 bg-[#0b1322]/92 shadow-[0_12px_36px_rgba(0,0,0,0.75)]"
                >
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOpenPanel((p) => (p === 'catalog' ? 'none' : 'catalog'));
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      openPanel === 'catalog'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800/90 text-amber-200 hover:bg-slate-700'
                    }`}
                  >
                    <Hammer className="w-4 h-4" />
                    <span>
                      {t(lang, 'build')} ({CATALOG_ITEMS.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOpenPanel((p) => (p === 'queue' ? 'none' : 'queue'));
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors tabular-nums ${
                      openPanel === 'queue'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span>
                      {t(lang, 'queue')} ({sim.constructions.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOpenPanel((p) => (p === 'character' ? 'none' : 'character'));
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      openPanel === 'character'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <User className="w-4 h-4 text-emerald-400" />
                    <span>{t(lang, 'character')}</span>
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOpenPanel((p) => (p === 'governance' ? 'none' : 'governance'));
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      openPanel === 'governance'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    <Scale className="w-4 h-4 text-amber-400" />
                    <span>{t(lang, 'governance')}</span>
                  </button>

                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setOpenPanel((p) => (p === 'advisor' ? 'none' : 'advisor'));
                    }}
                    className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                      openPanel === 'advisor'
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800/90 text-sky-300 hover:bg-slate-700'
                    }`}
                  >
                    <Brain className="w-4 h-4" />
                    <span>{t(lang, 'advisor')}</span>
                  </button>
                </nav>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Crisis Decision Banner */}
      {gameState === 'playing' && sim.activeCrisis && openPanel === 'none' && (
        <CrisisBannerModal lang={lang} crisis={sim.activeCrisis} onChoose={handleResolveCrisis} />
      )}

      {/* Character Customization Modal */}
      {gameState === 'playing' && openPanel === 'character' && (
        <CharacterStudioModal
          lang={lang}
          initial={sim.character}
          onSave={handleSaveCharacter}
          onClose={() => setOpenPanel('none')}
        />
      )}

      {/* Governance, Economy, Market & AI Advisor Modal */}
      {gameState === 'playing' && (openPanel === 'governance' || openPanel === 'advisor') && (
        <GovernanceModal
          lang={lang}
          sim={sim}
          initialTab={openPanel === 'advisor' ? 'advisor' : 'budget'}
          onUpdateTaxes={handleUpdateTaxes}
          onUpdateBudgets={handleUpdateBudgets}
          onToggleOrdinance={handleToggleOrdinance}
          onTradeResource={handleTradeResource}
          onClose={() => setOpenPanel('none')}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          lang={lang}
          sim={sim}
          onResume={() => setGameState('playing')}
          onRestart={handleRestart}
          onTitle={() => {
            setOpenPanel('none');
            setGameState('title');
          }}
        />
      )}

      {/* Victory / Game Over Modal */}
      {gameState === 'gameover' && (
        <OutcomeModal lang={lang} sim={sim} onRestart={handleRestart} />
      )}
    </main>
  );
}
