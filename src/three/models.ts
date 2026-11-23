import * as THREE from 'three';
import {
  BuildingArchetype,
  CatalogItem,
  CharacterCustomization,
} from '../game/types';
import { WorldTextures } from './textures';

export interface AnimatedBuildingRefs {
  windBlades?: THREE.Object3D;
  fountainRing?: THREE.Object3D;
  radarDish?: THREE.Object3D;
  beaconLight?: THREE.Mesh;
  craneTrolley?: THREE.Object3D;
}

export interface ConstructionRigRefs {
  group: THREE.Group;
  craneBoom: THREE.Group;
  risingCore: THREE.Mesh;
  scaffoldGroup: THREE.Group;
  targetHeight: number;
}

export interface CharacterRigRefs {
  group: THREE.Group;
  torsoGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
}

export interface VehicleRigRefs {
  group: THREE.Group;
  chassisGroup: THREE.Group;
  wheels: THREE.Group[];
  headlights: THREE.MeshStandardMaterial;
  taillights: THREE.MeshStandardMaterial;
}

function makeBeveledBox(w: number, h: number, d: number, bevel = 0.08): THREE.ExtrudeGeometry {
  const hw = Math.max(0.05, w / 2 - bevel);
  const hd = Math.max(0.05, d / 2 - bevel);
  const shape = new THREE.Shape();
  shape.moveTo(-hw, -hd);
  shape.lineTo(hw, -hd);
  shape.lineTo(hw, hd);
  shape.lineTo(-hw, hd);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.05, h - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return geo;
}

function makePitchedRoof(w: number, d: number, roofH: number): THREE.ExtrudeGeometry {
  const hw = w / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(0, roofH);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: d,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.08,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -d / 2);
  return geo;
}

function makeDomeGeometry(radius: number, height: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const segs = 10;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.cos(t) * radius, Math.sin(t) * height));
  }
  return new THREE.LatheGeometry(pts, 24);
}

function makeHyperboloidTower(rBase: number, rWaist: number, rTop: number, h: number): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r =
      t < 0.65
        ? THREE.MathUtils.lerp(rBase, rWaist, Math.sin((t / 0.65) * (Math.PI / 2)))
        : THREE.MathUtils.lerp(rWaist, rTop, (t - 0.65) / 0.35);
    pts.push(new THREE.Vector2(r, t * h));
  }
  return new THREE.LatheGeometry(pts, 24);
}

function createTreeSubAssembly(heightM: number, foliageHex: number, isConifer: boolean): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92, metalness: 0.02 });
  const leafMat = new THREE.MeshStandardMaterial({ color: foliageHex, roughness: 0.85, metalness: 0.0 });

  const trunkH = heightM * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(heightM * 0.04, heightM * 0.075, trunkH, 8),
    trunkMat
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  tree.add(trunk);

  if (isConifer) {
    for (let i = 0; i < 3; i++) {
      const tierR = heightM * (0.3 - i * 0.065);
      const tierH = heightM * 0.34;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tierR, tierH, 9), leafMat);
      cone.position.y = trunkH + i * (tierH * 0.55) + tierH * 0.35;
      cone.castShadow = true;
      tree.add(cone);
    }
  } else {
    const offsets = [
      [0, trunkH + heightM * 0.25, 0, heightM * 0.24],
      [-heightM * 0.13, trunkH + heightM * 0.18, heightM * 0.08, heightM * 0.18],
      [heightM * 0.14, trunkH + heightM * 0.2, -heightM * 0.09, heightM * 0.17],
    ];
    for (const [ox, oy, oz, r] of offsets) {
      const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 1), leafMat);
      crown.position.set(ox, oy, oz);
      crown.castShadow = true;
      tree.add(crown);
    }
  }
  return tree;
}

