import { createProceduralMonster, monsters } from "@showcase/game-assets";
import { describe, expect, it, vi } from "vitest";
import { createReviewOverlays } from "../src/scene/create-overlays";

describe("createReviewOverlays", () => {
  it("uses the real joint hierarchy, declared collider, and named sockets", () => {
    const instance = createProceduralMonster(monsters[0]!);
    const overlays = createReviewOverlays(instance);

    overlays.setVisible("skeleton", true);
    overlays.setVisible("colliders", true);
    overlays.setVisible("sockets", true);
    overlays.update();

    const root = instance.root.getObjectByName("review-overlays")!;
    const lines = root.getObjectByName("review-joint-hierarchy")!;
    const collider = root.getObjectByName("review-collider-solid")!;
    expect((lines as unknown as { geometry: { getAttribute(name: string): { count: number } } }).geometry.getAttribute("position").count).toBeGreaterThan(2);
    expect(collider.userData.size).toEqual({ radius: monsters[0]!.collider.radius, height: monsters[0]!.collider.height });
    for (const socket of monsters[0]!.sockets) expect(instance.root.getObjectByName(`review-socket-${socket.name}`)).toBeTruthy();

    overlays.dispose();
    expect(instance.root.getObjectByName("review-overlays")).toBeUndefined();
    expect(instance.root.getObjectByName("review-socket-target")).toBeUndefined();
    instance.dispose();
  });

  it("does not accumulate overlay resources across rebuilds and disposal", () => {
    const instance = createProceduralMonster(monsters[1]!);
    for (let index = 0; index < 4; index += 1) {
      const overlays = createReviewOverlays(instance);
      const collider = instance.root.getObjectByName("review-collider-solid") as unknown as { geometry: { dispose(): void }; material: { dispose(): void } };
      const geometryDispose = vi.spyOn(collider.geometry, "dispose");
      const materialDispose = vi.spyOn(collider.material, "dispose");
      overlays.dispose();
      expect(geometryDispose).toHaveBeenCalledTimes(1);
      expect(materialDispose).toHaveBeenCalledTimes(1);
      expect(instance.root.getObjectByName("review-overlays")).toBeUndefined();
    }
    instance.dispose();
  });
});
