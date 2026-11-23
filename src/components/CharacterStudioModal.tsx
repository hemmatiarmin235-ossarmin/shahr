import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Check, X } from 'lucide-react';
import { t } from '../game/i18n';
import { calculateCharacterPerks } from '../game/simulation';
import {
  AccessoryType,
  CharacterCustomization,
  EyewearType,
  HairStyle,
  HeadwearType,
  LanguageCode,
  MayorPerk,
  OutfitStyle,
} from '../game/types';
import { createCharacterGroup } from '../three/models';

interface CharacterStudioModalProps {
  lang: LanguageCode;
  initial: CharacterCustomization;
  onSave: (char: CharacterCustomization) => void;
  onClose: () => void;
}

const HAIR_STYLES: Array<{ id: HairStyle; fa: string; en: string }> = [
  { id: 'swept', fa: 'مرتب کلاسیک', en: 'Swept' },
  { id: 'short', fa: 'کوتاه رسمی', en: 'Short' },
  { id: 'bob', fa: 'متوسط', en: 'Bob' },
  { id: 'bun', fa: 'بسته پشت', en: 'Top Bun' },
  { id: 'afro', fa: 'حجم‌دار', en: 'Volume' },
  { id: 'bald', fa: 'بدون مو', en: 'Clean' },
];

const OUTFIT_STYLES: Array<{ id: OutfitStyle; fa: string; en: string }> = [
  { id: 'architect_coat', fa: 'پالتوی معمار ارشد', en: 'Architect Coat' },
  { id: 'mayor_suit', fa: 'کت‌وشلوار شهردار', en: 'Mayor Suit' },
  { id: 'civil_engineer', fa: 'مهندس عمران', en: 'Civil Engineer' },
  { id: 'eco_ranger', fa: 'مدافع محیط‌زیست', en: 'Eco Ranger' },
  { id: 'cyber_planner', fa: 'طراح هوشمند', en: 'Cyber Planner' },
  { id: 'street_casual', fa: 'استایل روزمره', en: 'Street Casual' },
];

const HEADWEAR_LIST: Array<{ id: HeadwearType; fa: string; en: string }> = [
  { id: 'none', fa: 'بدون کلاه', en: 'None' },
  { id: 'hardhat', fa: 'کلاه ایمنی مهندسی', en: 'Hard Hat' },
  { id: 'fedora', fa: 'کلاه فدورا', en: 'Fedora' },
  { id: 'cap', fa: 'کلاه نقاب‌دار', en: 'Cap' },
  { id: 'beret', fa: 'بره کلاسیک', en: 'Beret' },
];

const EYEWEAR_LIST: Array<{ id: EyewearType; fa: string; en: string }> = [
  { id: 'none', fa: 'بدون عینک', en: 'None' },
  { id: 'glasses', fa: 'عینک طبی', en: 'Glasses' },
  { id: 'sunglasses', fa: 'عینک آفتابی', en: 'Sunglasses' },
  { id: 'visor', fa: 'ویزور هوشمند AR', en: 'AR Visor' },
];

const ACCESSORIES: Array<{ id: AccessoryType; fa: string; en: string }> = [
  { id: 'none', fa: 'ندارد', en: 'None' },
  { id: 'blueprint_tube', fa: 'لوله نقشه‌های شهرسازی', en: 'Blueprint Tube' },
  { id: 'jet_pack', fa: 'کوله جت مهندسی', en: 'Jet Pack' },
  { id: 'drone_pack', fa: 'هاب پهپاد بازرسی', en: 'Drone Pack' },
];

const PERKS: Array<{ id: MayorPerk; fa: string; en: string; bonusFa: string; bonusEn: string }> = [
  {
    id: 'master_architect',
    fa: 'معمار بزرگ',
    en: 'Master Architect',
    bonusFa: '+۱۸٪ سرعت ساخت‌وساز، +۲ محبوبیت',
    bonusEn: '+18% Build Speed, +2 Approval',
  },
  {
    id: 'fiscal_hawk',
    fa: 'استراتژیست مالی',
    en: 'Fiscal Strategist',
    bonusFa: '+۱۲٪ درآمد مالیاتی شهر',
    bonusEn: '+12% Municipal Tax Yield',
  },
  {
    id: 'eco_visionary',
    fa: 'پیشگام اکولوژی',
    en: 'Eco Visionary',
    bonusFa: '-۲۲٪ آلودگی شهر، +۴ محبوبیت',
    bonusEn: '-22% Pollution, +4 Approval',
  },
  {
    id: 'peoples_mayor',
    fa: 'شهردار مردمی',
    en: "People's Mayor",
    bonusFa: '+۱۰ محبوبیت پایه و +۴٪ سرعت ساخت',
    bonusEn: '+10 Base Approval, +4% Build Speed',
  },
];

