export type LanguageCode = 'fa' | 'en';

export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraMode = 'fps' | 'orbit' | 'pan' | 'drive';

export type CatalogCategory =
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'civic'
  | 'energy'
  | 'parks'
  | 'transit'
  | 'props'
  | 'agriculture'
  | 'tech';

export type BuildingArchetype =
  | 'villa'
  | 'townhouse'
  | 'apartment'
  | 'skyscraper'
  | 'supertall'
  | 'commercial_plaza'
  | 'mall'
  | 'factory'
  | 'warehouse'
  | 'refinery'
  | 'civic_hall'
  | 'hospital'
  | 'school'
  | 'police_station'
  | 'fire_station'
  | 'wind_turbine'
  | 'solar_farm'
  | 'power_plant'
  | 'water_tower'
  | 'park_plaza'
  | 'fountain'
  | 'monument'
  | 'tree_cluster'
  | 'transit_hub'
  | 'bus_stop'
  | 'streetlight'
  | 'bench'
  | 'market_stall'
  | 'farm_greenhouse'
  | 'silo'
  | 'tech_lab'
  | 'observatory'
  | 'harbor_crane'
  | 'yacht_dock';

export type ResourceKey =
  | 'concrete'
  | 'steel'
  | 'timber'
  | 'glass'
  | 'electronics'
  | 'fuel'
  | 'food';

export type ResourceStock = Record<ResourceKey, number>;

export interface CatalogItem {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  category: CatalogCategory;
  archetype: BuildingArchetype;
  tier: 1 | 2 | 3 | 4 | 5;
  footprintW: number; // meters
  footprintD: number; // meters
  heightM: number; // meters (human = 1.75m, car = 4.4m)
  cost: number;
  buildTimeSec: number; // real-time seconds at 1x speed (never 0)
  materials: Partial<ResourceStock>;
  upkeepPerMin: number;
  taxYieldPerMin: number;
  productionPerMin?: Partial<ResourceStock>;
  jobs: number;
  housing: number;
  powerMW: number; // + generates, - consumes
  waterML: number; // + generates, - consumes
  happinessDelta: number;
  pollutionDelta: number;
  wallColor: string;
  accentColor: string;
  scaleVariation: number;
}

export interface PlacedStructure {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  builtAtDay: number;
  condition: number; // 0..100
  activeWorkers: number;
}

export interface ConstructionProject {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  elapsedSec: number;
  totalSec: number;
  progress: number; // 0..1
  stage: 'foundation' | 'framing' | 'facade' | 'finishing';
  materialsCommitted: boolean;
}

export interface TaxPolicy {
  residentialRate: number; // 2..25 %
  commercialRate: number; // 2..25 %
  industrialRate: number; // 2..25 %
}

export interface BudgetAllocation {
  infrastructure: number; // 50..150 %
  education: number; // 50..150 %
  healthcare: number; // 50..150 %
  environment: number; // 50..150 %
  security: number; // 50..150 %
}

export interface Ordinance {
  id: string;
  nameFa: string;
  nameEn: string;
  descFa: string;
  descEn: string;
  active: boolean;
  upkeepPerMin: number;
  effects: {
    buildSpeedMult?: number;
    happinessDelta?: number;
    pollutionMult?: number;
    taxMult?: number;
    powerDemandMult?: number;
    crimeDelta?: number;
  };
}

export interface CityCrisisOption {
  id: string;
  labelFa: string;
  labelEn: string;
  costDelta: number;
  happinessDelta: number;
  approvalDelta: number;
  pollutionDelta: number;
  powerBonusMW?: number;
  resourceDelta?: Partial<ResourceStock>;
}

export interface CityCrisisEvent {
  id: string;
  titleFa: string;
  titleEn: string;
  descFa: string;
  descEn: string;
  severity: 'info' | 'warning' | 'critical';
  options: CityCrisisOption[];
}

export type HairStyle = 'short' | 'swept' | 'bun' | 'bob' | 'afro' | 'bald';
export type EyewearType = 'none' | 'glasses' | 'sunglasses' | 'visor';
export type HeadwearType = 'none' | 'hardhat' | 'cap' | 'fedora' | 'beret';
export type OutfitStyle =
  | 'mayor_suit'
  | 'civil_engineer'
  | 'architect_coat'
  | 'eco_ranger'
  | 'cyber_planner'
  | 'street_casual';
export type AccessoryType = 'none' | 'briefcase' | 'blueprint_tube' | 'jet_pack' | 'drone_pack';
export type MayorPerk =
  | 'master_architect'
  | 'fiscal_hawk'
  | 'eco_visionary'
  | 'peoples_mayor';

export interface CharacterCustomization {
  name: string;
  heightM: number; // 1.60 .. 2.05
  buildScale: number; // 0.85 .. 1.25
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  eyewear: EyewearType;
  headwear: HeadwearType;
  outfitStyle: OutfitStyle;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  accessory: AccessoryType;
  perk: MayorPerk;
}

export interface EconomyMetrics {
  treasury: number;
  taxIncomePerMin: number;
  tradeIncomePerMin: number;
  upkeepPerMin: number;
  ordinanceCostPerMin: number;
  netCashflowPerMin: number;
  population: number;
  housingCapacity: number;
  jobsAvailable: number;
  unemploymentPct: number;
  powerGeneratedMW: number;
  powerDemandMW: number;
  waterGeneratedML: number;
  waterDemandML: number;
  happiness: number; // 0..100
  approval: number; // 0..100
  pollution: number; // 0..100
  safetyIndex: number; // 0..100
  educationIndex: number; // 0..100
  gdpPerCapita: number;
}

export interface CitySimulationState {
  day: number;
  timeOfDay: number; // 0..24 hours
  simSpeed: 1 | 3 | 10;
  resources: ResourceStock;
  marketPrices: ResourceStock;
  taxes: TaxPolicy;
  budgets: BudgetAllocation;
  ordinances: Ordinance[];
  structures: PlacedStructure[];
  constructions: ConstructionProject[];
  activeCrisis: CityCrisisEvent | null;
  crisisCooldownSec: number;
  character: CharacterCustomization;
  metrics: EconomyMetrics;
  outcome: 'none' | 'bankrupt' | 'metropolis_triumph';
  outcomeReasonFa?: string;
  outcomeReasonEn?: string;
  recentLogs: Array<{ id: string; textFa: string; textEn: string; kind: 'good' | 'warn' | 'bad' }>;
}

export interface ColliderBox {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
}

export interface PhysicsPropState {
  id: string;
  kind: 'crate' | 'barrel' | 'cone' | 'barrier';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rotY: number;
  angVel: number;
  radius: number;
  halfH: number;
  mass: number;
}

export interface PlayerPhysicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  stamina: number; // 0..100
  sprinting: boolean;
  stridePhase: number;
  landingDip: number;
  inVehicleId: string | null;
}
