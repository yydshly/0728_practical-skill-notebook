import * as THREE from 'three';
import { VILLAGE_LAYOUT } from './level-data.js';
import { createMaterials } from './world/materials.js';
import { buildStructure } from './world/buildings.js';
import { addLantern, addPropCluster } from './world/props.js';

function flatPolygon(points, material, y = 0.012) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], points[0][1]);
  for (const [x, z] of points.slice(1)) shape.lineTo(x, z);
  shape.closePath();
  const road = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
  road.rotation.x = Math.PI / 2;
  road.position.y = y;
  road.receiveShadow = true;
  return road;
}

function runtimeAnchors(anchorDefinitions) {
  return Object.fromEntries(
    Object.entries(anchorDefinitions).map(([id, position]) => [id, new THREE.Vector3(...position)]),
  );
}

function runtimeZones(zoneDefinitions) {
  return Object.fromEntries(
    Object.entries(zoneDefinitions).map(([id, zone]) => [
      id,
      { id, center: new THREE.Vector3(...zone.center), radius: zone.radius },
    ]),
  );
}

function runtimePropColliders(clusterDefinitions) {
  return clusterDefinitions.flatMap((cluster) => {
    if (!cluster.collider) return [];
    return [{
      ...cluster.collider,
      x: cluster.x + (cluster.collider.offsetX ?? 0),
      z: cluster.z + (cluster.collider.offsetZ ?? 0),
    }];
  });
}

export function createVillage(scene) {
  const materials = createMaterials();
  const width = VILLAGE_LAYOUT.bounds.maxX - VILLAGE_LAYOUT.bounds.minX;
  const depth = VILLAGE_LAYOUT.bounds.maxZ - VILLAGE_LAYOUT.bounds.minZ;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), materials.soil);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  scene.add(flatPolygon(VILLAGE_LAYOUT.roadPolygon, materials.road));

  const cameraOccluders = [];
  for (const definition of VILLAGE_LAYOUT.buildings) {
    const { occluders } = buildStructure(scene, definition, materials);
    cameraOccluders.push(...occluders);
  }

  for (const cluster of VILLAGE_LAYOUT.propClusters) {
    addPropCluster(scene, cluster, materials);
  }

  for (const lightDefinition of VILLAGE_LAYOUT.lights) {
    addLantern(scene, lightDefinition, materials);
  }

  const anchors = runtimeAnchors(VILLAGE_LAYOUT.anchors);
  const colliders = [
    ...VILLAGE_LAYOUT.colliders.map((collider) => ({ ...collider })),
    ...runtimePropColliders(VILLAGE_LAYOUT.propClusters),
  ];

  scene.updateMatrixWorld(true);

  return {
    anchors,
    bounds: { ...VILLAGE_LAYOUT.bounds },
    zones: runtimeZones(VILLAGE_LAYOUT.zones),
    colliders,
    navNodes: VILLAGE_LAYOUT.navNodes.map((position) => new THREE.Vector3(...position)),
    cameraOccluders,
    interactionAnchors: [
      {
        id: 'radio',
        label: '调查收音机',
        kind: 'radio',
        position: anchors.radio,
      },
      {
        id: 'neighbour',
        label: '询问邻居',
        kind: 'neighbour',
        position: anchors.neighbour,
      },
      {
        id: 'flashlight',
        label: '拾取手电筒',
        kind: 'flashlight',
        position: anchors.flashlight,
      },
    ],
  };
}
