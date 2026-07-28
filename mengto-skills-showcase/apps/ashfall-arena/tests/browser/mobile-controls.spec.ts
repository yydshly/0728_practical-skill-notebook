import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __setTask6Gamepad(
      button: number | null,
      pressed: boolean,
      connected?: boolean,
    ): void;
  }
}

type ReviewSnapshot = {
  player: {
    health: number;
    healingCharges: number;
    weaponId: string;
    lockTargetId: string | null;
    action: string;
    position: { x: number; y: number };
  };
  paused: boolean;
};

const reviewState = (page: Page) =>
  page.evaluate(() => {
    const review = (
      window as unknown as {
        __review: { getSerializableState(): ReviewSnapshot };
      }
    ).__review;
    return review.getSerializableState();
  });

const assertNoBrowserErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return () => expect(errors, "browser console and page errors").toEqual([]);
};

for (const viewport of [
  {
    label: "portrait",
    width: 390,
    height: 844,
    safe: { top: 36, right: 22, bottom: 44, left: 24 },
  },
  {
    label: "landscape",
    width: 844,
    height: 390,
    safe: { top: 18, right: 46, bottom: 20, left: 46 },
  },
] as const) {
  test.describe(viewport.label, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
      hasTouch: true,
    });

    test("touch exposes every combat verb without overflow", async ({ page }) => {
      const assertClean = assertNoBrowserErrors(page);
      await page.goto("/?fixture=wave-one&reviewControls=1");
      await page.addStyleTag({
        content: `:root {
          --ashfall-safe-top: ${viewport.safe.top}px;
          --ashfall-safe-right: ${viewport.safe.right}px;
          --ashfall-safe-bottom: ${viewport.safe.bottom}px;
          --ashfall-safe-left: ${viewport.safe.left}px;
        }`,
      });

      await expect(page.getByLabel("移动摇杆")).toBeVisible();
      for (const name of [
        "攻击",
        "格挡",
        "闪避",
        "目标锁定",
        "切换武器",
        "治疗",
        "暂停",
      ]) {
        const button = page.getByRole("button", { name });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(44);
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      const canvasBox = await page.locator("[data-game-canvas]").boundingBox();
      const controlsBox = await page.getByLabel("触控操作").boundingBox();
      expect(canvasBox).not.toBeNull();
      expect(controlsBox).not.toBeNull();
      expect(controlsBox!.height).toBeLessThan(canvasBox!.height * 0.52);

      const touchBounds = await page
        .getByLabel("触控操作")
        .locator("button, [aria-label='移动摇杆']")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              label: element.getAttribute("aria-label") ?? element.textContent,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            };
          }),
        );
      expect(touchBounds.length).toBeGreaterThan(0);
      for (const bounds of touchBounds) {
        expect(bounds.left, `${bounds.label} left safe area`).toBeGreaterThanOrEqual(
          viewport.safe.left,
        );
        expect(bounds.right, `${bounds.label} right safe area`).toBeLessThanOrEqual(
          viewport.width - viewport.safe.right,
        );
        expect(bounds.top, `${bounds.label} top safe area`).toBeGreaterThanOrEqual(
          viewport.safe.top,
        );
        expect(bounds.bottom, `${bounds.label} bottom safe area`).toBeLessThanOrEqual(
          viewport.height - viewport.safe.bottom,
        );
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByRole("button", { name: "目标锁定" }).tap();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      assertClean();
    });
  });
}

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("touch buttons change authoritative state and cancellation clears ownership", async ({
  page,
}) => {
  const assertClean = assertNoBrowserErrors(page);
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );

  const initial = await reviewState(page);
  await page.getByRole("button", { name: "切换武器" }).tap();
  await expect
    .poll(async () => (await reviewState(page)).player.weaponId)
    .not.toBe(initial.player.weaponId);

  await page.getByRole("button", { name: "目标锁定" }).tap();
  await expect
    .poll(async () => (await reviewState(page)).player.lockTargetId)
    .not.toBeNull();

  await page.getByRole("button", { name: "攻击" }).tap();
  await expect
    .poll(async () => (await reviewState(page)).player.action)
    .toBe("attack");

  await page.evaluate(() => {
    (
      window as unknown as {
        __review: { setPlayerHealth(value: number): void };
      }
    ).__review.setPlayerHealth(60);
  });
  await expect
    .poll(async () => (await reviewState(page)).player.health)
    .toBe(60);
  await expect
    .poll(async () => (await reviewState(page)).player.action)
    .toBe("idle");
  const charges = (await reviewState(page)).player.healingCharges;
  await page.getByRole("button", { name: "治疗" }).tap();
  await expect
    .poll(async () => (await reviewState(page)).player.health)
    .toBe(95);
  expect((await reviewState(page)).player.healingCharges).toBe(charges - 1);

  await page.getByRole("button", { name: "暂停" }).tap();
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeVisible();
  expect((await reviewState(page)).paused).toBe(true);
  await page.getByRole("button", { name: "继续战斗" }).tap();
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeHidden();
  expect((await reviewState(page)).paused).toBe(false);

  const guard = page.getByRole("button", { name: "格挡" });
  await guard.dispatchEvent("pointerdown", {
    pointerId: 81,
    pointerType: "touch",
    button: 0,
  });
  await guard.dispatchEvent("pointercancel", {
    pointerId: 81,
    pointerType: "touch",
    button: 0,
  });
  const diagnostics = await page.evaluate(() =>
    (
      window as unknown as {
        __review: {
          getDiagnostics(): { input: { guardHeld: boolean } };
        };
      }
    ).__review.getDiagnostics(),
  );
  expect(diagnostics.input.guardHeld).toBe(false);
  assertClean();
});

