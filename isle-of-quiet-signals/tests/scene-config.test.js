import { describe, expect, it } from "vitest";
import { initApp } from "../src/main.js";
import { NAV_POINTS, ROUTES, SCENE } from "../src/scene-config.js";

describe("scene configuration", () => {
  it("keeps timeline ranges ordered and inside zero to one", () => {
    const ranges = Object.values(SCENE.ranges);

    for (const range of ranges) {
      expect(range.start).toBeGreaterThanOrEqual(0);
      expect(range.end).toBeLessThanOrEqual(1);
      expect(range.end).toBeGreaterThan(range.start);
    }

    expect(ranges.map(({ start }) => start)).toEqual(
      [...ranges].map(({ start }) => start).sort((a, b) => a - b),
    );
  });

  it("exposes three real navigation targets and four distinct routes", () => {
    expect(NAV_POINTS.map(({ id }) => id)).toEqual(["lighthouse", "signal", "routes"]);
    expect(NAV_POINTS.every(({ progress }) => progress >= 0 && progress <= 1)).toBe(true);
    expect(ROUTES).toHaveLength(4);
    expect(new Set(ROUTES.map(({ id }) => id)).size).toBe(4);
  });

  it("sets the cinematic scroll length on the document root", async () => {
    const documentRef = document.implementation.createHTMLDocument("scene");
    const app = await initApp(documentRef);

    expect(documentRef.documentElement.style.getPropertyValue("--scroll-length")).toBe("4400px");
    expect(app.navPoints).toHaveLength(3);
    expect(app.routes).toHaveLength(4);
  });
});
