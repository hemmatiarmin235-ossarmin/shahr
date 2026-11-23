import { CATALOG_MAP, findCatalogByPrefix } from './catalog';
import { groundHeightAt } from './physics';
import {
  BudgetAllocation,
  CharacterCustomization,
  CityCrisisEvent,
  CitySimulationState,
  ConstructionProject,
  EconomyMetrics,
  Ordinance,
  PlacedStructure,
  ResourceKey,
  ResourceStock,
  TaxPolicy,
} from './types';

export const RESOURCE_KEYS: ResourceKey[] = [
  'concrete',
  'steel',
  'timber',
  'glass',
  'electronics',
  'fuel',
  'food',
];

export const BASE_MARKET_PRICES: ResourceStock = {
  concrete: 32,
  steel: 58,
  timber: 26,
  glass: 44,
  electronics: 95,
  fuel: 48,
  food: 24,
};

export const RESOURCE_LABELS: Record<ResourceKey, { fa: string; en: string }> = {
  concrete: { fa: 'بتن', en: 'Concrete' },
  steel: { fa: 'فولاد', en: 'Steel' },
  timber: { fa: 'الوار چوب', en: 'Timber' },
  glass: { fa: 'شیشه', en: 'Glass' },
  electronics: { fa: 'الکترونیک', en: 'Electronics' },
  fuel: { fa: 'سوخت', en: 'Fuel' },
  food: { fa: 'مواد غذایی', en: 'Food' },
};

export function createDefaultCharacter(): CharacterCustomization {
  return {
    name: 'آرمین شهردار',
    heightM: 1.78,
    buildScale: 1.0,
    skinTone: '#e0b088',
    hairStyle: 'swept',
    hairColor: '#2a1d17',
    eyewear: 'glasses',
    headwear: 'none',
    outfitStyle: 'architect_coat',
    primaryColor: '#1e3a5f',
    secondaryColor: '#f59e0b',
    accentColor: '#e2e8f0',
    accessory: 'blueprint_tube',
    perk: 'master_architect',
  };
}

export function calculateCharacterPerks(char: CharacterCustomization): {
  buildSpeedMult: number;
  taxMult: number;
  pollutionMult: number;
  approvalBonus: number;
} {
  switch (char.perk) {
    case 'master_architect':
      return { buildSpeedMult: 1.18, taxMult: 1.0, pollutionMult: 1.0, approvalBonus: 2 };
    case 'fiscal_hawk':
      return { buildSpeedMult: 1.0, taxMult: 1.12, pollutionMult: 1.0, approvalBonus: -1 };
    case 'eco_visionary':
      return { buildSpeedMult: 1.0, taxMult: 1.0, pollutionMult: 0.78, approvalBonus: 4 };
    case 'peoples_mayor':
      return { buildSpeedMult: 1.04, taxMult: 0.98, pollutionMult: 0.95, approvalBonus: 10 };
  }
}

export function createInitialOrdinances(): Ordinance[] {
  return [
    {
      id: 'free_transit',
      nameFa: 'حمل‌ونقل عمومی رایگان',
      nameEn: 'Free Public Transit',
      descFa: 'کاهش شدید آلودگی ترافیکی و افزایش رضایت، با هزینه بودجه شهرداری',
      descEn: 'Cuts traffic emissions and boosts happiness at municipal expense.',
      active: false,
      upkeepPerMin: 180,
      effects: { happinessDelta: 8, pollutionMult: 0.78 },
    },
    {
      id: 'permits_24_7',
      nameFa: 'مجوز ساخت‌وساز شبانه‌روزی',
      nameEn: '24/7 Construction Permits',
      descFa: 'سرعت ساخت پروژه‌ها را ۳۵٪ افزایش می‌دهد اما اندکی رفاه را کم می‌کند',
      descEn: 'Accelerates all construction sites by 35% with minor noise penalty.',
      active: false,
      upkeepPerMin: 120,
      effects: { buildSpeedMult: 1.35, happinessDelta: -3 },
    },
    {
      id: 'green_grid',
      nameFa: 'یارانه انرژی پاک و خورشیدی',
      nameEn: 'Green Energy Mandate',
      descFa: 'کاهش ۲۲٪ آلودگی و مصرف برق، مناسب کلان‌شهرهای مدرن',
      descEn: 'Reduces industrial pollution by 22% and trims grid demand.',
      active: true,
      upkeepPerMin: 140,
      effects: { pollutionMult: 0.78, powerDemandMult: 0.92, happinessDelta: 4 },
    },
    {
      id: 'carbon_tax',
      nameFa: 'مالیات بر کربن صنایع سنگین',
      nameEn: 'Industrial Carbon Tax',
      descFa: 'افزایش ۱۵٪ درآمد مالیاتی و کاهش آلایندگی ولی افت اندک محبوبیت',
      descEn: 'Raises tax revenue 15% and lowers emissions; slight approval dip.',
      active: false,
      upkeepPerMin: 0,
      effects: { taxMult: 1.15, pollutionMult: 0.85, happinessDelta: -4 },
    },
    {
      id: 'tech_zone',
      nameFa: 'منطقه آزاد فناوری و استارتاپ',
      nameEn: 'Smart Innovation Zone',
      descFa: 'تقویت درآمد تجاری و سرعت پروژه‌های فناورانه',
      descEn: 'Attracts high-value firms, raising tax yield by 12%.',
      active: false,
      upkeepPerMin: 160,
      effects: { taxMult: 1.12, buildSpeedMult: 1.1, happinessDelta: 3 },
    },
    {
      id: 'universal_care',
      nameFa: 'پوشش همگانی سلامت و آموزش',
      nameEn: 'Universal Health & Civic Care',
      descFa: 'افزایش چشمگیر رضایت عمومی و بهره‌وری نیروی کار',
      descEn: 'Elevates citizen happiness (+11) and workforce stability.',
      active: false,
      upkeepPerMin: 260,
      effects: { happinessDelta: 11 },
    },
  ];
}

