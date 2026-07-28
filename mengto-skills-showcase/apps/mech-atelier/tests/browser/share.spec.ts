import {
  expect,
  test as base,
  type ConsoleMessage,
  type Page,
} from "@playwright/test";

const localKey = "mech-atelier:v1";
const bastionConfiguration = {
  version: 1,
  chassisId: "bastion-hauler",
  headId: "surveyor-head",
  armorId: "ceramic-shell",
  leftWeaponId: "arc-blade",
  rightWeaponId: "drone-rack",
  rearModuleId: "jump-pack",
  finish: {
    primary: "#7a2f24",
    secondary: "#d8b36a",
    metalness: 0.5,
    roughness: 0.6,
    environment: "foundry",
  },
} as const;

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
    await expect(page.locator("[data-product-canvas]")).toHaveCount(1);
  },
});

test("复制当前 canonical absolute URL，成功后显示中文反馈", async ({
  cleanPage: page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (globalThis as typeof globalThis & { __copied?: string }).__copied =
            value;
        },
      },
    });
  });
  await page.goto("/?v=1&c=oracle-frame&h=halo-head&e=dusk");

  await page.getByRole("button", { name: "复制配置链接" }).click();

  const expected = new URL(
    "/?v=1&c=oracle-frame&h=halo-head&e=dusk",
    page.url(),
  ).href;
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (globalThis as typeof globalThis & { __copied?: string }).__copied,
      ),
    )
    .toBe(expected);
  await expect(page.locator("[data-share-status]")).toHaveText(
    "配置链接已复制。",
  );
  await expect(page.locator("[data-share-fallback]")).toBeHidden();
});

test("剪贴板失败时展示可选择的只读完整链接且不吞掉错误", async ({
  cleanPage: page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("clipboard blocked");
        },
      },
    });
  });
  await page.goto("/?v=1&c=bastion-hauler&a=reactive-bastion");

  await page.getByRole("button", { name: "复制配置链接" }).click();

  await expect(page.locator("[data-share-status]")).toContainText(
    "无法自动复制",
  );
  await expect(page.locator("[data-share-status]")).toContainText(
    "clipboard blocked",
  );
  const fallback = page.locator("[data-share-fallback]");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("readonly", "");
  await expect(fallback).toHaveValue(
    new URL(
      "/?v=1&c=bastion-hauler&a=reactive-bastion",
      page.url(),
    ).href,
  );
  await expect(fallback).toBeFocused();
  expect(
    await fallback.evaluate((input: HTMLInputElement) => ({
      start: input.selectionStart,
      end: input.selectionEnd,
      length: input.value.length,
    })),
  ).toEqual({
    start: 0,
    end: (
      await fallback.inputValue()
    ).length,
    length: (
      await fallback.inputValue()
    ).length,
  });
});

test("共享链接可粘贴式打开和刷新，并优先于合法本地配置", async ({
  cleanPage: page,
}) => {
  await seedLocalConfiguration(page, bastionConfiguration);
  await page.goto(
    "/?v=1&c=oracle-frame&h=halo-head&rw=rail-lance&r=field-relay&e=dusk",
  );

  await expect(page.getByRole("radio", { name: /神谕框架/ })).toBeChecked();
  await expect(page.getByRole("radio", { name: /光环头部/ })).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "右侧武器" })
      .getByRole("radio", { name: "磁轨长枪" }),
  ).toBeChecked();
  await expect(page.getByRole("radio", { name: "暮色" })).toBeChecked();
  await page.reload();
  await expect(page.getByRole("radio", { name: /神谕框架/ })).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "右侧武器" })
      .getByRole("radio", { name: "磁轨长枪" }),
  ).toBeChecked();
});

test("无版本化 URL 时读取合法本地配置，损坏存储保持原文且回到默认", async ({
  cleanPage: page,
}) => {
  await seedLocalConfiguration(page, bastionConfiguration);
  await page.goto("/");
  await expect(
    page.getByRole("radio", { name: /堡垒运输型/ }),
  ).toBeChecked();
  await expect(page.locator("[data-summary-price]")).toHaveText(
    "216,000 信用点",
  );
  await page.reload();
  await expect(
    page.getByRole("radio", { name: /堡垒运输型/ }),
  ).toBeChecked();

  const broken = "{still-broken";
  await page.evaluate(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: localKey, value: broken },
  );
  await page.goto("/");
  await expect(
    page.getByRole("radio", { name: /游骑侦察型/ }),
  ).toBeChecked();
  expect(await page.evaluate((key) => localStorage.getItem(key), localKey)).toBe(
    broken,
  );
});

