import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { configDefaults } from "vitest/config";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const auditScript = fileURLToPath(new URL("../scripts/check-selected-skills.mjs", import.meta.url));
const appFolders = [
  "showcase-hub",
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
];
const packageFolders = [
  "content-schema",
  "game-assets",
  "input-system",
  "showcase-guide",
  "three-runtime",
  "ui-system",
];

const readReadmeSkillRows = (readme) => [...readme.matchAll(
  /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|$/gm,
)].map(([, name, sourcePath, products, phases]) => ({
  name,
  sourcePath,
  products: products.split(", "),
  phases: phases.split(", "),
}));

const readInstallationGuideSkillRows = (guide) => [...guide.matchAll(
  /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \| [^|]+ \|$/gm,
)].map(([, name, sourcePath, products, phases]) => ({
  name,
  sourcePath,
  products: products.split(", "),
  phases: phases.split(", "),
}));

const createAuditFixture = async () => {
  const userProfile = await mkdtemp(join(tmpdir(), "showcase-skill-audit-"));
  const installRoot = join(userProfile, ".codex", "skills");
  const selection = await readJson("../config/selected-skills.json");

  for (const skill of selection.skills) {
    const skillDirectory = join(installRoot, skill.name);
    await mkdir(skillDirectory, { recursive: true });
    await writeFile(join(skillDirectory, "SKILL.md"), "# Test skill\n", "utf8");
  }

  const outsideProject = join(userProfile, "outside-project");
  await mkdir(outsideProject);
  return { userProfile, installRoot, outsideProject, selection };
};

const runAudit = (cwd, userProfile) => {
  try {
    return { status: 0, stdout: execFileSync(process.execPath, [auditScript], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, USERPROFILE: userProfile },
    }) };
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
};