const CRISIS_DECK: CityCrisisEvent[] = [
  {
    id: 'grid_surge',
    titleFa: 'اوج مصرف و فشار شبکه برق شهری',
    titleEn: 'Summer Grid Peak Overload',
    descFa: 'رشد سریع ساختمان‌ها باعث فشار بر پست‌های برق شده است. تصمیم فوری شما سرنوشت روشنایی شهر را تعیین می‌کند.',
    descEn: 'Rapid urban growth is straining regional substations. Decide how the city responds.',
    severity: 'warning',
    options: [
      {
        id: 'import_power',
        labelFa: 'خرید برق اضطراری و ارتقای پست ($۶,۵۰۰)',
        labelEn: 'Emergency Grid Upgrade ($6,500)',
        costDelta: -6500,
        happinessDelta: 4,
        approvalDelta: 5,
        pollutionDelta: -1,
        powerBonusMW: 25,
      },
      {
        id: 'rolling_ration',
        labelFa: 'سهمیه‌بندی موقت صنایع (صرفه‌جویی بودجه)',
        labelEn: 'Industrial Rationing (Save Funds)',
        costDelta: 1200,
        happinessDelta: -6,
        approvalDelta: -5,
        pollutionDelta: -2,
      },
    ],
  },
  {
    id: 'harbor_boom',
    titleFa: 'رونق تجارت دریایی در بندر آزاد',
    titleEn: 'Maritime Trade Windfall',
    descFa: 'ناوگان کشتی‌های تجاری خواستار عقد قرارداد صادراتی جدید با بندر شهر هستند.',
    descEn: 'International shipping lines are bidding for expanded dockside customs contracts.',
    severity: 'info',
    options: [
      {
        id: 'sign_trade',
        labelFa: 'گسترش قرارداد گمرکی (+$۱۲,۰۰۰ و مصالح)',
        labelEn: 'Expand Port Customs (+$12,000 & Steel)',
        costDelta: 12000,
        happinessDelta: 2,
        approvalDelta: 6,
        pollutionDelta: 2.5,
        resourceDelta: { steel: 35, concrete: 35, electronics: 15 },
      },
      {
        id: 'eco_port',
        labelFa: 'الزام کشتی‌های پاک (+$۶,۰۰۰ و کاهش آلودگی)',
        labelEn: 'Green Shipping Standard (+$6,000, Clean)',
        costDelta: 6000,
        happinessDelta: 5,
        approvalDelta: 7,
        pollutionDelta: -2.0,
        resourceDelta: { timber: 25, glass: 20 },
      },
    ],
  },
  {
    id: 'housing_demand',
    titleFa: 'موج مهاجرت متخصصان به شهر',
    titleEn: 'Skilled Workforce Immigration Wave',
    descFa: 'کیفیت زندگی شهر باعث هجوم نیروهای متخصص شده اما تقاضای مسکن بالا رفته است.',
    descEn: 'High livability is drawing skilled newcomers, straining housing supply.',
    severity: 'info',
    options: [
      {
        id: 'subsidize_build',
        labelFa: 'تأمین مصالح ساختمانی انبوه ($۵,۰۰۰)',
        labelEn: 'Subsidize Material Stockpile ($5,000)',
        costDelta: -5000,
        happinessDelta: 6,
        approvalDelta: 7,
        pollutionDelta: 0.5,
        resourceDelta: { concrete: 60, timber: 50, glass: 30 },
      },
      {
        id: 'market_only',
        labelFa: 'واگذاری به بازار آزاد (+$۲,۵۰۰ مالیات)',
        labelEn: 'Leave to Market Forces (+$2,500 Tax)',
        costDelta: 2500,
        happinessDelta: -4,
        approvalDelta: -3,
        pollutionDelta: 0,
      },
    ],
  },
  {
    id: 'storm_front',
    titleFa: 'طوفان ساحلی و موج شدید دریا',
    titleEn: 'Coastal Storm Surge Warning',
    descFa: 'جبهه بارشی شدیدی به سمت اسکله و تأسیسات ساحلی در حرکت است.',
    descEn: 'A strong Atlantic front threatens the harbor quay and coastal utilities.',
    severity: 'critical',
    options: [
      {
        id: 'deploy_barriers',
        labelFa: 'استقرار تیم‌های مهار سیلاب ($۷,۵۰۰)',
        labelEn: 'Deploy Flood Barriers ($7,500)',
        costDelta: -7500,
        happinessDelta: 3,
        approvalDelta: 9,
        pollutionDelta: 0,
      },
      {
        id: 'minimal_alert',
        labelFa: 'هشدار عمومی بدون بودجه اضطراری',
        labelEn: 'Public Advisory Only ($0)',
        costDelta: 0,
        happinessDelta: -8,
        approvalDelta: -9,
        pollutionDelta: 1.5,
      },
    ],
  },
];

