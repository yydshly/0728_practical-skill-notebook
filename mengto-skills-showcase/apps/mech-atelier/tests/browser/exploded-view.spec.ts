import {
  expect,
  test as base,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";

const test = base.extend<{ cleanPage: Page }>({
  cleanPage: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const missingResources: string[] = [];
    page.on("console", (message: ConsoleMessage) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() === 404) missingResources.push(response.url());
    });
    await use(page);
    expect(consoleErrors, "浏览器控制台不应出现错误").toEqual([]);
    expect(pageErrors, "页面不应抛出运行时错误").toEqual([]);
    expect(missingResources, "页面不应请求 404 资源").toEqual([]);
  },
});

test("分解视图展示五个中文热点并可逆返回原始装配", async ({
  cleanPage: page,
}) => {
  await page.goto("/?reviewControls=1");
  const initial = await sceneSnapshot(page);
  await page.getByRole("button", { name: "分解视图" }).click();
  await expect(page.locator("[data-exploded-state]")).toHaveAttribute(
    "data-exploded-state",
    "exploded",
  );
  await expect
    .poll(async () => (await sceneSnapshot(page)).exploded.progress)
    .toBe(1);

  for (const name of [
    "头部",
    "装甲",
    "左侧武器",
    "右侧武器",
    "背部模块",
  ]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
  const exploded = await sceneSnapshot(page);
  expect(exploded.exploded.maxDisplacement).toBeLessThanOrEqual(1.8);
  expect(exploded.rendererId).toBe(initial.rendererId);
  expect(await page.locator("[data-product-canvas]").count()).toBe(1);

  await page.getByRole("button", { name: "重新组装" }).click();
  await expect
    .poll(async () => (await sceneSnapshot(page)).exploded.progress)
    .toBe(0);
  expect((await sceneSnapshot(page)).exploded.parts.head).toEqual([0, 0, 0]);
});

test("热点跟随拖拽并把焦点送到对应配置组首个可用选项", async ({
  cleanPage: page,
}) => {
  await page.goto("/?reviewControls=1");
  await page.getByRole("button", { name: "分解视图" }).click();
  const head = page.getByRole("button", { name: "头部" });
  const before = await head.getAttribute("style");
  const canvas = page.locator("[data-product-canvas]");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.46, box!.y + box!.height * 0.52);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.67, box!.y + box!.height * 0.5, {
    steps: 6,
  });
  await page.mouse.up();
  await expect.poll(() => head.getAttribute("style")).not.toBe(before);

  for (const [label, group] of [
    ["头部", "头部"],
    ["装甲", "装甲"],
    ["左侧武器", "左侧武器"],
    ["右侧武器", "右侧武器"],
    ["背部模块", "背部模块"],
  ] as const) {
    const hotspot = page.getByRole("button", { name: label });
    await hotspot.click();
    const fieldset = page.getByRole("group", { name: group });
    await expect(fieldset).toBeInViewport();
    await expect(fieldset.locator("input:not(:disabled)").first()).toBeFocused();
    await expect(hotspot).toHaveAttribute("aria-controls", /option-group-/);
  }
});

test("reduced motion 即时切换，分解中换件并重复五十次仍无漂移", async ({
  cleanPage: page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?reviewControls=1");
  const original = await sceneSnapshot(page);
  const toggle = page.locator("[data-toggle-exploded]");

  await toggle.click();
  expect((await sceneSnapshot(page)).exploded.progress).toBe(1);
  await page
    .getByRole("group", { name: "头部" })
    .getByRole("radio", { name: "光环头部" })
    .check();
  const changed = await sceneSnapshot(page);
  expect(changed.exploded.parts.head).toEqual([0, 1.25, 0]);

  await toggle.click();
  await toggle.evaluate((button) => {
    for (let index = 0; index < 50; index += 1) {
      (button as HTMLButtonElement).click();
    }
  });
  if ((await toggle.textContent())?.includes("重新组装")) {
    await toggle.click();
  }
  const final = await sceneSnapshot(page);
  expect(final.exploded.progress).toBe(0);
  for (const position of Object.values(final.exploded.parts)) {
    expect(position).toEqual([0, 0, 0]);
  }
  expect(final.rendererId).toBe(original.rendererId);
  expect(await page.locator("canvas").count()).toBe(1);
});

interface SceneSnapshot {
  rendererId: number;
  exploded: {
    progress: number;
    maxDisplacement: number;
    parts: Record<string, [number, number, number]>;
  };
}

async function sceneSnapshot(page: Page): Promise<SceneSnapshot> {
  return page.evaluate(() => {
    const debug = (
      window as unknown as {
        __MECH_ATELIER_DEBUG__?: { snapshot(): SceneSnapshot };
      }
    ).__MECH_ATELIER_DEBUG__;
    if (!debug) throw new Error("Mech debug controls are missing");
    return debug.snapshot();
  });
}
