import {
  access,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, parse, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertSafeShowcaseTarget,
  buildShowcase,
  showcaseBuildJobs,
} from "../scripts/build-showcase.mjs";
import {
  scanShowcaseText,
  walkFiles,
} from "../scripts/verify-showcase-links.mjs";
import showcasePreviewConfig from "../vite.showcase-preview.config.ts";
import hubViteConfig from "../apps/showcase-hub/vite.config.ts";
import monsterViteConfig from "../apps/monster-forge/vite.config.ts";
import ashfallViteConfig from "../apps/ashfall-arena/vite.config.ts";
import mechViteConfig from "../apps/mech-atelier/vite.config.ts";

const appIds = [
  "showcase-hub",
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
];
const productIds = appIds.slice(1);
const temporaryRoots = new Set();

afterEach(async () => {
  await Promise.all([...temporaryRoots].map((path) =>
    rm(path, { recursive: true, force: true })));
  temporaryRoots.clear();
});

async function temporaryDirectory(prefix) {
  const path = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.add(path);
  return path;
}

function marker(id) {
  return `<meta name="showcase-app" content="${id}" />`;
}

function validIndex(id, markerHtml = marker(id)) {
  const navigation = id === "showcase-hub"
    ? [
        '<a href="./monster-forge/">Monster</a>',
        '<a href="./ashfall-arena/">Ashfall</a>',
        '<a href="./mech-atelier/">Mech</a>',
      ].join("")
    : `<a href="../#product-${id}">Hub</a>`;
  return [
    "<!doctype html>",
    markerHtml,
    '<script type="module" src="./assets/index.js"></script>',
    navigation,
  ].join("");
}

async function createBuildRoot({
  markerById = {},
  oldShowcase = true,
  distExists = true,
} = {}) {
  const root = await temporaryDirectory("showcase-build-");
  await writeFile(join(root, "root.keep"), "root", "utf8");
  await mkdir(join(root, "sibling"), { recursive: true });
  await writeFile(join(root, "sibling", "sibling.keep"), "sibling", "utf8");
  if (distExists) {
    await mkdir(join(root, "dist"), { recursive: true });
    await writeFile(join(root, "dist", "dist.keep"), "dist", "utf8");
  }
  if (oldShowcase) {
    await mkdir(join(root, "dist", "showcase"), { recursive: true });
    await writeFile(join(root, "dist", "showcase", "old.txt"), "old", "utf8");
  }
  for (const id of appIds) {
    const source = join(root, "apps", id, "dist");
    await mkdir(join(source, "assets"), { recursive: true });
    await writeFile(join(source, "input.keep"), id, "utf8");
    await writeFile(
      join(source, "index.html"),
      validIndex(id, markerById[id] ?? marker(id)),
      "utf8",
    );
    const script = id === "showcase-hub"
      ? "const local = true;"
      : `const productId="${id}";url.hash=\`product-\${productId}\`;`;
    await writeFile(join(source, "assets", "index.js"), script, "utf8");
  }
  return root;
}

async function assertOrdinaryChain(root, target) {
  for (const [index, path] of [root, join(root, "dist"), target].entries()) {
    try {
      const stats = await lstat(path);
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error(`unsafe test directory: ${path}`);
      }
    } catch (error) {
      if (error?.code === "ENOENT" && index > 0) continue;
      throw error;
    }
  }
}

async function runFixtureBuild(root, options = {}) {
  return buildShowcase({
    root,
    runBuild: async () => {},
    inspectTarget: assertOrdinaryChain,
    ...options,
  });
}

async function expectSentinelsPreserved(root) {
  await expect(access(join(root, "dist", "showcase"))).rejects.toMatchObject({
    code: "ENOENT",
  });
  expect(await readFile(join(root, "root.keep"), "utf8")).toBe("root");
  expect(await readFile(join(root, "dist", "dist.keep"), "utf8")).toBe("dist");
  expect(await readFile(join(root, "sibling", "sibling.keep"), "utf8"))
    .toBe("sibling");
  for (const id of appIds) {
    expect(await readFile(join(root, "apps", id, "dist", "input.keep"), "utf8"))
      .toBe(id);
  }
}

