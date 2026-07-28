# Rural Mutation Escape Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将《雾村：逃离》从镜头穿地、缺少层次的白盒原型升级为可完整游玩的中式乡村民俗恐怖序章。

**Architecture:** 保留现有 Three.js 单场景游戏循环与故事状态，将相机数学、关卡数据、环境建造、角色外观、碰撞交互和界面氛围拆成独立模块。纯数据与纯计算先由 Node 测试覆盖，浏览器冒烟测试覆盖系统集成，最终使用真实浏览器验证出生、异常目击和南门三个关键画面。

**Tech Stack:** Three.js 0.180、Vite 7、原生 ES Modules、Node `node:test`、Playwright 1.61、CSS

## Global Constraints

- 所有移动、碰撞、导航、交互和故事区域保持在 `y = 0` 的单一可玩平面。
- 默认第三人称，`C` 切换第一人称；切换不得改变玩家位置、故事状态或交互距离。
- 不新增攻击、武器、物品栏、联网、开放世界或新的敌人类型。
- 局部光必须对应可见发光物；远景高度只作不可通行装饰。
- 桌面验证视口为 `1280×720` 和 `1440×900`。
- 不要求独立显卡；渲染器像素比上限为 `1.5`，动态阴影仅用于关键对象。
- 最终浏览器证据只保留出生画面、主路异常画面和南门画面。

## Planned File Structure

- `src/camera-math.js`: 相机目标位置与最低高度的纯计算。
- `src/camera.js`: 第三/第一人称状态、即时初始化、平滑跟随与遮挡拉近。
- `src/level-data.js`: 稳定区域、锚点、道路多边形、建筑和碰撞数据。
- `src/world/materials.js`: 共享乡村材质。
- `src/world/buildings.js`: 模块化泥墙住宅、祠堂、粮仓和南门。
- `src/world/props.js`: 栅栏、作物、水井、柴堆、电线杆、灯笼和雾中远景。
- `src/level.js`: 根据关卡数据组装视觉层、碰撞层、导航层和灯光层。
- `src/character-motion.js`: 步态与角色类型参数的纯计算。
- `src/characters.js`: 可复用程序化拟人角色层级与姿态。
- `src/player.js`: 玩家移动、碰撞和角色动画适配。
- `src/collision.js`: 圆形玩家对 AABB 墙体的平面移动解析。
- `src/interactions.js`: 近距离交互候选选择。
- `src/ui.js`: 章节标题、目标、字幕、交互提示和界面阶段。
- `src/atmosphere.js`: 天光、暮色方向光、雾与可见局部光配置。
- `src/main.js`: 组合各模块并保留最小游戏循环。
- `index.html`, `src/style.css`: 收敛后的空间舞台界面。
- `tests/unit.mjs`: 相机、关卡数据、角色动作、碰撞和交互的纯逻辑测试。
- `tests/smoke.mjs`: 浏览器集成、故事路线、视角和 HUD 冒烟测试。

---

### Task 1: Camera Foundation and Test Harness

**Files:**
- Create: `rural-mutation-escape/src/camera-math.js`
- Create: `rural-mutation-escape/tests/unit.mjs`
- Modify: `rural-mutation-escape/src/camera.js`
- Modify: `rural-mutation-escape/src/main.js`
- Modify: `rural-mutation-escape/package.json`

**Interfaces:**
- Produces: `computeThirdPersonPose(options) -> { target: number[], position: number[] }`
- Produces: `createCameraController(camera, player, options)`, where `options.occluders` is `THREE.Object3D[]` and `options.groundY` is a number.
- Produces: controller methods `snap()`, `update(dt)`, `rotate(dx, dy)`, `setMode(mode)`, `toggle()`.

- [ ] **Step 1: Add the unit-test command and write failing camera tests**

Add `"test:unit": "node --test tests/unit.mjs"` and change `"test"` to `"npm run test:unit && node tests/smoke.mjs"`.

Create `tests/unit.mjs` with:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { computeThirdPersonPose } from '../src/camera-math.js';

