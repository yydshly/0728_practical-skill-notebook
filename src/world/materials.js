import * as THREE from 'three';

function standard(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function createMaterials() {
  return {
    soil: standard(0x34382f, 1),
    road: new THREE.MeshStandardMaterial({ color: 0x655e4d, roughness: 0.98, side: THREE.DoubleSide }),
    plaster: standard(0x9b8c6e, 0.94),
    plasterDark: standard(0x6f6756, 0.96),
    roof: standard(0x303b3a, 0.86),
    roofEdge: standard(0x202927, 0.9),
    wood: standard(0x493126, 0.92),
    foliage: standard(0x263a31, 1),
    straw: standard(0x8d7448, 1),
    metal: standard(0x454a46, 0.62, 0.18),
    lanternGlass: new THREE.MeshStandardMaterial({
      color: 0xe0a25c,
      emissive: 0xb86728,
      emissiveIntensity: 1.8,
      roughness: 0.38,
    }),
    windowGlow: new THREE.MeshStandardMaterial({
      color: 0xe6b879,
      emissive: 0xc07732,
      emissiveIntensity: 1.35,
      roughness: 0.55,
    }),
    hallGlow: new THREE.MeshStandardMaterial({
      color: 0x6f241d,
      emissive: 0x5e100c,
      emissiveIntensity: 1.45,
      roughness: 0.62,
    }),
    coldGlow: new THREE.MeshStandardMaterial({
      color: 0xa5c8c4,
      emissive: 0x4b8c8a,
      emissiveIntensity: 1.7,
      roughness: 0.42,
    }),
  };
}