async function createScanTree() {
  const root = await temporaryDirectory("showcase-scan-");
  for (const id of appIds) {
    const directory = id === "showcase-hub" ? root : join(root, id);
    await mkdir(join(directory, "assets"), { recursive: true });
    await writeFile(join(directory, "index.html"), validIndex(id), "utf8");
    const script = id === "showcase-hub"
      ? "const local = true;"
      : `const productId="${id}";url.hash=\`product-\${productId}\`;`;
    await writeFile(join(directory, "assets", "index.js"), script, "utf8");
  }
  return root;
}

async function addScanAsset(root, relativePath, content) {
  const path = join(root, ...relativePath.split("/"));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return path;
}

describe("showcase build descriptors and config", () => {
  it("allows deletion only for the exact resolved root dist/showcase directory", () => {
    const root = resolve("fixture-root");
    const exact = resolve(root, "dist", "showcase");
    expect(assertSafeShowcaseTarget(root, exact)).toBe(exact);
    for (const unsafe of [
      root,
      resolve(root, "dist"),
      dirname(root),
      parse(root).root,
      resolve(root, "apps", "monster-forge", "dist"),
      resolve(root, "sibling"),
    ]) {
      expect(() => assertSafeShowcaseTarget(root, unsafe))
        .toThrow(/refusing to clean showcase target/);
    }
  });

  it("builds the four exact relative URL environments and stable marker descriptors", () => {
    expect(showcaseBuildJobs()).toEqual([
      {
        id: "showcase-hub",
        marker: '<meta name="showcase-app" content="showcase-hub">',
        workspace: "@showcase/hub",
        source: "apps/showcase-hub/dist",
        destination: ".",
        env: {
          VITE_APP_BASE: "./",
          VITE_MONSTER_FORGE_URL: "./monster-forge/",
          VITE_ASHFALL_ARENA_URL: "./ashfall-arena/",
          VITE_MECH_ATELIER_URL: "./mech-atelier/",
        },
      },
      ...productIds.map((id) => ({
        id,
        marker: `<meta name="showcase-app" content="${id}">`,
        workspace: `@showcase/${id}`,
        source: `apps/${id}/dist`,
        destination: id,
        env: { VITE_APP_BASE: "./", VITE_SHOWCASE_HUB_URL: "../" },
      })),
    ]);
  });

  it("uses slash by default, accepts an explicit relative base, and preserves split limits", () => {
    const previous = process.env.VITE_APP_BASE;
    delete process.env.VITE_APP_BASE;
    try {
      const configs = [
        hubViteConfig,
        monsterViteConfig,
        ashfallViteConfig,
        mechViteConfig,
      ].map((factory) => factory({ mode: "production" }));
      expect(configs.map(({ base }) => base)).toEqual(["/", "/", "/", "/"]);
      process.env.VITE_APP_BASE = "./";
      expect([
        hubViteConfig,
        monsterViteConfig,
        ashfallViteConfig,
        mechViteConfig,
      ].map((factory) => factory({ mode: "production" }).base))
        .toEqual(["./", "./", "./", "./"]);
      expect(configs[2].build.rolldownOptions.output.codeSplitting.groups[0].maxSize)
        .toBe(450 * 1_024);
      expect(configs[3].build.rolldownOptions.output.codeSplitting.groups[0].maxSize)
        .toBe(430 * 1_024);
    } finally {
      if (previous === undefined) delete process.env.VITE_APP_BASE;
      else process.env.VITE_APP_BASE = previous;
    }
  });

  it("keeps Task 10 commands and exposes the combined build and preview commands", async () => {
    const manifest = JSON.parse(await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    ));
    expect(manifest.scripts).toMatchObject({
      dev: "node scripts/dev-showcase.mjs",
      "dev:forge": "npm run dev --workspace @showcase/monster-forge -- --strictPort",
      "dev:arena": "npm run dev --workspace @showcase/ashfall-arena -- --strictPort",
      "dev:atelier": "npm run dev --workspace @showcase/mech-atelier -- --strictPort",
      "build:showcase": "node scripts/build-showcase.mjs",
      "preview:showcase": "vite preview --config vite.showcase-preview.config.ts",
    });
    expect(showcasePreviewConfig).toMatchObject({
      build: { outDir: "dist/showcase" },
      preview: { host: "127.0.0.1", port: 4292, strictPort: true },
    });
  });
});