test('third-person pose starts above ground and behind its target', () => {
  const pose = computeThirdPersonPose({
    player: [-8, 0, 25],
    yaw: Math.PI,
    pitch: -0.18,
    distance: 5.6,
    groundY: 0,
  });
  assert.ok(pose.position[1] >= 2.4);
  assert.ok(Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[2] - pose.target[2],
  ) >= 5);
  assert.deepEqual(pose.target, [-8, 1.45, 25]);
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run: `npm run test:unit`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/camera-math.js`.

- [ ] **Step 3: Implement deterministic camera pose math**

Create `src/camera-math.js`:

```js
export function computeThirdPersonPose({
  player,
  yaw,
  pitch,
  distance,
  groundY,
}) {
  const target = [player[0], player[1] + 1.45, player[2]];
  const horizontal = Math.cos(pitch) * distance;
  const position = [
    target[0] - Math.sin(yaw) * horizontal,
    Math.max(groundY + 0.65, target[1] - Math.sin(pitch) * distance + 0.6),
    target[2] - Math.cos(yaw) * horizontal,
  ];
  return { target, position };
}
```

- [ ] **Step 4: Refactor the controller to snap before the first render and pull in on occlusion**

In `camera.js`, construct `THREE.Raycaster`, copy the pose into reusable vectors, and implement:

```js
function snap() {
  calculateDesired();
  camera.position.copy(desired);
  camera.lookAt(target);
  initialized = true;
}

function applyOcclusion() {
  rayDirection.subVectors(desired, target);
  const desiredDistance = rayDirection.length();
  rayDirection.normalize();
  raycaster.set(target, rayDirection);
  raycaster.far = desiredDistance;
  const hit = raycaster.intersectObjects(occluders, false)[0];
  if (hit) desired.copy(target).addScaledVector(rayDirection, Math.max(0.75, hit.distance - 0.25));
  desired.y = Math.max(desired.y, groundY + 0.65);
}

function update(dt = 1 / 60) {
  if (!initialized) return snap();
  calculateDesired();
  applyOcclusion();
  const alpha = 1 - Math.exp(-8 * dt);
  camera.position.lerp(desired, alpha);
  camera.lookAt(target);
}
```

Pass `village.cameraOccluders` from `main.js`, call `cameraController.snap()` before `requestAnimationFrame`, and pass `dt` to every later `update`.

- [ ] **Step 5: Run camera tests and the existing smoke test**

Run: `npm test`

Expected: unit camera test PASS; smoke test PASS with no runtime exception.

- [ ] **Step 6: Commit the camera slice**

```powershell
git add rural-mutation-escape/package.json rural-mutation-escape/tests/unit.mjs rural-mutation-escape/src/camera-math.js rural-mutation-escape/src/camera.js rural-mutation-escape/src/main.js
git commit -m "fix: stabilize rural escape camera"
```

---

### Task 2: Authored Village Layout and Modular Rural Environment

**Files:**
- Create: `rural-mutation-escape/src/level-data.js`
- Create: `rural-mutation-escape/src/world/materials.js`
- Create: `rural-mutation-escape/src/world/buildings.js`
- Create: `rural-mutation-escape/src/world/props.js`
- Modify: `rural-mutation-escape/src/level.js`
- Modify: `rural-mutation-escape/tests/unit.mjs`

**Interfaces:**
- Produces: `VILLAGE_LAYOUT` with `anchors`, `zones`, `roadPolygon`, `buildings`, `colliders`, `propClusters`, and `navNodes`.
- Produces: `validateVillageLayout(layout) -> string[]`.
- Produces: `createMaterials() -> Record<string, THREE.Material>`.
- Produces: `buildStructure(scene, definition, materials) -> { root, occluders }`.
- Produces: `addPropCluster(scene, cluster, materials) -> THREE.Object3D[]`.
- `createVillage(scene)` continues returning `anchors`, `bounds`, `zones`, `colliders`, `navNodes`, plus `cameraOccluders` and `interactionAnchors`.

- [ ] **Step 1: Write failing layout-contract tests**

Append to `tests/unit.mjs`:

```js
import { VILLAGE_LAYOUT, validateVillageLayout } from '../src/level-data.js';

test('village layout defines readable zones and collision separately', () => {
  assert.deepEqual(
    Object.keys(VILLAGE_LAYOUT.zones),
    ['home', 'courtyard', 'main_road', 'granary', 'south_gate_exit'],
  );
  assert.equal(VILLAGE_LAYOUT.roadPolygon.length, 12);
  assert.ok(VILLAGE_LAYOUT.buildings.length >= 7);
  assert.ok(VILLAGE_LAYOUT.colliders.length >= 10);
  assert.deepEqual(validateVillageLayout(VILLAGE_LAYOUT), []);
});

test('every local light has a visible source id', () => {
  assert.ok(VILLAGE_LAYOUT.lights.every((light) => Boolean(light.sourceId)));
});
```

- [ ] **Step 2: Run the layout tests and verify RED**

Run: `npm run test:unit`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/level-data.js`.

- [ ] **Step 3: Add stable level data and validation**

Create `level-data.js` with plain arrays and no Three.js objects:

```js
export const VILLAGE_LAYOUT = {
  bounds: { minX: -38, maxX: 38, minZ: -39, maxZ: 39 },
  anchors: {
    player_home: [-8, 0, 26],
    radio: [-11.2, 0, 26.8],
    courtyard: [8, 0, 17],
    neighbour: [10.4, 0, 18.4],
    sighting: [-1, 0, 3],
    granary: [11, 0, -10],
    flashlight: [13.2, 0, -8.7],
    south_gate: [0, 0, -35],
  },
  zones: {
    home: { center: [-8, 0, 26], radius: 5 },
    courtyard: { center: [8, 0, 17], radius: 5 },
    main_road: { center: [-1, 0, 3], radius: 8 },
    granary: { center: [11, 0, -10], radius: 6 },
    south_gate_exit: { center: [0, 0, -35], radius: 4.5 },
  },
  roadPolygon: [
    [-5.5, 39], [5.5, 39], [6.2, 25], [4.8, 14], [6.5, 2], [5.2, -10],
    [6, -39], [-6, -39], [-5.2, -12], [-6.4, 0], [-4.8, 15], [-6.2, 27],
  ],
  buildings: [
    { id: 'protagonist_home', kind: 'house', x: -12, z: 28, width: 10, depth: 8, rotation: 0.02 },
    { id: 'courtyard_house', kind: 'house', x: 13, z: 19, width: 10, depth: 9, rotation: -0.04 },
    { id: 'ancestral_hall', kind: 'hall', x: -13, z: 3, width: 12, depth: 8, rotation: 0.03 },
    { id: 'grain_barn', kind: 'barn', x: 15, z: -10, width: 10, depth: 9, rotation: -0.03 },
    { id: 'abandoned_home', kind: 'house', x: -14, z: -21, width: 9, depth: 8, rotation: 0.06 },
    { id: 'north_shed', kind: 'shed', x: 15, z: 32, width: 7, depth: 5, rotation: -0.08 },
    { id: 'south_gate', kind: 'gate', x: 0, z: -36, width: 9, depth: 2, rotation: 0 },
  ],
  colliders: [
    { id: 'home_body', x: -12, z: 28, halfX: 5.2, halfZ: 4.2 },
    { id: 'courtyard_body', x: 13, z: 19, halfX: 5.2, halfZ: 4.7 },
    { id: 'hall_body', x: -13, z: 3, halfX: 6.2, halfZ: 4.2 },
    { id: 'barn_body', x: 15, z: -10, halfX: 5.2, halfZ: 4.7 },
    { id: 'abandoned_body', x: -14, z: -21, halfX: 4.7, halfZ: 4.2 },
    { id: 'north_shed_body', x: 15, z: 32, halfX: 3.7, halfZ: 2.7 },
    { id: 'west_wall_north', x: -20, z: 22, halfX: 0.3, halfZ: 8 },
    { id: 'east_wall_north', x: 20, z: 11, halfX: 0.3, halfZ: 8 },
    { id: 'west_wall_south', x: -21, z: -13, halfX: 0.3, halfZ: 7 },
    { id: 'east_wall_south', x: 21, z: -25, halfX: 0.3, halfZ: 7 },
  ],
  propClusters: [
    { id: 'home_life', kind: 'home', x: -7, z: 29 },
    { id: 'courtyard_crops', kind: 'crops', x: 18, z: 12 },
    { id: 'hall_forecourt', kind: 'well', x: -7, z: 8 },
    { id: 'barn_storage', kind: 'storage', x: 10, z: -14 },
    { id: 'gate_blockade', kind: 'blockade', x: -4, z: -32 },
  ],
  lights: [
    { id: 'home_window', sourceId: 'home_window_mesh', x: -7.3, y: 1.6, z: 28, color: 0xe1a461 },
    { id: 'road_lantern_a', sourceId: 'road_lantern_a_mesh', x: -4.6, y: 2.4, z: 18, color: 0xd68b47 },
    { id: 'road_lantern_b', sourceId: 'road_lantern_b_mesh', x: 4.8, y: 2.4, z: -5, color: 0xd68b47 },
  ],
  navNodes: [[8, 0, 17], [-1, 0, 3], [11, 0, -10], [0, 0, -35]],
};

export function validateVillageLayout(layout) {
  const errors = [];
  const anchorIds = new Set(Object.keys(layout.anchors));
  for (const light of layout.lights) if (!light.sourceId) errors.push(`light:${light.id}:missing-source`);
  for (const id of ['player_home', 'courtyard', 'sighting', 'granary', 'south_gate']) {
    if (!anchorIds.has(id)) errors.push(`anchor:${id}:missing`);
  }
  return errors;
}
```

- [ ] **Step 4: Build shared materials and modular structures**

Create `world/materials.js`:

```js
import * as THREE from 'three';

function standard(color, roughness = 0.9, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function createMaterials() {
  return {
    soil: standard(0x34382f, 1),
    road: new THREE.MeshStandardMaterial({
      color: 0x655e4d,
      roughness: 0.98,
      side: THREE.DoubleSide,
    }),
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
  };
}
```

In `world/buildings.js`, construct each building from a wall body, raised foundation, front wood frame, door, two windows, roof slopes and roof ridge. Use:

```js
import * as THREE from 'three';

function makeMesh(geometry, material, castShadow = true) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  return mesh;
}

function addRoof(group, width, depth, materials, roofHeight = 1.45) {
  const slopeLength = Math.hypot(depth / 2 + 0.5, roofHeight);
  for (const side of [-1, 1]) {
    const roof = makeMesh(
      new THREE.BoxGeometry(width + 0.7, 0.18, slopeLength),
      materials.roof,
    );
    roof.position.set(0, 3.05, side * depth * 0.22);
    roof.rotation.x = side * Math.atan2(roofHeight, depth / 2 + 0.5);
    group.add(roof);
  }
}

export function buildStructure(scene, definition, materials) {
  const root = new THREE.Group();
  root.name = definition.id;
  root.position.set(definition.x, 0, definition.z);
  root.rotation.y = definition.rotation;

  const wallHeight = definition.kind === 'hall' ? 3.5 : 3;
  const walls = makeMesh(
    new THREE.BoxGeometry(definition.width, wallHeight, definition.depth),
    definition.kind === 'barn' ? materials.plasterDark : materials.plaster,
  );
  walls.position.y = wallHeight / 2 + 0.18;
  root.add(walls);

  const foundation = makeMesh(
    new THREE.BoxGeometry(definition.width + 0.35, 0.36, definition.depth + 0.35),
    materials.plasterDark,
    false,
  );
  foundation.position.y = 0.18;
  root.add(foundation);

  const door = makeMesh(new THREE.BoxGeometry(1.1, 1.95, 0.16), materials.wood);
  door.position.set(0, 1.16, definition.depth / 2 + 0.09);
  root.add(door);

  for (const x of [-definition.width * 0.28, definition.width * 0.28]) {
    const window = makeMesh(new THREE.BoxGeometry(1.1, 0.82, 0.12), materials.windowGlow, false);
    window.position.set(x, 1.65, definition.depth / 2 + 0.11);
    root.add(window);
  }

  addRoof(root, definition.width, definition.depth, materials, definition.kind === 'hall' ? 1.8 : 1.35);
  scene.add(root);
  return { root, occluders: [walls, ...root.children.filter((child) => child.material === materials.roof)] };
}
```

Return only wall and roof meshes in `occluders`; doors, windows and small trim remain visual-only.

- [ ] **Step 5: Build rural props and an irregular road**

In `world/props.js`, use shared primitive helpers and an explicit cluster dispatcher:

```js
import * as THREE from 'three';

function box(group, size, position, material, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addFence(group, materials, length = 6) {
  for (const x of [-length / 2, 0, length / 2]) box(group, [0.14, 1.15, 0.14], [x, 0.58, 0], materials.wood);
  for (const y of [0.42, 0.9]) box(group, [length, 0.1, 0.12], [0, y, 0], materials.wood);
}

function addCropRows(group, materials) {
  for (let row = -2; row <= 2; row += 1) {
    for (let plant = -3; plant <= 3; plant += 1) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.2, 5), materials.straw);
      stem.position.set(row * 0.55, 0.6, plant * 0.62);
      group.add(stem);
    }
  }
}

function addWell(group, materials) {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.08, 0.75, 12, 1, true), materials.plasterDark);
  ring.position.y = 0.38;
  ring.castShadow = true;
  group.add(ring);
  box(group, [2.5, 0.15, 0.18], [0, 2, 0], materials.wood);
  box(group, [0.14, 2.5, 0.14], [-1.05, 1.25, 0], materials.wood);
  box(group, [0.14, 2.5, 0.14], [1.05, 1.25, 0], materials.wood);
}

function addStorage(group, materials) {
  for (let index = 0; index < 7; index += 1) {
    box(group, [0.8, 0.4, 0.5], [(index % 3) * 0.7, 0.22 + Math.floor(index / 3) * 0.4, 0], materials.straw);
  }
}

function addBlockade(group, materials) {
  box(group, [5.5, 0.25, 0.35], [0, 0.55, 0], materials.wood);
  box(group, [0.25, 1.4, 0.25], [-2.1, 0.7, 0], materials.wood);
  box(group, [0.25, 1.4, 0.25], [2.1, 0.7, 0], materials.wood);
  box(group, [2.2, 0.65, 1.2], [2.6, 0.34, -0.8], materials.metal);
}

export function addPropCluster(scene, cluster, materials) {
  const root = new THREE.Group();
  root.name = cluster.id;
  root.position.set(cluster.x, 0, cluster.z);
  if (cluster.kind === 'crops') addCropRows(root, materials);
  if (cluster.kind === 'well') addWell(root, materials);
  if (cluster.kind === 'storage' || cluster.kind === 'home') addStorage(root, materials);
  if (cluster.kind === 'blockade') addBlockade(root, materials);
  if (cluster.kind === 'home') addFence(root, materials, 5);
  scene.add(root);
  return root.children;
}
```

Add these top-level exports; the lantern mesh and point light share the same authored color:

```js
export function addUtilityPole(scene, { x, z }, materials) {
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.8, 7), materials.wood);
  pole.position.y = 2.4;
  pole.castShadow = true;
  root.add(pole);
  box(root, [2.2, 0.13, 0.13], [0, 4.35, 0], materials.wood);
  for (const offset of [-0.78, 0.78]) {
    const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.22, 6), materials.metal);
    insulator.position.set(offset, 4.55, 0);
    root.add(insulator);
  }
  scene.add(root);
  return root;
}

export function addLantern(scene, lightDefinition, materials) {
  const root = new THREE.Group();
  root.position.set(lightDefinition.x, 0, lightDefinition.z);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.6, 7), materials.wood);
  post.position.y = 1.3;
  const source = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), materials.lanternGlass);
  source.name = lightDefinition.sourceId;
  source.position.y = lightDefinition.y;
  const light = new THREE.PointLight(lightDefinition.color, 4.2, 9, 2);
  light.position.y = lightDefinition.y;
  root.add(post, source, light);
  scene.add(root);
  return { root, source, light };
}
```

Only fences and the gate blockade add simplified collider definitions in `level.js`.

In `level.js`, build the road with:

```js
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
```

Convert all plain coordinate arrays to `THREE.Vector3` only when returning runtime `anchors`, `zones`, and `navNodes`. Remove the colored debug markers.

- [ ] **Step 6: Run unit and browser tests**

Run: `npm test`

Expected: layout tests PASS; existing story and movement smoke checks remain PASS.

- [ ] **Step 7: Commit the environment slice**

```powershell
git add rural-mutation-escape/src/level-data.js rural-mutation-escape/src/world rural-mutation-escape/src/level.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: rebuild the rural village environment"
```

---

### Task 3: Readable Character Rigs and Procedural Motion

**Files:**
- Create: `rural-mutation-escape/src/character-motion.js`
- Modify: `rural-mutation-escape/src/characters.js`
- Modify: `rural-mutation-escape/src/player.js`
- Modify: `rural-mutation-escape/src/pursuer.js`
- Modify: `rural-mutation-escape/tests/unit.mjs`

**Interfaces:**
- Produces: `getCharacterProfile(kind) -> { scale, lean, armLength, colors }`.
- Produces: `getGaitPose(time, speed, kind) -> { armSwing, legSwing, bob, lean }`.
- Produces: `createHumanoid(scene, position, options) -> { root, setMotion(speed, elapsed), setPose(pose) }`.
- `createResident` and `createMutant` return the same rig object; `player.object` and `pursuer.object` expose `rig.root`.

- [ ] **Step 1: Write failing profile and gait tests**

Append:

```js
import { getCharacterProfile, getGaitPose } from '../src/character-motion.js';

test('mutant silhouette is asymmetric and more forward-leaning', () => {
  const human = getCharacterProfile('player');
  const mutant = getCharacterProfile('mutant');
  assert.ok(mutant.lean > human.lean);
  assert.notEqual(mutant.leftArmLength, mutant.rightArmLength);
});

test('walking gait moves opposite arms and legs', () => {
  const pose = getGaitPose(0.25, 3.6, 'player');
  assert.equal(Math.sign(pose.leftArm), -Math.sign(pose.rightArm));
  assert.equal(Math.sign(pose.leftLeg), -Math.sign(pose.rightLeg));
  assert.ok(Math.abs(pose.bob) <= 0.05);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `character-motion.js`.

- [ ] **Step 3: Implement pure character profiles and gait**

Create:

```js
const profiles = {
  player: {
    scale: 1, lean: 0.02, leftArmLength: 0.72, rightArmLength: 0.72,
    colors: { coat: 0x506755, trousers: 0x2d3630, skin: 0xb98568 },
  },
  resident: {
    scale: 0.96, lean: 0.14, leftArmLength: 0.68, rightArmLength: 0.68,
    colors: { coat: 0x765852, trousers: 0x403b39, skin: 0xb17f65 },
  },
  mutant: {
    scale: 1.08, lean: 0.34, leftArmLength: 0.92, rightArmLength: 0.76,
    colors: { coat: 0x4d4540, trousers: 0x292d29, skin: 0x819077 },
  },
};

export function getCharacterProfile(kind) {
  return structuredClone(profiles[kind] ?? profiles.resident);
}

export function getGaitPose(time, speed, kind) {
  const phase = time * (kind === 'mutant' ? 8.2 : 6.8);
  const amount = Math.min(speed / 3.6, 1) * (kind === 'mutant' ? 0.72 : 0.52);
  const swing = Math.sin(phase) * amount;
  return {
    leftArm: swing,
    rightArm: -swing,
    leftLeg: -swing,
    rightLeg: swing,
    bob: Math.abs(Math.cos(phase * 2)) * 0.035,
    lean: profiles[kind]?.lean ?? profiles.resident.lean,
  };
}
```

- [ ] **Step 4: Rebuild the humanoid as a named joint hierarchy**

In `characters.js`, create `hips`, `torso`, `head`, `leftShoulder`, `rightShoulder`, `leftHip`, and `rightHip` groups. Add upper/lower limb meshes beneath their joint groups. `setMotion()` applies `getGaitPose`; `setPose('hide')` bends torso, turns head toward the road, and raises forearms; `setPose('mutant')` applies the asymmetric profile.

Use `BoxGeometry` for shoes and coat hem, capsule limbs for arms and legs, a sphere head, and a separate hair mesh. Mark only body, head, coat and legs as shadow casters.

Use this hierarchy and motion mapping:

```js
const root = new THREE.Group();
const hips = new THREE.Group();
const torso = new THREE.Group();
const leftShoulder = new THREE.Group();
const rightShoulder = new THREE.Group();
const leftHip = new THREE.Group();
const rightHip = new THREE.Group();

hips.position.y = 0.92;
torso.position.y = 0.28;
leftShoulder.position.set(-0.38, 0.58, 0);
rightShoulder.position.set(0.38, 0.58, 0);
leftHip.position.set(-0.2, -0.12, 0);
rightHip.position.set(0.2, -0.12, 0);
root.add(hips);
hips.add(torso, leftHip, rightHip);
torso.add(leftShoulder, rightShoulder);

function setMotion(speed, elapsed) {
  const pose = getGaitPose(elapsed, speed, kind);
  leftShoulder.rotation.x = pose.leftArm;
  rightShoulder.rotation.x = pose.rightArm;
  leftHip.rotation.x = pose.leftLeg;
  rightHip.rotation.x = pose.rightLeg;
  torso.rotation.x = pose.lean;
  hips.position.y = 0.92 + pose.bob;
}

function setPose(poseName) {
  torso.rotation.z = poseName === 'hide' ? -0.18 : 0;
  torso.rotation.x = poseName === 'mutant' ? profile.lean : torso.rotation.x;
  root.rotation.y = poseName === 'hide' ? Math.PI * 0.65 : root.rotation.y;
}
```

- [ ] **Step 5: Connect animation to player and pursuer movement**

Track `elapsed` and actual planar speed. In `player.update`, call:

```js
const distance = move.lengthSq() === 0 ? 0 : speed * dt;
elapsed += dt;
rig.setMotion(distance / Math.max(dt, 0.0001), elapsed);
```

In `pursuer.update`, call `rig.setMotion(speed, elapsed)` while moving and `rig.setMotion(0, elapsed)` while idle. Keep the existing patrol/chase/lost state thresholds unchanged.

- [ ] **Step 6: Run all automated tests**

Run: `npm test`

Expected: character unit tests PASS; smoke test still observes player movement, camera switching, chase and chapter completion.

- [ ] **Step 7: Commit the character slice**

```powershell
git add rural-mutation-escape/src/character-motion.js rural-mutation-escape/src/characters.js rural-mutation-escape/src/player.js rural-mutation-escape/src/pursuer.js rural-mutation-escape/tests/unit.mjs
git commit -m "feat: add readable rural character rigs"
```

---

### Task 4: Atmosphere and Spatial HUD

**Files:**
- Create: `rural-mutation-escape/src/atmosphere.js`
- Create: `rural-mutation-escape/src/ui.js`
- Modify: `rural-mutation-escape/index.html`
- Modify: `rural-mutation-escape/src/style.css`
- Modify: `rural-mutation-escape/src/main.js`
- Modify: `rural-mutation-escape/tests/smoke.mjs`

**Interfaces:**
- Produces: `createAtmosphere(scene, renderer) -> { update(elapsed), dispose() }`.
- Produces: `createGameUi(elements) -> { setObjective, showSubtitle, showInteraction, completeIntro }`.
- Adds `window.__RURAL_ESCAPE__.completeIntroForTest()` for deterministic HUD verification.

- [ ] **Step 1: Write failing HUD integration assertions**

In `tests/smoke.mjs`, after checking the canvas height, add:

```js
await page.evaluate(() => window.__RURAL_ESCAPE__.completeIntroForTest());
const hudState = await page.evaluate(() => ({
  shellPhase: document.querySelector('.game-shell').dataset.uiPhase,
  titleHidden: document.querySelector('.title-lockup').getAttribute('aria-hidden'),
  interactionHidden: document.querySelector('#interaction').hidden,
}));
if (hudState.shellPhase !== 'playing') throw new Error(`Expected playing HUD, got ${hudState.shellPhase}`);
if (hudState.titleHidden !== 'true') throw new Error('Expected chapter title to leave the main view');
if (!hudState.interactionHidden) throw new Error('Expected interaction prompt to start hidden');
```

- [ ] **Step 2: Run the smoke test and verify RED**

Run: `node tests/smoke.mjs`

Expected: FAIL because `completeIntroForTest` and `.title-lockup` do not exist.

- [ ] **Step 3: Restructure the HUD markup**

Change `index.html` to:

```html
<main class="game-shell" data-ui-phase="intro" aria-label="雾村：逃离游戏画面">
  <canvas id="game" aria-label="游戏场景"></canvas>
  <div class="cinematic-grain" aria-hidden="true"></div>
  <section class="title-lockup" aria-live="polite">
    <p class="eyebrow">CHAPTER 01 · DUSK</p>
    <h1>雾村：逃离</h1>
  </section>
  <section class="mission-hud" aria-live="polite">
    <p class="mission-label">当前目标</p>
    <p id="objective">离开主角家，调查村里的异常。</p>
  </section>
  <p id="subtitle" class="subtitle">收音机在杂音里重复着一个陌生的名字。</p>
  <p id="interaction" class="interaction" hidden><kbd>E</kbd><span></span></p>
  <footer class="controls">WASD 移动 · Shift 奔跑 · 鼠标环顾 · C 切换视角</footer>
</main>
```

- [ ] **Step 4: Implement deterministic UI phases**

In `ui.js`, set the initial phase, schedule the intro completion, and expose a deterministic method:

```js
export function createGameUi({ shell, title, objective, subtitle, interaction }) {
  let subtitleTimer;
  function completeIntro() {
    shell.dataset.uiPhase = 'playing';
    title.setAttribute('aria-hidden', 'true');
  }
  function setObjective(text) { objective.textContent = text.replace(/^目标：/, ''); }
  function showSubtitle(text, duration = 4200) {
    clearTimeout(subtitleTimer);
    subtitle.textContent = text;
    subtitle.dataset.visible = 'true';
    subtitleTimer = setTimeout(() => { subtitle.dataset.visible = 'false'; }, duration);
  }
  function showInteraction(label) {
    interaction.hidden = !label;
    interaction.querySelector('span').textContent = label ?? '';
  }
  const introTimer = setTimeout(completeIntro, 2400);
  return {
    completeIntro() { clearTimeout(introTimer); completeIntro(); },
    setObjective,
    showSubtitle,
    showInteraction,
  };
}
```

Adapt `story.js` to use `setObjective` and `showSubtitle` rather than writing DOM nodes directly.

- [ ] **Step 5: Add motivated lighting and restrained cinematic CSS**

In `atmosphere.js`, set `scene.background` and `scene.fog` to `0x536260`, add a hemisphere light `(0x80959d, 0x25281f, 1.15)` and directional light `(0xe1a66f, 2.15)` at `(-22, 24, 14)`. Configure a `1024×1024` shadow map and update only subtle fog color drift.

In `style.css`:

- Keep the canvas full viewport.
- Position `.mission-hud` at top left with a maximum width of `24rem`.
- Fade and scale `.title-lockup` when `[data-ui-phase="playing"]`.
- Place `.subtitle` centered above the bottom safe area.
- Place `.interaction` above the subtitle and give `kbd` a warm outline.
- Add a pointer-events-none radial vignette and a low-opacity repeating noise gradient.
- At widths below `700px`, reduce type sizes and stack controls without covering the center.

Use these core rules:

```css
.game-shell {
  min-height: 100vh;
  overflow: hidden;
  position: relative;
  background: #18201e;
}

#game { display: block; width: 100%; height: 100vh; }

.game-shell::after {
  background: radial-gradient(circle at 50% 42%, transparent 38%, rgba(7, 10, 9, .72) 118%);
  content: "";
  inset: 0;
  pointer-events: none;
  position: absolute;
}

.cinematic-grain {
  background-image:
    repeating-linear-gradient(0deg, rgba(255,255,255,.018) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0,0,0,.02) 0 1px, transparent 1px 4px);
  inset: 0;
  mix-blend-mode: soft-light;
  opacity: .28;
  pointer-events: none;
  position: absolute;
}

