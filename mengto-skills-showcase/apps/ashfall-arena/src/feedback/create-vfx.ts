import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  Scene,
  TorusGeometry,
} from "three";
import type {
  EncounterPhase,
  GameEvent,
  GameState,
  GameStatus,
} from "../simulation/types";

export type VfxQuality = "low" | "medium" | "high";
export type VfxPoolName =
  | "hitSparks"
  | "guardArcs"
  | "dodgeTrails"
  | "projectileTraces"
  | "bossShockwaves";

const DAMAGE_FLASH_DURATION = 0.6;

export const VFX_EFFECT_DEFINITIONS = Object.freeze({
  hitSparks: Object.freeze({
    trigger: "damage",
    duration: 0.24,
    meaning: "确认接触与伤害已经由模拟结算",
    reducedEquivalent: "固定伤害闪光与短促接触星",
    capacity: 12,
  }),
  guardArcs: Object.freeze({
    trigger: "guarded damage",
    duration: 0.32,
    meaning: "确认格挡成功且伤害已被削减",
    reducedEquivalent: "静态盾环与“格挡”文字",
    capacity: 8,
  }),
  dodgeTrails: Object.freeze({
    trigger: "player dodge action-started event",
    duration: 0.28,
    meaning: "确认闪避输入已进入权威动作状态",
    reducedEquivalent: "角色脚下短环，不产生长拖尾",
    capacity: 6,
  }),
  projectileTraces: Object.freeze({
    trigger: "enemy projectile spawned event",
    duration: 0.6,
    meaning: "标示已进入 active 的投射攻击方向",
    reducedEquivalent: "固定短线，不沿轨迹移动",
    capacity: 12,
  }),
  bossShockwaves: Object.freeze({
    trigger: "sovereign shockwave active event",
    duration: 0.6,
    meaning: "标示 Boss 冲击波接触范围，不代替碰撞判定",
    reducedEquivalent: "固定轮廓环与字幕",
    capacity: 4,
  }),
} as const);

interface EffectSlot {
  readonly mesh: Mesh;
  readonly material: MeshBasicMaterial;
  active: boolean;
  remaining: number;
  duration: number;
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  sourceId: string | null;
}

interface EffectPool {
  readonly name: VfxPoolName;
  readonly root: Group;
  readonly slots: EffectSlot[];
  cursor: number;
}

export interface VfxDiagnostics {
  readonly disposed: boolean;
  readonly reducedMotion: boolean;
  readonly quality: VfxQuality;
  readonly particleDisplacement: boolean;
  readonly damageFlashActive: boolean;
  readonly totalActive: number;
  readonly projectileTraces: readonly {
    readonly projectileId: string;
    readonly position: { readonly x: number; readonly z: number };
    readonly velocity: { readonly x: number; readonly z: number };
    readonly rotationY: number;
  }[];
  readonly pools: Record<
    VfxPoolName,
    { readonly active: number; readonly capacity: number }
  >;
}

export interface VfxController {
  consume(events: readonly GameEvent[], state: Readonly<GameState>): void;
  sync(state: Readonly<GameState>): void;
  update(deltaSeconds: number, paused: boolean): void;
  setReducedMotion(reduced: boolean): void;
  setQuality(quality: VfxQuality): void;
  reset(): void;
  getDiagnostics(): VfxDiagnostics;
  dispose(): void;
}

const createPool = (
  name: VfxPoolName,
  capacity: number,
  geometry:
    | BoxGeometry
    | PlaneGeometry
    | RingGeometry
    | TorusGeometry,
  color: number,
  opacity: number,
): EffectPool => {
  const root = new Group();
  root.name = `ashfall-vfx-${name}`;
  const slots: EffectSlot[] = [];
  for (let index = 0; index < capacity; index += 1) {
    const material = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = `${name}-${index}`;
    mesh.visible = false;
    mesh.renderOrder = 12;
    root.add(mesh);
    slots.push({
      mesh,
      material,
      active: false,
      remaining: 0,
      duration: 0,
      velocityX: 0,
      velocityY: 0,
      velocityZ: 0,
      sourceId: null,
    });
  }
  return { name, root, slots, cursor: 0 };
};

const deactivate = (slot: EffectSlot) => {
  slot.active = false;
  slot.remaining = 0;
  slot.duration = 0;
  slot.velocityX = 0;
  slot.velocityY = 0;
  slot.velocityZ = 0;
  slot.sourceId = null;
  slot.mesh.visible = false;
};

const acquire = (pool: EffectPool): EffectSlot => {
  for (let offset = 0; offset < pool.slots.length; offset += 1) {
    const index = (pool.cursor + offset) % pool.slots.length;
    const slot = pool.slots[index]!;
    if (!slot.active) {
      pool.cursor = (index + 1) % pool.slots.length;
      return slot;
    }
  }
  const slot = pool.slots[pool.cursor]!;
  pool.cursor = (pool.cursor + 1) % pool.slots.length;
  return slot;
};

