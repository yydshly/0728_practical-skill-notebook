import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("first visit explains the Mech configuration task and can be reopened", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: /机甲定制工坊/ });
  await expect(dialog).toContainText(
    "更换机甲部件，并立即观察 3D 外观、价格和性能参数变化。",
  );
  await expect(dialog).toContainText("更换机体、头部、装甲或武器。");
  await expect(dialog).toContainText("预计 3–5 分钟");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "这是什么？" }),
  ).toBeFocused();
});

test("opening the guide closes the mobile configuration sheet without focus theft", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("button", { name: "开始配置" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-configuration-sheet",
    "closed",
  );
  await expect(
    page.getByRole("dialog", { name: /机甲定制工坊/ }),
  ).toBeVisible();
  await expect(page.locator(".showcase-guide-trigger")).toHaveCSS(
    "z-index",
    "50",
  );
  await expect(page.locator("dialog.showcase-guide-dialog")).toHaveCSS(
    "z-index",
    "60",
  );
  await expect(page.locator("[data-close-config]")).not.toBeFocused();
});

test("reopens after Escape and returns to the Mech card in the same tab", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "这是什么？" }).click();
  const link = page.getByRole("link", { name: "返回能力展厅" });
  await expect(link).not.toHaveAttribute("target");
  await expect(link).toHaveAttribute("href", /#product-mech-atelier$/);
});

test("a blocked localStorage getter keeps Mech onboarding usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: /机甲定制工坊/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(
    page.getByRole("dialog", { name: /机甲定制工坊/ }),
  ).toBeVisible();
});

test("WebGL fallback retains Mech onboarding and return", async ({ page }) => {
  await page.goto("/?reviewControls=1&forceWebglFailure=1");
  await expect(
    page.getByRole("dialog", { name: /机甲定制工坊/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "开始体验" }).click();
  await expect(page.getByText("3D 预览不可用")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "这是什么？" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("link", { name: "返回能力展厅" }))
    .toHaveAttribute("href", /#product-mech-atelier$/);
});

test("changes one part and exposes linked summary and canonical URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始体验" }).click();
  await page.getByRole("radio", { name: /光环头部/ }).check();
  await expect(page.locator("[data-summary-price]")).toContainText("194,000");
  await expect(page.locator("[data-summary-weight]")).toContainText(
    "29 / 32 kg",
  );
  await expect(page.locator("[data-summary-power]")).toContainText("66");
  await expect(page.locator("[data-summary-guard]")).toContainText("43");
  await expect(page.locator("[data-summary-mobility]")).toContainText("74");
  await expect(page).toHaveURL(/v=1.*c=strider-scout.*h=halo-head/);
  await expect(page.locator("canvas")).toHaveCount(1);
});

test("repeated guide toggles preserve the configuration URL and summary", async ({
  page,
}) => {
  await page.goto("/?v=1&c=strider-scout&h=halo-head");
  await page.getByRole("button", { name: "开始体验" }).click();

  for (let index = 0; index < 2; index += 1) {
    await page.getByRole("button", { name: "这是什么？" }).click();
    await page.keyboard.press("Escape");
  }

  await expect(page).toHaveURL(
    /\/\?v=1&c=strider-scout&h=halo-head$/,
  );
  await expect(
    page.getByRole("radio", { name: /光环头部/ }),
  ).toBeChecked();
  await expect(page.locator("[data-summary-price]")).toContainText("194,000");
  await expect(page.locator("[data-summary-weight]")).toContainText(
    "29 / 32 kg",
  );
  await expect(page.locator("[data-summary-power]")).toContainText("66");
  await expect(page.locator("[data-summary-guard]")).toContainText("43");
  await expect(page.locator("[data-summary-mobility]")).toContainText("74");
});
