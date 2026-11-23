import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { CATALOG_MAP } from '../game/catalog';
import {
  createInitialPlayerState,
  groundHeightAt,
  isRoadAt,
  isWaterAt,
  PLAYER_EYE_RATIO,
  ROAD_COORDS,
  SEA_LEVEL,
  stepDynamicPropPhysics,
  stepPlayerPhysics,
  WORLD_HALF_SIZE,
} from '../game/physics';
import {
  CameraMode,
  CatalogItem,
  CharacterCustomization,
  CitySimulationState,
  ColliderBox,
  GameState,
  PhysicsPropState,
  PlayerPhysicsState,
} from '../game/types';
import { CivicAudioSynth } from './audio';
import {
  AnimatedBuildingRefs,
  CharacterRigRefs,
  ConstructionRigRefs,
  createCharacterGroup,
  createConstructionSiteGroup,
  createDetailedBuildingGroup,
  createShipGroup,
  createVehicleGroup,
  VehicleRigRefs,
} from './models';
import { createWorldTextures, WorldTextures } from './textures';

// Pre-allocated zero-GC scratch objects for 60fps loop
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _euler = new THREE.Euler();

interface AutoVehicle {
  id: string;
  rig: VehicleRigRefs;
  axis: 'x' | 'z';
  laneCoord: number;
  dir: 1 | -1;
  pos: number;
  speed: number;
  baseSpeed: number;
}

interface AutoCitizen {
  rig: CharacterRigRefs;
  axis: 'x' | 'z';
  sideCoord: number;
  dir: 1 | -1;
  pos: number;
  speed: number;
  stride: number;
}

interface AutoShip {
  mesh: THREE.Group;
  centerX: number;
  centerZ: number;
  radiusX: number;
  radiusZ: number;
  phase: number;
  speed: number;
}

export interface WorldEngineCallbacks {
  onPlaceBlueprint: (itemId: string, x: number, z: number, rotationY: number) => void;
  onHudTelemetry: (info: {
    fpsSpeed: number;
    stamina: number;
    coords: { x: number; z: number };
    canEnterCar: boolean;
    drivingSpeedKmh: number;
    placementValid: boolean;
  }) => void;
}

export class WorldEngine {
  private container: HTMLElement;
  private callbacks: WorldEngineCallbacks;
  public audio = new CivicAudioSynth();

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private orbitControls!: OrbitControls;
  private sky!: Sky;
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private textures!: WorldTextures;
  private isSoftwareGl = false;

  private frameId = 0;
  private disposed = false;
  private lastTimeMs = performance.now();
  private hudEmitAccum = 0;

  // Game & Camera state
  private gameState: GameState = 'title';
  private cameraMode: CameraMode = 'fps';
  private simTimeOfDay = 9.5;
  private titleOrbitAngle = 0;
  private cameraTrauma = 0;

  // Player & Vehicle Physics
  public player: PlayerPhysicsState = createInitialPlayerState();
  private playerRig!: CharacterRigRefs;
  private playerVehicle!: VehicleRigRefs;
  private carState = { x: 14, z: 22, yaw: 0, speed: 0, steer: 0, wheelSpin: 0 };

  // World collections
  private structureGroups = new Map<string, { group: THREE.Group; anim: AnimatedBuildingRefs }>();
  private constructionRigs = new Map<string, ConstructionRigRefs>();
  private colliders: ColliderBox[] = [];
  private autoVehicles: AutoVehicle[] = [];
  private autoCitizens: AutoCitizen[] = [];
  private autoShips: AutoShip[] = [];
  private physicsProps: Array<{ state: PhysicsPropState; mesh: THREE.Group }> = [];
  private oceanMesh!: THREE.Mesh;

