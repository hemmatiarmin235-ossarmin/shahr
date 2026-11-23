import { ColliderBox, PhysicsPropState, PlayerPhysicsState } from './types';

export const WORLD_HALF_SIZE = 310;
export const SEA_LEVEL = 0.0;
export const PLAYER_EYE_RATIO = 0.91;
export const PLAYER_RADIUS = 0.42;

/**
 * Deterministic smooth terrain elevation function across the 640m x 640m open world.
 * Central city grid (-125..125, -115..98) is engineered level at y = 0.25m,
 * Harbor Quay at z = 98..118 sits at y = 1.05m, ocean bay dips below 0m for z > 120,
 * and scenic hills + outer mountain ridges rise naturally beyond the urban basin.
 */
export function groundHeightAt(x: number, z: number): number {
  // Harbor pier & boardwalk
  if (z >= 98 && z <= 118 && Math.abs(x) <= 135) {
    return 1.05;
  }

  // Southern coastal bay & seabed
  if (z > 118) {
    const t = Math.min(1, (z - 118) / 48);
    const waveBed = -3.8 * t + Math.sin(x * 0.06) * 0.35;
    // Eastern breakwater peninsula
    if (x > 135 && z < 185) {
      const penT = Math.min(1, (x - 135) / 35);
      return waveBed * (1 - penT) + 1.2 * penT;
    }
    return waveBed;
  }

  // Engineered flat urban core
  const distFromCoreX = Math.max(0, Math.abs(x) - 120);
  const distFromCoreZ = z < -110 ? -110 - z : 0;
  const distOutside = Math.hypot(distFromCoreX, distFromCoreZ);

  if (distOutside <= 0.001) {
    return 0.25;
  }

  const blend = Math.min(1, distOutside / 55);
  const smoothBlend = blend * blend * (3 - 2 * blend);

  // Rolling foothills & natural mountain perimeter
  const hills =
    Math.sin(x * 0.024 + 0.5) * Math.cos(z * 0.022 - 0.3) * 7.5 +
    Math.sin(x * 0.055 - z * 0.04) * 2.6 +
    7.2;

  const radial = Math.hypot(x, z);
  const perimeterRidge = radial > 245 ? Math.pow((radial - 245) / 55, 1.5) * 26 : 0;

  return 0.25 + smoothBlend * Math.max(0, hills) + perimeterRidge;
}

export function isWaterAt(x: number, z: number): boolean {
  return groundHeightAt(x, z) < SEA_LEVEL - 0.15;
}

export const ROAD_COORDS = [-80, -40, 0, 40, 80];
export const ROAD_HALF_WIDTH = 5.2; // 10.4m wide two-lane avenue

export function isRoadAt(x: number, z: number): boolean {
  if (Math.abs(x) > 108 || z < -105 || z > 96) return false;
  // Coastal promenade avenue
  if (Math.abs(z - 88) <= ROAD_HALF_WIDTH && Math.abs(x) <= 104) return true;
  for (const rx of ROAD_COORDS) {
    if (Math.abs(x - rx) <= ROAD_HALF_WIDTH && z >= -96 && z <= 92) return true;
  }
  for (const rz of ROAD_COORDS) {
    if (Math.abs(z - rz) <= ROAD_HALF_WIDTH && Math.abs(x) <= 96) return true;
  }
  return false;
}

export function createInitialPlayerState(): PlayerPhysicsState {
  // Spawn on open Grand Civic Boulevard looking North toward City Hall & Downtown
  const startX = 0;
  const startZ = 22;
  return {
    x: startX,
    y: groundHeightAt(startX, startZ),
    z: startZ,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0, // Facing -Z (North)
    pitch: -0.04,
    grounded: true,
    stamina: 100,
    sprinting: false,
    stridePhase: 0,
    landingDip: 0,
    inVehicleId: null,
  };
}

export interface PlayerInputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  sprint: boolean;
  jumpJustPressed: boolean;
}