test("非法共享值逐项中文播报、规范化 URL，恶意 HTML 永远只是文本", async ({
  cleanPage: page,
}) => {
  const payload = "<img src=x onerror=globalThis.__pwned=1>";
  await page.goto(
    `/?v=1&c=${encodeURIComponent(payload)}&lw=rail-lance&p=${encodeURIComponent(payload)}`,
  );

  const announcer = page.locator("[data-config-announcer]");
  await expect(announcer).toContainText("底盘");
  await expect(announcer).toContainText("左侧武器");
  await expect(announcer).toContainText("主色");
  await expect(announcer).toContainText("已规范化");
  await expect(announcer.locator("[data-config-issue]")).toHaveCount(3);
  expect(await page.locator("img").count()).toBe(0);
  expect(
    await page.evaluate(
      () =>
        (globalThis as typeof globalThis & { __pwned?: number }).__pwned,
    ),
  ).toBeUndefined();
  await expect(
    page.getByRole("radio", { name: /游骑侦察型/ }),
  ).toBeChecked();
  expect(new URL(page.url()).search).toBe("?v=1&c=strider-scout");
});

test("恢复默认必须确认：取消无变化，确认同步 scene、summary、URL 和唯一存储键", async ({
  cleanPage: page,
}) => {
  await page.goto("/?v=1&c=oracle-frame&h=halo-head&e=dusk");
  await page.evaluate(() => localStorage.setItem("unrelated-key", "keep-me"));

  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "恢复默认配置" }).click();
  await expect(page.getByRole("radio", { name: /神谕框架/ })).toBeChecked();
  expect(new URL(page.url()).search).toContain("c=oracle-frame");
  expect(
    await page.evaluate((key) => localStorage.getItem(key), localKey),
  ).toBeNull();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "恢复默认配置" }).click();
  await expect(
    page.getByRole("radio", { name: /游骑侦察型/ }),
  ).toBeChecked();
  await expect(page.locator("[data-summary-price]")).toHaveText(
    "184,000 信用点",
  );
  expect(new URL(page.url()).search).toBe("?v=1&c=strider-scout");
  expect(await page.evaluate(() => localStorage.getItem("unrelated-key"))).toBe(
    "keep-me",
  );
  expect(
    JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), localKey))!,
    ),
  ).toEqual({
    version: 1,
    config: {
      ...bastionConfiguration,
      chassisId: "strider-scout",
    },
  });
});

test("快速配置只在最后一次后 250ms 写一次，replaceState 不增加 history", async ({
  cleanPage: page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    (
      globalThis as typeof globalThis & {
        __storageWrites?: Array<{ key: string; value: string }>;
      }
    ).__storageWrites = [];
    Storage.prototype.setItem = function (key: string, value: string) {
      (
        globalThis as typeof globalThis & {
          __storageWrites: Array<{ key: string; value: string }>;
        }
      ).__storageWrites.push({ key, value });
      return original.call(this, key, value);
    };
  });
  await page.goto("/");
  const initialHistoryLength = await page.evaluate(() => history.length);

  await page.evaluate(() => {
    for (const value of ["hangar", "foundry", "dusk"]) {
      const input = document.querySelector<HTMLInputElement>(
        `input[name="finish.environment"][value="${value}"]`,
      );
      if (!input) throw new Error(`Missing environment ${value}`);
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __storageWrites: unknown[];
          }
        ).__storageWrites.length,
    ),
  ).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            globalThis as typeof globalThis & {
              __storageWrites: unknown[];
            }
          ).__storageWrites.length,
      ),
    )
    .toBe(1);
  expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);
  expect(
    await page.evaluate(
      () =>
        (
          globalThis as typeof globalThis & {
            __storageWrites: Array<{ key: string }>;
          }
        ).__storageWrites.map(({ key }) => key),
    ),
  ).toEqual([localKey]);
  expect(new URL(page.url()).search).toBe(
    "?v=1&c=strider-scout&e=dusk",
  );
});

test("pagehide 立即 flush 最后合法配置并清理延时任务", async ({
  cleanPage: page,
}) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "机库" }).check();
  await page.goto("/?reviewControls=1");

  await expect(page.getByRole("radio", { name: "机库" })).toBeChecked();
  expect(
    JSON.parse(
      (await page.evaluate((key) => localStorage.getItem(key), localKey))!,
    ).config.finish.environment,
  ).toBe("hangar");
});

async function seedLocalConfiguration(
  page: Page,
  config: typeof bastionConfiguration,
): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value);
    },
    {
      key: localKey,
      value: JSON.stringify({ version: 1, config }),
    },
  );
}