.title-lockup {
  left: clamp(1.5rem, 5vw, 4.5rem);
  position: absolute;
  top: clamp(2rem, 8vh, 5rem);
  transition: opacity .7s ease, transform .9s ease;
}

[data-ui-phase="playing"] .title-lockup {
  opacity: 0;
  transform: translateY(-1rem) scale(.97);
}

.mission-hud {
  left: clamp(1rem, 3vw, 2.5rem);
  max-width: 24rem;
  position: absolute;
  top: clamp(1rem, 3vw, 2.5rem);
}

.subtitle, .interaction, .controls {
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
}

.subtitle { bottom: 4.5rem; max-width: min(46rem, 82vw); text-align: center; }
.interaction { bottom: 7.5rem; }
.controls { bottom: 1.25rem; opacity: .62; white-space: nowrap; }

@media (max-width: 700px) {
  .mission-hud { max-width: calc(100vw - 2rem); }
  .subtitle { bottom: 5.5rem; font-size: .9rem; }
  .controls { font-size: .68rem; white-space: normal; width: calc(100vw - 2rem); }
}
```

- [ ] **Step 6: Connect UI and atmosphere in the game loop**

Create the UI before the story director, pass its methods into `createStoryDirector`, add `atmosphere.update(elapsed)` in the frame, and expose:

```js
completeIntroForTest() {
  ui.completeIntro();
}
```

- [ ] **Step 7: Run all automated tests**

Run: `npm test`

Expected: HUD integration checks PASS and no existing route check regresses.

- [ ] **Step 8: Commit the atmosphere and HUD slice**

```powershell
git add rural-mutation-escape/src/atmosphere.js rural-mutation-escape/src/ui.js rural-mutation-escape/index.html rural-mutation-escape/src/style.css rural-mutation-escape/src/main.js rural-mutation-escape/src/story.js rural-mutation-escape/tests/smoke.mjs
git commit -m "feat: add cinematic village atmosphere"
```

---

### Task 5: Collision-Safe Route and Proximity Interactions

**Files:**
- Create: `rural-mutation-escape/src/collision.js`
- Create: `rural-mutation-escape/src/interactions.js`
- Modify: `rural-mutation-escape/src/level-data.js`
- Modify: `rural-mutation-escape/src/world/props.js`
- Modify: `rural-mutation-escape/src/player.js`
- Modify: `rural-mutation-escape/src/main.js`
- Modify: `rural-mutation-escape/src/story.js`
- Modify: `rural-mutation-escape/src/level.js`
- Modify: `rural-mutation-escape/tests/unit.mjs`
- Modify: `rural-mutation-escape/tests/smoke.mjs`

**Interfaces:**
- Produces: `resolveCircleMove(position, delta, radius, bounds, colliders) -> { x, z }`.
- Produces: `nearestInteraction(position, candidates, radius) -> candidate | null`.
- `interactionAnchors` entries use `{ id, label, kind, position: THREE.Vector3 }`.
- User-approved scope revision: corrected reachable anchors live in `VILLAGE_LAYOUT.anchors`; prop-cluster collision metadata shares the prop's canonical ID and transform, and `level.js` must not override either source.

- [ ] **Step 1: Write failing collision and interaction tests**

Append:

```js
import { resolveCircleMove } from '../src/collision.js';
import { nearestInteraction } from '../src/interactions.js';