function placed(
  uid: string,
  prefix: string,
  variant: number,
  x: number,
  z: number,
  rotationY = 0
): PlacedStructure {
  const item = findCatalogByPrefix(prefix, variant);
  return {
    uid,
    itemId: item.id,
    x,
    y: groundHeightAt(x, z),
    z,
    rotationY,
    builtAtDay: 1,
    condition: 100,
    activeWorkers: 8,
  };
}

function createStarterCity(): {
  structures: PlacedStructure[];
  constructions: ConstructionProject[];
} {
  // Rich realistic multi-district starter coastal city aligned cleanly to our road grid
  const structures: PlacedStructure[] = [
    // Grand Civic Core (North of spawn at 0, 22 -> looking North at City Hall & Skyline)
    placed('s-hall', 'CIV-HAL', 5, 0, -20, 0),
    placed('s-plaza', 'PRK-PLZ', 3, -20, 18, 0),
    placed('s-fnt', 'PRK-FNT', 4, 20, 18, 0),
    placed('s-mon', 'PRK-MON', 5, -20, -20, 0),
    placed('s-lib', 'CIV-LIB', 4, 20, -20, Math.PI),

    // Downtown High-Rise & Commercial Skyline
    placed('s-sky1', 'COM-OFF', 1, -60, -20, Math.PI / 2),
    placed('s-sky2', 'COM-HQ', 7, -60, -60, 0),
    placed('s-mall', 'COM-MALL', 1, 60, -20, -Math.PI / 2),
    placed('s-htl', 'COM-HTL', 8, 60, 20, Math.PI),
    placed('s-biz1', 'COM-BIZ', 2, -20, 60, 0),
    placed('s-biz2', 'COM-MKT', 0, 20, 60, 0),

    // Residential Neighborhoods (West & North-West)
    placed('s-apt1', 'RES-APT', 3, -60, 20, Math.PI / 2),
    placed('s-apt2', 'RES-LUX', 4, -60, 60, 0),
    placed('s-twn1', 'RES-TWN', 2, -20, -60, 0),
    placed('s-eco1', 'RES-ECO', 3, 20, -60, 0),
    placed('s-vil1', 'RES-VIL', 0, -100, 20, Math.PI / 2),
    placed('s-vil2', 'RES-VIL', 8, -100, 60, Math.PI / 2),
    placed('s-coast1', 'RES-COAST', 8, -60, 102, Math.PI),

    // Civic Services
    placed('s-hosp', 'CIV-HSP', 4, 60, -60, 0),
    placed('s-pol', 'CIV-POL', 1, 100, -20, -Math.PI / 2),
    placed('s-fir', 'CIV-FIR', 2, -100, -20, Math.PI / 2),
    placed('s-uni', 'CIV-UNI', 5, 100, -60, -Math.PI / 2),

    // Energy, Water & Industry (East & Port)
    placed('s-pwr1', 'ENE-GEO', 0, 142, -55, -Math.PI / 2),
    placed('s-wnd1', 'ENE-WND', 4, 145, 22, -Math.PI / 2),
    placed('s-wnd2', 'ENE-WND', 4, 145, 58, -Math.PI / 2),
    placed('s-sol1', 'ENE-SOL', 6, 104, 22, 0),
    placed('s-wat1', 'ENE-WAT', 0, 104, 60, 0),
    placed('s-wat2', 'ENE-WAT', 1, 104, -18, 0),
    placed('s-des1', 'ENE-DES', 6, 104, 102, Math.PI),
    placed('s-stl1', 'IND-STL', 0, 142, -16, -Math.PI / 2),
    placed('s-cem1', 'IND-CEM', 0, 142, 92, -Math.PI / 2),
    placed('s-grn1', 'AGR-GRN', 3, -102, -62, 0),

    // Harbor & Waterfront
    placed('s-prt1', 'TRN-PRT', 0, 60, 104, Math.PI),
    placed('s-yat1', 'PRK-YAT', 8, -20, 104, Math.PI),
    placed('s-trn1', 'TRN-HUB', 1, 20, 102, Math.PI),

    // Streetscape Props along Central Boulevard
    placed('s-lgt1', 'PRP-LGT', 0, -6.5, 10, Math.PI / 2),
    placed('s-lgt2', 'PRP-LGT', 0, 6.5, 10, -Math.PI / 2),
    placed('s-lgt3', 'PRP-LGT', 0, -6.5, 34, Math.PI / 2),
    placed('s-lgt4', 'PRP-LGT', 0, 6.5, 34, -Math.PI / 2),
    placed('s-clk1', 'PRP-CLK', 5, 0, 50, 0),
  ];

  // Two active timed construction sites visible right away in the city!
  const itemA = findCatalogByPrefix('RES-SUP', 6);
  const itemB = findCatalogByPrefix('TCH-RND', 6);
  const constructions: ConstructionProject[] = [
    {
      uid: 'c-init-1',
      itemId: itemA.id,
      x: 60,
      y: groundHeightAt(60, 60),
      z: 60,
      rotationY: 0,
      elapsedSec: 12,
      totalSec: itemA.buildTimeSec,
      progress: 12 / itemA.buildTimeSec,
      stage: 'framing',
      materialsCommitted: true,
    },
    {
      uid: 'c-init-2',
      itemId: itemB.id,
      x: -20,
      y: groundHeightAt(-20, -100),
      z: -100,
      rotationY: 0,
      elapsedSec: 6,
      totalSec: itemB.buildTimeSec,
      progress: 6 / itemB.buildTimeSec,
      stage: 'foundation',
      materialsCommitted: true,
    },
  ];

  return { structures, constructions };
}

