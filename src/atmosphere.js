import * as THREE from 'three';

const FOG_COLOR = 0x536260;

export function createAtmosphere(scene, renderer) {
  const previousBackground = scene.background;
  const previousFog = scene.fog;
  const baseFogColor = new THREE.Color(FOG_COLOR);
  const driftColor = new THREE.Color();

  scene.background = baseFogColor.clone();
  scene.fog = new THREE.Fog(FOG_COLOR, 20, 72);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const hemisphere = new THREE.HemisphereLight(0x80959d, 0x25281f, 1.15);
  const sun = new THREE.DirectionalLight(0xe1a66f, 2.15);
  sun.position.set(-22, 24, 14);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  scene.add(hemisphere, sun);

  return {
    update(elapsed) {
      const lightnessDrift = Math.sin(elapsed * 0.08) * 0.006;
      driftColor.copy(baseFogColor).offsetHSL(0, 0, lightnessDrift);
      scene.fog.color.copy(driftColor);
    },
    dispose() {
      scene.remove(hemisphere, sun);
      sun.shadow.map?.dispose();
      scene.background = previousBackground;
      scene.fog = previousFog;
    },
  };
}