test('circle movement stops outside a house collider', () => {
  const next = resolveCircleMove(
    { x: 0, z: 0 },
    { x: 1.3, z: 0 },
    0.4,
    { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    [{ x: 2, z: 0, halfX: 0.5, halfZ: 2 }],
  );
  assert.equal(next.x, 0);
  assert.equal(next.z, 0);
});

test('interaction selects only a nearby candidate', () => {
  const candidates = [
    { id: 'radio', position: { x: 1, z: 1 } },
    { id: 'flashlight', position: { x: 8, z: 8 } },
  ];
  assert.equal(nearestInteraction({ x: 0, z: 0 }, candidates, 2)?.id, 'radio');
  assert.equal(nearestInteraction({ x: -6, z: -6 }, candidates, 2), null);
});
```

- [ ] **Step 2: Run unit tests and verify RED**

Run: `npm run test:unit`

Expected: FAIL with missing `collision.js` or `interactions.js`.

- [ ] **Step 3: Implement axis-separated circle collision**

Create `collision.js`:

```js
function overlaps(x, z, radius, box) {
  const closestX = Math.max(box.x - box.halfX, Math.min(x, box.x + box.halfX));
  const closestZ = Math.max(box.z - box.halfZ, Math.min(z, box.z + box.halfZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 < radius ** 2;
}

export function resolveCircleMove(position, delta, radius, bounds, colliders) {
  const result = {
    x: Math.max(bounds.minX, Math.min(position.x + delta.x, bounds.maxX)),
    z: position.z,
  };
  if (colliders.some((box) => overlaps(result.x, result.z, radius, box))) result.x = position.x;
  result.z = Math.max(bounds.minZ, Math.min(position.z + delta.z, bounds.maxZ));
  if (colliders.some((box) => overlaps(result.x, result.z, radius, box))) result.z = position.z;
  return result;
}
```

- [ ] **Step 4: Implement proximity candidate selection**

Create `interactions.js`:

```js
export function nearestInteraction(position, candidates, radius) {
  let nearest = null;
  let nearestDistance = radius;
  for (const candidate of candidates) {
    const distance = Math.hypot(
      position.x - candidate.position.x,
      position.z - candidate.position.z,
    );
    if (distance <= nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}
```

- [ ] **Step 5: Connect collision and nearby interaction prompts**

Pass `village.colliders` into player movement. Replace direct clamping with `resolveCircleMove` using player radius `0.42`.

Each frame, select an interaction from `village.interactionAnchors` with radius `2.2`, filter it against the current story objective, and call `ui.showInteraction(candidate?.label)`. On `KeyE`, call `storyDirector.interact(candidate.kind)` only when a candidate exists.

Use:

```js
const allowedKinds = {
  leave_home: ['radio'],
  visit_courtyard: ['neighbour'],
  reach_granary: ['flashlight'],
};
let nearbyInteraction = null;

function updateInteraction() {
  const allowed = new Set(allowedKinds[storyDirector.story.objective] ?? []);
  nearbyInteraction = nearestInteraction(
    player.position,
    village.interactionAnchors.filter((candidate) => allowed.has(candidate.kind)),
    2.2,
  );
  ui.showInteraction(nearbyInteraction?.label ?? null);
}
```

Call `updateInteraction()` once per frame after player movement. The `KeyE` handler becomes:

```js
if (event.code === 'KeyE' && !event.repeat && nearbyInteraction) {
  storyDirector.interact(nearbyInteraction.kind);
  updateInteraction();
}
```

Update test hooks so `interactForTest(kind)` remains available for state-only tests, while the browser test also checks:

```js
const farPromptHidden = await page.evaluate(() => document.querySelector('#interaction').hidden);
if (!farPromptHidden) throw new Error('Expected no interaction prompt away from an object');
```

- [ ] **Step 6: Run route regression tests**

Run: `npm test`

Expected: collision and interaction unit tests PASS; story route completes through test hooks; canvas and camera checks remain PASS.

- [ ] **Step 7: Commit the route-safety slice**

```powershell
git add rural-mutation-escape/src/collision.js rural-mutation-escape/src/interactions.js rural-mutation-escape/src/player.js rural-mutation-escape/src/main.js rural-mutation-escape/src/story.js rural-mutation-escape/src/level.js rural-mutation-escape/tests/unit.mjs rural-mutation-escape/tests/smoke.mjs
git commit -m "fix: make the village route collision safe"
```

---

### Task 6: Final Performance and Browser Evidence

**Files:**
- Modify: `rural-mutation-escape/src/main.js`
- Modify: `rural-mutation-escape/tests/smoke.mjs`
- Create: `rural-mutation-escape/artifacts/visual-upgrade/birth.png`
- Create: `rural-mutation-escape/artifacts/visual-upgrade/sighting.png`
- Create: `rural-mutation-escape/artifacts/visual-upgrade/south-gate.png`

**Interfaces:**
- `window.__RURAL_ESCAPE__` retains existing hooks and adds `setStoryStateForTest(flags, objective)` for deterministic evidence states.

- [ ] **Step 1: Add a failing smoke assertion for visual state hooks and viewport safety**

Add:

```js
const visualHooks = await page.evaluate(() => ({
  hasStorySetter: typeof window.__RURAL_ESCAPE__.setStoryStateForTest === 'function',
  pixelRatio: window.__RURAL_ESCAPE__.rendererPixelRatio,
  objectiveRect: document.querySelector('.mission-hud').getBoundingClientRect().toJSON(),
}));
if (!visualHooks.hasStorySetter) throw new Error('Expected deterministic story-state hook');
if (visualHooks.pixelRatio > 1.5) throw new Error(`Pixel ratio exceeds cap: ${visualHooks.pixelRatio}`);
if (visualHooks.objectiveRect.right > 640) throw new Error('Mission HUD is too wide at 1280px');
```

- [ ] **Step 2: Run the smoke test and verify RED**

Run: `node tests/smoke.mjs`

Expected: FAIL because `setStoryStateForTest` or `rendererPixelRatio` is missing.

- [ ] **Step 3: Add deterministic visual-state hooks and enforce renderer caps**

Set:

```js
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
```

Expose:

```js
rendererPixelRatio: renderer.getPixelRatio(),
setStoryStateForTest(flags, objectiveName) {
  Object.assign(storyDirector.story.flags, flags);
  storyDirector.story.objective = objectiveName;
  storyDirector.render();
},
```

Make `render()` part of the story director’s returned public interface.

- [ ] **Step 4: Run the complete engineering verification**

Run:

```powershell
npm test
npm run build
```

Expected: both commands exit `0`, with zero failed tests and no build error.

- [ ] **Step 5: Verify the live game at both required desktop viewports**

Start the canonical runtime with:

```powershell
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

In the in-app browser:

1. At `1280×720`, reload and verify the player,院门,主路和远处地标 are visible within two seconds.
2. Move and rotate near the protagonist home, ancestral hall and granary; verify no ground or wall camera penetration.
3. Switch `C` to first person and back; verify position and story state remain unchanged.
4. Walk the story route and verify nearby `E` prompts only appear within range.
5. Repeat the birth and south-gate checks at `1440×900`.
6. Inspect console logs and require zero `error` entries.

- [ ] **Step 6: Capture the three final evidence states**

Save only:

- `artifacts/visual-upgrade/birth.png`: third-person birth framing after the intro title exits.
- `artifacts/visual-upgrade/sighting.png`: main-road mutant silhouette and readable escape direction.
- `artifacts/visual-upgrade/south-gate.png`: gate, blockade, fog road and completed objective.

Delete or leave outside the repository any intermediate debug captures.

- [ ] **Step 7: Review the full diff and commit final verification adjustments**

Run:

```powershell
git diff --check
git status --short
```

Stage only files belonging to this visual upgrade. Do not stage `RESEARCH.md` or unrelated artifacts.

```powershell
git add rural-mutation-escape/src/main.js rural-mutation-escape/src/story.js rural-mutation-escape/tests/smoke.mjs
git commit -m "test: verify the rural escape visual upgrade"
```

- [ ] **Step 8: Final acceptance audit**

Confirm every requirement in `docs/superpowers/specs/2026-07-28-rural-mutation-escape-visual-upgrade-design.md` maps to passing automated evidence or one of the three retained browser screenshots. Report any unmet item explicitly instead of marking it complete.
