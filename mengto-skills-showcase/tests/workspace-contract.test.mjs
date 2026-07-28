import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const auditScript = fileURLToPath(new URL("../scripts/check-selected-skills.mjs", import.meta.url));

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
    expect(readme).toContain("Node.js 22+");

    const selection = await readJson("../config/selected-skills.json");
    for (const skill of selection.skills) {
      expect(readme).toContain(`\`${skill.name}\``);
    }
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