export function computeEconomyMetrics(
  state: Pick<
    CitySimulationState,
    'structures' | 'taxes' | 'budgets' | 'ordinances' | 'character' | 'resources'
  >,
  prevTreasury: number,
  prevApproval: number
): EconomyMetrics {
  const perks = calculateCharacterPerks(state.character);

  let housingCapacity = 0;
  let jobsAvailable = 0;
  let powerGeneratedMW = 0;
  let powerDemandMW = 0;
  let waterGeneratedML = 0;
  let waterDemandML = 0;
  let rawResTax = 0;
  let rawComTax = 0;
  let rawIndTax = 0;
  let totalUpkeep = 0;
  let happinessSum = 48;
  let pollutionRaw = 8;

  for (const st of state.structures) {
    const item = CATALOG_MAP.get(st.itemId);
    if (!item) continue;

    housingCapacity += item.housing;
    jobsAvailable += item.jobs;
    if (item.powerMW >= 0) powerGeneratedMW += item.powerMW;
    else powerDemandMW += -item.powerMW;

    if (item.waterML >= 0) waterGeneratedML += item.waterML;
    else waterDemandML += -item.waterML;

    totalUpkeep += item.upkeepPerMin;
    happinessSum += item.happinessDelta * 0.45;
    pollutionRaw += item.pollutionDelta;

    if (item.category === 'residential') rawResTax += item.taxYieldPerMin;
    else if (item.category === 'commercial' || item.category === 'parks') rawComTax += item.taxYieldPerMin;
    else rawIndTax += item.taxYieldPerMin;
  }

  let ordinanceCostPerMin = 0;
  let ordTaxMult = 1.0;
  let ordPollutionMult = 1.0;
  let ordPowerMult = 1.0;
  let ordHappiness = 0;

  for (const ord of state.ordinances) {
    if (!ord.active) continue;
    ordinanceCostPerMin += ord.upkeepPerMin;
    if (ord.effects.taxMult) ordTaxMult *= ord.effects.taxMult;
    if (ord.effects.pollutionMult) ordPollutionMult *= ord.effects.pollutionMult;
    if (ord.effects.powerDemandMult) ordPowerMult *= ord.effects.powerDemandMult;
    if (ord.effects.happinessDelta) ordHappiness += ord.effects.happinessDelta;
  }

  powerDemandMW = Math.round(powerDemandMW * ordPowerMult * 10) / 10;

  const avgBudgetScale =
    (state.budgets.infrastructure +
      state.budgets.education +
      state.budgets.healthcare +
      state.budgets.environment +
      state.budgets.security) /
    500;

  const upkeepPerMin = Math.round(totalUpkeep * avgBudgetScale);

  const taxIncomePerMin = Math.round(
    (rawResTax * (state.taxes.residentialRate / 10) +
      rawComTax * (state.taxes.commercialRate / 10) +
      rawIndTax * (state.taxes.industrialRate / 10)) *
      ordTaxMult *
      perks.taxMult
  );

  // Port & logistics export bonus
  const tradeIncomePerMin = Math.round(
    Math.min(1800, (state.resources.steel + state.resources.electronics + state.resources.glass) * 0.55)
  );

  const netCashflowPerMin = taxIncomePerMin + tradeIncomePerMin - upkeepPerMin - ordinanceCostPerMin;

  // Tax burden penalty or relief
  const avgTax = (state.taxes.residentialRate + state.taxes.commercialRate + state.taxes.industrialRate) / 3;
  const taxHappiness = (10 - avgTax) * 1.4;

  // Utility coverage penalty
  const powerShortage = Math.max(0, powerDemandMW - powerGeneratedMW);
  const waterShortage = Math.max(0, waterDemandML - waterGeneratedML);
  const utilityPenalty = powerShortage * 0.45 + waterShortage * 0.4;

  // Pollution
  const envBudgetRelief = (state.budgets.environment - 100) * 0.12;
  const pollution = Math.max(
    0,
    Math.min(100, Math.round((pollutionRaw * ordPollutionMult * perks.pollutionMult - envBudgetRelief) * 10) / 10)
  );

  const budgetHappiness =
    (state.budgets.healthcare - 100) * 0.08 +
    (state.budgets.education - 100) * 0.07 +
    (state.budgets.security - 100) * 0.06;

  const happiness = Math.max(
    5,
    Math.min(
      100,
      Math.round(happinessSum + ordHappiness + taxHappiness + budgetHappiness - utilityPenalty - pollution * 0.38)
    )
  );

  const population = Math.max(40, Math.round(housingCapacity * (0.62 + happiness * 0.0038)));
  const unemploymentPct =
    jobsAvailable >= population * 0.55
      ? Math.max(2, Math.round(8 - (jobsAvailable - population * 0.55) * 0.03))
      : Math.min(48, Math.round(((population * 0.55 - jobsAvailable) / Math.max(1, population * 0.55)) * 100));

  const targetApproval = Math.max(
    5,
    Math.min(100, Math.round(happiness * 0.78 + perks.approvalBonus + (netCashflowPerMin > 0 ? 8 : -8)))
  );
  const approval = Math.round(prevApproval * 0.7 + targetApproval * 0.3);

  const safetyIndex = Math.max(
    15,
    Math.min(100, Math.round(55 + (state.budgets.security - 100) * 0.35 + happiness * 0.25))
  );
  const educationIndex = Math.max(
    20,
    Math.min(100, Math.round(52 + (state.budgets.education - 100) * 0.4 + state.structures.length * 0.4))
  );

  const gdpPerCapita = Math.round(
    18000 + (taxIncomePerMin * 35) / Math.max(1, population) + educationIndex * 180
  );

  return {
    treasury: Math.round(prevTreasury),
    taxIncomePerMin,
    tradeIncomePerMin,
    upkeepPerMin,
    ordinanceCostPerMin,
    netCashflowPerMin,
    population,
    housingCapacity,
    jobsAvailable,
    unemploymentPct,
    powerGeneratedMW: Math.round(powerGeneratedMW * 10) / 10,
    powerDemandMW,
    waterGeneratedML: Math.round(waterGeneratedML * 10) / 10,
    waterDemandML: Math.round(waterDemandML * 10) / 10,
    happiness,
    approval,
    pollution,
    safetyIndex,
    educationIndex,
    gdpPerCapita,
  };
}