describe("showcase workspace", () => {
  it("keeps the shared guide independently addressable", async () => {
    const guide = await readJson("../packages/showcase-guide/package.json");
    expect(guide.name).toBe("@showcase/showcase-guide");
    expect(guide.exports).toEqual({
      ".": "./src/index.ts",
      "./styles.css": "./src/styles.css",
    });
  });

  it("keeps four apps and six shared packages independently addressable", async () => {
    const manifest = await readJson("../package.json");
    const apps = await Promise.all(
      appFolders.map((folder) => readJson(`../apps/${folder}/package.json`)),
    );
    const packages = await Promise.all(
      packageFolders.map((folder) => readJson(`../packages/${folder}/package.json`)),
    );

    expect(manifest.workspaces).toEqual(["apps/*", "packages/*"]);
    expect(manifest.scripts).toMatchObject({
      dev: "node scripts/dev-showcase.mjs",
      "dev:hub": "npm run dev --workspace @showcase/hub",
      validate: "node scripts/validate-workspace.mjs",
      test: "vitest run",
      build: "npm run build --workspaces --if-present",
      "build:showcase": "node scripts/build-showcase.mjs",
      "test:showcase-preview": "playwright test --config playwright.showcase-preview.config.ts",
    });
    expect(apps.map(({ name }) => name).sort()).toEqual([
      "@showcase/ashfall-arena",
      "@showcase/hub",
      "@showcase/mech-atelier",
      "@showcase/monster-forge",
    ]);
    expect(packages.map(({ name }) => name).sort()).toEqual([
      "@showcase/content-schema",
      "@showcase/game-assets",
      "@showcase/input-system",
      "@showcase/showcase-guide",
      "@showcase/three-runtime",
      "@showcase/ui-system",
    ]);
    expect(apps.every(({ private: isPrivate }) => isPrivate === true)).toBe(true);
    expect(packages.every(({ private: isPrivate }) => isPrivate === true)).toBe(true);
    for (const app of apps) {
      expect(app.dependencies?.["@showcase/showcase-guide"]).toBe("*");
    }
  });

  it("keeps Playwright showroom journeys out of the root Vitest run", async () => {
    const { default: vitestConfig } = await import("../vitest.config.ts");

    expect(vitestConfig.test.exclude).toEqual([
      ...configDefaults.exclude,
      "apps/*/tests/browser/**",
      "apps/*/tests/production/**",
      "packages/*/tests/browser/**",
      "tests/browser/**",
      "tests/showcase-preview/**",
    ]);
  });

  it("runs Ashfall browser behavior and performance in isolated Playwright processes", async () => {
    const manifest = await readJson("../apps/ashfall-arena/package.json");
    const functionalConfig = await readFile(
      new URL("../apps/ashfall-arena/playwright.config.ts", import.meta.url),
      "utf8",
    );
    const performanceConfig = await readFile(
      new URL(
        "../apps/ashfall-arena/playwright.performance.config.ts",
        import.meta.url,
      ),
      "utf8",
    );

    expect(manifest.scripts["test:browser"]).toBe(
      "playwright test --config playwright.config.ts && playwright test --config playwright.performance.config.ts",
    );
    expect(functionalConfig).toContain(
      'testIgnore: "**/release-performance.spec.ts"',
    );
    expect(performanceConfig).toContain(
      'testMatch: "**/release-performance.spec.ts"',
    );
    expect(performanceConfig).toContain("reuseExistingServer: false");
  });

  it("records exactly the approved skills with unique names and source paths", async () => {
    const selection = await readJson("../config/selected-skills.json");
    expect(selection.skills).toHaveLength(16);
    expect(new Set(selection.skills.map((skill) => skill.name)).size).toBe(16);
    for (const skill of selection.skills) {
      expect(skill.sourcePath).toBe(`agent-skills/game-development/${skill.name}`);
      expect(skill.products.length).toBeGreaterThan(0);
      expect(skill.phases.length).toBeGreaterThan(0);
    }
  });

  it("pins the upstream repository to a full commit SHA", async () => {
    const lock = await readJson("../config/skill-source-lock.json");
    expect(lock.repository).toBe("https://github.com/MengTo/Skills.git");
    expect(lock.branch).toBe("main");
    expect(lock.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  it("documents every selected skill and the global install impact", async () => {
    const selection = await readJson("../config/selected-skills.json");
    const guide = await readFile(new URL("../docs/skill-installation.md", import.meta.url), "utf8");
    for (const skill of selection.skills) {
      expect(guide).toContain(`\`${skill.name}\``);
    }
    expect(guide).toContain("C:\\Users\\yun68\\.codex\\skills");
    expect(guide).toContain("开发操作规范");
    expect(guide).toContain("不是运行时依赖");
    expect(guide).toContain("所有 Codex 项目");
    expect(guide).toContain("Skill 是 Codex 开发与验收时读取的工作说明");
    expect(guide).toContain("网页运行时不会加载这些 Skill");
    expect(guide).toContain("本项目代码位于当前 `mengto-skills-showcase` 套件目录");
    expect(guide).toContain("不属于能力展厅三产品");
  });

  it("documents the archive story in the required Chinese order", async () => {
    const readme = await readFile(
      new URL("../README.md", import.meta.url),
      "utf8",
    );
    const orderedHeadings = [
      "## 先看当前效果",
      "## 来源、参考与独立实现",
      "## 四个应用、三款产品",
      "## 一条命令本地运行",
      "## 项目如何实现",
      "## Skill 安装目录与全局影响",
      "## 16 项 Skill 与产品/阶段映射",
      "## 测试、构建与验证",
      "## 当前归档状态与验证边界",
      "## Skill 更新与安全卸载",
    ];
    const positions = orderedHeadings.map((heading) =>
      readme.indexOf(heading));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((left, right) => left - right))
      .toEqual(positions);

    for (const required of [
      '<img src="../docs/demos/07-mengto-skills-showcase.gif"',
      "https://github.com/MengTo/Skills",
      "https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45",
      "https://vesperfall.mengto.chatgpt.site/",
      "Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。",
      "Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。",
      "四个可运行应用",
      "只有三款展示产品",
      "当前未公开部署",
      "C:\\Users\\yun68\\.codex\\skills",
      "不会进入最终产品包",
      "不会自动同步",
      "node scripts/record-mengto-showcase-demo.mjs",
      "node scripts/check-mengto-seventh-project.mjs",
      "MENGTO_SHOWCASE_FFMPEG",
      "[验证记录](apps/ashfall-arena/docs/VALIDATION.md)",
      "Node.js 22.12+",
    ]) {
      expect(readme).toContain(required);
    }
    expect(readme).not.toContain("四款产品");
    expect(readme).not.toContain("## 两个独立演示");
  });

  it("让 README 的 Skill 表格与所选清单的产品和阶段映射一致", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const guide = await readFile(new URL("../docs/skill-installation.md", import.meta.url), "utf8");
    const selection = await readJson("../config/selected-skills.json");
    const rows = readReadmeSkillRows(readme);
    const guideRows = readInstallationGuideSkillRows(guide);
    const expectedRows = selection.skills.map((skill) => ({
      name: skill.name,
      sourcePath: skill.sourcePath,
      products: skill.products,
      phases: skill.phases,
    }));

    expect(rows).toHaveLength(selection.skills.length);
    expect(rows).toEqual(expectedRows);
    expect(guideRows).toEqual(expectedRows);
  });

  it("仅将 build-isometric-arpg 路由到 Ashfall Arena", async () => {
    const selection = await readJson("../config/selected-skills.json");
    const arpg = selection.skills.find((skill) => skill.name === "build-isometric-arpg");
    expect(arpg).toMatchObject({
      products: ["ashfall-arena"],
      phases: ["foundation"],
    });
  });

  it("将 Monster Forge 的怪物与资产审阅链路标为资产阶段", async () => {
    const selection = await readJson("../config/selected-skills.json");
    for (const name of [
      "build-hybrid-game-assets",
      "build-game-monster-system",
      "build-vesperfall-review-assets",
    ]) {
      const skill = selection.skills.find((entry) => entry.name === name);
      expect(skill?.products).toContain("monster-forge");
      expect(skill?.phases).toContain("assets");
    }
  });

  it("documents four browser test entry points without a global count assertion", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    for (const workspace of [
      "hub",
      "monster-forge",
      "ashfall-arena",
      "mech-atelier",
    ]) {
      expect(readme).toContain(
        `npm run test:browser --workspace @showcase/${workspace}`,
      );
    }
  });

  it("声明与 Vite 兼容的 Node 运行时下限", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const packageJson = await readJson("../package.json");

    expect(readme).toContain("Node.js 22.12+");
    expect(packageJson.engines).toEqual({
      node: "^20.19.0 || >=22.12.0",
    });
  });

  it("记录 Ashfall 候选证据且不冒充人工可用性结论", async () => {
    const validation = await readFile(
      new URL("../apps/ashfall-arena/docs/VALIDATION.md", import.meta.url),
      "utf8",
    );

    expect(validation).toContain(
      "发布候选 / 自动验收通过，人工可用性门槛未关闭",
    );
    expect(validation).toContain("submittedFrames=0");
    expect(validation).toContain("GPU 完成时间仍是未测边界");
    expect(validation).toContain("不是人工游戏时长");
    expect(validation.match(/`7`/g)?.length).toBeGreaterThanOrEqual(3);
    expect(validation.match(/未开始/g)?.length).toBeGreaterThanOrEqual(3);
    expect(validation).toContain("Browser unavailable");
    expect(validation).toContain("kernel assets path error");
    expect(validation).toContain("不是真人研究");
    expect(validation).toContain("8–12 分钟首次人工完成门槛");
    expect(validation).toContain("ashfall-arena:v1");
    expect(validation).toContain("ashfall-arena:audio-settings:v1");
    expect(validation).toContain("Monster Forge 单包 `564.22 kB`");
    expect(validation).not.toContain("独立最终复核结论为 **Ready**");
  });

  it("为每个新产品路由到明确且狭范围的 Skills", async () => {
    const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
    expect(agents).toContain("apps/monster-forge");
    expect(agents).toContain("apps/ashfall-arena");
    expect(agents).toContain("apps/mech-atelier");
    expect(agents).toContain("Read the narrowest matching SKILL.md before acting");
    expect(agents).toContain("build-hybrid-game-assets");
    expect(agents).toContain("build-vesperfall-review-assets");
    expect(agents).toContain("build-game-monster-system");
    expect(agents).toContain("build-isometric-arpg");
    expect(agents).toContain("test-playable-web-games");
    expect(agents).toContain("ship-web-games");
    expect(agents).toContain("不得修改");
    expect(agents).toContain("skills-source/MengTo-Skills");
    expect(agents).toContain("未批准");
  });

  it("没有将未批准的 web-design Skill 记录为 Mech Atelier 路由", async () => {
    const selection = await readJson("../config/selected-skills.json");
    const agents = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");

    expect(selection.skills.some((skill) => skill.sourcePath.includes("/web-design/"))).toBe(false);
    expect(agents).toContain("Mech Atelier 当前没有批准任何 web-design Skill");
    expect(agents).toContain("未批准的 web-design Skill 不得");
  });

  it("runs the selected-skill audit from outside the suite directory", async () => {
    const fixture = await createAuditFixture();
    try {
      const audit = runAudit(fixture.outsideProject, fixture.userProfile);
      expect(audit.status).toBe(0);
      expect(audit.stdout).toContain("build-isometric-arpg");
    } finally {
      await rm(fixture.userProfile, { recursive: true, force: true });
    }
  });

  it("does not report a SKILL.md directory as an installed skill", async () => {
    const fixture = await createAuditFixture();
    const target = fixture.selection.skills[0];
    const manifest = join(fixture.installRoot, target.name, "SKILL.md");

    await rm(manifest, { force: true });
    await mkdir(manifest);

    try {
      const audit = runAudit(fixture.outsideProject, fixture.userProfile);
      expect(audit.status).toBe(1);
      expect(audit.stdout).toContain(target.name);
      expect(audit.stdout).toContain("false");
    } finally {
      await rm(fixture.userProfile, { recursive: true, force: true });
    }
  });
});
