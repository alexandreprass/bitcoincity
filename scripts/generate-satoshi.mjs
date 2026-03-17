/**
 * Generate Satoshi Nakamoto GLB model using @gltf-transform/core
 * Smooth LatheGeometry for robe, proper face, hood, Bitcoin medallion
 * Run: node scripts/generate-satoshi.mjs
 */

import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { writeFileSync, readFileSync } from 'fs';

// ============================================================
// Use Three.js to build geometries, then convert to glTF manually
// ============================================================

const doc = new Document();
const buffer = doc.createBuffer('main');
const scene = doc.createScene('Satoshi');

// Helper: Convert THREE.BufferGeometry + material props to glTF mesh
function createGltfMesh(name, threeGeo, color, metalness = 0.2, roughness = 0.8, emissiveFactor = [0, 0, 0]) {
  // Ensure geometry has necessary attributes
  threeGeo.computeVertexNormals();

  const posArr = threeGeo.attributes.position.array;
  const normArr = threeGeo.attributes.normal.array;
  const idxArr = threeGeo.index ? threeGeo.index.array : null;

  const posAccessor = doc.createAccessor(`${name}_pos`)
    .setType('VEC3')
    .setBuffer(buffer)
    .setArray(new Float32Array(posArr));

  const normAccessor = doc.createAccessor(`${name}_norm`)
    .setType('VEC3')
    .setBuffer(buffer)
    .setArray(new Float32Array(normArr));

  const prim = doc.createPrimitive()
    .setAttribute('POSITION', posAccessor)
    .setAttribute('NORMAL', normAccessor);

  if (idxArr) {
    const idxAccessor = doc.createAccessor(`${name}_idx`)
      .setType('SCALAR')
      .setBuffer(buffer)
      .setArray(new Uint16Array(idxArr));
    prim.setIndices(idxAccessor);
  }

  // Material
  const mat = doc.createMaterial(name + '_mat')
    .setBaseColorFactor([...color, 1])
    .setMetallicFactor(metalness)
    .setRoughnessFactor(roughness)
    .setEmissiveFactor(emissiveFactor)
    .setDoubleSided(false);

  prim.setMaterial(mat);

  const mesh = doc.createMesh(name).addPrimitive(prim);
  return mesh;
}

// Helper: apply Three.js transforms (position, rotation, scale) to a glTF node
function addMeshToScene(name, threeGeo, color, metalness, roughness, pos = [0,0,0], rot = [0,0,0], scl = [1,1,1], emissive = [0,0,0], doubleSided = false) {
  threeGeo.computeVertexNormals();

  const posArr = threeGeo.attributes.position.array;
  const normArr = threeGeo.attributes.normal.array;
  const idxArr = threeGeo.index ? threeGeo.index.array : null;

  const posAccessor = doc.createAccessor(`${name}_pos`)
    .setType('VEC3').setBuffer(buffer).setArray(new Float32Array(posArr));
  const normAccessor = doc.createAccessor(`${name}_norm`)
    .setType('VEC3').setBuffer(buffer).setArray(new Float32Array(normArr));

  const prim = doc.createPrimitive()
    .setAttribute('POSITION', posAccessor)
    .setAttribute('NORMAL', normAccessor);

  if (idxArr) {
    const maxIdx = Math.max(...idxArr);
    const IdxType = maxIdx > 65535 ? Uint32Array : Uint16Array;
    const idxAccessor = doc.createAccessor(`${name}_idx`)
      .setType('SCALAR').setBuffer(buffer).setArray(new IdxType(idxArr));
    prim.setIndices(idxAccessor);
  }

  const mat = doc.createMaterial(name + '_mat')
    .setBaseColorFactor([...color, 1])
    .setMetallicFactor(metalness)
    .setRoughnessFactor(roughness)
    .setEmissiveFactor(emissive)
    .setDoubleSided(doubleSided);

  prim.setMaterial(mat);

  const mesh = doc.createMesh(name).addPrimitive(prim);

  // Convert euler to quaternion
  const euler = new THREE.Euler(rot[0], rot[1], rot[2]);
  const quat = new THREE.Quaternion().setFromEuler(euler);

  const node = doc.createNode(name)
    .setMesh(mesh)
    .setTranslation(pos)
    .setRotation([quat.x, quat.y, quat.z, quat.w])
    .setScale(scl);

  scene.addChild(node);
  return node;
}

