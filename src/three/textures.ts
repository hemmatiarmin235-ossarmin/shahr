import * as THREE from 'three';

export interface WorldTextures {
  asphaltMap: THREE.CanvasTexture;
  asphaltBump: THREE.CanvasTexture;
  plazaMap: THREE.CanvasTexture;
  plazaBump: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  grassBump: THREE.CanvasTexture;
  glassFacadeMap: THREE.CanvasTexture;
  glassEmissiveMap: THREE.CanvasTexture;
  brickMap: THREE.CanvasTexture;
  brickBump: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function setupTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  repeatX: number,
  repeatY: number,
  maxAniso: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

export function createWorldTextures(maxAnisotropy: number): WorldTextures {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Asphalt & Micro-aggregate bump
  const [asphC, asphCtx] = makeCanvas(256);
  const [asphBC, asphBCtx] = makeCanvas(256);
  asphCtx.fillStyle = '#2d333b';
  asphCtx.fillRect(0, 0, 256, 256);
  asphBCtx.fillStyle = '#808080';
  asphBCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const v = 38 + ((i * 29) % 26);
    asphCtx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    asphCtx.fillRect(x, y, 2, 2);
    const bv = 100 + ((i * 41) % 65);
    asphBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    asphBCtx.fillRect(x, y, 2, 2);
  }
  const asphaltMap = setupTex(asphC, true, 16, 16, aniso);
  const asphaltBump = setupTex(asphBC, false, 16, 16, aniso);

  // 2. Granite Plaza Pavers
  const [plzC, plzCtx] = makeCanvas(256);
  const [plzBC, plzBCtx] = makeCanvas(256);
  plzCtx.fillStyle = '#b6bac2';
  plzCtx.fillRect(0, 0, 256, 256);
  plzBCtx.fillStyle = '#d0d0d0';
  plzBCtx.fillRect(0, 0, 256, 256);
  const tile = 32;
  for (let gx = 0; gx < 256; gx += tile) {
    for (let gy = 0; gy < 256; gy += tile) {
      const shade = 172 + (((gx * 7 + gy * 13) % 24) - 12);
      plzCtx.fillStyle = `rgb(${shade},${shade + 1},${shade + 4})`;
      plzCtx.fillRect(gx + 2, gy + 2, tile - 3, tile - 3);
      plzBCtx.fillStyle = '#404040';
      plzBCtx.strokeStyle = '#383838';
      plzBCtx.lineWidth = 2;
      plzBCtx.strokeRect(gx + 1, gy + 1, tile - 2, tile - 2);
    }
  }
  const plazaMap = setupTex(plzC, true, 18, 18, aniso);
  const plazaBump = setupTex(plzBC, false, 18, 18, aniso);

  // 3. Meadow Grass
  const [grsC, grsCtx] = makeCanvas(256);
  const [grsBC, grsBCtx] = makeCanvas(256);
  grsCtx.fillStyle = '#4d7c42';
  grsCtx.fillRect(0, 0, 256, 256);
  grsBCtx.fillStyle = '#808080';
  grsBCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const x = (i * 97) % 256;
    const y = (i * 193) % 256;
    const g = 104 + ((i * 31) % 36);
    const r = 64 + ((i * 17) % 22);
    grsCtx.fillStyle = `rgb(${r},${g},58)`;
    grsCtx.fillRect(x, y, 2, 4);
    const bv = 90 + ((i * 53) % 80);
    grsBCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    grsBCtx.fillRect(x, y, 2, 3);
  }
  const grassMap = setupTex(grsC, true, 32, 32, aniso);
  const grassBump = setupTex(grsBC, false, 32, 32, aniso);

  // 4. Curtain-wall Glass Facade + Night Window Emissive Map
  const [glsC, glsCtx] = makeCanvas(256);
  const [emC, emCtx] = makeCanvas(256);
  glsCtx.fillStyle = '#1e354d';
  glsCtx.fillRect(0, 0, 256, 256);
  emCtx.fillStyle = '#000000';
  emCtx.fillRect(0, 0, 256, 256);

  const cols = 8;
  const rows = 8;
  const cw = 256 / cols;
  const ch = 256 / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = ((r * 13 + c * 7) % 5) !== 0;
      const grad = glsCtx.createLinearGradient(c * cw, r * ch, c * cw, (r + 1) * ch);
      grad.addColorStop(0, '#72a8cf');
      grad.addColorStop(0.55, '#3b6d94');
      grad.addColorStop(1, '#22425e');
      glsCtx.fillStyle = grad;
      glsCtx.fillRect(c * cw + 3, r * ch + 4, cw - 6, ch - 8);

      if (lit) {
        const warm = ((r + c) % 3) === 0 ? '#ffd89b' : '#b7e3ff';
        emCtx.fillStyle = warm;
        emCtx.fillRect(c * cw + 4, r * ch + 5, cw - 8, ch - 10);
      }
    }
    // Spandrel floor beam
    glsCtx.fillStyle = '#24303e';
    glsCtx.fillRect(0, r * ch, 256, 4);
  }
  const glassFacadeMap = setupTex(glsC, true, 2, 4, aniso);
  const glassEmissiveMap = setupTex(emC, true, 2, 4, aniso);

  // 5. Heritage Brick Masonry
  const [brkC, brkCtx] = makeCanvas(256);
  const [brkBC, brkBCtx] = makeCanvas(256);
  brkCtx.fillStyle = '#9e8e7e';
  brkCtx.fillRect(0, 0, 256, 256);
  brkBCtx.fillStyle = '#404040';
  brkBCtx.fillRect(0, 0, 256, 256);
  const bh = 16;
  const bw = 32;
  for (let row = 0; row < 16; row++) {
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < 9; col++) {
      const tone = ((row * 11 + col * 19) % 30) - 15;
      brkCtx.fillStyle = `rgb(${165 + tone},${96 + Math.floor(tone * 0.6)},${74 + Math.floor(tone * 0.4)})`;
      brkCtx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 3, bh - 3);
      brkBCtx.fillStyle = '#dcdcdc';
      brkBCtx.fillRect(col * bw + offset + 2, row * bh + 2, bw - 3, bh - 3);
    }
  }
  const brickMap = setupTex(brkC, true, 3, 3, aniso);
  const brickBump = setupTex(brkBC, false, 3, 3, aniso);

  // 6. Soft Radial Contact Shadow Disc
  const [shC, shCtx] = makeCanvas(128);
  const shGrad = shCtx.createRadialGradient(64, 64, 6, 64, 64, 60);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.65)');
  shGrad.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowMap = new THREE.CanvasTexture(shC);
  contactShadowMap.colorSpace = THREE.SRGBColorSpace;
  contactShadowMap.needsUpdate = true;

  return {
    asphaltMap,
    asphaltBump,
    plazaMap,
    plazaBump,
    grassMap,
    grassBump,
    glassFacadeMap,
    glassEmissiveMap,
    brickMap,
    brickBump,
    contactShadowMap,
    dispose: () => {
      asphaltMap.dispose();
      asphaltBump.dispose();
      plazaMap.dispose();
      plazaBump.dispose();
      grassMap.dispose();
      grassBump.dispose();
      glassFacadeMap.dispose();
      glassEmissiveMap.dispose();
      brickMap.dispose();
      brickBump.dispose();
      contactShadowMap.dispose();
    },
  };
}