const actorPosition = (
  state: Readonly<GameState>,
  actorId: string,
): Readonly<{ x: number; y: number }> => {
  if (actorId === state.player.id) return state.player.position;
  return state.enemies[actorId]?.position ?? state.player.position;
};

export function createVfx(
  scene: Scene,
  options: {
    reducedMotion: boolean;
    quality: VfxQuality;
  },
): VfxController {
  const root = new Group();
  root.name = "ashfall-feedback-root";

  const pools = {
    hitSparks: createPool(
      "hitSparks",
      VFX_EFFECT_DEFINITIONS.hitSparks.capacity,
      new BoxGeometry(0.09, 0.09, 0.32),
      0xffc66d,
      0.95,
    ),
    guardArcs: createPool(
      "guardArcs",
      VFX_EFFECT_DEFINITIONS.guardArcs.capacity,
      new TorusGeometry(0.72, 0.055, 5, 24, Math.PI * 1.35),
      0x8ed8ff,
      0.9,
    ),
    dodgeTrails: createPool(
      "dodgeTrails",
      VFX_EFFECT_DEFINITIONS.dodgeTrails.capacity,
      new PlaneGeometry(0.8, 0.18),
      0xe4bc88,
      0.52,
    ),
    projectileTraces: createPool(
      "projectileTraces",
      VFX_EFFECT_DEFINITIONS.projectileTraces.capacity,
      new PlaneGeometry(1.2, 0.08),
      0xff8c52,
      0.84,
    ),
    bossShockwaves: createPool(
      "bossShockwaves",
      VFX_EFFECT_DEFINITIONS.bossShockwaves.capacity,
      new RingGeometry(0.82, 0.96, 32),
      0xffb45d,
      0.82,
    ),
  } satisfies Record<VfxPoolName, EffectPool>;

  for (const pool of Object.values(pools)) {
    root.add(pool.root);
  }
  scene.add(root);

  let reducedMotion = options.reducedMotion;
  let quality = options.quality;
  let damageFlashRemaining = 0;
  let previousPhase: EncounterPhase | null = null;
  let previousStatus: GameStatus | null = null;
  let disposed = false;

  const spawn = (
    pool: EffectPool,
    x: number,
    y: number,
    z: number,
    duration: number,
    velocityX: number,
    velocityY: number,
    velocityZ: number,
    sourceId: string | null = null,
  ) => {
    const slot = acquire(pool);
    slot.active = true;
    slot.remaining = duration;
    slot.duration = duration;
    slot.velocityX = reducedMotion ? 0 : velocityX;
    slot.velocityY = reducedMotion ? 0 : velocityY;
    slot.velocityZ = reducedMotion ? 0 : velocityZ;
    slot.sourceId = sourceId;
    slot.mesh.position.set(x, y, z);
    slot.mesh.rotation.set(0, 0, 0);
    slot.mesh.scale.setScalar(1);
    slot.material.opacity = 1;
    slot.mesh.visible = true;
  };

  const reset = () => {
    damageFlashRemaining = 0;
    for (const pool of Object.values(pools)) {
      pool.cursor = 0;
      for (const slot of pool.slots) deactivate(slot);
    }
  };

  const sync = (state: Readonly<GameState>) => {
    if (disposed) return;
    if (
      previousPhase !== null &&
      (state.encounter.phase !== previousPhase ||
        (previousStatus === "playing" &&
          (state.status === "defeated" || state.status === "complete")))
    ) {
      reset();
    }
    previousPhase = state.encounter.phase;
    previousStatus = state.status;
  };

  const consume = (
    events: readonly GameEvent[],
    state: Readonly<GameState>,
  ) => {
    if (disposed) return;
    sync(state);
    for (const event of events) {
      if (
        event.type === "action-started" &&
        event.actorId === state.player.id &&
        event.actionId === "dodge"
      ) {
        const count =
          reducedMotion || quality === "low"
            ? 1
            : quality === "medium"
              ? 2
              : 3;
        for (let index = 0; index < count; index += 1) {
          const direction = index % 2 === 0 ? -1 : 1;
          spawn(
            pools.dodgeTrails,
            state.player.position.x,
            0.055,
            state.player.position.y,
            VFX_EFFECT_DEFINITIONS.dodgeTrails.duration,
            direction * 0.15,
            0,
            -0.55,
          );
        }
      } else if (event.type === "damage") {
        const position = actorPosition(state, event.targetId);
        if (event.targetId === state.player.id) {
          damageFlashRemaining = Math.max(
            damageFlashRemaining,
            DAMAGE_FLASH_DURATION,
          );
        }
        if (event.guarded) {
          spawn(
            pools.guardArcs,
            position.x,
            0.78,
            position.y,
            VFX_EFFECT_DEFINITIONS.guardArcs.duration,
            0,
            0,
            0,
          );
          continue;
        }
        const count =
          reducedMotion || quality === "low"
            ? 1
            : quality === "medium"
              ? 2
              : 4;
        for (let index = 0; index < count; index += 1) {
          const angle = index * Math.PI * 0.5;
          spawn(
            pools.hitSparks,
            position.x,
            0.74,
            position.y,
            VFX_EFFECT_DEFINITIONS.hitSparks.duration,
            Math.cos(angle) * 1.4,
            0.8,
            Math.sin(angle) * 1.4,
          );
        }
      } else if (event.type === "enemy-projectile-spawned") {
        const velocityX = event.velocity.x;
        const velocityZ = event.velocity.y;
        const slot = acquire(pools.projectileTraces);
        slot.active = true;
        slot.remaining = VFX_EFFECT_DEFINITIONS.projectileTraces.duration;
        slot.duration = VFX_EFFECT_DEFINITIONS.projectileTraces.duration;
        slot.velocityX = reducedMotion ? 0 : velocityX;
        slot.velocityY = 0;
        slot.velocityZ = reducedMotion ? 0 : velocityZ;
        slot.sourceId = event.projectileId;
        slot.mesh.position.set(event.position.x, 0.9, event.position.y);
        slot.mesh.rotation.set(
          -Math.PI / 2,
          -Math.atan2(velocityZ, velocityX),
          0,
        );
        slot.mesh.scale.setScalar(1);
        slot.material.opacity = 1;
        slot.mesh.visible = true;
      } else if (
        event.type === "enemy-move-active" &&
        event.moveId === "sovereign-shockwave"
      ) {
        const position = actorPosition(state, event.enemyId);
        const slot = acquire(pools.bossShockwaves);
        slot.mesh.rotation.x = -Math.PI / 2;
        slot.active = true;
        slot.remaining = VFX_EFFECT_DEFINITIONS.bossShockwaves.duration;
        slot.duration = VFX_EFFECT_DEFINITIONS.bossShockwaves.duration;
        slot.velocityX = 0;
        slot.velocityY = 0;
        slot.velocityZ = 0;
        slot.sourceId = null;
        slot.mesh.position.set(position.x, 0.04, position.y);
        slot.mesh.scale.setScalar(reducedMotion ? 1.8 : 0.65);
        slot.material.opacity = 1;
        slot.mesh.visible = true;
      }
    }
  };

  const update = (deltaSeconds: number, paused: boolean) => {
    if (disposed || paused || deltaSeconds <= 0) return;
    damageFlashRemaining = Math.max(0, damageFlashRemaining - deltaSeconds);
    for (const pool of Object.values(pools)) {
      for (const slot of pool.slots) {
        if (!slot.active) continue;
        slot.remaining -= deltaSeconds;
        if (slot.remaining <= 0) {
          deactivate(slot);
          continue;
        }
        const progress = 1 - slot.remaining / slot.duration;
        slot.mesh.position.x += slot.velocityX * deltaSeconds;
        slot.mesh.position.y += slot.velocityY * deltaSeconds;
        slot.mesh.position.z += slot.velocityZ * deltaSeconds;
        slot.material.opacity = 1 - progress;
        if (
          pool.name === "bossShockwaves" &&
          !reducedMotion
        ) {
          slot.mesh.scale.setScalar(0.65 + progress * 4.25);
        }
      }
    }
  };

  const getDiagnostics = (): VfxDiagnostics => {
    const poolDiagnostics = {} as VfxDiagnostics["pools"];
    let totalActive = 0;
    for (const [name, pool] of Object.entries(pools) as Array<
      [VfxPoolName, EffectPool]
    >) {
      let active = 0;
      for (const slot of pool.slots) {
        if (slot.active) active += 1;
      }
      totalActive += active;
      poolDiagnostics[name] = {
        active,
        capacity: pool.slots.length,
      };
    }
    return {
      disposed,
      reducedMotion,
      quality,
      particleDisplacement: !reducedMotion,
      damageFlashActive: damageFlashRemaining > 0,
      totalActive,
      projectileTraces: pools.projectileTraces.slots
        .filter((slot) => slot.active && slot.sourceId !== null)
        .map((slot) => ({
          projectileId: slot.sourceId!,
          position: {
            x: slot.mesh.position.x,
            z: slot.mesh.position.z,
          },
          velocity: {
            x: slot.velocityX,
            z: slot.velocityZ,
          },
          rotationY: slot.mesh.rotation.y,
        })),
      pools: poolDiagnostics,
    };
  };

  return {
    consume,
    sync,
    update,
    setReducedMotion(reduced) {
      reducedMotion = reduced;
      if (reduced) {
        for (const pool of Object.values(pools)) {
          for (const slot of pool.slots) {
            slot.velocityX = 0;
            slot.velocityY = 0;
            slot.velocityZ = 0;
          }
        }
      }
    },
    setQuality(nextQuality) {
      quality = nextQuality;
    },
    reset,
    getDiagnostics,
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      root.removeFromParent();
      for (const pool of Object.values(pools)) {
        const geometry = pool.slots[0]?.mesh.geometry;
        geometry?.dispose();
        for (const slot of pool.slots) slot.material.dispose();
      }
    },
  };
}