test("device prompt follows meaningful gamepad input and disconnects safely", async ({
  page,
}) => {
  const assertClean = assertNoBrowserErrors(page);
  await page.addInitScript(() => {
    let connected = true;
    const buttons = Array.from({ length: 16 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    const pad = {
      axes: [0, 0, 0, 0],
      buttons,
      connected: true,
      id: "Ashfall standard test pad",
      index: 0,
      mapping: "standard",
      timestamp: 1,
      vibrationActuator: null,
      hapticActuators: [],
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => (connected ? [pad] : []),
    });
    (
      window as unknown as {
        __setTask6Gamepad(
          button: number | null,
          pressed: boolean,
          connected?: boolean,
        ): void;
      }
    ).__setTask6Gamepad = (button, pressed, nextConnected = connected) => {
      connected = nextConnected;
      for (const entry of buttons) {
        entry.pressed = false;
        entry.value = 0;
      }
      if (button !== null) {
        buttons[button]!.pressed = pressed;
        buttons[button]!.value = pressed ? 1 : 0;
      }
    };
  });
  await page.goto(
    "/?fixture=wave-one&reviewControls=1&manualEnemyAi=1",
  );

  await page.getByRole("button", { name: "目标锁定" }).tap();
  await expect(page.locator("[data-device-prompt]")).toContainText("触控");
  await page.evaluate(() =>
    (
      window as unknown as {
        __setTask6Gamepad(
          button: number | null,
          pressed: boolean,
          connected?: boolean,
        ): void;
      }
    ).__setTask6Gamepad(15, true),
  );
  await expect(page.locator("[data-device-prompt]")).toContainText("手柄");
  await expect
    .poll(async () => (await reviewState(page)).player.weaponId)
    .toBe("ember-bow");

  await page.evaluate(() => window.__setTask6Gamepad(null, false, true));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__setTask6Gamepad(9, true, true));
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeVisible();
  expect((await reviewState(page)).paused).toBe(true);
  await page.evaluate(() => window.__setTask6Gamepad(null, false, true));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.__setTask6Gamepad(0, true, true));
  await expect(page.getByRole("dialog", { name: "游戏已暂停" })).toBeHidden();
  expect((await reviewState(page)).paused).toBe(false);

  await page.evaluate(() => {
    (
      window as unknown as {
        __setTask6Gamepad(
          button: number | null,
          pressed: boolean,
          connected?: boolean,
        ): void;
      }
    ).__setTask6Gamepad(null, false, false);
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  await page.getByRole("button", { name: "目标锁定" }).tap();
  await expect(page.locator("[data-device-prompt]")).toContainText("触控");
  await expect
    .poll(async () => (await reviewState(page)).player.lockTargetId)
    .not.toBeNull();
  assertClean();
});