export function createDetailedBuildingGroup(
  item: CatalogItem,
  textures: WorldTextures,
  isSoftwareGl: boolean,
  nightWindowFactor = 0
): { group: THREE.Group; anim: AnimatedBuildingRefs } {
  const group = new THREE.Group();
  const anim: AnimatedBuildingRefs = {};

  const wallMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.wallColor),
    roughness: item.tier >= 4 ? 0.42 : 0.78,
    metalness: item.tier >= 4 ? 0.25 : 0.06,
    map: item.wallColor === '#b96b52' ? textures.brickMap : null,
    bumpMap: item.wallColor === '#b96b52' ? textures.brickBump : textures.plazaBump,
    bumpScale: 0.03,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(item.accentColor),
    roughness: 0.35,
    metalness: 0.55,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x2a3342,
    roughness: 0.28,
    metalness: 0.78,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: textures.glassFacadeMap,
    emissive: new THREE.Color(0xffdfa8),
    emissiveMap: textures.glassEmissiveMap,
    emissiveIntensity: nightWindowFactor,
    roughness: 0.12,
    metalness: 0.35,
    clearcoat: isSoftwareGl ? 0 : 0.9,
    clearcoatRoughness: 0.08,
  });

  const darkRoofMat = new THREE.MeshStandardMaterial({
    color: 0x3a424d,
    roughness: 0.85,
    metalness: 0.15,
  });

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xd9d7d0,
    map: textures.plazaMap,
    bumpMap: textures.plazaBump,
    bumpScale: 0.02,
    roughness: 0.82,
    metalness: 0.04,
  });

  const W = item.footprintW;
  const D = item.footprintD;
  const H = item.heightM;

  // Base foundation plinth for all structures except streetlights/benches/trees
  const skipPlinth =
    item.archetype === 'streetlight' ||
    item.archetype === 'bench' ||
    item.archetype === 'tree_cluster' ||
    item.archetype === 'wind_turbine';

  if (!skipPlinth) {
    const plinth = new THREE.Mesh(makeBeveledBox(W * 0.98, 0.45, D * 0.98, 0.08), stoneMat);
    plinth.receiveShadow = true;
    plinth.castShadow = true;
    group.add(plinth);
  }

  const arch: BuildingArchetype = item.archetype;

  if (arch === 'villa' || arch === 'townhouse') {
    const bodyH = H * 0.66;
    const body = new THREE.Mesh(makeBeveledBox(W * 0.78, bodyH, D * 0.74, 0.12), wallMat);
    body.position.y = 0.4;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Pitched roof overhang
    const roof = new THREE.Mesh(
      makePitchedRoof(W * 0.88, D * 0.82, H * 0.3),
      new THREE.MeshStandardMaterial({ color: item.accentColor, roughness: 0.72, metalness: 0.1 })
    );
    roof.position.y = 0.4 + bodyH - 0.05;
    roof.castShadow = true;
    group.add(roof);

    // Glazed front & side window bands
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(W * 0.64, bodyH * 0.48, D * 0.76), glassMat);
    winBand.position.y = 0.4 + bodyH * 0.52;
    group.add(winBand);

    // Front porch canopy + 2 columns
    const porch = new THREE.Mesh(makeBeveledBox(W * 0.42, 0.25, 1.8, 0.05), trimMat);
    porch.position.set(0, 2.7, D * 0.37 + 0.7);
    group.add(porch);
    for (const sx of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.5, 10), stoneMat);
      col.position.set(sx * W * 0.16, 1.65, D * 0.37 + 1.3);
      group.add(col);
    }

    // Chimney + garden hedge
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.9, H * 0.35, 0.9), stoneMat);
    chimney.position.set(W * 0.22, 0.4 + bodyH + H * 0.12, -D * 0.15);
    group.add(chimney);

    const tree = createTreeSubAssembly(3.6, 0x3c7a3e, false);
    tree.position.set(-W * 0.35, 0.3, D * 0.3);
    group.add(tree);
  } else if (arch === 'apartment' || arch === 'commercial_plaza') {
    const podiumH = Math.min(4.6, H * 0.26);
    const podium = new THREE.Mesh(makeBeveledBox(W * 0.92, podiumH, D * 0.88, 0.14), stoneMat);
    podium.position.y = 0.4;
    podium.castShadow = true;
    group.add(podium);

    const upperH = H - podiumH - 0.8;
    const upper = new THREE.Mesh(makeBeveledBox(W * 0.82, upperH, D * 0.76, 0.14), wallMat);
    upper.position.y = 0.4 + podiumH;
    upper.castShadow = true;
    group.add(upper);

    const glassSleeve = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.84, upperH * 0.84, D * 0.78),
      glassMat
    );
    glassSleeve.position.y = 0.4 + podiumH + upperH * 0.48;
    group.add(glassSleeve);

    // Recessed balconies / horizontal floor ledges
    const floors = Math.max(2, Math.min(6, Math.floor(upperH / 3.4)));
    for (let f = 1; f <= floors; f++) {
      const ledge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.88, 0.28, D * 0.83), trimMat);
      ledge.position.y = 0.4 + podiumH + (f / (floors + 0.5)) * upperH;
      group.add(ledge);
    }

    // Rooftop parapet & pergola/HVAC
    const cap = new THREE.Mesh(makeBeveledBox(W * 0.84, 0.65, D * 0.78, 0.08), accentMat);
    cap.position.y = 0.4 + podiumH + upperH;
    group.add(cap);

    const hvac = new THREE.Mesh(makeBeveledBox(W * 0.3, 1.4, D * 0.28, 0.08), trimMat);
    hvac.position.set(-W * 0.15, 0.4 + podiumH + upperH + 0.65, 0);
    group.add(hvac);
  } else if (arch === 'skyscraper' || arch === 'supertall') {
    const podiumH = Math.max(5.5, H * 0.16);
    const podium = new THREE.Mesh(makeBeveledBox(W * 0.94, podiumH, D * 0.94, 0.18), stoneMat);
    podium.position.y = 0.4;
    podium.castShadow = true;
    group.add(podium);

    const midH = H * 0.52;
    const midCore = new THREE.Mesh(new THREE.BoxGeometry(W * 0.74, midH, D * 0.74), glassMat);
    midCore.position.y = 0.4 + podiumH + midH / 2;
    midCore.castShadow = true;
    group.add(midCore);

    // Corner structural exoskeleton piers
    const pierOffsets = [
      [-W * 0.38, -D * 0.38],
      [W * 0.38, -D * 0.38],
      [-W * 0.38, D * 0.38],
      [W * 0.38, D * 0.38],
    ];
    for (const [px, pz] of pierOffsets) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.1, midH + 2, 1.1), wallMat);
      pier.position.set(px, 0.4 + podiumH + midH / 2, pz);
      pier.castShadow = true;
      group.add(pier);
    }

    // Upper tapered setback tier
    const topH = H * 0.24;
    const topTier = new THREE.Mesh(new THREE.BoxGeometry(W * 0.54, topH, D * 0.54), glassMat);
    topTier.position.y = 0.4 + podiumH + midH + topH / 2;
    topTier.castShadow = true;
    group.add(topTier);

    const crown = new THREE.Mesh(makeBeveledBox(W * 0.58, 1.2, D * 0.58, 0.12), accentMat);
    crown.position.y = 0.4 + podiumH + midH + topH;
    group.add(crown);

    if (arch === 'supertall') {
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.65, H * 0.16, 12), trimMat);
      spire.position.y = 0.4 + podiumH + midH + topH + H * 0.08 + 1.0;
      group.add(spire);

      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0xff3b30, emissive: 0xff3b30, emissiveIntensity: 1.8 })
      );
      beacon.position.y = spire.position.y + H * 0.08;
      group.add(beacon);
      anim.beaconLight = beacon;
    }
  } else if (arch === 'civic_hall' || arch === 'school') {
    const baseH = H * 0.56;
    const mainBlock = new THREE.Mesh(makeBeveledBox(W * 0.88, baseH, D * 0.78, 0.15), wallMat);
    mainBlock.position.y = 0.4;
    mainBlock.castShadow = true;
    group.add(mainBlock);

    // Recessed window bays & cornice trim along all 4 sides
    const winRibbon = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, baseH * 0.42, D * 0.8), glassMat);
    winRibbon.position.y = 0.4 + baseH * 0.55;
    group.add(winRibbon);

    const cornice = new THREE.Mesh(makeBeveledBox(W * 0.92, 0.55, D * 0.84, 0.08), trimMat);
    cornice.position.y = 0.4 + baseH - 0.15;
    group.add(cornice);

    // Grand entrance steps & bronze double portal
    for (let st = 0; st < 3; st++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(W * 0.52 - st * 0.6, 0.22, 1.8 - st * 0.4),
        stoneMat
      );
      step.position.set(0, 0.25 + st * 0.22, D * 0.44 + (2 - st) * 0.28);
      group.add(step);
    }
    const portal = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 0.35), trimMat);
    portal.position.set(0, 2.5, D * 0.39);
    group.add(portal);

    // Classical front colonnade (6 fluted columns + pediment)
    const colCount = 6;
    for (let i = 0; i < colCount; i++) {
      const cx = -W * 0.34 + (i / (colCount - 1)) * (W * 0.68);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, baseH * 0.86, 12), stoneMat);
      col.position.set(cx, 0.4 + baseH * 0.43, D * 0.43);
      col.castShadow = true;
      group.add(col);
    }

    const pediment = new THREE.Mesh(makePitchedRoof(W * 0.84, D * 0.26, H * 0.18), stoneMat);
    pediment.position.set(0, 0.4 + baseH * 0.84, D * 0.36);
    group.add(pediment);

    // Drum + Rotunda Dome
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.22, W * 0.24, H * 0.18, 24), stoneMat);
    drum.position.y = 0.4 + baseH + H * 0.09;
    group.add(drum);

    const dome = new THREE.Mesh(makeDomeGeometry(W * 0.21, H * 0.22), accentMat);
    dome.position.y = 0.4 + baseH + H * 0.18;
    dome.castShadow = true;
    group.add(dome);
  } else if (arch === 'hospital' || arch === 'police_station' || arch === 'fire_station') {
    const mainH = H * 0.72;
    const wing = new THREE.Mesh(makeBeveledBox(W * 0.9, mainH, D * 0.72, 0.15), wallMat);
    wing.position.y = 0.4;
    wing.castShadow = true;
    group.add(wing);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, mainH * 0.55, D * 0.6), glassMat);
    glassBand.position.y = 0.4 + mainH * 0.52;
    group.add(glassBand);

    // Apparatus bay / Ambulance canopy
    const canopy = new THREE.Mesh(makeBeveledBox(W * 0.55, 0.5, D * 0.26, 0.08), accentMat);
    canopy.position.set(0, 3.6, D * 0.42);
    group.add(canopy);

    if (arch === 'hospital') {
      const helipad = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.8, 0.4, 20), trimMat);
      helipad.position.y = 0.4 + mainH + 0.2;
      group.add(helipad);
      const crossH = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.1, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.6 })
      );
      crossH.position.set(0, helipad.position.y + 0.22, 0);
      group.add(crossH);
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 2.6), crossH.material);
      crossV.position.copy(crossH.position);
      group.add(crossV);
    } else {
      const tower = new THREE.Mesh(makeBeveledBox(W * 0.24, H * 0.95, D * 0.24, 0.1), accentMat);
      tower.position.set(W * 0.28, 0.4, -D * 0.2);
      tower.castShadow = true;
      group.add(tower);
    }
  } else if (arch === 'mall' || arch === 'transit_hub') {
    const hallH = H * 0.55;
    const base = new THREE.Mesh(makeBeveledBox(W * 0.92, hallH, D * 0.88, 0.18), wallMat);
    base.position.y = 0.4;
    base.castShadow = true;
    group.add(base);

    // Vaulted glass atrium dome/arch
    const vault = new THREE.Mesh(
      new THREE.CylinderGeometry(W * 0.34, W * 0.34, D * 0.82, 16, 1, false, 0, Math.PI),
      glassMat
    );
    vault.rotation.z = Math.PI / 2;
    vault.rotation.y = Math.PI / 2;
    vault.position.y = 0.4 + hallH;
    group.add(vault);

    // Entrance ribs
    for (let i = -2; i <= 2; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(W * 0.345, 0.22, 8, 20, Math.PI), trimMat);
      rib.position.set(0, 0.4 + hallH, (i / 2.2) * (D * 0.38));
      group.add(rib);
    }
  } else if (arch === 'factory' || arch === 'warehouse' || arch === 'refinery') {
    const hallH = H * 0.62;
    const hall = new THREE.Mesh(makeBeveledBox(W * 0.88, hallH, D * 0.82, 0.14), wallMat);
    hall.position.y = 0.4;
    hall.castShadow = true;
    group.add(hall);

    // Sawtooth industrial roof ridges
    for (let i = -1; i <= 1; i++) {
      const ridge = new THREE.Mesh(makePitchedRoof(W * 0.28, D * 0.8, H * 0.16), darkRoofMat);
      ridge.position.set(i * W * 0.28, 0.4 + hallH, 0);
      group.add(ridge);
    }

    if (arch !== 'warehouse') {
      // Twin smokestacks / processing silos
      for (const sx of [-1, 1]) {
        const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.05, H * 0.98, 14), trimMat);
        stack.position.set(sx * W * 0.26, H * 0.49, -D * 0.25);
        stack.castShadow = true;
        group.add(stack);

        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.9, 14), accentMat);
        collar.position.set(sx * W * 0.26, H * 0.88, -D * 0.25);
        group.add(collar);
      }
    }
  } else if (arch === 'wind_turbine') {
    const mastH = H * 0.78;
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.4, 1.0, 16), stoneMat);
    plinth.position.y = 0.5;
    group.add(plinth);

    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.95, mastH, 16),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.32, metalness: 0.35 })
    );
    mast.position.y = 1.0 + mastH / 2;
    mast.castShadow = true;
    group.add(mast);

    const nacelle = new THREE.Mesh(makeBeveledBox(1.5, 1.4, 3.6, 0.22), accentMat);
    nacelle.position.set(0, 1.0 + mastH - 0.5, 0.3);
    group.add(nacelle);

    const hub = new THREE.Group();
    hub.position.set(0, 1.0 + mastH + 0.1, 2.2);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 14), trimMat);
    nose.rotation.x = Math.PI / 2;
    hub.add(nose);

    const bladeGeo = makeBeveledBox(0.65, H * 0.36, 0.14, 0.04);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.15 });
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI * 2) / 3;
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.y = 0.2;
      arm.add(blade);
      hub.add(arm);
    }
    group.add(hub);
    anim.windBlades = hub;
  } else if (arch === 'solar_farm') {
    const panelMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f2a4a,
      roughness: 0.12,
      metalness: 0.65,
      clearcoat: isSoftwareGl ? 0 : 0.9,
    });
    for (let rx = -1; rx <= 1; rx++) {
      for (let rz = -1; rz <= 1; rz++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 1.8, 8), trimMat);
        post.position.set(rx * (W * 0.28), 1.1, rz * (D * 0.28));
        group.add(post);

        const panel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.25, 0.12, D * 0.24), panelMat);
        panel.position.set(rx * (W * 0.28), 2.1, rz * (D * 0.28));
        panel.rotation.x = 0.42;
        panel.castShadow = true;
        group.add(panel);
      }
    }
  } else if (arch === 'power_plant') {
    // Hyperboloid Cooling Tower + Turbine Hall
    const cooling = new THREE.Mesh(makeHyperboloidTower(W * 0.26, W * 0.17, W * 0.21, H * 0.96), stoneMat);
    cooling.position.set(-W * 0.18, 0.4, 0);
    cooling.castShadow = true;
    group.add(cooling);

    const turbineHall = new THREE.Mesh(makeBeveledBox(W * 0.44, H * 0.46, D * 0.72, 0.15), wallMat);
    turbineHall.position.set(W * 0.22, 0.4, 0);
    turbineHall.castShadow = true;
    group.add(turbineHall);

    const transformer = new THREE.Mesh(makeBeveledBox(W * 0.25, H * 0.28, D * 0.32, 0.08), accentMat);
    transformer.position.set(W * 0.22, 0.4 + H * 0.46, 0);
    group.add(transformer);
  } else if (arch === 'water_tower' || arch === 'silo') {
    const legH = H * 0.52;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, legH, 8), trimMat);
      leg.position.set(Math.cos(angle) * W * 0.26, 0.4 + legH / 2, Math.sin(angle) * D * 0.26);
      leg.castShadow = true;
      group.add(leg);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.34, W * 0.34, H * 0.34, 20), wallMat);
    tank.position.y = 0.4 + legH + H * 0.16;
    tank.castShadow = true;
    group.add(tank);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(W * 0.36, H * 0.16, 20), accentMat);
    cap.position.y = 0.4 + legH + H * 0.41;
    group.add(cap);
  } else if (arch === 'park_plaza' || arch === 'tree_cluster') {
    const treeCount = arch === 'tree_cluster' ? 4 : 3;
    const coords = [
      [-W * 0.26, -D * 0.22],
      [W * 0.26, -D * 0.2],
      [-W * 0.22, D * 0.24],
      [W * 0.24, D * 0.22],
    ];
    for (let i = 0; i < treeCount; i++) {
      const t = createTreeSubAssembly(H * (0.75 + (i % 2) * 0.22), i % 2 === 0 ? 0x3b7a3d : 0x2f6841, i === 1);
      t.position.set(coords[i][0], 0.35, coords[i][1]);
      group.add(t);
    }
    if (arch === 'park_plaza') {
      const pergola = new THREE.Mesh(makeBeveledBox(W * 0.38, 0.22, D * 0.38, 0.05), accentMat);
      pergola.position.y = 3.1;
      group.add(pergola);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.8, 8), trimMat);
          post.position.set(sx * W * 0.16, 1.7, sz * D * 0.16);
          group.add(post);
        }
      }
    }
  } else if (arch === 'fountain') {
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.44, W * 0.46, 0.85, 24), stoneMat);
    basin.position.y = 0.6;
    group.add(basin);

    const water = new THREE.Mesh(
      new THREE.CylinderGeometry(W * 0.4, W * 0.4, 0.15, 24),
      new THREE.MeshPhysicalMaterial({ color: 0x38bdf8, roughness: 0.08, metalness: 0.1, clearcoat: isSoftwareGl ? 0 : 1 })
    );
    water.position.y = 0.98;
    group.add(water);

    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.9, H * 0.72, 16), stoneMat);
    spire.position.y = 0.8 + H * 0.36;
    group.add(spire);

    const sprayRing = new THREE.Mesh(
      new THREE.TorusGeometry(W * 0.18, 0.12, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xbae6fd, emissive: 0x0284c7, emissiveIntensity: 0.45 })
    );
    sprayRing.rotation.x = Math.PI / 2;
    sprayRing.position.y = 1.6;
    group.add(sprayRing);
    anim.fountainRing = sprayRing;
  } else if (arch === 'monument') {
    for (let step = 0; step < 3; step++) {
      const s = 1 - step * 0.22;
      const tier = new THREE.Mesh(makeBeveledBox(W * 0.7 * s, 0.8, D * 0.7 * s, 0.1), stoneMat);
      tier.position.y = 0.4 + step * 0.75;
      group.add(tier);
    }
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 1.35, H * 0.78, 4), accentMat);
    obelisk.rotation.y = Math.PI / 4;
    obelisk.position.y = 2.6 + H * 0.39;
    obelisk.castShadow = true;
    group.add(obelisk);
  } else if (arch === 'observatory' || arch === 'tech_lab') {
    const base = new THREE.Mesh(makeBeveledBox(W * 0.86, H * 0.48, D * 0.86, 0.18), wallMat);
    base.position.y = 0.4;
    base.castShadow = true;
    group.add(base);

    const glassWall = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.34, W * 0.38, H * 0.28, 20), glassMat);
    glassWall.position.y = 0.4 + H * 0.48 + H * 0.12;
    group.add(glassWall);

    const dome = new THREE.Mesh(makeDomeGeometry(W * 0.32, H * 0.28), accentMat);
    dome.position.y = 0.4 + H * 0.74;
    group.add(dome);

    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.5, 0.8, 12), trimMat);
    dish.position.set(0, 0.4 + H * 0.96, 0);
    dish.rotation.x = 0.45;
    group.add(dish);
    anim.radarDish = dish;
  } else if (arch === 'harbor_crane') {
    const legMat = accentMat;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.85, H * 0.75, 0.85), legMat);
        leg.position.set(sx * W * 0.34, H * 0.38, sz * D * 0.3);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    const bridge = new THREE.Mesh(makeBeveledBox(W * 0.9, 1.4, D * 0.85, 0.12), trimMat);
    bridge.position.y = H * 0.75;
    group.add(bridge);

    const boom = new THREE.Mesh(makeBeveledBox(1.2, 1.1, D * 1.4, 0.08), accentMat);
    boom.position.set(0, H * 0.82, D * 0.35);
    group.add(boom);

    const container = new THREE.Mesh(
      makeBeveledBox(2.6, 2.5, 6.2, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.55, metalness: 0.4 })
    );
    container.position.set(0, H * 0.42, D * 0.35);
    group.add(container);
    anim.craneTrolley = container;
  } else if (arch === 'yacht_dock') {
    const deck = new THREE.Mesh(
      makeBeveledBox(W * 0.94, 0.6, D * 0.9, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.82 })
    );
    deck.position.y = 0.45;
    group.add(deck);
    const cabin = new THREE.Mesh(makeBeveledBox(W * 0.45, H * 0.52, D * 0.42, 0.12), wallMat);
    cabin.position.set(-W * 0.18, 1.0, -D * 0.15);
    group.add(cabin);
    const roof = new THREE.Mesh(makePitchedRoof(W * 0.5, D * 0.48, H * 0.22), accentMat);
    roof.position.set(-W * 0.18, 1.0 + H * 0.52, -D * 0.15);
    group.add(roof);
    // Moored sailboat hull & mast
    const hull = new THREE.Mesh(makeBeveledBox(2.6, 1.1, 7.2, 0.25), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 }));
    hull.position.set(W * 0.26, 0.6, D * 0.2);
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, H * 0.85, 8), trimMat);
    mast.position.set(W * 0.26, 1.4 + H * 0.42, D * 0.2);
    group.add(mast);
  } else if (arch === 'streetlight') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.65, 10), trimMat);
    base.position.y = 0.32;
    group.add(base);
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.5, 0),
      new THREE.Vector3(0, H * 0.85, 0),
      new THREE.Vector3(0.7, H * 0.98, 0),
      new THREE.Vector3(1.6, H * 0.94, 0),
    ]);
    const pole = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.1, 8, false), trimMat);
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(
      makeBeveledBox(0.75, 0.22, 0.42, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd27d, emissiveIntensity: 1.5 })
    );
    lamp.position.set(1.6, H * 0.91, 0);
    group.add(lamp);
  } else if (arch === 'bench') {
    const wood = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.78 });
    const seat = new THREE.Mesh(makeBeveledBox(2.4, 0.14, 0.7, 0.03), wood);
    seat.position.set(0, 0.52, 0);
    group.add(seat);
    const back = new THREE.Mesh(makeBeveledBox(2.4, 0.5, 0.12, 0.03), wood);
    back.position.set(0, 0.72, -0.32);
    group.add(back);
    for (const sx of [-0.95, 0.95]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.68), trimMat);
      leg.position.set(sx, 0.27, 0);
      group.add(leg);
    }
    const planter = new THREE.Mesh(makeBeveledBox(0.75, 0.65, 0.75, 0.05), stoneMat);
    planter.position.set(1.6, 0, 0);
    group.add(planter);
    const shrub = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45, 1), new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.85 }));
    shrub.position.set(1.6, 0.85, 0);
    group.add(shrub);
  } else if (arch === 'bus_stop' || arch === 'market_stall') {
    const roof = new THREE.Mesh(makeBeveledBox(W * 0.85, 0.25, D * 0.85, 0.05), accentMat);
    roof.position.y = H * 0.86;
    group.add(roof);
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, H * 0.85, 8), trimMat);
      post.position.set(sx * W * 0.36, 0.4 + H * 0.42, -D * 0.26);
      group.add(post);
    }
    const glassPanel = new THREE.Mesh(new THREE.BoxGeometry(W * 0.75, H * 0.72, 0.12), glassMat);
    glassPanel.position.set(0, 0.4 + H * 0.4, -D * 0.26);
    group.add(glassPanel);
  } else {
    // farm_greenhouse & any fallback
    const frame = new THREE.Mesh(makeBeveledBox(W * 0.9, H * 0.55, D * 0.84, 0.12), trimMat);
    frame.position.y = 0.4;
    group.add(frame);
    const roof = new THREE.Mesh(makePitchedRoof(W * 0.88, D * 0.82, H * 0.38), glassMat);
    roof.position.y = 0.4 + H * 0.52;
    group.add(roof);
  }

  return { group, anim };
}