/**
 * Resolves 2D circle-vs-AABB horizontal sliding collision so the player glides smoothly
 * along building walls, fences, and parked/moving vehicles without getting stuck.
 */
export function resolveCircleCollisions(
  x: number,
  z: number,
  y: number,
  radius: number,
  colliders: ColliderBox[]
): { x: number; z: number; collided: boolean } {
  let outX = x;
  let outZ = z;
  let collided = false;

  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < colliders.length; i++) {
      const box = colliders[i];
      if (y >= box.maxY - 0.15) continue; // Player is standing on top of or above this box

      const closestX = Math.max(box.minX, Math.min(outX, box.maxX));
      const closestZ = Math.max(box.minZ, Math.min(outZ, box.maxZ));

      const dx = outX - closestX;
      const dz = outZ - closestZ;
      const distSq = dx * dx + dz * dz;

      if (distSq < radius * radius) {
        collided = true;
        if (distSq > 1e-6) {
          const dist = Math.sqrt(distSq);
          const push = radius - dist;
          outX += (dx / dist) * push;
          outZ += (dz / dist) * push;
        } else {
          // Center inside AABB: push out along nearest edge
          const penLeft = Math.abs(outX - box.minX);
          const penRight = Math.abs(box.maxX - outX);
          const penTop = Math.abs(outZ - box.minZ);
          const penBottom = Math.abs(box.maxZ - outZ);
          const minPen = Math.min(penLeft, penRight, penTop, penBottom);
          if (minPen === penLeft) outX = box.minX - radius;
          else if (minPen === penRight) outX = box.maxX + radius;
          else if (minPen === penTop) outZ = box.minZ - radius;
          else outZ = box.maxZ + radius;
        }
      }
    }
  }

  return { x: outX, z: outZ, collided };
}

export function stepPlayerPhysics(
  player: PlayerPhysicsState,
  input: PlayerInputState,
  colliders: ColliderBox[],
  dtRaw: number
): { landedSpeed: number; jumped: boolean } {
  const dt = Math.min(dtRaw, 0.05);
  let landedSpeed = 0;
  let jumped = false;

  // Forward & right vectors in XZ from yaw (yaw=0 faces -Z)
  const sinY = Math.sin(player.yaw);
  const cosY = Math.cos(player.yaw);
  const fwdX = -sinY;
  const fwdZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  let wishX = fwdX * input.forward + rightX * input.strafe;
  let wishZ = fwdZ * input.forward + rightZ * input.strafe;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  const wantsSprint = input.sprint && wishLen > 0.1 && player.stamina > 4;
  player.sprinting = wantsSprint;
  if (wantsSprint) {
    player.stamina = Math.max(0, player.stamina - 22 * dt);
  } else {
    player.stamina = Math.min(100, player.stamina + 16 * dt);
  }

  const maxSpeed = wantsSprint ? 11.8 : 5.8;
  const targetVx = wishX * maxSpeed;
  const targetVz = wishZ * maxSpeed;

  const accelRate = player.grounded ? 14 : 4.5;
  const blend = 1 - Math.exp(-accelRate * dt);
  player.vx += (targetVx - player.vx) * blend;
  player.vz += (targetVz - player.vz) * blend;

  // Jump
  if (input.jumpJustPressed && player.grounded) {
    player.vy = 8.8;
    player.grounded = false;
    jumped = true;
  }

  // Gravity & water buoyancy
  const floorY = groundHeightAt(player.x, player.z);
  const inWater = player.y < SEA_LEVEL - 0.2;
  if (inWater) {
    player.vy += (12.0 - player.vy * 4.5) * dt;
    player.vx *= Math.exp(-3.5 * dt);
    player.vz *= Math.exp(-3.5 * dt);
  } else {
    player.vy -= 24.0 * dt;
  }

  // Integrate candidate position
  const nextX = Math.max(-WORLD_HALF_SIZE, Math.min(WORLD_HALF_SIZE, player.x + player.vx * dt));
  const nextZ = Math.max(-WORLD_HALF_SIZE, Math.min(WORLD_HALF_SIZE, player.z + player.vz * dt));
  const resolved = resolveCircleCollisions(nextX, nextZ, player.y, PLAYER_RADIUS, colliders);

  if (Math.abs(resolved.x - nextX) > 0.005) player.vx *= 0.2;
  if (Math.abs(resolved.z - nextZ) > 0.005) player.vz *= 0.2;

  player.x = resolved.x;
  player.z = resolved.z;
  player.y += player.vy * dt;

  const newFloorY = groundHeightAt(player.x, player.z);
  // Check top of walkable colliders too
  let supportY = newFloorY;
  for (let i = 0; i < colliders.length; i++) {
    const b = colliders[i];
    if (
      player.x >= b.minX - 0.1 &&
      player.x <= b.maxX + 0.1 &&
      player.z >= b.minZ - 0.1 &&
      player.z <= b.maxZ + 0.1 &&
      player.y >= b.maxY - 0.45 &&
      b.maxY > supportY &&
      b.maxY < 6.0
    ) {
      supportY = b.maxY;
    }
  }

  if (player.y <= supportY) {
    if (!player.grounded && player.vy < -3.0) {
      landedSpeed = -player.vy;
      player.landingDip = Math.min(0.24, landedSpeed * 0.018);
    }
    player.y = supportY;
    player.vy = 0;
    player.grounded = true;
  } else if (player.y > supportY + 0.12) {
    player.grounded = false;
  }

  // Decay landing camera dip
  player.landingDip *= Math.exp(-12 * dt);

  // Stride phase synced to actual horizontal distance traveled (zero skating)
  const horizSpeed = Math.hypot(player.vx, player.vz);
  if (player.grounded && horizSpeed > 0.25) {
    player.stridePhase += horizSpeed * dt * 1.45;
  }

  return { landedSpeed, jumped };
}

