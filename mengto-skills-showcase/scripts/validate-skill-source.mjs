import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const showCommit = (commit) => commit ?? "未找到";

export const evaluateSkillSourcePin = ({
  lockCommit,
  submoduleAvailable,
  actualCommit,
  gitlinkCommit,
  displayPath,
}) => {
  if (!submoduleAvailable) {
    return [`Skills 子模块缺失或不可用：${displayPath}`];
  }

  const failures = [];
  if (actualCommit !== lockCommit) {
    failures.push(
      `Skills 子模块实际 HEAD 与锁定提交不一致：实际 ${showCommit(actualCommit)}，锁定 ${lockCommit}`,
    );
  }
  if (gitlinkCommit !== lockCommit) {
    failures.push(
      `父仓库 gitlink 与锁定提交不一致：实际 ${showCommit(gitlinkCommit)}，锁定 ${lockCommit}`,
    );
  }
  return failures;
};

const runGit = (cwd, args) => execFileSync("git", ["-C", cwd, ...args], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "ignore"],
}).trim();

export const inspectSkillSourcePin = ({
  lockCommit,
  submodulePath,
  repositoryRoot,
  gitlinkPath,
  displayPath,
}) => {
  let submoduleAvailable = existsSync(submodulePath);
  let actualCommit = null;

  if (submoduleAvailable) {
    try {
      const checkoutRoot = runGit(submodulePath, ["rev-parse", "--show-toplevel"]);
      submoduleAvailable = (
        runGit(submodulePath, ["rev-parse", "--is-inside-work-tree"]) === "true"
        && resolve(checkoutRoot).toLowerCase() === resolve(submodulePath).toLowerCase()
      );
      if (submoduleAvailable) actualCommit = runGit(submodulePath, ["rev-parse", "HEAD"]);
    } catch {
      submoduleAvailable = false;
    }
  }

  let gitlinkCommit = null;
  try {
    const treeEntry = runGit(repositoryRoot, ["ls-tree", "HEAD", "--", gitlinkPath]);
    gitlinkCommit = /^160000 commit ([0-9a-f]{40})\t/.exec(treeEntry)?.[1] ?? null;
  } catch {
    gitlinkCommit = null;
  }

  return evaluateSkillSourcePin({
    lockCommit,
    submoduleAvailable,
    actualCommit,
    gitlinkCommit,
    displayPath,
  });
};