export function createConstructionSiteGroup(
  item: CatalogItem,
  textures: WorldTextures
): ConstructionRigRefs {
  const group = new THREE.Group();
  const W = Math.max(4, item.footprintW);
  const D = Math.max(4, item.footprintD);
  const H = Math.max(5, item.heightM);

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    map: textures.plazaMap,
    bumpMap: textures.plazaBump,
    bumpScale: 0.03,
    roughness: 0.88,
  });
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.45, metalness: 0.25 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.35, metalness: 0.75 });
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.65, metalness: 0.3 });

  // Foundation slab
  const slab = new THREE.Mesh(makeBeveledBox(W * 0.95, 0.5, D * 0.95, 0.08), concreteMat);
  slab.receiveShadow = true;
  group.add(slab);

  // Perimeter yellow safety rails
  for (const sz of [-D * 0.48, D * 0.48]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(W * 0.98, 0.35, 0.18), barrierMat);
    rail.position.set(0, 0.8, sz);
    group.add(rail);
  }
  for (const sx of [-W * 0.48, W * 0.48]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.35, D * 0.98), barrierMat);
    rail.position.set(sx, 0.8, 0);
    group.add(rail);
  }

  // Rising under-construction structural core
  const risingCore = new THREE.Mesh(new THREE.BoxGeometry(W * 0.68, H * 0.82, D * 0.68), coreMat);
  risingCore.position.y = 0.5 + (H * 0.82) / 2;
  risingCore.scale.y = 0.15;
  risingCore.castShadow = true;
  group.add(risingCore);

  // Scaffolding corner columns
  const scaffoldGroup = new THREE.Group();
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.32, H * 0.9, 0.32), steelMat);
      col.position.set(sx * W * 0.38, 0.5 + H * 0.45, sz * D * 0.38);
      scaffoldGroup.add(col);
    }
  }
  group.add(scaffoldGroup);

  // Tower Crane Mast + Rotating Jib
  const craneH = Math.max(10, H + 5);
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.95, craneH, 0.95), barrierMat);
  mast.position.set(W * 0.42, craneH / 2, -D * 0.42);
  mast.castShadow = true;
  group.add(mast);

  const craneBoom = new THREE.Group();
  craneBoom.position.set(W * 0.42, craneH, -D * 0.42);

  const jibLen = Math.max(10, W * 0.85);
  const jib = new THREE.Mesh(new THREE.BoxGeometry(jibLen, 0.65, 0.65), barrierMat);
  jib.position.set(-jibLen * 0.25, 0, 0);
  craneBoom.add(jib);

  const counterWeight = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 1.2), steelMat);
  counterWeight.position.set(jibLen * 0.22, -0.3, 0);
  craneBoom.add(counterWeight);

  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, craneH * 0.35, 6), steelMat);
  cable.position.set(-jibLen * 0.52, -craneH * 0.175, 0);
  craneBoom.add(cable);

  const hookBeam = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.35, 0.35), steelMat);
  hookBeam.position.set(-jibLen * 0.52, -craneH * 0.35, 0);
  craneBoom.add(hookBeam);

  group.add(craneBoom);

  return { group, craneBoom, risingCore, scaffoldGroup, targetHeight: H };
}

