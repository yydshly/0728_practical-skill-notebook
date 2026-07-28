import { createVesperKnight } from "@showcase/game-assets";
import { Scene } from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createEntitySynchronizer,
} from "../src/scene/sync-entities";
import {
  createEncounterFixture,
} from "../src/simulation/encounters";

describe("shared monster scene synchronization", () => {
  it("renders a readable Warden bolt trace and disposes it when authority removes it", () => {
    const scene = new Scene();
    const knight = createVesperKnight();
    const synchronizer = createEntitySynchronizer(knight, scene);
    const base = createEncounterFixture(7, "fresh");
    const projectileState = {
      ...base,
      combat: {
        ...base.combat,
        enemyProjectiles: [{
          id: "warden-a:warden-bolt:1:projectile",
          attackId: "warden-a:warden-bolt:1",
          ownerId: "warden-a",
          moveId: "warden-bolt" as const,
          position: { x: 1, y: -2 },
          direction: { x: 0, y: 1 },
          speed: 8,
          radius: 0.18,
          ageTicks: 4,
          lifetimeTicks: 90,
          targetLayer: "player" as const,
          team: "enemy" as const,
          hitTargetIds: [],
        }],
      },
    };

    synchronizer.sync(projectileState, 1 / 60);
    expect(synchronizer.getDiagnostics()).toMatchObject({
      enemyProjectileTraceCount: 1,
      enemyProjectileIds: ["warden-a:warden-bolt:1:projectile"],
    });
    const trace = scene.children.find(
      ({ userData }) => userData.entityType === "enemy-projectile-trace",
    )!;
    expect(trace).toBeDefined();
    expect(trace.position.toArray()).toEqual([1, 0.32, -2]);
    expect(trace.children.length).toBeGreaterThanOrEqual(2);
    const disposeSpies = trace.children.flatMap((child) => {
      if (!("geometry" in child) || !("material" in child)) return [];
      return [
        vi.spyOn(child.geometry as { dispose(): void }, "dispose"),
        vi.spyOn(child.material as { dispose(): void }, "dispose"),
      ];
    });

    synchronizer.sync(base, 1 / 60);
    expect(synchronizer.getDiagnostics()).toMatchObject({
      enemyProjectileTraceCount: 0,
      enemyProjectileIds: [],
    });
    expect(trace.parent).toBeNull();
    for (const spy of disposeSpies) expect(spy).toHaveBeenCalledOnce();

    synchronizer.dispose();
    knight.dispose();
  });

  it("creates, updates, and releases one shared model per authoritative enemy", () => {
    const scene = new Scene();
    const knight = createVesperKnight();
    scene.add(knight.root);
    const synchronizer = createEntitySynchronizer(knight, scene);
    const wave = createEncounterFixture(1, "wave-one");

    synchronizer.sync(wave, 1 / 60);
    expect(synchronizer.getDiagnostics()).toMatchObject({
      modelRootCount: 3,
      fallbackRootCount: 0,
      enemyIds: [
        "wave-one-crawler-a",
        "wave-one-crawler-b",
        "wave-one-warden",
      ],
    });
    expect(
      scene.children.filter(
        ({ userData }) => userData.entityType === "enemy-model",
      ),
    ).toHaveLength(3);

    const hit = {
      ...wave,
      enemies: {
        ...wave.enemies,
        "wave-one-crawler-a": {
          ...wave.enemies["wave-one-crawler-a"]!,
          action: "hit" as const,
        },
      },
    };
    synchronizer.sync(hit, 1 / 60);
    expect(
      scene.children.find(
        ({ userData }) =>
          userData.entityId === "wave-one-crawler-a",
      )?.userData.renderAction,
    ).toBe("Hit");

    for (const [action, intent, expected] of [
      ["idle", "observe", "Idle"],
      ["move", "approach", "Walk"],
      ["attack", "attack", "Attack"],
      ["dead", "dead", "Death"],
    ] as const) {
      const enemy = wave.enemies["wave-one-crawler-a"]!;
      synchronizer.sync(
        {
          ...wave,
          enemies: {
            ...wave.enemies,
            [enemy.id]: {
              ...enemy,
              action,
              intent,
              health: action === "dead" ? 0 : enemy.health,
            },
          },
        },
        1 / 60,
      );
      expect(
        scene.children.find(
          ({ userData }) => userData.entityId === enemy.id,
        )?.userData.renderAction,
      ).toBe(expected);
    }

    synchronizer.sync(createEncounterFixture(1, "boss"), 1 / 60);
    expect(synchronizer.getDiagnostics()).toMatchObject({
      modelRootCount: 1,
      enemyIds: ["boss-sovereign"],
    });
    expect(
      scene.children.filter(
        ({ userData }) => userData.entityType === "enemy-model",
      ),
    ).toHaveLength(1);

    synchronizer.dispose();
    expect(
      scene.children.filter(
        ({ userData }) =>
          userData.entityType === "enemy-model" ||
          userData.entityType === "enemy-fallback",
      ),
    ).toHaveLength(0);
    knight.dispose();
  });

  it("uses an unmistakable truthful footprint fallback when shared model creation fails", () => {
    const scene = new Scene();
    const knight = createVesperKnight();
    scene.add(knight.root);
    const synchronizer = createEntitySynchronizer(knight, scene, {
      createMonster() {
        throw new Error("injected model failure");
      },
    });

    synchronizer.sync(createEncounterFixture(2, "wave-one"), 1 / 60);

    expect(synchronizer.getDiagnostics()).toMatchObject({
      modelRootCount: 0,
      fallbackRootCount: 3,
    });
    const fallbacks = scene.children.filter(
      ({ userData }) => userData.entityType === "enemy-fallback",
    );
    expect(fallbacks).toHaveLength(3);
    for (const fallback of fallbacks) {
      expect(fallback.userData).toMatchObject({
        fallback: true,
        provenance: "truthful-footprint-placeholder",
        failureReason: "injected model failure",
      });
      expect(fallback.userData.footprintRadius).toBeGreaterThan(0);
    }

    synchronizer.dispose();
    knight.dispose();
  });

  it("does not leak roots when the same fixture is synchronized repeatedly", () => {
    const scene = new Scene();
    const knight = createVesperKnight();
    scene.add(knight.root);
    const synchronizer = createEntitySynchronizer(knight, scene);
    const fixture = createEncounterFixture(3, "elite");

    for (let index = 0; index < 20; index += 1) {
      synchronizer.sync(fixture, 1 / 60);
    }

    expect(synchronizer.getDiagnostics()).toMatchObject({
      modelRootCount: 2,
      fallbackRootCount: 0,
      enemyIds: ["elite-bell", "elite-crawler"],
    });
    synchronizer.dispose();
    knight.dispose();
  });
});