describe("exact-target failure cleanup", () => {
  it("removes only the exact target and rethrows the same second-build error", async () => {
    const root = await createBuildRoot();
    const original = new Error("second build failed");
    let index = 0;
    let caught;
    try {
      await buildShowcase({
        root,
        inspectTarget: assertOrdinaryChain,
        runBuild: async () => {
          index += 1;
          if (index === 2) throw original;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(original);
    await expectSentinelsPreserved(root);
  });

  it("cleans partial output and preserves the original copy error", async () => {
    const root = await createBuildRoot();
    const original = new Error("copy failed");
    let index = 0;
    let caught;
    try {
      await runFixtureBuild(root, {
        copyEntry: async (...args) => {
          index += 1;
          if (index === 2) throw original;
          await cp(...args);
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(original);
    await expectSentinelsPreserved(root);
  });

  it.each([
    ["missing", ""],
    ["wrong", marker("wrong-app")],
    ["duplicate", `${marker("showcase-hub")}${marker("showcase-hub")}`],
    ["conflicting", `${marker("showcase-hub")}${marker("wrong-app")}`],
    ["missing content", '<meta name="showcase-app">'],
    ["comment", `<!--${marker("showcase-hub")}-->`],
    ["script", `<script>const fake='${marker("showcase-hub")}'</script>`],
    ["style", `<style>x{content:'${marker("showcase-hub")}'}</style>`],
    [
      "scriptx",
      `<script>const fake="</scriptx>${marker("showcase-hub")}";</script>`,
    ],
    [
      "stylex",
      `<style>x{content:"</stylex>${marker("showcase-hub")}"}</style>`,
    ],
    [
      "script hyphen",
      `<script>const fake="</script-not-close>${marker("showcase-hub")}";</script>`,
    ],
    [
      "style hyphen",
      `<style>x{content:"</style-not-close>${marker("showcase-hub")}"}</style>`,
    ],
    [
      "script Unicode index",
      `<script>const fake="\u0130</scriptx>${marker("showcase-hub")}";</script>`,
    ],
    [
      "style Unicode index",
      `<style>x{content:"\u0130</stylex>${marker("showcase-hub")}"}</style>`,
    ],
  ])("rejects a %s marker and cleans only the exact target", async (_label, html) => {
    const root = await createBuildRoot({
      markerById: { "showcase-hub": html },
    });
    await expect(runFixtureBuild(root)).rejects.toThrow(/showcase-hub index/);
    await expectSentinelsPreserved(root);
  });

  it("accepts reordered, single-quoted, unquoted, and self-closing marker attributes", async () => {
    const root = await createBuildRoot({
      markerById: {
        "showcase-hub": "<META content='showcase-hub' NAME=showcase-app />",
        "monster-forge": "<meta content=monster-forge name=showcase-app>",
        "ashfall-arena": `<script>const value="\u0130";</script>${marker("ashfall-arena")}`,
      },
    });
    await expect(runFixtureBuild(root)).resolves.toBe(join(root, "dist", "showcase"));
    await expect(access(join(root, "dist", "showcase", "mech-atelier", "index.html")))
      .resolves.toBeUndefined();
  });

  it("cleans a real scan failure and keeps the generated scan error", async () => {
    const root = await createBuildRoot();
    await writeFile(
      join(root, "apps", "showcase-hub", "dist", "assets", "index.js"),
      'fetch("https://cdn.example.test/app.js")',
      "utf8",
    );
    let scanError;
    let caught;
    try {
      await runFixtureBuild(root, {
        scan: async (target) => {
          try {
            await scanShowcaseText(target);
          } catch (error) {
            scanError = error;
            throw error;
          }
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(scanError);
    expect(caught.message).toContain("cdn.example.test");
    await expectSentinelsPreserved(root);
  });

  it("rethrows the same initial-remove error after successful retry cleanup", async () => {
    const root = await createBuildRoot();
    const original = new Error("initial remove failed");
    let first = true;
    let caught;
    try {
      await runFixtureBuild(root, {
        removeExactTarget: async (target) => {
          if (first) {
            first = false;
            throw original;
          }
          await rm(target, { recursive: true, force: true });
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(original);
    await expectSentinelsPreserved(root);
  });

  it("reports original then cleanup failure in AggregateError", async () => {
    const root = await createBuildRoot();
    const original = new Error("build failed");
    const cleanup = new Error("cleanup failed");
    let removeCount = 0;
    let caught;
    try {
      await buildShowcase({
        root,
        inspectTarget: assertOrdinaryChain,
        runBuild: async () => {
          throw original;
        },
        removeExactTarget: async (target) => {
          removeCount += 1;
          if (removeCount === 1) {
            await rm(target, { recursive: true, force: true });
            return;
          }
          throw cleanup;
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    expect(caught.errors).toEqual([original, cleanup]);
    expect(caught.cause).toBe(original);
    expect(await readFile(join(root, "root.keep"), "utf8")).toBe("root");
  });

  it("rejects unsafe targets synchronously before inspection or removal", async () => {
    const root = await createBuildRoot();
    for (const target of [
      root,
      join(root, "dist"),
      dirname(root),
      parse(root).root,
      join(root, "apps", "monster-forge", "dist"),
      join(root, "sibling"),
    ]) {
      await expect(buildShowcase({
        root,
        target,
        inspectTarget: () => {
          throw new Error("inspector must not run");
        },
        removeExactTarget: () => {
          throw new Error("remover must not run");
        },
      })).rejects.toThrow(/refusing to clean showcase target/);
    }
    expect(await readFile(join(root, "dist", "showcase", "old.txt"), "utf8"))
      .toBe("old");
  });

  it("allows absent target with an existing or absent ordinary dist parent", async () => {
    for (const distExists of [true, false]) {
      const root = await createBuildRoot({ oldShowcase: false, distExists });
      await expect(runFixtureBuild(root)).resolves.toBe(join(root, "dist", "showcase"));
    }
  });

  it("accepts an ordinary real directory chain with the default Windows inspector", async () => {
    const root = await createBuildRoot();
    await expect(buildShowcase({
      root,
      runBuild: async () => {},
    })).resolves.toBe(join(root, "dist", "showcase"));
  });

  it("audits the absent exact target before creating it and audits again before copy", async () => {
    const root = await createBuildRoot();
    const target = join(root, "dist", "showcase");
    let audits = 0;
    await runFixtureBuild(root, {
      inspectTarget: async (...args) => {
        audits += 1;
        await assertOrdinaryChain(...args);
        if (audits === 2) {
          await expect(access(target)).rejects.toMatchObject({ code: "ENOENT" });
        }
        if (audits === 3) {
          const stats = await lstat(target);
          expect(stats.isDirectory()).toBe(true);
        }
      },
    });
    expect(audits).toBeGreaterThanOrEqual(3);
  });

  it("does not remove after the cleanup audit newly reports a reparse point", async () => {
    const root = await createBuildRoot();
    const original = new Error("build failed");
    const reparse = new Error("reparse point discovered");
    let audits = 0;
    let removals = 0;
    let caught;
    try {
      await buildShowcase({
        root,
        runBuild: async () => {
          throw original;
        },
        inspectTarget: async (...args) => {
          audits += 1;
          if (audits === 2) throw reparse;
          await assertOrdinaryChain(...args);
        },
        removeExactTarget: async (target) => {
          removals += 1;
          await rm(target, { recursive: true, force: true });
        },
      });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AggregateError);
    expect(caught.errors).toEqual([original, reparse]);
    expect(removals).toBe(1);
  });
});

describe("real reparse-point safety", () => {
  it.each(["root", "dist", "showcase"])(
    "refuses a real Windows junction at %s without touching its sentinel",
    async (location, context) => {
      const container = await temporaryDirectory("showcase-junction-");
      const physical = join(container, "physical");
      const linked = join(container, "linked");
      await mkdir(physical, { recursive: true });
      await writeFile(join(physical, "outside.keep"), "outside", "utf8");
      const root = location === "root" ? linked : join(container, "root");
      if (location !== "root") await mkdir(root, { recursive: true });
      const linkPath = location === "root"
        ? root
        : location === "dist"
          ? join(root, "dist")
          : join(root, "dist", "showcase");
      if (location === "showcase") await mkdir(join(root, "dist"), { recursive: true });
      try {
        await symlink(physical, linkPath, "junction");
      } catch (error) {
        if (["EPERM", "EACCES", "ENOSYS"].includes(error?.code)) {
          context.skip();
          return;
        }
        throw error;
      }
      let caught;
      try {
        await buildShowcase({
          root,
          target: join(root, "dist", "showcase"),
          runBuild: async () => {},
        });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(AggregateError);
      expect(caught.errors).toHaveLength(2);
      expect(caught.errors[0].message).toMatch(/reparse|symbolic|unsafe/i);
      expect(caught.errors[1].message).toMatch(/reparse|symbolic|unsafe/i);
      expect(await readFile(join(physical, "outside.keep"), "utf8")).toBe("outside");
    },
  );
});

describe("final showcase text scan", () => {
  it.each(["127.0.0.1", "localhost", "[::1]"])(
    "rejects loopback token %s anywhere in the tree",
    async (token) => {
      const root = await createScanTree();
      await addScanAsset(root, "monster-forge/assets/extra.js", `const value="${token}"`);
      await expect(scanShowcaseText(root)).rejects.toThrow(token);
    },
  );

  it.each(productIds.flatMap((id) => [
    [
      id,
      "XHTML namespace",
      'document.createElementNS("http://www.w3.org/1999/xhtml", "canvas")',
    ],
    [
      id,
      "shader citation",
      "const shader=`// https://jcgt.org/published/0007/04/01/\n"
        + "vec3 importanceSampleGGX_VNDF(){return vec3(0.);}`",
    ],
  ]))("allows the inert Three %s in %s assets JS", async (id, _label, content) => {
    const root = await createScanTree();
    await addScanAsset(root, `${id}/assets/extra.js`, content);
    await expect(scanShowcaseText(root)).resolves.toBeUndefined();
  });

  it.each([
    ["Hub root", "assets/extra.js"],
    ["product HTML", "monster-forge/extra.html"],
    ["product CSS", "ashfall-arena/assets/extra.css"],
    ["product JSON", "mech-atelier/assets/extra.json"],
    ["product map", "monster-forge/assets/extra.map"],
    ["unknown subtree", "unknown/assets/extra.js"],
  ])("rejects an allowlisted literal in %s", async (_label, relativePath) => {
    const root = await createScanTree();
    await addScanAsset(
      root,
      relativePath,
      'document.createElementNS("http://www.w3.org/1999/xhtml", "canvas")',
    );
    await expect(scanShowcaseText(root)).rejects.toThrow(/w3\.org/);
  });

  it.each([
    ['fetch("https://jcgt.org/published/0007/04/01/")', "fetch"],
    ['import("http://www.w3.org/1999/xhtml")', "import"],
    ['const source="http://www.w3.org/1999/xhtml"', "assignment"],
    ['document.createElementNS("http://www.w3.org/1999/xhtml/path", "x")', "path"],
    ["// https://jcgt.org/published/0007/04/01/?query=1", "query"],
    ["// https://jcgt.org/published/0007/04/01/#fragment", "fragment"],
    ['document.createElementNS("https://www.w3.org/1999/xhtml", "x")', "protocol"],
    ['fetch("https://cdn.example.test/app.js")', "CDN"],
    ['const value="https:\\/\\/cdn.example.test/app.js"', "slash escaped"],
    ['const value="https:\\u002f\\u002fcdn.example.test/app.js"', "unicode escaped"],
    ['const value="https%3A%2F%2Fcdn.example.test/app.js"', "percent escaped"],
    [
      "const shader=`// https://jcgt.org/published/0007/04/01/path\n"
        + "vec3 importanceSampleGGX_VNDF(){return vec3(0.);}`",
      "allowlisted shader path suffix",
    ],
    [
      "const shader=`// https://jcgt.org/published/0007/04/01/?query=1\n"
        + "vec3 importanceSampleGGX_VNDF(){return vec3(0.);}`",
      "allowlisted shader query suffix",
    ],
    [
      "const shader=`// https://jcgt.org/published/0007/04/01/#fragment\n"
        + "vec3 importanceSampleGGX_VNDF(){return vec3(0.);}`",
      "allowlisted shader fragment suffix",
    ],
    [
      "const shader=`// https://jcgt.org/published/0007/04/01/路径\n"
        + "vec3 importanceSampleGGX_VNDF(){return vec3(0.);}`",
      "allowlisted shader non-ASCII suffix",
    ],
  ])("rejects a remote URL in %s context", async (content, _label) => {
    const root = await createScanTree();
    await addScanAsset(root, "monster-forge/assets/extra.js", content);
    await expect(scanShowcaseText(root)).rejects.toThrow(/remote|http|escaped/i);
  });

  it.each([
    [String.raw`const value="https:\x2f\x2fcdn.example.test/app.js"`, "hex slashes"],
    [
      String.raw`const value="https:\u{2f}\u{2F}cdn.example.test/app.js"`,
      "code-point Unicode slashes",
    ],
    ['const value="https:%2f%2Fcdn.example.test/app.js"', "percent slashes"],
    [
      String.raw`const value="https:/\x2Fcdn.example.test/app.js"`,
      "literal and hex slashes",
    ],
    [
      String.raw`const value="https:\/\u002Fcdn.example.test/app.js"`,
      "escaped and Unicode slashes",
    ],
    [
      String.raw`const value="https:\u{2f}%2Fcdn.example.test/app.js"`,
      "Unicode and percent slashes",
    ],
    [String.raw`const value="https\x3a//cdn.example.test/app.js"`, "hex colon"],
    [
      String.raw`const value="https\u003A/\x2fcdn.example.test/app.js"`,
      "Unicode colon and mixed slashes",
    ],
    [
      String.raw`const value="https\u{3a}\/%2fcdn.example.test/app.js"`,
      "code-point Unicode colon and mixed slashes",
    ],
    [
      'const value="HTTPS%3A%2f/cdn.example.test/app.js"',
      "percent colon and mixed slashes",
    ],
  ])("rejects a remote URL with %s", async (content, _label) => {
    const root = await createScanTree();
    await addScanAsset(root, "monster-forge/assets/extra.js", content);
    await expect(scanShowcaseText(root)).rejects.toThrow(/remote URL/i);
  });

  it.each([
    [
      '<link rel="stylesheet" href="https&#58;//cdn.example.test/app.css">',
      "decimal remote colon",
      /remote URL/i,
    ],
    [
      '<script src="https&#x3a;&sol;&sol;cdn.example.test/app.js"></script>',
      "hex and named remote delimiters",
      /remote URL/i,
    ],
    [
      '<a href="https&colon;&#47;&#x2f;cdn.example.test/">CDN</a>',
      "named and numeric mixed remote delimiters",
      /remote URL/i,
    ],
    [
      '<a href="&sol;&sol;cdn.example.test/app.js">CDN</a>',
      "protocol-relative remote URL",
      /remote URL/i,
    ],
    [
      '<a href="../" target="_bl&#97;nk">Hub</a>',
      "decimal target blank",
      /target=_blank/i,
    ],
    [
      '<a href="../" target="_bl&#x61;nk">Hub</a>',
      "hex target blank",
      /target=_blank/i,
    ],
    [
      '<a href="../" target="&lowbar;blank">Hub</a>',
      "named target blank",
      /target=_blank/i,
    ],
    [
      '<script src="&#47;assets/evil.js"></script>',
      "decimal root assets",
      /\/assets\//i,
    ],
    [
      '<link rel="stylesheet" href="&#x2f;assets/evil.css">',
      "hex root assets",
      /\/assets\//i,
    ],
    [
      '<script src="&sol;assets/evil.js"></script>',
      "named root assets",
      /\/assets\//i,
    ],
  ])("rejects an HTML %s violation after attribute decoding", async (
    addition,
    _label,
    expected,
  ) => {
    const root = await createScanTree();
    const path = join(root, "monster-forge", "index.html");
    await writeFile(path, `${await readFile(path, "utf8")}${addition}`, "utf8");
    await expect(scanShowcaseText(root)).rejects.toThrow(expected);
  });

  it("requires ./assets/ in a real href or src attribute", async () => {
    const root = await createScanTree();
    const path = join(root, "monster-forge", "index.html");
    await writeFile(
      path,
      validIndex("monster-forge").replace(
        '<script type="module" src="./assets/index.js"></script>',
        "<main>Documentation: ./assets/index.js</main>",
      ),
      "utf8",
    );
    await expect(scanShowcaseText(root)).rejects.toThrow("./assets/");
  });

  it("ignores character references outside real start-tag attributes", async () => {
    const root = await createScanTree();
    const path = join(root, "monster-forge", "index.html");
    const inert = [
      '<!-- <a href="https&colon;&sol;&sol;cdn.example/" target="&lowbar;blank"> -->',
      "<script>const fake='src=&quot;&sol;assets/fake.js&quot;';</script>",
      "<style>.fake{content:'https&colon;&sol;&sol;cdn.example/'}</style>",
      "<p>https&colon;&sol;&sol;cdn.example/ &lowbar;blank &sol;assets/fake.js</p>",
    ].join("");
    await writeFile(path, `${await readFile(path, "utf8")}${inert}`, "utf8");
    await expect(scanShowcaseText(root)).resolves.toBeUndefined();
  });

  it("preserves an ampersand character reference in a local navigation query", async () => {
    const root = await createScanTree();
    const path = join(root, "monster-forge", "index.html");
    await writeFile(
      path,
      validIndex("monster-forge").replace(
        `href="../#product-monster-forge"`,
        `href="../?mode=review&amp;source=hub#product-monster-forge"`,
      ),
      "utf8",
    );
    await expect(scanShowcaseText(root)).resolves.toBeUndefined();
  });

  it.each([
    ["quoted target blank", '<a href="../" target="_blank">Hub</a>'],
    ["self-closing target blank", '<a href="../" target=_blank/>'],
  ])("rejects an HTML %s violation for that reason", async (_label, addition) => {
    const root = await createScanTree();
    const path = join(root, "monster-forge", "index.html");
    await writeFile(
      path,
      `${await readFile(path, "utf8")}${addition}`,
      "utf8",
    );
    await expect(scanShowcaseText(root)).rejects.toThrow("target=_blank");
  });

  it.each([
    ["root assets", '<script src="/assets/index.js"></script>', "/assets/"],
    ["missing relative assets", "<main>No entry asset</main>", "./assets/"],
  ])("rejects an HTML %s violation for that reason", async (
    _label,
    replacement,
    expected,
  ) => {
    const root = await createScanTree();
    await writeFile(
      join(root, "monster-forge", "index.html"),
      validIndex("monster-forge").replace(
        '<script type="module" src="./assets/index.js"></script>',
        replacement,
      ),
      "utf8",
    );
    await expect(scanShowcaseText(root)).rejects.toThrow(expected);
  });

  it("requires all navigation tokens in each exact directory", async () => {
    const root = await createScanTree();
    const path = join(root, "ashfall-arena", "assets", "index.js");
    await writeFile(
      path,
      (await readFile(path, "utf8")).replace("ashfall-arena", "wrong-product"),
      "utf8",
    );
    await expect(scanShowcaseText(root)).rejects.toThrow("ashfall-arena");
  });

  it("accepts the bundled product-id plus product-prefix form of a dynamic anchor", async () => {
    const root = await createScanTree();
    const path = join(root, "monster-forge", "index.html");
    await writeFile(
      path,
      validIndex("monster-forge").replace(
        "product-monster-forge",
        "product-",
      ),
      "utf8",
    );
    await expect(scanShowcaseText(root)).resolves.toBeUndefined();
  });

  it.each([
    ["../", "index.html"],
    ["product-", "assets/index.js"],
    ["mech-atelier", "assets/index.js"],
  ])("rejects a product directory missing the %s runtime construct", async (token, file) => {
    const root = await createScanTree();
    const path = join(root, "mech-atelier", ...file.split("/"));
    await writeFile(
      path,
      (await readFile(path, "utf8")).replaceAll(token, "removed"),
      "utf8",
    );
    await expect(scanShowcaseText(root)).rejects.toThrow(token);
  });

  it.each([
    ["Three runtime text", "assets/hub.js", 'const runtime="three.module"'],
    ["Three runtime filename", "assets/three-runtime.js", "const local=true"],
    ["unknown subtree Three", "unknown/assets/three-core.js", "const local=true"],
  ])("keeps Hub and unknown subtrees free of %s", async (_label, path, content) => {
    const root = await createScanTree();
    await addScanAsset(root, path, content);
    await expect(scanShowcaseText(root)).rejects.toThrow(/Three/i);
  });

  it("rejects symbolic links while walking the output tree", async (context) => {
    const root = await createScanTree();
    const outside = await temporaryDirectory("showcase-scan-outside-");
    await writeFile(join(outside, "outside.keep"), "outside", "utf8");
    try {
      await symlink(outside, join(root, "linked"), "junction");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS"].includes(error?.code)) {
        context.skip();
        return;
      }
      throw error;
    }
    await expect(walkFiles(root)).rejects.toThrow(/symbolic links/);
    expect(await readFile(join(outside, "outside.keep"), "utf8")).toBe("outside");
  });
});