export function createVehicleGroup(
  kind: 'sedan' | 'suv' | 'bus' | 'truck' | 'police',
  paintHex: string,
  isSoftwareGl: boolean
): VehicleRigRefs {
  const group = new THREE.Group();
  const chassisGroup = new THREE.Group();
  group.add(chassisGroup);

  // True realistic scale vs 1.75m human: sedan ~4.4m long x 1.85m wide x 1.48m tall
  const dims =
    kind === 'bus'
      ? { w: 2.35, l: 8.6, h: 2.85, wheelR: 0.46 }
      : kind === 'truck'
        ? { w: 2.3, l: 6.8, h: 2.65, wheelR: 0.46 }
        : kind === 'suv'
          ? { w: 1.92, l: 4.65, h: 1.72, wheelR: 0.38 }
          : { w: 1.84, l: 4.4, h: 1.46, wheelR: 0.34 };

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    roughness: 0.22,
    metalness: 0.65,
    clearcoat: isSoftwareGl ? 0 : 1.0,
    clearcoatRoughness: 0.08,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x162230,
    roughness: 0.08,
    metalness: 0.2,
    clearcoat: isSoftwareGl ? 0 : 1.0,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.3 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.2, metalness: 0.85 });

  // Lower body
  const lowerH = dims.h * 0.44;
  const lowerBody = new THREE.Mesh(makeBeveledBox(dims.w, lowerH, dims.l, 0.12), paintMat);
  lowerBody.position.y = dims.wheelR * 0.72;
  lowerBody.castShadow = true;
  chassisGroup.add(lowerBody);

  // Cabin / greenhouse
  const cabinL = kind === 'truck' ? dims.l * 0.32 : kind === 'bus' ? dims.l * 0.9 : dims.l * 0.52;
  const cabinZ = kind === 'truck' ? -dims.l * 0.28 : kind === 'bus' ? 0 : dims.l * 0.06;
  const cabinH = dims.h * 0.42;
  const cabin = new THREE.Mesh(makeBeveledBox(dims.w * 0.88, cabinH, cabinL, 0.14), glassMat);
  cabin.position.set(0, dims.wheelR * 0.72 + lowerH - 0.05, cabinZ);
  chassisGroup.add(cabin);

  // Roof cap
  const roof = new THREE.Mesh(makeBeveledBox(dims.w * 0.82, 0.12, cabinL * 0.86, 0.04), paintMat);
  roof.position.set(0, cabin.position.y + cabinH - 0.05, cabinZ);
  chassisGroup.add(roof);

  if (kind === 'truck') {
    const cargo = new THREE.Mesh(
      makeBeveledBox(dims.w * 0.96, dims.h * 0.66, dims.l * 0.62, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6, metalness: 0.15 })
    );
    cargo.position.set(0, dims.wheelR * 0.72 + lowerH * 0.85, dims.l * 0.18);
    cargo.castShadow = true;
    chassisGroup.add(cargo);
  }

  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x2563eb, emissiveIntensity: 1.5 })
    );
    bar.position.set(0, roof.position.y + 0.16, cabinZ);
    chassisGroup.add(bar);
  }

  // Front & rear bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(dims.w * 0.96, 0.24, 0.22), trimMat);
  frontBumper.position.set(0, dims.wheelR * 0.82, -dims.l / 2 + 0.04);
  chassisGroup.add(frontBumper);

  const headlights = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff4cc,
    emissiveIntensity: 1.2,
  });
  const taillights = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0xef4444,
    emissiveIntensity: 1.0,
  });
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.08), headlights);
    hl.position.set(sx * dims.w * 0.34, dims.wheelR * 1.25, -dims.l / 2 - 0.01);
    chassisGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.08), taillights);
    tl.position.set(sx * dims.w * 0.34, dims.wheelR * 1.25, dims.l / 2 + 0.01);
    chassisGroup.add(tl);
  }

  // 4 Articulated Wheels (Tire + Alloy Rim)
  const wheels: THREE.Group[] = [];
  const wheelCoords = [
    [-dims.w * 0.48, -dims.l * 0.31],
    [dims.w * 0.48, -dims.l * 0.31],
    [-dims.w * 0.48, dims.l * 0.31],
    [dims.w * 0.48, dims.l * 0.31],
  ];
  for (const [wx, wz] of wheelCoords) {
    const wg = new THREE.Group();
    wg.position.set(wx, dims.wheelR, wz);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(dims.wheelR, dims.wheelR, 0.26, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wg.add(tire);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(dims.wheelR * 0.58, dims.wheelR * 0.58, 0.28, 10), rimMat);
    rim.rotation.z = Math.PI / 2;
    wg.add(rim);
    group.add(wg);
    wheels.push(wg);
  }

  return { group, chassisGroup, wheels, headlights, taillights };
}