// Color helpers
const C = (hex) => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};

// ============================================================
// Material colors
// ============================================================
const cloak = C('#141414');
const cloakDk = C('#0a0a0a');
const cloakFold = C('#1c1c1c');
const hood = C('#0f0f0f');
const hoodInner = C('#040404');
const mask = C('#c0c0c0');
const maskDk = C('#3a3a3a');
const bronze = C('#8B6914');
const btcOrange = C('#f7931a');
const bronzeRim = C('#a07830');
const boot = C('#080808');

// ============================================================
// 1. ROBE - LatheGeometry (smooth revolution surface)
// ============================================================
const robePoints = [
  new THREE.Vector2(0.70, 0.0),
  new THREE.Vector2(0.68, 0.05),
  new THREE.Vector2(0.64, 0.10),
  new THREE.Vector2(0.58, 0.25),
  new THREE.Vector2(0.52, 0.45),
  new THREE.Vector2(0.47, 0.65),
  new THREE.Vector2(0.42, 0.85),
  new THREE.Vector2(0.40, 1.0),
  new THREE.Vector2(0.41, 1.15),
  new THREE.Vector2(0.43, 1.30),
  new THREE.Vector2(0.46, 1.45),
  new THREE.Vector2(0.48, 1.55),
  new THREE.Vector2(0.46, 1.62),
  new THREE.Vector2(0.20, 1.70),
  new THREE.Vector2(0.15, 1.75),
];

addMeshToScene('Robe', new THREE.LatheGeometry(robePoints, 48), cloak, 0.18, 0.82);

// ============================================================
// 2. FABRIC FOLDS
// ============================================================
const folds = [
  // Front folds [x, z, height, yOff, radius, colorKey]
  [0, 0.42, 1.3, 0.08, 0.022, 'dk'],
  [-0.12, 0.40, 1.1, 0.08, 0.016, 'fold'],
  [0.12, 0.40, 1.1, 0.08, 0.016, 'fold'],
  [-0.22, 0.35, 0.95, 0.08, 0.014, 'dk'],
  [0.22, 0.35, 0.95, 0.08, 0.014, 'dk'],
  // Sides
  [-0.40, 0.15, 1.0, 0.08, 0.018, 'dk'],
  [-0.44, 0.0, 0.9, 0.08, 0.014, 'fold'],
  [0.40, 0.15, 1.0, 0.08, 0.018, 'dk'],
  [0.44, 0.0, 0.9, 0.08, 0.014, 'fold'],
  // Back
  [0, -0.42, 1.2, 0.08, 0.02, 'dk'],
  [-0.15, -0.38, 0.9, 0.08, 0.015, 'fold'],
  [0.15, -0.38, 0.9, 0.08, 0.015, 'fold'],
  [-0.30, -0.30, 0.8, 0.08, 0.013, 'dk'],
  [0.30, -0.30, 0.8, 0.08, 0.013, 'dk'],
];

folds.forEach(([x, z, h, yOff, r, type], i) => {
  const col = type === 'dk' ? cloakDk : cloakFold;
  const met = type === 'dk' ? 0.1 : 0.22;
  const rough = type === 'dk' ? 0.92 : 0.75;
  addMeshToScene(`Fold_${i}`, new THREE.CapsuleGeometry(r, h, 6, 12), col, met, rough,
    [x, yOff + h / 2, z], [0, Math.atan2(x, z), 0]);
});

