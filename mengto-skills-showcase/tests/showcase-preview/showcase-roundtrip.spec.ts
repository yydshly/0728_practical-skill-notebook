import {
  expect,
  test,
  type BrowserContext,
  type Page,
} from "@playwright/test";

const PREVIEW_ORIGIN = "http://127.0.0.1:4292";
const ASHFALL_LIFECYCLE_STORAGE_KEY =
  "__task12:ashfall-pagehide-lifecycle:v1";

const products = [
  ["Monster Forge", "monster-forge", "product-monster-forge"],
  ["Ashfall Arena", "ashfall-arena", "product-ashfall-arena"],
  ["Mech Atelier", "mech-atelier", "product-mech-atelier"],
] as const;

type Product = (typeof products)[number];

type LifecycleSample = {
  phase:
    | "hub-click-capture"
    | "pagehide-start"
    | "pagehide-after-dispose";
  dialogOpen: boolean;
  scrollLocked: boolean;
  runtimeDisposed: boolean;
};

async function openFreshHub(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.locator('meta[name="showcase-app"]')).toHaveAttribute(
    "content",
    "showcase-hub",
  );
  expect(await page.evaluate(() => window.localStorage.length)).toBe(0);
}

async function enterProduct(
  page: Page,
  context: BrowserContext,
  [, id]: Product,
): Promise<void> {
  const enter = page.locator(`[data-enter-product="${id}"]`);
  await expect(enter).not.toHaveAttribute("target");
  await enter.click();

  expect(context.pages()).toHaveLength(1);
  await expect(page).toHaveURL(`${PREVIEW_ORIGIN}/${id}/`);
  await expect(page.locator('meta[name="showcase-app"]')).toHaveAttribute(
    "content",
    id,
  );
}

async function returnFromGuide(
  page: Page,
  context: BrowserContext,
  [, , anchor]: Product,
): Promise<void> {
  const dialog = page.locator("dialog.showcase-guide-dialog");
  await expect(dialog).toBeVisible();

  const returnLink = dialog.getByRole("link", {
    name: "返回能力展厅",
    exact: true,
  });
  await expect(returnLink).not.toHaveAttribute("target");
  await returnLink.click();

  expect(context.pages()).toHaveLength(1);
  await expect(page).toHaveURL(`${PREVIEW_ORIGIN}/#${anchor}`);
  await expect(page.locator(`#${anchor} h3`)).toBeFocused();
}

async function normalRoundTrip(
  page: Page,
  context: BrowserContext,
  product: Product,
): Promise<void> {
  await enterProduct(page, context, product);
  await returnFromGuide(page, context, product);
}

async function expectLiveAshfallRuntime(page: Page): Promise<void> {
  await expect(page.locator("[data-runtime-fallback]")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-render-mode",
    "information-fallback",
  );
  await expect(page.locator("[data-game-canvas]")).toBeVisible();
}

async function installAshfallLifecycleProbe(
  page: Page,
  samples: LifecycleSample[],
): Promise<void> {
  await page.exposeBinding(
    "__task12CaptureLifecycle",
    (_source, sample: LifecycleSample) => {
      samples.push(sample);
    },
  );
  await page.addInitScript((storageKey) => {
    type Sample = {
      phase:
        | "hub-click-capture"
        | "pagehide-start"
        | "pagehide-after-dispose";
      dialogOpen: boolean;
      scrollLocked: boolean;
      runtimeDisposed: boolean;
    };
    type CaptureWindow = Window & {
      __task12CaptureLifecycle(sample: Sample): Promise<void>;
    };

    const pending = window.sessionStorage.getItem(storageKey);
    if (pending !== null) {
      window.sessionStorage.removeItem(storageKey);
      for (const sample of JSON.parse(pending) as Sample[]) {
        void (window as unknown as CaptureWindow).__task12CaptureLifecycle(
          sample,
        );
      }
    }

    const capture = (phase: Sample["phase"]) => {
      const dialog = document.querySelector<HTMLDialogElement>(
        "dialog.showcase-guide-dialog",
      );
      const sample = {
        phase,
        dialogOpen: dialog?.open === true,
        scrollLocked:
          document.documentElement.dataset.guideScrollLock === "true",
        runtimeDisposed:
          document.documentElement.dataset.runtimeDisposed === "true",
      };
      const pendingSamples = JSON.parse(
        window.sessionStorage.getItem(storageKey) ?? "[]",
      ) as Sample[];
      pendingSamples.push(sample);
      window.sessionStorage.setItem(storageKey, JSON.stringify(pendingSamples));
    };

    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        const link =
          target instanceof Element
            ? target.closest("a[data-guide-hub]")
            : null;
        if (link) capture("hub-click-capture");
      },
      true,
    );

    // This listener is installed before the application module and observes
    // the old document before Ashfall's synchronous pagehide disposer.
    window.addEventListener(
      "pagehide",
      () => capture("pagehide-start"),
      { once: true },
    );

    // The application registers its disposer before DOMContentLoaded. This
    // listener is therefore synchronous but ordered after that disposer.
    document.addEventListener(
      "DOMContentLoaded",
      () => {
        window.addEventListener(
          "pagehide",
          () => capture("pagehide-after-dispose"),
          { once: true },
        );
      },
      { once: true },
    );
  }, ASHFALL_LIFECYCLE_STORAGE_KEY);
}

