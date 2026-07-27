import { beforeEach, describe, expect, it } from "vitest";
import { createRouteArchive } from "../src/route-archive.js";
import { ROUTES } from "../src/scene-config.js";

beforeEach(() => {
  document.body.innerHTML = `
    <section id="route-archive">
      <button id="route-prev"></button>
      <div id="route-track"></div>
      <button id="route-next"></button>
      <p id="route-status"></p>
      <p class="route-count"><span></span></p>
    </section>`;
});

describe("route archive", () => {
  it("moves by button and wraps from the final route to the first route", () => {
    const archive = createRouteArchive({ root: document.querySelector("#route-archive"), routes: ROUTES });

    archive.next();
    expect(archive.getIndex()).toBe(1);
    archive.goTo(3);
    archive.next();

    expect(archive.getIndex()).toBe(0);
    expect(document.querySelector('[aria-current="true"] h3').textContent).toBe("潮汐花园");
  });

  it("supports Arrow keys, Home, End, and an accessible position announcement", () => {
    const root = document.querySelector("#route-archive");
    const archive = createRouteArchive({ root, routes: ROUTES });

    root.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    expect(archive.getIndex()).toBe(3);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    expect(archive.getIndex()).toBe(0);
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));

    expect(archive.getIndex()).toBe(1);
    expect(document.querySelector("#route-status").textContent).toBe("路线 2，共 4 条：回声湾");
  });

  it("opens the selected route detail without losing its expanded state", () => {
    const root = document.querySelector("#route-archive");
    createRouteArchive({ root, routes: ROUTES });

    const detailButton = root.querySelector('[data-route-detail="0"]');
    detailButton.click();

    expect(detailButton.getAttribute("aria-expanded")).toBe("true");
    expect(root.querySelector("#route-detail-0").hidden).toBe(false);
  });

  it("replaces an existing controller instead of binding archive actions twice", () => {
    const root = document.querySelector("#route-archive");
    createRouteArchive({ root, routes: ROUTES });
    createRouteArchive({ root, routes: ROUTES });

    const detailButton = root.querySelector('[data-route-detail="0"]');
    detailButton.click();

    expect(detailButton.getAttribute("aria-expanded")).toBe("true");
  });
});