// ============================================================
// 3. HOOD
// ============================================================
addMeshToScene('Hood', new THREE.SphereGeometry(0.50, 36, 28, 0, Math.PI * 2, 0, Math.PI / 1.65),
  hood, 0.15, 0.88, [0, 2.0, -0.04], [0,0,0], [1,1,1], [0,0,0], true);

addMeshToScene('HoodInner', new THREE.SphereGeometry(0.45, 32, 24, 0, Math.PI * 2, 0, Math.PI / 1.85),
  hoodInner, 0.05, 0.95, [0, 1.98, 0.0], [0,0,0], [1,1,1], [0,0,0], true);

addMeshToScene('HoodBack', new THREE.SphereGeometry(0.38, 24, 18),
  cloakDk, 0.12, 0.9, [0, 1.72, -0.22], [0,0,0], [1.0, 1.1, 0.75]);

addMeshToScene('HoodPeak', new THREE.SphereGeometry(0.16, 16, 12),
  hood, 0.15, 0.88, [0, 2.28, -0.12], [0,0,0], [0.6, 0.8, 0.6]);

// Hood rims
addMeshToScene('HoodRimL', new THREE.CapsuleGeometry(0.06, 0.22, 8, 12),
  cloakDk, 0.1, 0.92, [-0.27, 1.88, 0.22], [0.5, 0.3, 0.2], [0.5, 1.2, 0.4]);
addMeshToScene('HoodRimR', new THREE.CapsuleGeometry(0.06, 0.22, 8, 12),
  cloakDk, 0.1, 0.92, [0.27, 1.88, 0.22], [0.5, -0.3, -0.2], [0.5, 1.2, 0.4]);

// ============================================================
// 4. FACE MASK - Chrome
// ============================================================
addMeshToScene('Mask', new THREE.SphereGeometry(0.25, 36, 32),
  mask, 1.0, 0.15, [0, 1.90, 0.22]);

addMeshToScene('FaceFront', new THREE.SphereGeometry(0.21, 28, 24),
  C('#b5b5b5'), 1.0, 0.12, [0, 1.87, 0.35], [0,0,0], [1.08, 0.92, 0.38]);

// Brow
addMeshToScene('Brow', new THREE.CapsuleGeometry(0.032, 0.14, 8, 12),
  mask, 1.0, 0.15, [0, 1.98, 0.38], [0, 0, Math.PI/2], [1, 1, 0.5]);

// Eye sockets
addMeshToScene('EyeL', new THREE.SphereGeometry(0.042, 14, 12),
  maskDk, 0.95, 0.25, [-0.078, 1.94, 0.42], [0,0,0], [1.35, 0.5, 0.3]);
addMeshToScene('EyeR', new THREE.SphereGeometry(0.042, 14, 12),
  maskDk, 0.95, 0.25, [0.078, 1.94, 0.42], [0,0,0], [1.35, 0.5, 0.3]);

// Eye glints
addMeshToScene('EyeGlintL', new THREE.SphereGeometry(0.022, 10, 8),
  C('#555555'), 1.0, 0.08, [-0.078, 1.945, 0.44], [0,0,0], [0.6, 0.25, 0.15]);
addMeshToScene('EyeGlintR', new THREE.SphereGeometry(0.022, 10, 8),
  C('#555555'), 1.0, 0.08, [0.078, 1.945, 0.44], [0,0,0], [0.6, 0.25, 0.15]);

// Nose
addMeshToScene('NoseBridge', new THREE.CapsuleGeometry(0.024, 0.08, 8, 10),
  C('#bbbbbb'), 1.0, 0.13, [0, 1.9, 0.44], [0.25, 0, 0], [0.45, 1.0, 0.35]);
addMeshToScene('NoseTip', new THREE.SphereGeometry(0.03, 14, 12),
  C('#aaaaaa'), 1.0, 0.18, [0, 1.855, 0.46]);
addMeshToScene('NostrilL', new THREE.SphereGeometry(0.013, 8, 6),
  maskDk, 0.95, 0.25, [-0.019, 1.845, 0.455], [0,0,0], [0.7, 0.4, 0.3]);
