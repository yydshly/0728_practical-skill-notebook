import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateSkillSourcePin, inspectSkillSourcePin } from "../scripts/validate-skill-source.mjs";

const validatorScript = fileURLToPath(new URL("../scripts/validate-workspace.mjs", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

describe("pinned MengTo skill source", () => {
  it("runs the real workspace validator outside the suite directory", () => {
    const result = spawnSync(process.execPath, [validatorScript], {
      cwd: repositoryRoot,
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Workspace contract valid.");
  });

  it("rejects an ordinary directory inherited from the parent repository as a submodule checkout", async () => {
    const lock = JSON.parse(await readFile(new URL("../config/skill-source-lock.json", import.meta.url), "utf8"));

    expect(inspectSkillSourcePin({
      lockCommit: lock.commit,
      submodulePath: fileURLToPath(new URL("../apps", import.meta.url)),
      repositoryRoot,
      gitlinkPath: "mengto-skills-showcase/skills-source/MengTo-Skills",
      displayPath: "skills-source/MengTo-Skills",
    })).toContain("Skills 子模块缺失或不可用：skills-source/MengTo-Skills");
  });

  it.each([
    {
      name: "reports a missing or unusable submodule checkout",
      state: {
        submoduleAvailable: false,
        actualCommit: null,
        gitlinkCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      expected: "Skills 子模块缺失或不可用：skills-source/MengTo-Skills",
    },
    {
      name: "reports a submodule HEAD that drifted from the lock",
      state: {
        submoduleAvailable: true,
        actualCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        gitlinkCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      expected: "Skills 子模块实际 HEAD 与锁定提交不一致：实际 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb，锁定 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    {
      name: "reports a parent gitlink that differs from the lock",
      state: {
        submoduleAvailable: true,
        actualCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        gitlinkCommit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      expected: "父仓库 gitlink 与锁定提交不一致：实际 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb，锁定 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ])("$name", ({ state, expected }) => {
    expect(evaluateSkillSourcePin({
      ...state,
      lockCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      displayPath: "skills-source/MengTo-Skills",
    })).toContain(expected);
  });
});