const SWATCHES = ['#1e3a5f', '#0f766e', '#b91c1c', '#d97706', '#334155', '#4f46e5', '#f8fafc', '#18181b'];
const SKIN_TONES = ['#f5d0b5', '#e0b088', '#c68642', '#8d5524', '#5c3822'];

export const CharacterStudioModal: React.FC<CharacterStudioModalProps> = ({
  lang,
  initial,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<CharacterCustomization>(initial);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const rigRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const isRtl = lang === 'fa';

  useEffect(() => {
    const mount = previewRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth || 280, mount.clientHeight || 360);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, (mount.clientWidth || 280) / (mount.clientHeight || 360), 0.1, 30);
    camera.position.set(0, 1.3, 3.6);
    camera.lookAt(0, 1.0, 0);

    const key = new THREE.DirectionalLight(0xfff4e0, 2.2);
    key.position.set(2.5, 4, 3);
    scene.add(key, new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.9));

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 0.14, 24),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 })
    );
    pedestal.position.y = -0.07;
    scene.add(pedestal);

    let disposed = false;
    let raf = 0;
    let angle = 0;
    const loop = () => {
      if (disposed) return;
      angle += 0.014;
      if (rigRef.current) {
        rigRef.current.rotation.y = angle;
      }
      renderer.render(scene, camera);
      raf = window.setTimeout(() => {
        if (!disposed) requestAnimationFrame(loop);
      }, 40);
    };
    loop();

    return () => {
      disposed = true;
      clearTimeout(raf);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rigRef.current) {
      scene.remove(rigRef.current);
    }
    const { group } = createCharacterGroup(draft);
    rigRef.current = group;
    scene.add(group);
  }, [draft]);

  const perks = calculateCharacterPerks(draft);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/75"
    >
      <div
        role="dialog"
        aria-label={t(lang, 'character')}
        className="w-full max-w-4xl rounded-2xl border border-amber-400/35 bg-[#0b1322] shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/80 bg-[#101c31]">
          <h2 className="text-base font-extrabold text-white">
            {lang === 'fa' ? 'استودیو شخصی‌سازی عمیق شهردار (پیش‌نمایش سه‌بعدی زنده)' : 'Deep Character Studio (Live 3D Preview)'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'cancel')}
            className="p-1.5 rounded-md bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 overflow-y-auto civic-scroll">
          {/* Live 3D Turntable */}
          <div className="md:col-span-4 flex flex-col items-center gap-3">
            <div
              ref={previewRef}
              className="w-full h-72 rounded-xl border border-slate-700/70 bg-gradient-to-b from-[#13223b] to-[#0a111f] overflow-hidden"
            />
            <div className="w-full p-3 rounded-lg bg-slate-900/90 border border-slate-700/60 text-xs space-y-1 tabular-nums">
              <div className="font-bold text-amber-300">{draft.name || 'Mayor'}</div>
              <div className="text-slate-300">
                {lang === 'fa' ? 'قد:' : 'Height:'} {draft.heightM.toFixed(2)}m ·{' '}
                {lang === 'fa' ? 'جثه:' : 'Build:'} {Math.round(draft.buildScale * 100)}%
              </div>
              <div className="text-emerald-300">
                {lang === 'fa' ? 'ضریب ساخت:' : 'Build Speed:'} ×{perks.buildSpeedMult.toFixed(2)} ·{' '}
                {lang === 'fa' ? 'مالیات:' : 'Tax:'} ×{perks.taxMult.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="md:col-span-8 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'نام کاراکتر' : 'Character Name'}
                </span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className="w-full px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                />
              </label>

              <div>
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'رنگ پوست' : 'Skin Tone'}
                </span>
                <div className="flex items-center gap-2 pt-1">
                  {SKIN_TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => setDraft({ ...draft, skinTone: tone })}
                      aria-label={`Skin ${tone}`}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        draft.skinTone === tone ? 'border-amber-400 scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: tone }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Height & Build Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-slate-300 font-semibold flex justify-between mb-1 tabular-nums">
                  <span>{lang === 'fa' ? 'قد واقعی (متر)' : 'Height (m)'}</span>
                  <span>{draft.heightM.toFixed(2)}m</span>
                </span>
                <input
                  type="range"
                  min={1.6}
                  max={2.05}
                  step={0.01}
                  value={draft.heightM}
                  onChange={(e) => setDraft({ ...draft, heightM: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </label>
              <label className="block">
                <span className="text-slate-300 font-semibold flex justify-between mb-1 tabular-nums">
                  <span>{lang === 'fa' ? 'عرض شانه و جثه' : 'Body Build'}</span>
                  <span>{Math.round(draft.buildScale * 100)}%</span>
                </span>
                <input
                  type="range"
                  min={0.85}
                  max={1.25}
                  step={0.02}
                  value={draft.buildScale}
                  onChange={(e) => setDraft({ ...draft, buildScale: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </label>
            </div>

            {/* Outfit, Hair, Headwear, Eyewear, Accessory */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="block">
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'سبک لباس' : 'Outfit'}
                </span>
                <select
                  value={draft.outfitStyle}
                  onChange={(e) => setDraft({ ...draft, outfitStyle: e.target.value as OutfitStyle })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                >
                  {OUTFIT_STYLES.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o[lang]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'مدل مو' : 'Hair Style'}
                </span>
                <select
                  value={draft.hairStyle}
                  onChange={(e) => setDraft({ ...draft, hairStyle: e.target.value as HairStyle })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                >
                  {HAIR_STYLES.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h[lang]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'کلاه' : 'Headwear'}
                </span>
                <select
                  value={draft.headwear}
                  onChange={(e) => setDraft({ ...draft, headwear: e.target.value as HeadwearType })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                >
                  {HEADWEAR_LIST.map((hw) => (
                    <option key={hw.id} value={hw.id}>
                      {hw[lang]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'عینک / ویزور' : 'Eyewear'}
                </span>
                <select
                  value={draft.eyewear}
                  onChange={(e) => setDraft({ ...draft, eyewear: e.target.value as EyewearType })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                >
                  {EYEWEAR_LIST.map((ew) => (
                    <option key={ew.id} value={ew.id}>
                      {ew[lang]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'تجهیزات پشتی' : 'Accessory'}
                </span>
                <select
                  value={draft.accessory}
                  onChange={(e) => setDraft({ ...draft, accessory: e.target.value as AccessoryType })}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-white"
                >
                  {ACCESSORIES.map((ac) => (
                    <option key={ac.id} value={ac.id}>
                      {ac[lang]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Outfit Color Swatches */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'رنگ اصلی لباس' : 'Primary Color'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SWATCHES.map((col) => (
                    <button
                      key={`p-${col}`}
                      type="button"
                      onClick={() => setDraft({ ...draft, primaryColor: col })}
                      aria-label={`Primary ${col}`}
                      className={`w-6 h-6 rounded border-2 cursor-pointer ${
                        draft.primaryColor === col ? 'border-amber-400 scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span className="text-slate-300 font-semibold block mb-1">
                  {lang === 'fa' ? 'رنگ دوم و جزئیات' : 'Secondary Color'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SWATCHES.map((col) => (
                    <button
                      key={`s-${col}`}
                      type="button"
                      onClick={() => setDraft({ ...draft, secondaryColor: col })}
                      aria-label={`Secondary ${col}`}
                      className={`w-6 h-6 rounded border-2 cursor-pointer ${
                        draft.secondaryColor === col ? 'border-amber-400 scale-110' : 'border-slate-600'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Mayor Leadership Perk */}
            <div>
              <span className="text-slate-300 font-semibold block mb-1.5">
                {lang === 'fa' ? 'تخصص مدیریتی شهردار (تأثیر مستقیم بر شهر)' : 'Leadership Specialization (City Gameplay Perk)'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PERKS.map((pk) => {
                  const active = draft.perk === pk.id;
                  return (
                    <button
                      key={pk.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, perk: pk.id })}
                      className={`p-2.5 rounded-lg border text-start cursor-pointer transition-colors ${
                        active
                          ? 'border-amber-400 bg-amber-500/15'
                          : 'border-slate-700 bg-slate-900 hover:border-slate-500'
                      }`}
                    >
                      <div className="font-bold text-white">{pk[lang]}</div>
                      <div className="text-[11px] text-amber-300">
                        {lang === 'fa' ? pk.bonusFa : pk.bonusEn}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-slate-700/80 bg-[#101c31]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
          >
            {t(lang, 'cancel')}
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            className="px-5 py-2 rounded-md text-xs font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t(lang, 'applyCharacter')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