export function createInitialCityState(): CitySimulationState {
  const { structures, constructions } = createStarterCity();
  const character = createDefaultCharacter();
  const ordinances = createInitialOrdinances();
  const resources: ResourceStock = {
    concrete: 420,
    steel: 320,
    timber: 360,
    glass: 280,
    electronics: 160,
    fuel: 260,
    food: 340,
  };
  const taxes: TaxPolicy = {
    residentialRate: 9,
    commercialRate: 10,
    industrialRate: 11,
  };
  const budgets: BudgetAllocation = {
    infrastructure: 100,
    education: 100,
    healthcare: 100,
    environment: 100,
    security: 100,
  };

  const metrics = computeEconomyMetrics(
    { structures, taxes, budgets, ordinances, character, resources },
    145000,
    76
  );

  return {
    day: 1,
    timeOfDay: 9.5, // Crisp bright morning sunlight
    simSpeed: 1,
    resources,
    marketPrices: { ...BASE_MARKET_PRICES },
    taxes,
    budgets,
    ordinances,
    structures,
    constructions,
    activeCrisis: null,
    crisisCooldownSec: 55,
    character,
    metrics,
    outcome: 'none',
    recentLogs: [
      {
        id: 'log-welcome',
        textFa: 'کلان‌شهر ساحلی آماده مدیریت شماست. پروژه‌های فعال در حال ساخت هستند.',
        textEn: 'Coastal metropolis initialized. Active construction sites are underway.',
        kind: 'good',
      },
    ],
  };
}

