import {
  expect,
  test as base,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";

interface CameraSnapshot {
  yaw: number;
  pitch: number;
  distance: number;
  boundsHeight: number;
  boundsWidth: number;
  boundsDepth: number;
  groundMinY: number;
  fitsBounds: boolean;
}

interface SceneSnapshot {
  rendererId: number;
  canvasId: number;
  sceneId: number;
  assemblyId: number;
  parts: Record<string, number>;
  environment: "foundry" | "hangar" | "dusk";
  camera: CameraSnapshot;
  rendererSize: { width: number; height: number };
}

declare global {
interface Window {
    __MECH_ATELIER_DEBUG__?: {
      snapshot(): SceneSnapshot;
      nonEmptyPixelCount(): number;
    };
  }
}

const test = base.extend<{
  cleanPage: Page;
}>({
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

async function snapshot(page: Page): Promise<SceneSnapshot> {
  return page.evaluate(() => window.__MECH_ATELIER_DEBUG__!.snapshot());
}

test("默认首屏展示精确摘要、概念边界和唯一非空 WebGL 画布", async ({
  cleanPage: page,
}, testInfo) => {
  await page.goto("/");
  expect(
    await page.evaluate(() => "__MECH_ATELIER_DEBUG__" in window),
  ).toBe(false);
  await page.goto("/?reviewControls=1");

  await expect(
    page.getByRole("heading", { name: "机甲定制工坊" }),
  ).toBeVisible();
  await expect(page.locator("[data-product-canvas]")).toHaveCount(1);
  await expect(page.locator("[data-summary-price]")).toHaveText(
    "184,000 信用点",
  );
  await expect(page.locator("[data-summary-weight]")).toHaveText(
    "28 / 32 kg",
  );
  await expect(page.locator("[data-summary-power]")).toHaveText("62");
  await expect(page.locator("[data-summary-guard]")).toHaveText("41");
  await expect(page.locator("[data-summary-mobility]")).toHaveText("78");
  await expect(
    page.getByText("概念配置，不提供结算或库存功能"),
  ).toBeVisible();
  await expect(
    page.getByText("项目自制程序化概念模型 · L2 可检查"),
  ).toBeVisible();

  await expect
    .poll(() => page.evaluate(() =>
      window.__MECH_ATELIER_DEBUG__!.nonEmptyPixelCount(),
    ))
    .toBeGreaterThan(120);
  await page.screenshot({
    path: testInfo.outputPath("mech-default-1440.png"),
    animations: "disabled",
  });
});

test("合法改装保持 renderer、canvas、scene 和 assembly 身份，只替换变化部件", async ({
  cleanPage: page,
}) => {
  await page.goto("/?reviewControls=1");
  const initial = await snapshot(page);

  await page.getByRole("radio", { name: /堡垒运输型/ }).check();
  const afterChassis = await snapshot(page);
  expect(afterChassis.rendererId).toBe(initial.rendererId);
  expect(afterChassis.canvasId).toBe(initial.canvasId);
  expect(afterChassis.sceneId).toBe(initial.sceneId);
  expect(afterChassis.assemblyId).toBe(initial.assemblyId);
  expect(afterChassis.parts.chassis).not.toBe(initial.parts.chassis);
  for (const slot of [
    "head",
    "armor",
    "leftWeapon",
    "rightWeapon",
    "rearModule",
  ]) {
    expect(afterChassis.parts[slot]).toBe(initial.parts[slot]);
  }

  await page
    .getByRole("group", { name: "左侧武器" })
    .getByRole("radio", { name: "神盾" })
    .check();
  const afterWeapon = await snapshot(page);
  expect(afterWeapon.parts.leftWeapon).not.toBe(
    afterChassis.parts.leftWeapon,
  );
  for (const slot of [
    "chassis",
    "head",
    "armor",
    "rightWeapon",
    "rearModule",
  ]) {
    expect(afterWeapon.parts[slot]).toBe(afterChassis.parts[slot]);
  }
  await expect(page.locator("[data-summary-price]")).toHaveText(
    "224,000 信用点",
  );
  await expect(page.locator("[data-summary-weight]")).toHaveText(
    "40 / 52 kg",
  );
  await expect(page.locator("[data-summary-power]")).toHaveText("54");
  await expect(page.locator("[data-summary-guard]")).toHaveText("73");
  await expect(page.locator("[data-summary-mobility]")).toHaveText("44");
  await expect(page.locator("[data-product-canvas]")).toHaveCount(1);
});

test("不兼容项禁用并紧邻中文原因，切换底盘会规范化并播报", async ({
  cleanPage: page,
}) => {
  await page.goto("/?reviewControls=1");

  const leftRail = page
    .getByRole("group", { name: "左侧武器" })
    .getByRole("radio", { name: "磁轨长枪" });
  await expect(leftRail).toBeDisabled();
  await expect(
    page.getByText("磁轨长枪：仅支持右侧武器位。"),
  ).toBeVisible();
  await expect(
    page.getByText("反应式堡垒装甲：与游骑侦察型底盘不兼容。"),
  ).toBeVisible();

  await page.getByRole("radio", { name: /堡垒运输型/ }).check();
  await page.getByRole("radio", { name: /反应式堡垒装甲/ }).check();
  await page.getByRole("radio", { name: /游骑侦察型/ }).check();

  await expect(
    page.getByRole("radio", { name: /陶瓷外壳/ }),
  ).toBeChecked();
  await expect(page.locator("[data-config-announcer]")).toContainText(
    "反应式堡垒装甲与游骑侦察型不兼容，已调整为陶瓷外壳。",
  );
});

test("三套环境切换真实场景预设，三种底盘都按测量边界完整取景", async ({
  cleanPage: page,
}) => {
  await page.goto("/?reviewControls=1");

  for (const [name, environment] of [
    ["铸造厂", "foundry"],
    ["机库", "hangar"],
    ["暮色", "dusk"],
  ] as const) {
    await page.getByRole("radio", { name }).check();
    await expect
      .poll(async () => (await snapshot(page)).environment)
      .toBe(environment);
    await expect
      .poll(() => page.evaluate(() =>
        window.__MECH_ATELIER_DEBUG__!.nonEmptyPixelCount(),
      ))
      .toBeGreaterThan(120);
  }

  for (const name of ["游骑侦察型", "堡垒运输型", "神谕框架"]) {
    await page.getByRole("radio", { name: new RegExp(name) }).check();
    const state = await snapshot(page);
    expect(state.camera.fitsBounds).toBe(true);
    expect(state.camera.groundMinY).toBeCloseTo(0, 4);
    expect(state.camera.boundsHeight).toBeGreaterThan(3);
    expect(state.camera.boundsWidth).toBeGreaterThan(1);
    expect(state.camera.boundsDepth).toBeGreaterThan(0.5);
  }
});

test("拖拽、滚轮、双指缩放和重置视图都产生可测变化", async ({
  cleanPage: page,
}) => {
  await page.goto("/?reviewControls=1");
  const canvas = page.locator("[data-product-canvas]");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const before = await snapshot(page);

  await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width * 0.68,
    box!.y + box!.height * 0.42,
    { steps: 5 },
  );
  await page.mouse.up();
  const afterDrag = await snapshot(page);
  expect(afterDrag.camera.yaw).not.toBeCloseTo(before.camera.yaw, 3);

  await canvas.hover();
  await page.mouse.wheel(0, -360);
  const afterWheel = await snapshot(page);
  expect(afterWheel.camera.distance).toBeLessThan(afterDrag.camera.distance);

  await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement;
    const emit = (
      type: string,
      pointerId: number,
      clientX: number,
      clientY: number,
    ) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "touch",
      pointerId,
      clientX,
      clientY,
      isPrimary: pointerId === 1,
    }));
    const rect = target.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    emit("pointerdown", 1, centerX - 30, centerY);
    emit("pointerdown", 2, centerX + 30, centerY);
    emit("pointermove", 1, centerX - 58, centerY);
    emit("pointermove", 2, centerX + 58, centerY);
    emit("pointerup", 1, centerX - 58, centerY);
    emit("pointerup", 2, centerX + 58, centerY);
  });
  const afterPinch = await snapshot(page);
  expect(afterPinch.camera.distance).toBeLessThan(afterWheel.camera.distance);

  await page.getByRole("button", { name: "重置视图" }).click();
  const reset = await snapshot(page);
  expect(reset.camera.yaw).toBeCloseTo(before.camera.yaw, 4);
  expect(reset.camera.pitch).toBeCloseTo(before.camera.pitch, 4);
  expect(reset.camera.distance).toBeCloseTo(before.camera.distance, 4);
});