  // Placement Ghost
  private armedItem: CatalogItem | null = null;
  private placementRotation = 0;
  private placementPos = new THREE.Vector3(0, 0.25, 0);
  private placementValid = true;
  private ghostGroup: THREE.Group | null = null;
  private ghostRingMat!: THREE.MeshBasicMaterial;
  private groundRayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25);
  private raycaster = new THREE.Raycaster();
  private pointerNdc = new THREE.Vector2(0, 0);

  // Input Tracking
  private keys = new Set<string>();
  private jumpQueued = false;
  private isDraggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private footstepAccum = 0;

  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, initialSim: CitySimulationState, callbacks: WorldEngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.simTimeOfDay = initialSim.timeOfDay;
    this.initRendererAndScene(initialSim);
    this.bindEvents();
    this.syncSimulationVisuals(initialSim);
    this.startLoop();
  }

  private detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private initRendererAndScene(initialSim: CitySimulationState) {
    this.isSoftwareGl = this.detectSoftwareGl();
    const width = Math.max(320, this.container.clientWidth || window.innerWidth);
    const height = Math.max(240, this.container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0xcbdcf0, 0.0021);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(64, width / height, 0.15, 950);

    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = !this.isSoftwareGl;
    this.orbitControls.dampingFactor = 0.07;
    this.orbitControls.maxPolarAngle = Math.PI * 0.485;
    this.orbitControls.minDistance = 4;
    this.orbitControls.maxDistance = 260;
    this.orbitControls.enabled = false;

    this.textures = createWorldTextures(this.renderer.capabilities.getMaxAnisotropy());

    // Sky + Warm/Cool Lighting Rig
    this.sky = new Sky();
    this.sky.scale.setScalar(1000);
    this.scene.add(this.sky);

    this.hemiLight = new THREE.HemisphereLight(0xa8d4ff, 0x4b5842, 0.82);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.35);
    this.sunLight.position.set(110, 145, 75);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 360;
    const d = 135;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.updateSkyAndSun(this.simTimeOfDay);

    // Build sprawling open world terrain, roads, harbor, ocean, foliage, traffic, citizens, props
    this.buildOpenWorldTerrain();
    this.buildRoadNetworkAndHarbor();
    this.buildForestPerimeter();
    this.buildAutonomousTrafficAndCitizens();
    this.buildPhysicsProps();
    this.buildPlayerAndMayorCar(initialSim.character);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  private updateSkyAndSun(hour: number) {
    const dayAngle = ((hour - 6) / 24) * Math.PI * 2;
    const elevation = Math.sin(dayAngle) * 58;
    const azimuth = 155 + Math.cos(dayAngle) * 45;
    const phi = THREE.MathUtils.degToRad(90 - Math.max(-8, elevation));
    const theta = THREE.MathUtils.degToRad(azimuth);

    _v1.setFromSphericalCoords(1, phi, theta);
    const skyUniforms = this.sky.material.uniforms;
    skyUniforms['turbidity'].value = elevation < 12 ? 8 : 3.8;
    skyUniforms['rayleigh'].value = elevation < 12 ? 2.4 : 1.35;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.82;
    skyUniforms['sunPosition'].value.copy(_v1);

    this.sunLight.position.copy(_v1).multiplyScalar(180);
    const daylight = THREE.MathUtils.clamp((elevation + 4) / 28, 0.12, 1.0);
    this.sunLight.intensity = 0.35 + daylight * 2.15;
    this.hemiLight.intensity = 0.32 + daylight * 0.55;

    if (elevation < 8 && elevation > -4) {
      this.sunLight.color.setHex(0xffb478);
      (this.scene.fog as THREE.FogExp2).color.setHex(0xd6a98a);
    } else if (elevation <= -4) {
      this.sunLight.color.setHex(0x6488b8);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x132033);
    } else {
      this.sunLight.color.setHex(0xfff1d6);
      (this.scene.fog as THREE.FogExp2).color.setHex(0xc8dcf0);
    }
  }

  private buildOpenWorldTerrain() {
    const size = WORLD_HALF_SIZE * 2;
    const segs = 110;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cSand = new THREE.Color(0xd9c79e);
    const cGrass = new THREE.Color(0x568247);
    const cHigh = new THREE.Color(0x6a7862);
    const cRock = new THREE.Color(0x747b82);
    const tmp = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = groundHeightAt(x, z);
      pos.setY(i, y);

      if (y < 0.8 && z > 110) {
        tmp.copy(cSand);
      } else if (y > 16) {
        tmp.copy(cHigh).lerp(cRock, Math.min(1, (y - 16) / 14));
      } else {
        tmp.copy(cGrass).lerp(cHigh, Math.min(1, Math.max(0, (y - 2) / 14)));
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      map: this.textures.grassMap,
      bumpMap: this.textures.grassBump,
      bumpScale: 0.12,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrain = new THREE.Mesh(geo, terrainMat);
    terrain.receiveShadow = true;
    this.scene.add(terrain);

    // Animated Coastal Ocean Bay
    const oceanGeo = new THREE.PlaneGeometry(WORLD_HALF_SIZE * 2.4, 340, 48, 24);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x0f5e84,
      roughness: 0.14,
      metalness: 0.18,
      clearcoat: this.isSoftwareGl ? 0 : 0.95,
      transparent: true,
      opacity: 0.9,
    });
    this.oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    this.oceanMesh.position.set(0, SEA_LEVEL, 240);
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);
  }

  private buildRoadNetworkAndHarbor() {
    // Urban granite plateau (+0.02m above terrain y=0.25 so zero Z-fighting)
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.plazaMap,
      bumpMap: this.textures.plazaBump,
      bumpScale: 0.02,
      roughness: 0.85,
      metalness: 0.04,
    });
    const cityBase = new THREE.Mesh(new THREE.BoxGeometry(226, 0.3, 206), plazaMat);
    cityBase.position.set(0, 0.12, -4);
    cityBase.receiveShadow = true;
    this.scene.add(cityBase);

    // Harbor Concrete Quay Pier
    const quayMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.82 });
    const quay = new THREE.Mesh(new THREE.BoxGeometry(270, 2.2, 22), quayMat);
    quay.position.set(0, 0.05, 108);
    quay.receiveShadow = true;
    this.scene.add(quay);

    // Asphalt Road Strips (y = 0.28 -> cleanly above plaza y = 0.27)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.textures.asphaltMap,
      bumpMap: this.textures.asphaltBump,
      bumpScale: 0.03,
      roughness: 0.82,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    // North-South Avenues
    for (const rx of ROAD_COORDS) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 192), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(rx, 0.285, -2);
      road.receiveShadow = true;
      this.scene.add(road);

      for (let z = -92; z <= 84; z += 8) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 3.6), stripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(rx, 0.295, z);
        this.scene.add(dash);
      }
    }

    // East-West Avenues + Coastal Promenade (z = 88)
    for (const rz of [...ROAD_COORDS, 88]) {
      const width = rz === 88 ? 208 : 196;
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, 10.4), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.29, rz);
      road.receiveShadow = true;
      this.scene.add(road);

      for (let x = -92; x <= 92; x += 8) {
        if (ROAD_COORDS.some((rx) => Math.abs(x - rx) < 5.8)) continue;
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.24), stripeMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.3, rz);
        this.scene.add(dash);
      }
    }

    // Iconic Harbor Suspension Arch Bridge extending East across the bay inlet
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(145, 1.0, 130);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(90, 1.2, 12), roadMat);
    bridgeGroup.add(deck);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.4, metalness: 0.5 });
    for (const tx of [-24, 24]) {
      for (const tz of [-5.2, 5.2]) {
        const pylon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 26, 1.6), towerMat);
        pylon.position.set(tx, 12, tz);
        bridgeGroup.add(pylon);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 12), towerMat);
      cross.position.set(tx, 23.5, 0);
      bridgeGroup.add(cross);
    }
    const cableCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-44, 1.5, -5.2),
      new THREE.Vector3(-24, 24.5, -5.2),
      new THREE.Vector3(0, 7, -5.2),
      new THREE.Vector3(24, 24.5, -5.2),
      new THREE.Vector3(44, 1.5, -5.2),
    ]);
    const cableGeo = new THREE.TubeGeometry(cableCurve, 32, 0.22, 6, false);
    const cable1 = new THREE.Mesh(cableGeo, towerMat);
    const cable2 = new THREE.Mesh(cableGeo, towerMat);
    cable2.position.z = 10.4;
    bridgeGroup.add(cable1, cable2);
    this.scene.add(bridgeGroup);
  }

  private buildForestPerimeter() {
    // InstancedMesh sculpted trees surrounding hills & outer open-world ridges
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.42, 4.2, 7);
    trunkGeo.translate(0, 2.1, 0);
    const canopyGeo = new THREE.ConeGeometry(2.3, 6.2, 8);
    canopyGeo.translate(0, 6.4, 0);

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x543c2c, roughness: 0.92 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });

    const treePoints: Array<{ x: number; y: number; z: number; scale: number; tint: THREE.Color }> = [];
    for (let i = 0; i < 240; i++) {
      const angle = (i / 240) * Math.PI * 2 + (i % 7) * 0.13;
      const dist = 138 + ((i * 37) % 135);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist - 20;
      if (z > 105 && Math.abs(x) < 130) continue; // Keep ocean bay open
      const y = groundHeightAt(x, z);
      if (y < 0.6) continue;

      const scale = 0.85 + ((i * 19) % 35) / 100;
      const tint = new THREE.Color().setHSL(0.27 + ((i * 11) % 8) * 0.008, 0.42, 0.28 + ((i * 13) % 10) * 0.014);
      treePoints.push({ x, y, z, scale, tint });
    }

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePoints.length);
    const canopies = new THREE.InstancedMesh(canopyGeo, leafMat, treePoints.length);
    trunks.castShadow = true;
    canopies.castShadow = true;

    treePoints.forEach((tp, idx) => {
      _v1.set(tp.x, tp.y, tp.z);
      _euler.set(0, idx * 1.1, 0);
      _quat.setFromEuler(_euler);
      _scale.setScalar(tp.scale);
      _mat4.compose(_v1, _quat, _scale);
      trunks.setMatrixAt(idx, _mat4);
      canopies.setMatrixAt(idx, _mat4);
      canopies.setColorAt(idx, tp.tint);
    });

    trunks.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    trunks.computeBoundingSphere();
    canopies.computeBoundingSphere();

    this.scene.add(trunks, canopies);
  }

  private buildAutonomousTrafficAndCitizens() {
    const carColors = ['#dc2626', '#2563eb', '#eab308', '#f8fafc', '#0f766e', '#475569', '#ea580c'];
    const kinds: Array<'sedan' | 'suv' | 'bus' | 'truck' | 'police'> = [
      'sedan',
      'suv',
      'bus',
      'truck',
      'police',
    ];

    // 18 Autonomous Road Vehicles
    for (let i = 0; i < 18; i++) {
      const axis: 'x' | 'z' = i % 2 === 0 ? 'x' : 'z';
      const laneIdx = i % ROAD_COORDS.length;
      const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
      const laneCoord = ROAD_COORDS[laneIdx] + dir * 2.3;
      const kind = kinds[i % kinds.length];
      const color = kind === 'bus' ? '#0284c7' : kind === 'police' ? '#1e293b' : carColors[i % carColors.length];
      const rig = createVehicleGroup(kind, color, this.isSoftwareGl);
      const pos = -85 + ((i * 29) % 170);

      rig.group.position.set(
        axis === 'x' ? pos : laneCoord,
        0.29,
        axis === 'z' ? pos : laneCoord
      );
      rig.group.rotation.y =
        axis === 'z' ? (dir === 1 ? Math.PI : 0) : dir === 1 ? -Math.PI / 2 : Math.PI / 2;

      this.scene.add(rig.group);
      this.autoVehicles.push({
        id: `auto-v-${i}`,
        rig,
        axis,
        laneCoord,
        dir,
        pos,
        speed: 7 + (i % 4) * 1.8,
        baseSpeed: 7 + (i % 4) * 1.8,
      });
    }

    // 24 Autonomous Sidewalk Citizens (realistic 1.72m-1.84m scale vs 4.4m cars & buildings!)
    const outfits: Array<CharacterCustomization['outfitStyle']> = [
      'street_casual',
      'mayor_suit',
      'eco_ranger',
      'architect_coat',
      'civil_engineer',
    ];
    for (let i = 0; i < 24; i++) {
      const citizenChar: CharacterCustomization = {
        name: `Citizen ${i + 1}`,
        heightM: 1.66 + (i % 5) * 0.04,
        buildScale: 0.92 + (i % 3) * 0.08,
        skinTone: ['#e0b088', '#c68642', '#f1c27d', '#8d5524'][i % 4],
        hairStyle: (['short', 'swept', 'bun', 'bob', 'afro'] as const)[i % 5],
        hairColor: ['#1c1917', '#451a03', '#78350f', '#0f172a'][i % 4],
        eyewear: i % 4 === 0 ? 'sunglasses' : 'none',
        headwear: i % 6 === 0 ? 'cap' : 'none',
        outfitStyle: outfits[i % outfits.length],
        primaryColor: ['#334155', '#0f766e', '#1d4ed8', '#9333ea', '#b45309'][i % 5],
        secondaryColor: ['#cbd5e1', '#1e293b', '#f59e0b'][i % 3],
        accentColor: '#e2e8f0',
        accessory: 'none',
        perk: 'peoples_mayor',
      };
      const rig = createCharacterGroup(citizenChar);
      const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
      const dir: 1 | -1 = i % 3 === 0 ? -1 : 1;
      const roadC = ROAD_COORDS[i % ROAD_COORDS.length];
      const sideCoord = roadC + (i % 2 === 0 ? 6.2 : -6.2);
      const pos = -85 + ((i * 19) % 170);

      rig.group.position.set(axis === 'x' ? pos : sideCoord, 0.27, axis === 'z' ? pos : sideCoord);
      rig.group.rotation.y = axis === 'z' ? (dir === 1 ? 0 : Math.PI) : dir === 1 ? Math.PI / 2 : -Math.PI / 2;
      this.scene.add(rig.group);
      this.autoCitizens.push({
        rig,
        axis,
        sideCoord,
        dir,
        pos,
        speed: 1.35 + (i % 4) * 0.22,
        stride: i * 0.7,
      });
    }

    // 4 Harbor Ships cruising the coastal bay
    const shipConfigs = [
      { kind: 'cargo' as const, cx: -40, cz: 190, rx: 95, rz: 24, speed: 0.08, phase: 0 },
      { kind: 'cargo' as const, cx: 55, cz: 225, rx: 110, rz: 28, speed: -0.06, phase: 2.1 },
      { kind: 'yacht' as const, cx: -25, cz: 155, rx: 45, rz: 14, speed: 0.14, phase: 1.2 },
      { kind: 'yacht' as const, cx: 45, cz: 162, rx: 50, rz: 16, speed: -0.12, phase: 4.0 },
    ];
    for (const sc of shipConfigs) {
      const mesh = createShipGroup(sc.kind);
      this.scene.add(mesh);
      this.autoShips.push({
        mesh,
        centerX: sc.cx,
        centerZ: sc.cz,
        radiusX: sc.rx,
        radiusZ: sc.rz,
        phase: sc.phase,
        speed: sc.speed,
      });
    }
  }

  private buildPhysicsProps() {
    const crateMat = new THREE.MeshStandardMaterial({ color: 0xb4783e, roughness: 0.85 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45, metalness: 0.45 });
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });

    const spots: Array<{ x: number; z: number; kind: PhysicsPropState['kind'] }> = [
      { x: -4.2, z: 16, kind: 'cone' },
      { x: 4.2, z: 16, kind: 'cone' },
      { x: -8, z: 14, kind: 'crate' },
      { x: -9, z: 15.2, kind: 'crate' },
      { x: 8, z: 14, kind: 'barrel' },
      { x: 9.2, z: 14.5, kind: 'barrel' },
      { x: 48, z: 54, kind: 'crate' },
      { x: 50, z: 56, kind: 'barrel' },
      { x: -12, z: 84, kind: 'crate' },
      { x: 12, z: 84, kind: 'barrel' },
    ];

    spots.forEach((sp, idx) => {
      const grp = new THREE.Group();
      const halfH = sp.kind === 'cone' ? 0.38 : 0.45;
      const radius = sp.kind === 'cone' ? 0.28 : 0.48;
      if (sp.kind === 'crate') {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.85, 0.85), crateMat);
        box.castShadow = true;
        grp.add(box);
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), barrelMat);
        grp.add(trim);
      } else if (sp.kind === 'barrel') {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.92, 12), barrelMat);
        cyl.castShadow = true;
        grp.add(cyl);
      } else {
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), coneMat);
        base.position.y = -0.34;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.68, 10), coneMat);
        grp.add(base, cone);
      }
      const y = groundHeightAt(sp.x, sp.z) + halfH;
      grp.position.set(sp.x, y, sp.z);
      this.scene.add(grp);
      this.physicsProps.push({
        mesh: grp,
        state: {
          id: `prop-${idx}`,
          kind: sp.kind,
          x: sp.x,
          y,
          z: sp.z,
          vx: 0,
          vy: 0,
          vz: 0,
          rotY: 0,
          angVel: 0,
          radius,
          halfH,
          mass: sp.kind === 'cone' ? 0.6 : 1.3,
        },
      });
    });
  }

  private buildPlayerAndMayorCar(char: CharacterCustomization) {
    this.playerRig = createCharacterGroup(char);
    this.playerRig.group.position.set(this.player.x, this.player.y, this.player.z);
    this.scene.add(this.playerRig.group);

    this.playerVehicle = createVehicleGroup('sedan', '#f59e0b', this.isSoftwareGl);
    this.playerVehicle.group.position.set(this.carState.x, groundHeightAt(this.carState.x, this.carState.z), this.carState.z);
    this.scene.add(this.playerVehicle.group);
  }

  public updateCharacterAppearance(char: CharacterCustomization) {
    if (this.playerRig) {
      this.scene.remove(this.playerRig.group);
    }
    this.playerRig = createCharacterGroup(char);
    this.playerRig.group.position.set(this.player.x, this.player.y, this.player.z);
    this.scene.add(this.playerRig.group);
  }

  public syncSimulationVisuals(sim: CitySimulationState) {
    this.simTimeOfDay = sim.timeOfDay;
    const nightGlow = sim.timeOfDay < 6.5 || sim.timeOfDay > 18.0 ? 1.2 : 0.08;

    // 1. Add new completed structures & remove deleted ones
    const activeUids = new Set(sim.structures.map((s) => s.uid));
    for (const [uid, entry] of this.structureGroups) {
      if (!activeUids.has(uid)) {
        this.scene.remove(entry.group);
        this.structureGroups.delete(uid);
      }
    }

    for (const st of sim.structures) {
      if (!this.structureGroups.has(st.uid)) {
        const item = CATALOG_MAP.get(st.itemId);
        if (!item) continue;
        const built = createDetailedBuildingGroup(item, this.textures, this.isSoftwareGl, nightGlow);
        built.group.position.set(st.x, st.y, st.z);
        built.group.rotation.y = st.rotationY;
        this.scene.add(built.group);
        this.structureGroups.set(st.uid, built);
      }
    }

    // 2. Sync active Construction Sites (timed progress + crane animation!)
    const activeProjUids = new Set(sim.constructions.map((c) => c.uid));
    for (const [uid, rig] of this.constructionRigs) {
      if (!activeProjUids.has(uid)) {
        this.scene.remove(rig.group);
        this.constructionRigs.delete(uid);
      }
    }

    for (const proj of sim.constructions) {
      let rig = this.constructionRigs.get(proj.uid);
      if (!rig) {
        const item = CATALOG_MAP.get(proj.itemId);
        if (!item) continue;
        rig = createConstructionSiteGroup(item, this.textures);
        rig.group.position.set(proj.x, proj.y, proj.z);
        rig.group.rotation.y = proj.rotationY;
        this.scene.add(rig.group);
        this.constructionRigs.set(proj.uid, rig);
      }
      const p = Math.max(0.08, proj.progress);
      rig.risingCore.scale.y = p;
      rig.risingCore.position.y = 0.5 + (rig.targetHeight * 0.82 * p) / 2;
    }

    // 3. Rebuild static colliders for accurate FPS & vehicle collision
    const nextColliders: ColliderBox[] = [];
    for (const st of sim.structures) {
      const item = CATALOG_MAP.get(st.itemId);
      if (!item || item.archetype === 'bench' || item.archetype === 'streetlight') continue;
      const halfW = (Math.abs(Math.cos(st.rotationY)) * item.footprintW + Math.abs(Math.sin(st.rotationY)) * item.footprintD) * 0.44;
      const halfD = (Math.abs(Math.sin(st.rotationY)) * item.footprintW + Math.abs(Math.cos(st.rotationY)) * item.footprintD) * 0.44;
      nextColliders.push({
        id: st.uid,
        minX: st.x - halfW,
        maxX: st.x + halfW,
        minZ: st.z - halfD,
        maxZ: st.z + halfD,
        maxY: st.y + item.heightM,
      });
    }
    for (const proj of sim.constructions) {
      const item = CATALOG_MAP.get(proj.itemId);
      if (!item) continue;
      nextColliders.push({
        id: proj.uid,
        minX: proj.x - item.footprintW * 0.48,
        maxX: proj.x + item.footprintW * 0.48,
        minZ: proj.z - item.footprintD * 0.48,
        maxZ: proj.z + item.footprintD * 0.48,
        maxY: proj.y + 4,
      });
    }
    this.colliders = nextColliders;
  }

  public setGameState(state: GameState) {
    const prev = this.gameState;
    this.gameState = state;
    if (state !== 'playing') {
      this.keys.clear();
      this.isDraggingLook = false;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
    } else if (prev === 'title') {
      this.recentreToPlayer();
    }
  }

  public setCameraMode(mode: CameraMode) {
    this.cameraMode = mode;
    if (mode === 'drive') {
      this.player.inVehicleId = 'mayor-sedan';
      this.orbitControls.enabled = false;
    } else {
      if (this.player.inVehicleId) {
        this.player.inVehicleId = null;
        this.player.x = this.carState.x - 2.2;
        this.player.z = this.carState.z;
        this.player.y = groundHeightAt(this.player.x, this.player.z);
      }
      this.orbitControls.enabled = mode === 'orbit' || mode === 'pan';
      if (mode === 'orbit') {
        this.orbitControls.target.set(this.player.x, this.player.y + 1.4, this.player.z);
        this.camera.position.set(this.player.x + 8, this.player.y + 5.5, this.player.z + 10);
      } else if (mode === 'pan') {
        this.orbitControls.target.set(this.player.x, 1, this.player.z);
        this.camera.position.set(this.player.x + 35, 48, this.player.z + 45);
      }
    }
    if (mode !== 'fps' && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }
  }

  public recentreToPlayer() {
    if (this.cameraMode === 'pan') {
      this.orbitControls.target.set(0, 1, 0);
      this.camera.position.set(35, 52, 48);
    } else {
      this.player = createInitialPlayerState();
      this.orbitControls.target.set(this.player.x, this.player.y + 1.4, this.player.z);
    }
  }

  public setArmedBlueprint(item: CatalogItem | null) {
    this.armedItem = item;
    if (this.ghostGroup) {
      this.scene.remove(this.ghostGroup);
      this.ghostGroup = null;
    }
    if (!item) return;

    const grp = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(
      Math.max(item.footprintW, item.footprintD) * 0.48,
      Math.max(item.footprintW, item.footprintD) * 0.54,
      32
    );
    ringGeo.rotateX(-Math.PI / 2);
    this.ghostRingMat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, this.ghostRingMat);
    ring.position.y = 0.15;
    grp.add(ring);

    const preview = createDetailedBuildingGroup(item, this.textures, true, 0.2).group;
    preview.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (m && m.clone) {
          const cloned = m.clone();
          cloned.transparent = true;
          cloned.opacity = 0.58;
          (obj as THREE.Mesh).material = cloned;
        }
      }
    });
    grp.add(preview);
    this.ghostGroup = grp;
    this.scene.add(grp);
  }

  public rotateArmedBlueprint() {
    this.placementRotation = (this.placementRotation + Math.PI / 2) % (Math.PI * 2);
    if (this.ghostGroup) {
      this.ghostGroup.rotation.y = this.placementRotation;
    }
  }

  public triggerTrauma(amount: number) {
    this.cameraTrauma = Math.min(1, this.cameraTrauma + amount);
  }

  private bindEvents() {
    const canvas = this.renderer.domElement;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (!this.keys.has(e.code) && e.code === 'Space') {
        this.jumpQueued = true;
      }
      if (e.code === 'KeyR' && this.armedItem) {
        this.rotateArmedBlueprint();
      }
      this.keys.add(e.code);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };

    const onBlur = () => {
      this.keys.clear();
      this.isDraggingLook = false;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (this.gameState !== 'playing') return;

      // Update NDC
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.armedItem && e.button === 0) {
        this.updatePlacementPreview();
        if (this.placementValid) {
          this.callbacks.onPlaceBlueprint(
            this.armedItem.id,
            Math.round(this.placementPos.x * 2) / 2,
            Math.round(this.placementPos.z * 2) / 2,
            this.placementRotation
          );
          this.audio.playBuildStart();
          this.triggerTrauma(0.18);
        }
        return;
      }

      if (this.cameraMode === 'fps' && e.button === 0) {
        this.isDraggingLook = true;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
        // Request pointer lock gently only on direct canvas click without armed item
        if (document.pointerLockElement !== canvas) {
          canvas.requestPointerLock?.();
        }
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.cameraMode === 'fps' && this.gameState === 'playing') {
        if (document.pointerLockElement === canvas) {
          this.player.yaw -= e.movementX * 0.0022;
          this.player.pitch = THREE.MathUtils.clamp(this.player.pitch - e.movementY * 0.0022, -1.25, 1.25);
        } else if (this.isDraggingLook) {
          const dx = e.clientX - this.lastPointerX;
          const dy = e.clientY - this.lastPointerY;
          this.lastPointerX = e.clientX;
          this.lastPointerY = e.clientY;
          this.player.yaw -= dx * 0.0045;
          this.player.pitch = THREE.MathUtils.clamp(this.player.pitch - dy * 0.004, -1.25, 1.25);
        }
      }
    };

    const onMouseUp = () => {
      this.isDraggingLook = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    this.resizeObserver = new ResizeObserver(() => {
      if (this.disposed) return;
      const w = Math.max(320, this.container.clientWidth);
      const h = Math.max(240, this.container.clientHeight);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
    this.resizeObserver.observe(this.container);

    // Store cleanup on instance
    this.cleanupListeners = () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }

  private cleanupListeners: () => void = () => {};

  private updatePlacementPreview() {
    if (!this.armedItem || !this.ghostGroup) return;
    if (this.cameraMode === 'fps') {
      this.pointerNdc.set(0, -0.08);
    }
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const hit = _v1;
    if (this.raycaster.ray.intersectPlane(this.groundRayPlane, hit)) {
      const snappedX = Math.round(hit.x / 2) * 2;
      const snappedZ = Math.round(hit.z / 2) * 2;
      const clampedX = THREE.MathUtils.clamp(snappedX, -220, 220);
      const clampedZ = THREE.MathUtils.clamp(snappedZ, -220, 125);
      const gy = groundHeightAt(clampedX, clampedZ);
      this.placementPos.set(clampedX, gy, clampedZ);
      this.ghostGroup.position.copy(this.placementPos);

      // Check overlap with roads, water, or existing buildings
      const halfR = Math.max(this.armedItem.footprintW, this.armedItem.footprintD) * 0.42;
      const inRoad =
        this.armedItem.category !== 'props' &&
        (isRoadAt(clampedX, clampedZ) ||
          isRoadAt(clampedX + halfR, clampedZ) ||
          isRoadAt(clampedX - halfR, clampedZ) ||
          isRoadAt(clampedX, clampedZ + halfR) ||
          isRoadAt(clampedX, clampedZ - halfR));
      const inWater = isWaterAt(clampedX, clampedZ);

      let collides = false;
      for (let i = 0; i < this.colliders.length; i++) {
        const b = this.colliders[i];
        if (
          clampedX + halfR > b.minX &&
          clampedX - halfR < b.maxX &&
          clampedZ + halfR > b.minZ &&
          clampedZ - halfR < b.maxZ
        ) {
          collides = true;
          break;
        }
      }

      this.placementValid = !inRoad && !inWater && !collides;
      this.ghostRingMat.color.setHex(this.placementValid ? 0x10b981 : 0xef4444);
    }
  }

  private stepAutonomousWorld(dt: number, elapsedSec: number) {
    // Ocean wave shimmer
    this.oceanMesh.position.y = SEA_LEVEL + Math.sin(elapsedSec * 1.1) * 0.08;

    // Animated buildings (wind turbines, fountains, beacons, cranes)
    this.structureGroups.forEach(({ anim }) => {
      if (anim.windBlades) anim.windBlades.rotation.z += dt * 1.4;
      if (anim.fountainRing) {
        const s = 0.85 + Math.sin(elapsedSec * 4) * 0.18;
        anim.fountainRing.scale.set(s, s, 1);
      }
      if (anim.radarDish) anim.radarDish.rotation.y += dt * 0.6;
      if (anim.craneTrolley) anim.craneTrolley.position.x = Math.sin(elapsedSec * 0.5) * 2.5;
      if (anim.beaconLight) {
        const mat = anim.beaconLight.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.6 + Math.abs(Math.sin(elapsedSec * 2.5)) * 1.6;
      }
    });

    // Animated active construction cranes
    this.constructionRigs.forEach((rig, uid) => {
      const seed = uid.length * 1.7;
      rig.craneBoom.rotation.y = Math.sin(elapsedSec * 0.45 + seed) * 1.1;
    });

    // Autonomous Vehicles along road grid
    for (let i = 0; i < this.autoVehicles.length; i++) {
      const v = this.autoVehicles[i];
      v.pos += v.dir * v.speed * dt;
      if (v.pos > 96) v.pos = -96;
      if (v.pos < -96) v.pos = 96;

      const x = v.axis === 'x' ? v.pos : v.laneCoord;
      const z = v.axis === 'z' ? v.pos : v.laneCoord;
      v.rig.group.position.set(x, 0.29, z);
      for (const w of v.rig.wheels) {
        w.rotation.x -= v.speed * dt * 2.2;
      }
    }

    // Autonomous Sidewalk Citizens
    for (let i = 0; i < this.autoCitizens.length; i++) {
      const c = this.autoCitizens[i];
      c.pos += c.dir * c.speed * dt;
      if (c.pos > 90) c.pos = -90;
      if (c.pos < -90) c.pos = 90;
      c.stride += c.speed * dt * 2.4;

      const x = c.axis === 'x' ? c.pos : c.sideCoord;
      const z = c.axis === 'z' ? c.pos : c.sideCoord;
      c.rig.group.position.set(x, 0.27, z);
      const swing = Math.sin(c.stride) * 0.52;
      c.rig.leftLeg.rotation.x = swing;
      c.rig.rightLeg.rotation.x = -swing;
      c.rig.leftArm.rotation.x = -swing * 0.8;
      c.rig.rightArm.rotation.x = swing * 0.8;
    }

    // Autonomous Harbor Ships
    for (const ship of this.autoShips) {
      ship.phase += ship.speed * dt;
      const nx = ship.centerX + Math.cos(ship.phase) * ship.radiusX;
      const nz = ship.centerZ + Math.sin(ship.phase) * ship.radiusZ;
      const dx = -Math.sin(ship.phase) * ship.radiusX * ship.speed;
      const dz = Math.cos(ship.phase) * ship.radiusZ * ship.speed;
      ship.mesh.position.set(nx, SEA_LEVEL + Math.sin(elapsedSec * 1.4 + ship.phase) * 0.14, nz);
      ship.mesh.rotation.y = Math.atan2(dx, dz) + Math.PI;
    }
  }

  private stepDrivingAndPlayer(dt: number) {
    if (this.cameraMode === 'drive') {
      const throttle = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const steerInput = (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) -
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0);

      const targetSpeed = throttle * 22;
      this.carState.speed += (targetSpeed - this.carState.speed) * (1 - Math.exp(-3.2 * dt));
      this.carState.steer += (steerInput * 0.65 - this.carState.steer) * (1 - Math.exp(-10 * dt));

      if (Math.abs(this.carState.speed) > 0.2) {
        const dirSign = this.carState.speed >= 0 ? 1 : -1;
        this.carState.yaw += this.carState.steer * dirSign * Math.min(1, Math.abs(this.carState.speed) / 6) * 2.1 * dt;
      }

      const fwdX = -Math.sin(this.carState.yaw);
      const fwdZ = -Math.cos(this.carState.yaw);
      const nextX = THREE.MathUtils.clamp(this.carState.x + fwdX * this.carState.speed * dt, -260, 260);
      const nextZ = THREE.MathUtils.clamp(this.carState.z + fwdZ * this.carState.speed * dt, -260, 114);

      // Check building collisions
      let blocked = false;
      for (const b of this.colliders) {
        if (nextX > b.minX - 1.3 && nextX < b.maxX + 1.3 && nextZ > b.minZ - 1.3 && nextZ < b.maxZ + 1.3) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        this.carState.speed *= -0.35;
        this.triggerTrauma(0.32);
      } else {
        this.carState.x = nextX;
        this.carState.z = nextZ;
      }

      const gy = groundHeightAt(this.carState.x, this.carState.z);
      this.playerVehicle.group.position.set(this.carState.x, gy, this.carState.z);
      this.playerVehicle.group.rotation.y = this.carState.yaw;

      // Realistic suspension pitch & roll
      this.playerVehicle.chassisGroup.rotation.x = -throttle * 0.035;
      this.playerVehicle.chassisGroup.rotation.z = this.carState.steer * (this.carState.speed / 22) * 0.06;
      this.carState.wheelSpin -= this.carState.speed * dt * 2.8;
      for (const w of this.playerVehicle.wheels) {
        w.rotation.x = this.carState.wheelSpin;
      }

      // Sync player position to car
      this.player.x = this.carState.x;
      this.player.y = gy;
      this.player.z = this.carState.z;
      this.playerRig.group.visible = false;

      // Dynamic chase camera with exponential damping
      _v1.set(
        this.carState.x + Math.sin(this.carState.yaw) * 9.5,
        gy + 3.8,
        this.carState.z + Math.cos(this.carState.yaw) * 9.5
      );
      this.camera.position.lerp(_v1, 1 - Math.exp(-8 * dt));
      _v2.set(this.carState.x - Math.sin(this.carState.yaw) * 6, gy + 1.4, this.carState.z - Math.cos(this.carState.yaw) * 6);
      this.camera.lookAt(_v2);

      stepDynamicPropPhysics(
        this.physicsProps.map((p) => p.state),
        this.carState.x,
        gy + 0.7,
        this.carState.z,
        fwdX * this.carState.speed,
        fwdZ * this.carState.speed,
        1.5,
        this.colliders,
        dt
      );
      return;
    }

    // Pan camera WASD navigation
    if (this.cameraMode === 'pan') {
      const fwd = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const str = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      if (fwd !== 0 || str !== 0) {
        this.camera.getWorldDirection(_v1);
        _v1.y = 0;
        _v1.normalize();
        _v2.set(-_v1.z, 0, _v1.x);
        const panDeltaX = (_v1.x * fwd + _v2.x * str) * 38 * dt;
        const panDeltaZ = (_v1.z * fwd + _v2.z * str) * 38 * dt;
        this.orbitControls.target.x += panDeltaX;
        this.orbitControls.target.z += panDeltaZ;
        this.camera.position.x += panDeltaX;
        this.camera.position.z += panDeltaZ;
      }
      this.orbitControls.update();
      return;
    }

    // First-person & 3rd-person Orbit player movement
    if (this.cameraMode === 'fps') {
      const turnInput = (this.keys.has('ArrowLeft') ? 1 : 0) - (this.keys.has('ArrowRight') ? 1 : 0);
      this.player.yaw += turnInput * 2.1 * dt;
    }

    const forward = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0);

    const prevPhase = this.player.stridePhase;
    const res = stepPlayerPhysics(
      this.player,
      {
        forward,
        strafe,
        sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
        jumpJustPressed: this.jumpQueued,
      },
      this.colliders,
      dt
    );
    this.jumpQueued = false;

    if (res.jumped) this.audio.playJump();
    if (res.landedSpeed > 4.5) {
      this.audio.playLand(res.landedSpeed / 10);
      this.triggerTrauma(Math.min(0.25, res.landedSpeed * 0.016));
    }
    if (Math.floor(this.player.stridePhase / Math.PI) !== Math.floor(prevPhase / Math.PI)) {
      this.footstepAccum++;
      if (this.footstepAccum % 1 === 0) {
        this.audio.playFootstep(!isRoadAt(this.player.x, this.player.z));
      }
    }

    // Update customized character rig & gait swing
    this.playerRig.group.visible = this.cameraMode !== 'fps';
    this.playerRig.group.position.set(this.player.x, this.player.y, this.player.z);
    this.playerRig.group.rotation.y = this.player.yaw + Math.PI;
    const swing = Math.sin(this.player.stridePhase) * 0.55;
    const movingAmt = Math.min(1, Math.hypot(this.player.vx, this.player.vz) / 4);
    this.playerRig.leftLeg.rotation.x = swing * movingAmt;
    this.playerRig.rightLeg.rotation.x = -swing * movingAmt;
    this.playerRig.leftArm.rotation.x = -swing * 0.8 * movingAmt;
    this.playerRig.rightArm.rotation.x = swing * 0.8 * movingAmt;

    // Physics props interaction
    const hitProp = stepDynamicPropPhysics(
      this.physicsProps.map((p) => p.state),
      this.player.x,
      this.player.y + 0.85,
      this.player.z,
      this.player.vx,
      this.player.vz,
      0.55,
      this.colliders,
      dt
    );
    if (hitProp) {
      this.triggerTrauma(0.08);
    }

    if (this.cameraMode === 'fps') {
      const eyeHeight = this.playerRig.group.scale.y * 1.78 * PLAYER_EYE_RATIO;
      const headBob = Math.sin(this.player.stridePhase * 2) * 0.045 * movingAmt;
      const shakeAmt = this.cameraTrauma * this.cameraTrauma;
      const shakeY = (Math.random() - 0.5) * shakeAmt * 0.08;
      const shakeZ = (Math.random() - 0.5) * shakeAmt * 0.04;

      this.camera.position.set(
        this.player.x,
        this.player.y + eyeHeight + headBob - this.player.landingDip + shakeY,
        this.player.z
      );
      _euler.set(this.player.pitch, this.player.yaw, shakeZ, 'YXZ');
      this.camera.quaternion.setFromEuler(_euler);
    } else {
      this.orbitControls.target.lerp(
        _v1.set(this.player.x, this.player.y + 1.4, this.player.z),
        1 - Math.exp(-10 * dt)
      );
      this.orbitControls.update();
    }
  }

  private startLoop() {
    const tick = () => {
      if (this.disposed) return;

      const now = performance.now();
      const dt = Math.min((now - this.lastTimeMs) / 1000, 0.05);
      this.lastTimeMs = now;
      const elapsedSec = now / 1000;

      this.updateSkyAndSun(this.simTimeOfDay);
      this.stepAutonomousWorld(dt, elapsedSec);

      // Update physics prop transforms
      for (const pp of this.physicsProps) {
        pp.mesh.position.set(pp.state.x, pp.state.y, pp.state.z);
        pp.mesh.rotation.y = pp.state.rotY;
      }

      if (this.gameState === 'title') {
        // Live atmospheric flyover spline above coastal metropolis!
        this.titleOrbitAngle += dt * 0.14;
        const r = 108;
        const camX = Math.sin(this.titleOrbitAngle) * r;
        const camZ = Math.cos(this.titleOrbitAngle) * r + 15;
        this.camera.position.set(camX, 42 + Math.sin(this.titleOrbitAngle * 2) * 5, camZ);
        this.camera.lookAt(0, 12, -10);
      } else if (this.gameState === 'playing') {
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
        this.stepDrivingAndPlayer(dt);
        if (this.armedItem) {
          this.updatePlacementPreview();
        }

        // Throttled HUD telemetry (<= 8Hz)
        this.hudEmitAccum += dt;
        if (this.hudEmitAccum >= 0.14) {
          this.hudEmitAccum = 0;
          const distToCar = Math.hypot(this.player.x - this.carState.x, this.player.z - this.carState.z);
          this.callbacks.onHudTelemetry({
            fpsSpeed: Math.round(Math.hypot(this.player.vx, this.player.vz) * 3.6),
            stamina: Math.round(this.player.stamina),
            coords: { x: Math.round(this.player.x), z: Math.round(this.player.z) },
            canEnterCar: distToCar < 5.5 || this.cameraMode === 'drive',
            drivingSpeedKmh: Math.round(Math.abs(this.carState.speed) * 3.6),
            placementValid: this.placementValid,
          });
        }
      }

      this.renderer.render(this.scene, this.camera);

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = window.setTimeout(tick, 16);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.cleanupListeners();
    this.resizeObserver?.disconnect();
    this.orbitControls.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
