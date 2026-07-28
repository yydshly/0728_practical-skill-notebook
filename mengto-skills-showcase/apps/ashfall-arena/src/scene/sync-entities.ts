import {
  createProceduralMonster,
  monsters,
  type MonsterActionName,
  type MonsterDefinition,
  type MonsterInstance,
  type VesperKnight,
} from "@showcase/game-assets";
import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Object3D,
  type Scene,
} from "three";
import { enemyDefinitions } from "../content/enemy-definitions";
import type { EnemyState, GameState } from "../simulation/types";

export interface EntitySynchronizerDiagnostics {
  readonly modelRootCount: number;
  readonly fallbackRootCount: number;
  readonly enemyIds: readonly string[];
  readonly telegraphIds: readonly string[];
}

export interface EntitySynchronizer {
  sync(state: Readonly<GameState>, deltaSeconds?: number): void;
  getDiagnostics(): EntitySynchronizerDiagnostics;
  dispose(): void;
}

interface EntitySynchronizerOptions {
  readonly createMonster?: (
    definition: MonsterDefinition,
  ) => MonsterInstance;
}

interface ManagedEnemy {
  readonly id: string;
  readonly root: Object3D;
  readonly monster: MonsterInstance | null;
  readonly telegraph: Object3D;
  readonly fallbackResources: readonly {
    geometry: CylinderGeometry | RingGeometry;
    material: MeshBasicMaterial;
  }[];
  action: MonsterActionName;
}

const monsterDefinitions = new Map(
  monsters.map((definition) => [definition.id, definition]),
);

export function syncEntities(
  knight: VesperKnight,
  state: Readonly<GameState>,
): void {
  knight.root.position.set(
    state.player.position.x,
    0,
    state.player.position.y,
  );
  knight.root.rotation.y = state.player.facingRadians;
  knight.equipWeapon(state.player.weaponId);
  knight.update(state.player.action, state.player.actionTime);
}

const renderAction = (enemy: Readonly<EnemyState>): MonsterActionName => {
  if (enemy.health <= 0 || enemy.action === "dead") return "Death";
  if (enemy.action === "hit" || enemy.intent === "stagger") return "Hit";
  if (enemy.action === "attack" || enemy.intent === "attack") return "Attack";
  if (
    enemy.action === "move" ||
    enemy.intent === "approach" ||
    enemy.intent === "orbit" ||
    enemy.intent === "retreat"
  ) {
    return "Walk";
  }
  return "Idle";
};

const createTelegraph = (radius: number): {
  root: Mesh<RingGeometry, MeshBasicMaterial>;
  resource: {
    geometry: RingGeometry;
    material: MeshBasicMaterial;
  };
} => {
  const geometry = new RingGeometry(radius * 1.05, radius * 1.3, 32);
  const material = new MeshBasicMaterial({
    color: 0xffae43,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
  });
  const root = new Mesh(geometry, material);
  root.name = "enemy-telegraph";
  root.rotation.x = -Math.PI / 2;
  root.position.y = 0.025;
  root.visible = false;
  return { root, resource: { geometry, material } };
};

const createFallback = (
  enemy: Readonly<EnemyState>,
  reason: string,
): ManagedEnemy => {
  const presentation = enemyDefinitions[enemy.definitionId].presentation;
  const group = new Group();
  group.name = `enemy-fallback:${enemy.id}`;
  group.userData = {
    entityType: "enemy-fallback",
    entityId: enemy.id,
    fallback: true,
    provenance: "truthful-footprint-placeholder",
    failureReason: reason,
    footprintRadius: presentation.footprintRadius,
  };
  const geometry = new CylinderGeometry(
    presentation.footprintRadius,
    presentation.footprintRadius,
    0.09,
    12,
  );
  const material = new MeshBasicMaterial({
    color: 0xff3fb4,
    wireframe: true,
  });
  const footprint = new Mesh(geometry, material);
  footprint.position.y = 0.045;
  footprint.name = "truthful-footprint";
  group.add(footprint);
  const telegraph = createTelegraph(presentation.footprintRadius);
  group.add(telegraph.root);
  return {
    id: enemy.id,
    root: group,
    monster: null,
    telegraph: telegraph.root,
    fallbackResources: [
      { geometry, material },
      telegraph.resource,
    ],
    action: "Idle",
  };
};

