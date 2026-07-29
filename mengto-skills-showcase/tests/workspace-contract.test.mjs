import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const auditScript = fileURLToPath(new URL("../scripts/check-selected-skills.mjs", import.meta.url));

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
  it("declares three independent apps and five shared package workspaces", async () => {
    const manifest = await readJson("../package.json");
    expect(manifest.workspaces).toEqual(["apps/*", "packages/*"]);
    expect(manifest.scripts).toMatchObject({
      validate: "node scripts/validate-workspace.mjs",
      test: "vitest run",
      build: "npm run build --workspaces --if-present",
    });
  });

  it.each([
    ["monster-forge", "@showcase/monster-forge"],
    ["ashfall-arena", "@showcase/ashfall-arena"],
    ["mech-atelier", "@showcase/mech-atelier"],
  ])("keeps %s independently addressable", async (folder, name) => {
    const manifest = await readJson(`../apps/${folder}/package.json`);
    expect(manifest.name).toBe(name);
    expect(manifest.private).toBe(true);
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
  });

  it("以中文说明产品、安装位置和运行时边界", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    for (const heading of [
      "## 产品矩阵",
      "## 本地运行",
      "## Skill 源码与安装目录",
      "## 已安装 Skills",
      "## Skill 对项目的影响",
      "## 更新与卸载",
      "## 验证",
    ]) expect(readme).toContain(heading);

    expect(readme).toContain("skills-source/MengTo-Skills");
    expect(readme).toContain("C:\\Users\\yun68\\.codex\\skills");
    expect(readme).toContain("不会进入最终产品包");
    expect(readme).toContain("不会自动同步");
    expect(readme).toContain("已有演示");
    expect(readme).toContain("规划中");
    expect(readme).toContain("发布候选；自动验收通过，人工可用性门槛未关闭");
    expect(readme).toContain("[验证记录](apps/ashfall-arena/docs/VALIDATION.md)");
    expect(readme).toContain("Node.js 22.12+");

    const selection = await readJson("../config/selected-skills.json");
    for (const skill of selection.skills) {
      expect(readme).toContain(`\`${skill.name}\``);
    }
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

  it("划分当前产品命令与未来产品的预留入口", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const currentCommands = readme.slice(
      readme.indexOf("### 当前基础层可执行命令"),
      readme.indexOf("### 当前可运行：Monster Forge｜怪物铸造所"),
    );
    const monsterForgeCommands = readme.slice(
      readme.indexOf("### 当前可运行：Monster Forge｜怪物铸造所"),
      readme.indexOf("### 当前可运行：Ashfall Arena｜灰烬竞技场"),
    );
    const ashfallCommands = readme.slice(
      readme.indexOf("### 当前可运行：Ashfall Arena｜灰烬竞技场"),
      readme.indexOf("### 当前可运行：Mech Atelier｜机甲定制工坊"),
    );
    const mechAtelierCommands = readme.slice(
      readme.indexOf("### 当前可运行：Mech Atelier｜机甲定制工坊"),
      readme.indexOf("## Skill 源码与安装目录"),
    );

    expect(currentCommands).toContain("npm run validate");
    expect(currentCommands).toContain("npm test");
    expect(currentCommands).toContain("node scripts/check-selected-skills.mjs");
    expect(currentCommands).toContain("npm run build");
    expect(currentCommands).not.toContain("npm run dev:forge");
    expect(currentCommands).not.toContain("npm run test:browser");
    expect(monsterForgeCommands).toContain("当前可运行：Monster Forge｜怪物铸造所");
    expect(monsterForgeCommands).toContain("npm run dev:forge");
    expect(monsterForgeCommands).toContain("npm run test:browser --workspace @showcase/monster-forge");
    expect(monsterForgeCommands).not.toContain("npm run dev:arena");
    expect(ashfallCommands).toContain("当前可运行：Ashfall Arena｜灰烬竞技场");
    expect(ashfallCommands).toContain("npm run dev:arena");
    expect(ashfallCommands).toContain("npm run test:browser --workspace @showcase/ashfall-arena");
    expect(ashfallCommands).toContain("npm run test:preview --workspace @showcase/ashfall-arena");
    expect(ashfallCommands).toContain("47.482s");
    expect(ashfallCommands).toContain("不是游戏时长");
    expect(ashfallCommands).not.toContain("npm run dev:forge");
    expect(ashfallCommands).not.toContain("npm run dev:atelier");
    expect(monsterForgeCommands).not.toContain("npm run dev:atelier");
    expect(mechAtelierCommands).toContain("当前可运行：Mech Atelier｜机甲定制工坊");
    expect(mechAtelierCommands).toContain(
      "npm run test:browser --workspace @showcase/mech-atelier",
    );
    expect(mechAtelierCommands).toContain(
      "npm run test:preview --workspace @showcase/mech-atelier",
    );
    expect(mechAtelierCommands).not.toContain("npm run dev:forge");
    expect(mechAtelierCommands).not.toContain("npm run dev:arena");
    expect(readme.match(/npm run test:browser/g)).toHaveLength(3);
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
      "d93291a8882f7e2dbb7562f7c779db5f36b7fbab",
    );
    expect(validation).toContain(
      "发布候选 / 自动验收通过，人工可用性门槛未关闭",
    );
    expect(validation).toContain("47.482s");
    expect(validation).toContain("50.809s");
    expect(validation).toContain("不是人工游戏时长");
    expect(validation.match(/`7`/g)?.length).toBeGreaterThanOrEqual(3);
    expect(validation.match(/未开始/g)?.length).toBeGreaterThanOrEqual(3);
    expect(validation).toContain("Browser unavailable");
    expect(validation).toContain("kernel assets path error");
    expect(validation).toContain("不是真人研究");
    expect(validation).toContain("8–12 分钟首次人工完成门槛");
    expect(validation).toContain("ashfall-arena:v1");
    expect(validation).toContain("ashfall-arena:audio-settings:v1");
    expect(validation).toContain("Monster Forge 已有单包 `563.30 kB`");
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
