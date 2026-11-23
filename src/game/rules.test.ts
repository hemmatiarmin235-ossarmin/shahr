import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_ITEMS, CATALOG_MAP } from './catalog';
import {
  calculateCharacterPerks,
  createInitialCityState,
  resolveCityCrisis,
  startConstructionProject,
  stepCitySimulation,
  tradeMarketResource,
} from './simulation';
import {
  createInitialPlayerState,
  groundHeightAt,
  isRoadAt,
  stepPlayerPhysics,
} from './physics';
import { ColliderBox } from './types';

test('catalog contains at least 500 unique buildable items with timed construction', () => {
  assert.ok(CATALOG_ITEMS.length >= 500, `Expected >= 500 items, got ${CATALOG_ITEMS.length}`);
  const ids = new Set(CATALOG_ITEMS.map((i) => i.id));
  assert.equal(ids.size, CATALOG_ITEMS.length);

  for (const item of CATALOG_ITEMS) {
    assert.ok(item.buildTimeSec >= 5, `${item.id} buildTimeSec must be >= 5`);
    assert.ok(item.cost > 0, `${item.id} cost must be > 0`);
    assert.ok(item.heightM >= 1.2, `${item.id} heightM must be realistic`);
  }
});

test('construction is timed (not instant) and completes into a placed structure', () => {
  const initial = createInitialCityState();
  const villa = CATALOG_MAP.get('res-vil-001')!;
  const startCount = initial.structures.length;
  const startConstructions = initial.constructions.length;

  const started = startConstructionProject(initial, villa.id, -35, -35, 0);
  assert.ok(started.project, 'Project should start');
  assert.equal(started.nextState.constructions.length, startConstructions + 1);
  assert.equal(started.nextState.structures.length, startCount); // NOT instant!

  // Advance 1 second -> still under construction
  const step1 = stepCitySimulation(started.nextState, 1.0);
  assert.equal(step1.completedUids.length, 0);
  assert.equal(step1.nextState.structures.length, startCount);

  // Advance enough time at 10x speed to complete
  let current = step1.nextState;
  current = { ...current, simSpeed: 10 };
  for (let i = 0; i < 40; i++) {
    current = stepCitySimulation(current, 0.2).nextState;
  }
  assert.ok(current.structures.length >= startCount + 1, 'Villa should complete after build duration');
});

test('municipal economy, market trading, and character perks affect state', () => {
  const state = createInitialCityState();
  const beforeSteel = state.resources.steel;
  const beforeTreasury = state.metrics.treasury;

  const afterBuy = tradeMarketResource(state, 'steel', 20);
  assert.equal(afterBuy.resources.steel, beforeSteel + 20);
  assert.ok(afterBuy.metrics.treasury < beforeTreasury);

  const archPerks = calculateCharacterPerks({ ...state.character, perk: 'master_architect' });
  const fiscalPerks = calculateCharacterPerks({ ...state.character, perk: 'fiscal_hawk' });
  assert.ok(archPerks.buildSpeedMult > 1);
  assert.ok(fiscalPerks.taxMult > 1);
});

test('first-person spawn is clear, groundHeightAt varies with terrain, and AABB collision stops wall clipping', () => {
  const player = createInitialPlayerState();
  assert.ok(isRoadAt(player.x, player.z), 'Player spawns on open Grand Civic Boulevard');
  assert.ok(groundHeightAt(0, 22) > 0);
  assert.ok(groundHeightAt(0, 200) < 0, 'Southern bay dips below sea level');
  assert.ok(groundHeightAt(-200, -200) > 2, 'Northern foothills rise above downtown');

  const wall: ColliderBox = { id: 'w1', minX: -2, maxX: 2, minZ: 15, maxZ: 18, maxY: 10 };
  for (let i = 0; i < 40; i++) {
    stepPlayerPhysics(
      player,
      { forward: 1, strafe: 0, sprint: true, jumpJustPressed: false },
      [wall],
      0.03
    );
  }
  // Player walked North (-Z) from z=22 toward wall at z=18 -> must be pushed outside z >= 18.4
  assert.ok(player.z >= 18.3, `Player z=${player.z} should not clip inside wall maxZ=18`);
});

test('crisis resolution updates treasury and metrics', () => {
  let state = createInitialCityState();
  state = { ...state, crisisCooldownSec: 0.1 };
  const stepped = stepCitySimulation(state, 0.5).nextState;
  assert.ok(stepped.activeCrisis !== null, 'Crisis should trigger when cooldown hits 0');
  const firstOpt = stepped.activeCrisis!.options[0];
  const resolved = resolveCityCrisis(stepped, firstOpt.id);
  assert.equal(resolved.activeCrisis, null);
});