export function createShipGroup(kind: 'cargo' | 'yacht'): THREE.Group {
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({
    color: kind === 'cargo' ? 0x991b1b : 0xf8fafc,
    roughness: 0.45,
    metalness: 0.2,
  });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
  const len = kind === 'cargo' ? 32 : 14;
  const wid = kind === 'cargo' ? 6.8 : 3.6;

  const hull = new THREE.Mesh(makeBeveledBox(wid, 2.6, len, 0.45), hullMat);
  hull.position.y = -0.6;
  ship.add(hull);

  const deck = new THREE.Mesh(makeBeveledBox(wid * 0.9, 0.35, len * 0.9, 0.1), deckMat);
  deck.position.y = 1.9;
  ship.add(deck);

  const bridge = new THREE.Mesh(
    makeBeveledBox(wid * 0.72, kind === 'cargo' ? 4.2 : 2.1, len * 0.24, 0.15),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 })
  );
  bridge.position.set(0, 2.2, len * 0.26);
  ship.add(bridge);

  if (kind === 'cargo') {
    const colors = [0x0284c7, 0xd97706, 0x16a34a, 0xdc2626];
    for (let i = 0; i < 4; i++) {
      const box = new THREE.Mesh(
        makeBeveledBox(wid * 0.65, 2.1, 4.4, 0.08),
        new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.55, metalness: 0.3 })
      );
      box.position.set(0, 2.2, -len * 0.26 + i * 4.8);
      ship.add(box);
    }
  } else {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 9.5, 8), deckMat);
    mast.position.set(0, 5.5, 0);
    ship.add(mast);
  }
  return ship;
}