export function canAffordProject(
  state: CitySimulationState,
  itemId: string
): { ok: boolean; reasonFa?: string; reasonEn?: string } {
  const item = CATALOG_MAP.get(itemId);
  if (!item) {
    return { ok: false, reasonFa: 'آیتم نامعتبر است.', reasonEn: 'Invalid blueprint.' };
  }
  if (state.metrics.treasury < item.cost) {
    return {
      ok: false,
      reasonFa: `بودجه کافی نیست (نیاز: $${item.cost.toLocaleString()})`,
      reasonEn: `Insufficient treasury (Need $${item.cost.toLocaleString()})`,
    };
  }
  for (const [key, req] of Object.entries(item.materials)) {
    const rk = key as ResourceKey;
    const have = state.resources[rk] ?? 0;
    if (have < (req ?? 0)) {
      return {
        ok: false,
        reasonFa: `کمبود مصالح: ${RESOURCE_LABELS[rk].fa} (${Math.floor(have)}/${req})`,
        reasonEn: `Insufficient ${RESOURCE_LABELS[rk].en} (${Math.floor(have)}/${req})`,
      };
    }
  }
  return { ok: true };
}

export function startConstructionProject(
  state: CitySimulationState,
  itemId: string,
  x: number,
  z: number,
  rotationY: number
): { nextState: CitySimulationState; project?: ConstructionProject; errorFa?: string; errorEn?: string } {
  const check = canAffordProject(state, itemId);
  if (!check.ok) {
    return { nextState: state, errorFa: check.reasonFa, errorEn: check.reasonEn };
  }
  const item = CATALOG_MAP.get(itemId)!;

  const nextResources = { ...state.resources };
  for (const [key, req] of Object.entries(item.materials)) {
    const rk = key as ResourceKey;
    nextResources[rk] = Math.max(0, nextResources[rk] - (req ?? 0));
  }

  const project: ConstructionProject = {
    uid: `proj-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    itemId: item.id,
    x,
    y: groundHeightAt(x, z),
    z,
    rotationY,
    elapsedSec: 0,
    totalSec: item.buildTimeSec,
    progress: 0,
    stage: 'foundation',
    materialsCommitted: true,
  };

  const nextMetrics = {
    ...state.metrics,
    treasury: state.metrics.treasury - item.cost,
  };

  return {
    project,
    nextState: {
      ...state,
      resources: nextResources,
      constructions: [...state.constructions, project],
      metrics: nextMetrics,
      recentLogs: [
        {
          id: `log-${project.uid}`,
          textFa: `ساخت «${item.nameFa}» آغاز شد (${item.buildTimeSec} ثانیه).`,
          textEn: `Construction started: ${item.nameEn} (${item.buildTimeSec}s).`,
          kind: 'good',
        },
        ...state.recentLogs.slice(0, 7),
      ],
    },
  };
}

export function tradeMarketResource(
  state: CitySimulationState,
  resource: ResourceKey,
  amount: number // positive = buy, negative = sell
): CitySimulationState {
  const unitPrice = state.marketPrices[resource];
  if (amount > 0) {
    const totalCost = Math.round(unitPrice * amount);
    if (state.metrics.treasury < totalCost) return state;
    return {
      ...state,
      resources: { ...state.resources, [resource]: state.resources[resource] + amount },
      metrics: { ...state.metrics, treasury: state.metrics.treasury - totalCost },
    };
  } else {
    const sellQty = Math.min(state.resources[resource], Math.abs(amount));
    if (sellQty <= 0) return state;
    const revenue = Math.round(unitPrice * 0.85 * sellQty);
    return {
      ...state,
      resources: { ...state.resources, [resource]: state.resources[resource] - sellQty },
      metrics: { ...state.metrics, treasury: state.metrics.treasury + revenue },
    };
  }
}

export function resolveCityCrisis(
  state: CitySimulationState,
  optionId: string
): CitySimulationState {
  if (!state.activeCrisis) return state;
  const option = state.activeCrisis.options.find((o) => o.id === optionId);
  if (!option) return state;

  const nextResources = { ...state.resources };
  if (option.resourceDelta) {
    for (const [k, v] of Object.entries(option.resourceDelta)) {
      const rk = k as ResourceKey;
      nextResources[rk] = Math.max(0, nextResources[rk] + (v ?? 0));
    }
  }

  return {
    ...state,
    resources: nextResources,
    activeCrisis: null,
    crisisCooldownSec: 65,
    metrics: {
      ...state.metrics,
      treasury: state.metrics.treasury + option.costDelta,
      happiness: Math.max(5, Math.min(100, state.metrics.happiness + option.happinessDelta)),
      approval: Math.max(5, Math.min(100, state.metrics.approval + option.approvalDelta)),
      pollution: Math.max(0, Math.min(100, state.metrics.pollution + option.pollutionDelta)),
      powerGeneratedMW: state.metrics.powerGeneratedMW + (option.powerBonusMW ?? 0),
    },
    recentLogs: [
      {
        id: `crisis-${Date.now()}`,
        textFa: `تصمیم شهردار اجرا شد: ${option.labelFa}`,
        textEn: `Mayor decree enacted: ${option.labelEn}`,
        kind: option.approvalDelta >= 0 ? 'good' : 'warn',
      },
      ...state.recentLogs.slice(0, 7),
    ],
  };
}

export function stepCitySimulation(
  state: CitySimulationState,
  realDtSec: number
): { nextState: CitySimulationState; completedUids: string[] } {
  if (state.outcome !== 'none') {
    return { nextState: state, completedUids: [] };
  }

  const simDt = Math.min(realDtSec, 0.25) * state.simSpeed;
  const perks = calculateCharacterPerks(state.character);

  let ordBuildSpeed = 1.0;
  for (const ord of state.ordinances) {
    if (ord.active && ord.effects.buildSpeedMult) {
      ordBuildSpeed *= ord.effects.buildSpeedMult;
    }
  }
  const infraFactor = 0.75 + (state.budgets.infrastructure / 100) * 0.25;
  const totalBuildRate = perks.buildSpeedMult * ordBuildSpeed * infraFactor;

  // Advance day/time (1 game day = 180 sim seconds -> 24 hours)
  let timeOfDay = state.timeOfDay + (simDt / 180) * 24;
  let day = state.day;
  while (timeOfDay >= 24) {
    timeOfDay -= 24;
    day += 1;
  }

  // Advance timed construction projects
  const remainingConstructions: ConstructionProject[] = [];
  const newlyBuilt: PlacedStructure[] = [];
  const completedUids: string[] = [];
  const newLogs = [...state.recentLogs];

  for (const proj of state.constructions) {
    const nextElapsed = proj.elapsedSec + simDt * totalBuildRate;
    const progress = Math.min(1, nextElapsed / proj.totalSec);
    if (progress >= 1) {
      completedUids.push(proj.uid);
      newlyBuilt.push({
        uid: `str-${proj.uid}`,
        itemId: proj.itemId,
        x: proj.x,
        y: proj.y,
        z: proj.z,
        rotationY: proj.rotationY,
        builtAtDay: day,
        condition: 100,
        activeWorkers: 6,
      });
      const item = CATALOG_MAP.get(proj.itemId);
      if (item) {
        newLogs.unshift({
          id: `done-${proj.uid}`,
          textFa: `تکمیل ساخت: «${item.nameFa}» به بهره‌برداری رسید!`,
          textEn: `Completed: ${item.nameEn} is now operational!`,
          kind: 'good',
        });
      }
    } else {
      const stage: ConstructionProject['stage'] =
        progress < 0.25
          ? 'foundation'
          : progress < 0.55
            ? 'framing'
            : progress < 0.85
              ? 'facade'
              : 'finishing';
      remainingConstructions.push({
        ...proj,
        elapsedSec: nextElapsed,
        progress,
        stage,
      });
    }
  }

  const nextStructures =
    newlyBuilt.length > 0 ? [...state.structures, ...newlyBuilt] : state.structures;

  // Resource production & population food/fuel consumption per minute -> scaled to simDt
  const minFrac = simDt / 60;
  const nextResources = { ...state.resources };
  for (const st of nextStructures) {
    const item = CATALOG_MAP.get(st.itemId);
    if (!item?.productionPerMin) continue;
    for (const [k, prod] of Object.entries(item.productionPerMin)) {
      const rk = k as ResourceKey;
      nextResources[rk] = Math.min(5000, nextResources[rk] + (prod ?? 0) * minFrac);
    }
  }
  // Baseline municipal consumption
  nextResources.food = Math.max(0, nextResources.food - state.metrics.population * 0.004 * minFrac);
  nextResources.fuel = Math.max(0, nextResources.fuel - state.structures.length * 0.12 * minFrac);

  // Market price gentle oscillation
  const nextPrices = { ...state.marketPrices };
  for (const rk of RESOURCE_KEYS) {
    const scarcity = Math.max(0.7, Math.min(1.6, 220 / Math.max(40, nextResources[rk])));
    const wave = 1 + Math.sin(day * 0.8 + rk.length) * 0.08;
    nextPrices[rk] = Math.round(BASE_MARKET_PRICES[rk] * scarcity * wave);
  }

  // Recompute economy & treasury delta
  const provisionalMetrics = computeEconomyMetrics(
    {
      structures: nextStructures,
      taxes: state.taxes,
      budgets: state.budgets,
      ordinances: state.ordinances,
      character: state.character,
      resources: nextResources,
    },
    state.metrics.treasury,
    state.metrics.approval
  );

  const treasuryDelta = provisionalMetrics.netCashflowPerMin * minFrac;
  provisionalMetrics.treasury = Math.round(state.metrics.treasury + treasuryDelta);

  // Crisis trigger cooldown
  let activeCrisis = state.activeCrisis;
  let crisisCooldownSec = state.crisisCooldownSec - simDt;
  if (!activeCrisis && crisisCooldownSec <= 0) {
    const idx = (day + nextStructures.length) % CRISIS_DECK.length;
    activeCrisis = CRISIS_DECK[idx];
    crisisCooldownSec = 90;
  }

  // Outcome check (reachable defeat & victory)
  let outcome: CitySimulationState['outcome'] = 'none';
  let outcomeReasonFa: string | undefined;
  let outcomeReasonEn: string | undefined;

  if (provisionalMetrics.treasury < -25000 || provisionalMetrics.approval <= 8) {
    outcome = 'bankrupt';
    outcomeReasonFa = 'ورشکستگی بودجه شهرداری یا سقوط اعتماد شهروندان';
    outcomeReasonEn = 'Municipal insolvency or civic approval collapse.';
  } else if (
    provisionalMetrics.population >= 4500 &&
    provisionalMetrics.treasury >= 400000 &&
    provisionalMetrics.happiness >= 82
  ) {
    outcome = 'metropolis_triumph';
    outcomeReasonFa = 'کلان‌شهر نمونه جهانی با اقتصاد پایدار و رفاه حداکثری ساخته شد!';
    outcomeReasonEn = 'World-class sustainable metropolis achieved!';
  }

  return {
    completedUids,
    nextState: {
      ...state,
      day,
      timeOfDay,
      resources: nextResources,
      marketPrices: nextPrices,
      structures: nextStructures,
      constructions: remainingConstructions,
      activeCrisis,
      crisisCooldownSec,
      metrics: provisionalMetrics,
      outcome,
      outcomeReasonFa,
      outcomeReasonEn,
      recentLogs: newLogs.slice(0, 8),
    },
  };
}