const createModel = (
  enemy: Readonly<EnemyState>,
  factory: (definition: MonsterDefinition) => MonsterInstance,
): ManagedEnemy => {
  const presentation = enemyDefinitions[enemy.definitionId].presentation;
  const definition = monsterDefinitions.get(presentation.monsterId);
  if (!definition) {
    return createFallback(
      enemy,
      `shared monster definition ${presentation.monsterId} is unavailable`,
    );
  }
  try {
    const monster = factory(definition);
    const scale = presentation.visualScale;
    monster.root.scale.setScalar(scale);
    monster.root.position.y = -definition.bounds.groundOffset * scale;
    monster.root.name = `enemy-model:${enemy.id}`;
    monster.root.userData = {
      ...monster.root.userData,
      entityType: "enemy-model",
      entityId: enemy.id,
      definitionId: definition.id,
      provenance: "shared-procedural",
      groundOffset: definition.bounds.groundOffset,
      socketNames: [...monster.sockets.keys()],
    };
    const telegraph = createTelegraph(
      presentation.footprintRadius * scale,
    );
    monster.root.add(telegraph.root);
    return {
      id: enemy.id,
      root: monster.root,
      monster,
      telegraph: telegraph.root,
      fallbackResources: [telegraph.resource],
      action: "Idle",
    };
  } catch (error) {
    return createFallback(
      enemy,
      error instanceof Error ? error.message : String(error),
    );
  }
};

const disposeManaged = (managed: ManagedEnemy): void => {
  managed.monster?.dispose();
  managed.root.removeFromParent();
  for (const { geometry, material } of managed.fallbackResources) {
    geometry.dispose();
    material.dispose();
  }
};

export function createEntitySynchronizer(
  knight: VesperKnight,
  scene?: Scene,
  options: EntitySynchronizerOptions = {},
): EntitySynchronizer {
  const entities = new Map<string, ManagedEnemy>();
  const factory = options.createMonster ?? createProceduralMonster;
  let disposed = false;

  return {
    sync(state, deltaSeconds = 0) {
      if (disposed) throw new Error("Entity synchronizer is disposed");
      syncEntities(knight, state);
      if (!scene) return;

      const liveIds = new Set(Object.keys(state.enemies));
      for (const [id, managed] of entities) {
        if (liveIds.has(id)) continue;
        disposeManaged(managed);
        entities.delete(id);
      }

      for (const enemy of Object.values(state.enemies).sort((left, right) =>
        left.id.localeCompare(right.id)
      )) {
        let managed = entities.get(enemy.id);
        if (!managed) {
          managed = createModel(enemy, factory);
          entities.set(enemy.id, managed);
          scene.add(managed.root);
        }
        managed.root.position.x = enemy.position.x;
        managed.root.position.z = enemy.position.y;
        managed.root.rotation.y = enemy.facingRadians;
        managed.telegraph.visible = enemy.movePhase === "telegraph";
        const action = renderAction(enemy);
        if (managed.monster && action !== managed.action) {
          managed.monster.playAction(action);
        }
        managed.monster?.update(deltaSeconds);
        managed.action = action;
        managed.root.userData.renderAction = action;
        managed.root.userData.telegraphVisible =
          managed.telegraph.visible;
      }
    },
    getDiagnostics() {
      const managed = [...entities.values()];
      return {
        modelRootCount: managed.filter(({ monster }) => monster !== null).length,
        fallbackRootCount: managed.filter(({ monster }) => monster === null)
          .length,
        enemyIds: managed.map(({ id }) => id).sort(),
        telegraphIds: managed
          .filter(({ telegraph }) => telegraph.visible)
          .map(({ id }) => id)
          .sort(),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const managed of entities.values()) disposeManaged(managed);
      entities.clear();
    },
  };
}
