import {
  MONSTER_ACTION_DURATIONS,
  type MonsterDefinition,
} from "./types";

const actions = ["Idle", "Walk", "Attack", "Hit", "Death"] as const;
const shippedSource = (factory: string, silhouette: string) =>
  "Project-authored Three.js geometry; runtime factory shipped; catalog PNG recapture required after grounding and animation revision. " +
  `The ${factory} runtime recipe creates the ${silhouette}. ` +
  "The previewPath remains delivered from the previous procedural revision and must be recaptured from the updated runtime.";

const freezeMonster = (monster: MonsterDefinition): MonsterDefinition => {
  Object.freeze(monster.source);
  monster.animations.forEach(Object.freeze);
  Object.freeze(monster.animations);
  monster.sockets.forEach(Object.freeze);
  Object.freeze(monster.sockets);
  Object.freeze(monster.bounds);
  Object.freeze(monster.actions);
  Object.freeze(monster.collider);
  Object.freeze(monster.palette);
  Object.freeze(monster.review.contactPoints);
  Object.freeze(monster.review);
  return Object.freeze(monster);
};

const monsterDefinitions = [
  {
    id: "ash-warden",
    kind: "monster",
    displayName: "灰烬守卫 / Ash Warden",
    previewPath: "/asset-catalog/monsters/ash-warden.png",
    source: {
      type: "procedural",
      description: shippedSource("biped", "tall staff-bearing caster"),
      license: "Project-authored content contract",
    },
    animations: actions.map((name) => ({ name, durationSeconds: MONSTER_ACTION_DURATIONS[name] })),
    sockets: [
      { name: "target", bone: "head" },
      { name: "ground", bone: "ground-contact" },
      { name: "vfx-hit", bone: "spine" },
      { name: "vfx-death", bone: "pelvis" },
      { name: "attack-staff", bone: "hand-r" },
    ],
    bounds: { width: 1.2, height: 2.55, depth: 0.96, groundOffset: -0.6 },
    deliveryStatus: "shipped",
    factoryId: "biped",
    actions,
    collider: { radius: 0.46, height: 2.42 },
    palette: { primary: 0x3b3437, secondary: 0x9c4a30, emissive: 0xd26737 },
    review: {
      contactPoints: ["ground", "attack-staff"],
      notes: "Grounded from the biped foot contact plane; staff tip is excluded from grounding.",
    },
  },
  {
    id: "glass-crawler",
    kind: "monster",
    displayName: "琉璃爬行者 / Glass Crawler",
    previewPath: "/asset-catalog/monsters/glass-crawler.png",
    source: {
      type: "procedural",
      description: shippedSource("crawler", "low six-legged crystal creature"),
      license: "Project-authored content contract",
    },
    animations: actions.map((name) => ({ name, durationSeconds: MONSTER_ACTION_DURATIONS[name] })),
    sockets: [
      { name: "target", bone: "crystal-crown" },
      { name: "ground", bone: "ground-contact" },
      { name: "vfx-hit", bone: "thorax" },
      { name: "vfx-death", bone: "abdomen" },
      { name: "attack-mandible", bone: "jaw" },
    ],
    bounds: { width: 1.86, height: 0.84, depth: 1.72, groundOffset: -0.21 },
    deliveryStatus: "shipped",
    factoryId: "crawler",
    actions,
    collider: { radius: 0.71, height: 0.72 },
    palette: { primary: 0x6ca8b9, secondary: 0x29495c, emissive: 0x9ce9ff },
    review: {
      contactPoints: ["ground", "attack-mandible"],
      notes: "Grounding is measured from the planted leg contact plane across the crawl cycle.",
    },
  },
  {
    id: "bell-knight",
    kind: "monster",
    displayName: "钟甲骑士 / Bell Knight",
    previewPath: "/asset-catalog/monsters/bell-knight.png",
    source: {
      type: "procedural",
      description: shippedSource("armored", "broad armored humanoid with bell helm"),
      license: "Project-authored content contract",
    },
    animations: actions.map((name) => ({ name, durationSeconds: MONSTER_ACTION_DURATIONS[name] })),
    sockets: [
      { name: "target", bone: "bell-helm" },
      { name: "ground", bone: "ground-contact" },
      { name: "vfx-hit", bone: "chest" },
      { name: "vfx-death", bone: "pelvis" },
      { name: "attack-mace", bone: "hand-r" },
    ],
    bounds: { width: 1.68, height: 2.18, depth: 1.12, groundOffset: -0.53 },
    deliveryStatus: "shipped",
    factoryId: "armored",
    actions,
    collider: { radius: 0.61, height: 2.06 },
    palette: { primary: 0x7a6b57, secondary: 0x342c27, emissive: 0xd5ac4f },
    review: {
      contactPoints: ["ground", "attack-mace"],
      notes: "Grounded from armored boot contacts; the hanging bell rim does not affect measured bounds.",
    },
  },
  {
    id: "mire-hound",
    kind: "monster",
    displayName: "泥沼猎犬 / Mire Hound",
    previewPath: "/asset-catalog/monsters/mire-hound.png",
    source: {
      type: "procedural",
      description: shippedSource("quadruped", "long-backed four-legged hunter"),
      license: "Project-authored content contract",
    },
    animations: actions.map((name) => ({ name, durationSeconds: MONSTER_ACTION_DURATIONS[name] })),
    sockets: [
      { name: "target", bone: "head" },
      { name: "ground", bone: "ground-contact" },
      { name: "vfx-hit", bone: "shoulders" },
      { name: "vfx-death", bone: "spine" },
      { name: "attack-jaw", bone: "jaw" },
    ],
    bounds: { width: 1.04, height: 1.16, depth: 2.42, groundOffset: -0.24 },
    deliveryStatus: "shipped",
    factoryId: "quadruped",
    actions,
    collider: { radius: 0.49, height: 1.04 },
    palette: { primary: 0x556847, secondary: 0x29331f, emissive: 0x93b567 },
    review: {
      contactPoints: ["ground", "attack-jaw"],
      notes: "The four-foot contact plane anchors the long-backed hunter through the locomotion loop.",
    },
  },
] as const satisfies readonly MonsterDefinition[];

export const monsters = Object.freeze(monsterDefinitions.map(freezeMonster));
