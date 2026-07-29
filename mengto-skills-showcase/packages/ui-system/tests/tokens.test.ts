import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { uiTokenNames } from "../src/index";

it("exports shared token names backed by the CSS token sheet", async () => {
  expect(uiTokenNames).toMatchObject({
    colorCanvas: "--showcase-color-canvas",
    typeBody: "--showcase-font-body",
    space3: "--showcase-space-3",
    focusRing: "--showcase-focus-ring",
    motionStandard: "--showcase-motion-standard",
  });

  const css = await readFile(new URL("../src/tokens.css", import.meta.url), "utf8");
  for (const tokenName of Object.values(uiTokenNames)) {
    expect(css).toContain(`${tokenName}:`);
  }
});

it("publishes the token sheet at @showcase/ui-system/tokens.css", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  expect(manifest.exports["./tokens.css"]).toBe("./src/tokens.css");
});