test("resize 保持单一画布尺寸同步，1024 宽无横向滚动且键盘可配置", async ({
  cleanPage: page,
}, testInfo) => {
  await page.goto("/?reviewControls=1");
  const initial = await snapshot(page);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect
    .poll(async () => (await snapshot(page)).rendererSize.width)
    .toBeGreaterThan(500);
  const resized = await snapshot(page);
  expect(resized.rendererId).toBe(initial.rendererId);
  expect(resized.canvasId).toBe(initial.canvasId);
  expect(resized.rendererSize.height).toBeGreaterThan(300);
  expect(
    await page.evaluate(() =>
      document.documentElement.scrollWidth <=
      document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const halo = page.getByRole("radio", { name: /光环头部/ });
  await halo.focus();
  await halo.press("Space");
  await expect(halo).toBeChecked();
  await expect(page.locator("[data-summary-power]")).toHaveText("66");
  await page.screenshot({
    path: testInfo.outputPath("mech-1024.png"),
    animations: "disabled",
  });
});

test("review 状态只允许确定性白名单，未知值回到默认并中文提示", async ({
  cleanPage: page,
}) => {
  await page.goto("/?review=oracle-dusk");
  await expect(
    page.getByRole("radio", { name: /神谕框架/ }),
  ).toBeChecked();
  await expect(page.getByRole("radio", { name: "暮色" })).toBeChecked();
  const first = await snapshot(page);
  await page.reload();
  const second = await snapshot(page);
  expect(second.environment).toBe(first.environment);
  expect(second.camera.boundsHeight).toBeCloseTo(
    first.camera.boundsHeight,
    5,
  );
  await expect(page.locator("[data-config-announcer]")).toHaveText("");

  await page.goto("/?review=anything-goes&reviewControls=1");
  await expect(
    page.getByRole("radio", { name: /游骑侦察型/ }),
  ).toBeChecked();
  await expect(page.locator("[data-config-announcer]")).toContainText(
    "未知审阅状态 anything-goes，已恢复默认配置。",
  );
});