export function createCharacterGroup(char: CharacterCustomization): CharacterRigRefs {
  const group = new THREE.Group();
  const hScale = char.heightM / 1.78;
  const wScale = char.buildScale;

  const skinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(char.skinTone), roughness: 0.65 });
  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(char.primaryColor),
    roughness: char.outfitStyle === 'cyber_planner' ? 0.35 : 0.78,
    metalness: char.outfitStyle === 'cyber_planner' ? 0.45 : 0.05,
  });
  const secondaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(char.secondaryColor),
    roughness: 0.42,
    metalness: 0.25,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(char.accentColor),
    roughness: 0.35,
    metalness: 0.4,
  });
  const hairMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(char.hairColor), roughness: 0.8 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });

  // Torso
  const torsoGroup = new THREE.Group();
  torsoGroup.position.y = 0.86;
  group.add(torsoGroup);

  const chest = new THREE.Mesh(makeBeveledBox(0.42 * wScale, 0.56, 0.24 * wScale, 0.06), primaryMat);
  chest.castShadow = true;
  torsoGroup.add(chest);

  // Coat tail / High-vis stripe / Tie accent
  const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.14 * wScale, 0.42, 0.25 * wScale), secondaryMat);
  lapel.position.y = 0.28;
  torsoGroup.add(lapel);

  if (char.outfitStyle === 'architect_coat' || char.outfitStyle === 'eco_ranger') {
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.44 * wScale, 0.07, 0.26 * wScale), accentMat);
    belt.position.y = 0.08;
    torsoGroup.add(belt);
  }

  // Accessory
  if (char.accessory === 'blueprint_tube') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 10), accentMat);
    tube.position.set(0, 0.28, -0.17 * wScale);
    tube.rotation.z = 0.45;
    torsoGroup.add(tube);
  } else if (char.accessory === 'jet_pack' || char.accessory === 'drone_pack') {
    const pack = new THREE.Mesh(makeBeveledBox(0.28, 0.38, 0.16, 0.04), secondaryMat);
    pack.position.set(0, 0.16, -0.18 * wScale);
    torsoGroup.add(pack);
  }

  // Head
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.62, 0);
  torsoGroup.add(headGroup);

  const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 14), skinMat);
  cranium.position.y = 0.12;
  cranium.castShadow = true;
  headGroup.add(cranium);

  // Expressive sculpted eyes & nose bridge
  const eyeDotMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
  for (const ex of [-0.05, 0.05]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 8), eyeDotMat);
    eye.position.set(ex, 0.135, 0.135);
    headGroup.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.03), skinMat);
  nose.position.set(0, 0.105, 0.145);
  headGroup.add(nose);

  // Hair styles
  if (char.hairStyle !== 'bald') {
    const hairCrown = new THREE.Mesh(
      new THREE.SphereGeometry(0.155, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
      hairMat
    );
    hairCrown.position.y = 0.135;
    headGroup.add(hairCrown);
    if (char.hairStyle === 'bun') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 10), hairMat);
      bun.position.set(0, 0.24, -0.12);
      headGroup.add(bun);
    } else if (char.hairStyle === 'afro') {
      const afro = new THREE.Mesh(new THREE.DodecahedronGeometry(0.19, 1), hairMat);
      afro.position.set(0, 0.17, -0.02);
      headGroup.add(afro);
    }
  }

  // Eyewear
  if (char.eyewear !== 'none') {
    const eyeCol = char.eyewear === 'visor' ? 0x06b6d4 : char.eyewear === 'sunglasses' ? 0x0f172a : 0x334155;
    const eyeMat = new THREE.MeshPhysicalMaterial({
      color: eyeCol,
      roughness: 0.1,
      metalness: 0.6,
      emissive: char.eyewear === 'visor' ? 0x0891b2 : 0x000000,
      emissiveIntensity: 0.7,
    });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.055, 0.04), eyeMat);
    frame.position.set(0, 0.13, 0.135);
    headGroup.add(frame);
  }

  // Headwear
  if (char.headwear === 'hardhat') {
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.165, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.25 })
    );
    dome.position.y = 0.17;
    headGroup.add(dome);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.02, 14), dome.material);
    brim.position.set(0, 0.17, 0.03);
    headGroup.add(brim);
  } else if (char.headwear === 'fedora' || char.headwear === 'cap' || char.headwear === 'beret') {
    const hatMat = secondaryMat;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.155, 0.11, 14), hatMat);
    crown.position.y = 0.24;
    headGroup.add(crown);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(char.headwear === 'fedora' ? 0.23 : 0.18, 0.2, 0.02, 14),
      hatMat
    );
    brim.position.set(0, 0.19, char.headwear === 'cap' ? 0.07 : 0);
    headGroup.add(brim);
  }

  // Articulated Arms
  const makeLimb = (isArm: boolean, side: number) => {
    const pivot = new THREE.Group();
    if (isArm) {
      pivot.position.set(side * (0.26 * wScale), 0.5, 0);
      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055 * wScale, 0.048 * wScale, 0.48, 8),
        primaryMat
      );
      sleeve.position.y = -0.24;
      sleeve.castShadow = true;
      pivot.add(sleeve);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
      hand.position.y = -0.5;
      pivot.add(hand);
    } else {
      pivot.position.set(side * (0.11 * wScale), 0.86, 0);
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075 * wScale, 0.06 * wScale, 0.78, 8),
        secondaryMat
      );
      leg.position.y = -0.39;
      leg.castShadow = true;
      pivot.add(leg);
      const shoe = new THREE.Mesh(makeBeveledBox(0.12 * wScale, 0.09, 0.22, 0.02), shoeMat);
      shoe.position.set(0, -0.84, 0.04);
      pivot.add(shoe);
    }
    return pivot;
  };

  const leftArm = makeLimb(true, -1);
  const rightArm = makeLimb(true, 1);
  torsoGroup.add(leftArm);
  torsoGroup.add(rightArm);

  const leftLeg = makeLimb(false, -1);
  const rightLeg = makeLimb(false, 1);
  group.add(leftLeg);
  group.add(rightLeg);

  group.scale.set(1, hScale, 1);

  return { group, torsoGroup, headGroup, leftArm, rightArm, leftLeg, rightLeg };
}