addMeshToScene('NostrilR', new THREE.SphereGeometry(0.013, 8, 6),
  maskDk, 0.95, 0.25, [0.019, 1.845, 0.455], [0,0,0], [0.7, 0.4, 0.3]);

// Lips
addMeshToScene('UpperLip', new THREE.CapsuleGeometry(0.018, 0.065, 8, 10),
  C('#888888'), 0.95, 0.22, [0, 1.81, 0.42], [0, 0, Math.PI/2], [1, 1, 0.3]);
addMeshToScene('LowerLip', new THREE.CapsuleGeometry(0.016, 0.045, 8, 8),
  C('#999999'), 0.95, 0.2, [0, 1.795, 0.41], [0, 0, Math.PI/2], [0.9, 1, 0.3]);

// Chin + Jaw
addMeshToScene('Chin', new THREE.SphereGeometry(0.07, 16, 12),
  C('#b0b0b0'), 1.0, 0.18, [0, 1.74, 0.34], [0,0,0], [0.78, 0.55, 0.5]);
addMeshToScene('JawL', new THREE.SphereGeometry(0.055, 12, 10),
  C('#aaaaaa'), 1.0, 0.2, [-0.11, 1.78, 0.28], [0,0,0], [0.5, 0.65, 0.5]);
addMeshToScene('JawR', new THREE.SphereGeometry(0.055, 12, 10),
  C('#aaaaaa'), 1.0, 0.2, [0.11, 1.78, 0.28], [0,0,0], [0.5, 0.65, 0.5]);
addMeshToScene('CheekL', new THREE.SphereGeometry(0.045, 12, 10),
  mask, 1.0, 0.15, [-0.13, 1.88, 0.35], [0,0,0], [0.6, 0.4, 0.3]);
addMeshToScene('CheekR', new THREE.SphereGeometry(0.045, 12, 10),
  mask, 1.0, 0.15, [0.13, 1.88, 0.35], [0,0,0], [0.6, 0.4, 0.3]);

// Neck
addMeshToScene('Neck', new THREE.CylinderGeometry(0.08, 0.1, 0.08, 16),
  cloakDk, 0.1, 0.92, [0, 1.88, 0.05]);

// ============================================================
// 5. SHOULDERS
// ============================================================
addMeshToScene('Shoulders', new THREE.SphereGeometry(0.34, 24, 18),
  cloak, 0.18, 0.82, [0, 1.65, 0], [0,0,0], [1.35, 0.45, 1.1]);
addMeshToScene('ShoulderPadL', new THREE.SphereGeometry(0.14, 16, 12),
  cloakFold, 0.22, 0.75, [-0.38, 1.65, 0], [0,0,0], [0.8, 0.6, 0.9]);
addMeshToScene('ShoulderPadR', new THREE.SphereGeometry(0.14, 16, 12),
  cloakFold, 0.22, 0.75, [0.38, 1.65, 0], [0,0,0], [0.8, 0.6, 0.9]);

// Collar
addMeshToScene('Collar', new THREE.TorusGeometry(0.17, 0.04, 14, 28, Math.PI * 1.3),
  cloakDk, 0.1, 0.92, [0, 1.74, 0.08], [-0.3, 0, 0]);

// ============================================================
// 6. BITCOIN MEDALLION
// ============================================================
addMeshToScene('Medallion', new THREE.CircleGeometry(0.14, 36),
  bronze, 0.85, 0.4, [0, 1.42, 0.44], [0,0,0], [1,1,1], [0.15, 0.09, 0.02]);
addMeshToScene('MedRim', new THREE.TorusGeometry(0.14, 0.016, 14, 36),
  bronzeRim, 0.9, 0.35, [0, 1.42, 0.438]);

// ₿ symbol
addMeshToScene('BtcStroke', new THREE.CapsuleGeometry(0.012, 0.11, 6, 10),
  btcOrange, 0.7, 0.25, [0, 1.42, 0.445], [0,0,0], [1,1,1], [0.97, 0.57, 0.1]);