async function collectDocumentLinks(
  page: Page,
  links: string[],
): Promise<void> {
  links.push(
    ...(await page.locator("a[href]").evaluateAll((anchors) =>
      anchors.flatMap((anchor) => {
        const raw = anchor.getAttribute("href") ?? "";
        const resolved =
          anchor instanceof HTMLAnchorElement ? anchor.href : "";
        return [raw, resolved];
      }),
    )),
  );
}

function expectOnlyCompositeLoopback(values: readonly string[]): void {
  for (const value of values) {
    expect(value).not.toMatch(
      /127\.0\.0\.1:(4172|4173|4174|4175)|localhost|\[::1\]/i,
    );
    let parsed: URL;
    try {
      parsed = new URL(value, PREVIEW_ORIGIN);
    } catch {
      continue;
    }
    if (parsed.hostname === "127.0.0.1") {
      expect(parsed.port, `unexpected loopback origin in ${value}`).toBe(
        "4292",
      );
    }
    expect(parsed.hostname.toLowerCase()).not.toBe("localhost");
    expect(parsed.hostname).not.toBe("[::1]");
  }
}

for (const product of products) {
  if (product[1] === "ashfall-arena") {
    test(`${product[0]} round-trips with normal pagehide lifecycle evidence`, async ({
      page,
      context,
    }) => {
      await openFreshHub(page);
      const samples: LifecycleSample[] = [];
      await installAshfallLifecycleProbe(page, samples);

      await enterProduct(page, context, product);
      await expectLiveAshfallRuntime(page);
      await expect(page).not.toHaveURL(/[?&](reviewControls|guideReview)=/);
      await expect(page.locator("html")).toHaveAttribute(
        "data-guide-scroll-lock",
        "true",
      );
      await returnFromGuide(page, context, product);

      const expected: LifecycleSample[] = [
        {
          phase: "hub-click-capture",
          dialogOpen: true,
          scrollLocked: true,
          runtimeDisposed: false,
        },
        {
          phase: "pagehide-start",
          dialogOpen: true,
          scrollLocked: true,
          runtimeDisposed: false,
        },
        {
          phase: "pagehide-after-dispose",
          dialogOpen: false,
          scrollLocked: false,
          runtimeDisposed: true,
        },
      ];
      await expect.poll(() => samples.slice()).toEqual(expected);
      expect(
        await page.evaluate(
          (storageKey) => window.sessionStorage.getItem(storageKey),
          ASHFALL_LIFECYCLE_STORAGE_KEY,
        ),
      ).toBeNull();
    });
  } else {
    test(`${product[0]} round-trips to its exact showroom card`, async ({
      page,
      context,
    }) => {
      await openFreshHub(page);
      await normalRoundTrip(page, context, product);
    });
  }
}

test("all three full journeys expose only the composite preview origin", async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  const links: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await openFreshHub(page);
  for (const product of products) {
    await collectDocumentLinks(page, links);
    await enterProduct(page, context, product);
    await collectDocumentLinks(page, links);
    await returnFromGuide(page, context, product);
    await collectDocumentLinks(page, links);
    expect(context.pages()).toHaveLength(1);
  }

  expectOnlyCompositeLoopback([...requests, ...links]);
});
