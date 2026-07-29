import { expect, test } from "@playwright/test";

test("first visit opens synchronously, session close stays closed, reload opens again", async ({ page }) => {
  await page.goto("/tests/fixture/");
  const dialog = page.getByRole("dialog", { name: "测试产品导览" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) =>
    node.style.getPropertyValue("--showcase-guide-accent")
  )).toBe("#123456");
  await page.getByRole("button", { name: "开始体验" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-close-log]")).toHaveText("start");
  await page.reload();
  await expect(dialog).toBeVisible();
});

test("persistent opt-out suppresses auto-open but never manual reopen", async ({ page }) => {
  await page.goto("/tests/fixture/");
  await page.getByRole("checkbox", { name: "不再自动显示" }).check();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("blocked automatic open remains pending until retry succeeds", async ({ page }) => {
  await page.goto("/tests/fixture/?blocked=1");
  const dialog = page.getByRole("dialog");
  const unblock = page.getByRole("button", { name: "解除宿主阻塞" });
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-auto-result]")).toHaveText("blocked");
  await unblock.click();
  await expect(page.locator("[data-auto-result]")).toHaveText("opened");
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await unblock.click();
  await expect(page.locator("[data-auto-result]")).toHaveText("settled");
  await expect(dialog).toBeHidden();
});

test("persistent preferences remain isolated by product and guide version", async ({ page }) => {
  await page.goto("/tests/fixture/?product=monster-forge&version=1");
  await page.getByRole("checkbox", { name: "不再自动显示" }).check();
  await page.getByRole("button", { name: "关闭说明" }).click();
  await page.reload();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/tests/fixture/?product=monster-forge&version=2");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.goto("/tests/fixture/?product=mech-atelier&version=1");
  await expect(page.getByRole("dialog")).toBeVisible();
});

for (const failure of ["getter", "read", "write"] as const) {
  test(`storage ${failure} failure still permits open, close and reopen`, async ({ page }) => {
    await page.goto(`/tests/fixture/?storageFailure=${failure}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    if (failure === "write") {
      await page.getByRole("checkbox", { name: "不再自动显示" }).check();
    }
    await page.getByRole("button", { name: "关闭说明" }).click();
    await page.getByRole("button", { name: "这是什么？" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}

test("traps focus, stops Escape propagation and restores the opener", async ({ page }) => {
  await page.goto("/tests/fixture/?hidden=1");
  const opener = page.getByRole("button", { name: "这是什么？" });
  await opener.focus();
  await opener.click();
  await expect(page.locator("main")).toHaveAttribute("inert", "");
  await expect(page.getByRole("button", { name: "开始体验" })).toBeFocused();
  await page.getByRole("checkbox", { name: "不再自动显示" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("link", { name: "返回能力展厅" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(page.locator("[data-host-escape-count]")).toHaveText("0");
  await expect(page.locator("html")).not.toHaveAttribute("data-guide-scroll-lock");
});

test("hub link persists opt-out without entering the close recovery branch", async ({ page }) => {
  await page.goto("/tests/fixture/");
  await page.getByRole("checkbox", { name: "不再自动显示" }).check();
  await page.getByRole("link", { name: "返回能力展厅" }).click();
  await expect(page).toHaveURL(/returned=1#product-monster-forge$/);
  await expect(page.locator("[data-close-log]")).toHaveText("");
  expect(await page.evaluate(() =>
    localStorage.getItem(
      "mengto-showcase:guide:monster-forge:v1:auto-hidden",
    )
  )).toBe("true");
});

test("destroy removes DOM and listeners without invoking onClose", async ({ page }) => {
  await page.goto("/tests/fixture/");
  await page.getByRole("button", { name: "销毁导览" }).evaluate(
    (button: HTMLButtonElement) => button.click(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "这是什么？" })).toHaveCount(0);
  await expect(page.locator("[data-close-log]")).toHaveText("");
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-host-escape-count]")).toHaveText("1");
});

test("close and destroy restore a pre-existing host scroll-lock marker", async ({ page }) => {
  await page.goto("/tests/fixture/?hidden=1&rootScrollLock=host-owned");
  await page.getByRole("button", { name: "这是什么？" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-guide-scroll-lock",
    "true",
  );
  await page.getByRole("button", { name: "关闭说明" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-guide-scroll-lock",
    "host-owned",
  );

  await page.getByRole("button", { name: "这是什么？" }).click();
  await page.getByRole("button", { name: "销毁导览" }).evaluate(
    (button: HTMLButtonElement) => button.click(),
  );
  await expect(page.locator("html")).toHaveAttribute(
    "data-guide-scroll-lock",
    "host-owned",
  );
});

test("mobile controls remain 44px and reduced motion removes guide transitions", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixture/");
  for (const control of await page.getByRole("dialog").locator("button, a, label").all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  const panel = page.locator(".showcase-guide-panel");
  expect((await panel.boundingBox())?.height).toBeLessThanOrEqual(844);
  const transitionDuration = await panel.evaluate((node) =>
    getComputedStyle(node).transitionDuration
  );
  const transitionDurationMs = transitionDuration.endsWith("ms")
    ? Number.parseFloat(transitionDuration)
    : Number.parseFloat(transitionDuration) * 1_000;
  expect(transitionDurationMs).toBeLessThanOrEqual(0.01);
});

test("shared guide styles do not rewrite an unrelated host dialog", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/tests/fixture/?hidden=1");
  const hostDialog = page.locator("[data-host-dialog]");
  await hostDialog.evaluate((node: HTMLDialogElement) => node.showModal());
  const style = await hostDialog.evaluate((node) => {
    const computed = getComputedStyle(node);
    return {
      inlineSize: computed.inlineSize,
      marginTop: computed.marginTop,
      transitionDuration: computed.transitionDuration,
    };
  });
  expect(style).toEqual({
    inlineSize: "240px",
    marginTop: "12px",
    transitionDuration: "2s",
  });
});