export function stepDynamicPropPhysics(
  props: PhysicsPropState[],
  actorX: number,
  actorY: number,
  actorZ: number,
  actorVx: number,
  actorVz: number,
  actorRadius: number,
  colliders: ColliderBox[],
  dtRaw: number
): boolean {
  const dt = Math.min(dtRaw, 0.05);
  let anyImpact = false;

  for (let i = 0; i < props.length; i++) {
    const p = props[i];

    // Impulse from player or driven vehicle
    const dx = p.x - actorX;
    const dz = p.z - actorZ;
    const minDist = p.radius + actorRadius;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && Math.abs(actorY - p.y) < 2.2) {
      const dist = Math.max(0.05, Math.sqrt(distSq));
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;
      p.x += nx * overlap;
      p.z += nz * overlap;
      const relSpeed = Math.max(3.2, Math.hypot(actorVx, actorVz) * 1.35);
      p.vx += (nx * relSpeed + actorVx * 0.5) / p.mass;
      p.vz += (nz * relSpeed + actorVz * 0.5) / p.mass;
      p.vy = Math.max(p.vy, 1.8 / p.mass);
      p.angVel += (nx * actorVz - nz * actorVx) * 0.6;
      anyImpact = true;
    }

    // Gravity & integration
    p.vy -= 22.0 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.rotY += p.angVel * dt;

    // Collide with static buildings
    const col = resolveCircleCollisions(p.x, p.z, p.y - p.halfH, p.radius, colliders);
    if (col.collided) {
      p.x = col.x;
      p.z = col.z;
      p.vx *= -0.45;
      p.vz *= -0.45;
    }

    const groundY = groundHeightAt(p.x, p.z) + p.halfH;
    if (p.y <= groundY) {
      p.y = groundY;
      if (p.vy < -2.0) {
        p.vy = -p.vy * 0.38;
      } else {
        p.vy = 0;
      }
      const friction = Math.exp(-5.5 * dt);
      p.vx *= friction;
      p.vz *= friction;
      p.angVel *= friction;
    }
  }

  return anyImpact;
}