addMeshToScene('BtcUpper', new THREE.SphereGeometry(0.042, 12, 10),
  btcOrange, 0.7, 0.25, [0.022, 1.455, 0.445], [0,0,0], [0.85, 0.55, 0.25], [0.97, 0.57, 0.1]);
addMeshToScene('BtcLower', new THREE.SphereGeometry(0.042, 12, 10),
  btcOrange, 0.7, 0.25, [0.022, 1.385, 0.445], [0,0,0], [0.95, 0.6, 0.25], [0.97, 0.57, 0.1]);
addMeshToScene('BtcSerifT', new THREE.CapsuleGeometry(0.007, 0.02, 4, 6),
  btcOrange, 0.7, 0.25, [0, 1.49, 0.445], [0, 0, Math.PI/2], [1,1,1], [0.97, 0.57, 0.1]);
addMeshToScene('BtcSerifB', new THREE.CapsuleGeometry(0.007, 0.02, 4, 6),
  btcOrange, 0.7, 0.25, [0, 1.35, 0.445], [0, 0, Math.PI/2], [1,1,1], [0.97, 0.57, 0.1]);

// ============================================================
// 7. ARMS
// ============================================================
function addArm(side, prefix) {
  const x = side * 0.42;
  // Upper arm
  addMeshToScene(`${prefix}Upper`, new THREE.CapsuleGeometry(0.09, 0.24, 10, 14),
    cloak, 0.18, 0.82, [x, 1.42, 0]);
  // Sleeve fold
  addMeshToScene(`${prefix}Fold`, new THREE.CapsuleGeometry(0.013, 0.2, 4, 8),
    cloakDk, 0.1, 0.92, [x + side * -0.04, 1.46, 0.05]);
  // Forearm
  addMeshToScene(`${prefix}Fore`, new THREE.CapsuleGeometry(0.078, 0.22, 10, 14),
    cloak, 0.18, 0.82, [x, 1.18, 0]);
  // Forearm fold
  addMeshToScene(`${prefix}Fold2`, new THREE.CapsuleGeometry(0.013, 0.15, 4, 8),
    cloakFold, 0.22, 0.75, [x + side * 0.03, 1.22, 0.04]);
  // Cuff
  addMeshToScene(`${prefix}Cuff`, new THREE.CylinderGeometry(0.068, 0.08, 0.06, 16),
    cloakDk, 0.1, 0.92, [x, 1.04, 0]);
  // Hand
  addMeshToScene(`${prefix}Hand`, new THREE.SphereGeometry(0.048, 14, 12),
    mask, 1.0, 0.15, [x, 0.98, 0.01]);
  // Fingers
  addMeshToScene(`${prefix}Fingers`, new THREE.SphereGeometry(0.032, 10, 8),
    C('#b0b0b0'), 1.0, 0.2, [x, 0.94, 0.02], [0,0,0], [0.8, 0.6, 0.5]);
}
addArm(-1, 'ArmL_');
addArm(1, 'ArmR_');

// ============================================================
// 8. LEGS
// ============================================================
function addLeg(side, prefix) {
  const x = side * 0.13;
  addMeshToScene(`${prefix}Upper`, new THREE.CapsuleGeometry(0.068, 0.18, 8, 12),
    cloakDk, 0.15, 0.85, [x, 0.04, 0]);
  addMeshToScene(`${prefix}Boot`, new THREE.CapsuleGeometry(0.058, 0.05, 8, 12),
    boot, 0.35, 0.65, [x, -0.1, 0.04], [0,0,0], [1.0, 0.55, 1.5]);
}
addLeg(-1, 'LegL_');
addLeg(1, 'LegR_');

// ============================================================
// EXPORT
// ============================================================
const io = new NodeIO();
const glb = await io.writeBinary(doc);
writeFileSync('public/models/satoshi.glb', glb);
console.log(`✅ Exported satoshi.glb (${(glb.byteLength / 1024).toFixed(1)} KB)`);
