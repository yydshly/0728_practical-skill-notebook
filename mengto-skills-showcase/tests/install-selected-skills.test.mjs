import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const suiteRoot = fileURLToPath(new URL("..", import.meta.url));
const installerScript = join(
  suiteRoot,
  "scripts",
  "install-selected-skills.ps1",
);
const installerTestTimeout = 15_000;
const temporaryProfiles = [];

afterEach(async () => {
  await Promise.all(
    temporaryProfiles.splice(0).map((path) =>
      rm(path, { recursive: true, force: true })
    ),
  );
});

describe("selected skill installer safety boundary", () => {
  it("installs missing skills from the full locked commit", async () => {
    const harness = await createHarness();

    const result = runInstaller(harness);

    expect(result.status, result.stderr || result.stdout).toBe(0);
    const args = JSON.parse(await readFile(harness.argsPath, "utf8"));
    const lock = JSON.parse(
      await readFile(join(suiteRoot, "config", "skill-source-lock.json"), "utf8"),
    );
    expect(args.slice(args.indexOf("--ref"), args.indexOf("--ref") + 2))
      .toEqual(["--ref", lock.commit]);
    expect(args).not.toContain("main");
    const installedManifest = await readFile(
      join(
        harness.profile,
        ".codex",
        "skills",
        "build-isometric-arpg",
        "SKILL.md",
      ),
      "utf8",
    );
    expect(installedManifest).toContain("\n");
    expect(installedManifest).not.toContain("\r\n");
  }, installerTestTimeout);

  it("reports an installed-copy drift without invoking the installer or overwriting it", async () => {
    const harness = await createHarness();
    expect(runInstaller(harness).status).toBe(0);
    const driftedManifest = join(
      harness.profile,
      ".codex",
      "skills",
      "build-isometric-arpg",
      "SKILL.md",
    );
    await writeFile(driftedManifest, "# local reviewed override\n", "utf8");
    await rm(harness.argsPath, { force: true });

    const result = runInstaller(harness);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Installed skill drift detected: build-isometric-arpg",
    );
    expect(await readFile(driftedManifest, "utf8")).toBe(
      "# local reviewed override\n",
    );
    await expect(readFile(harness.argsPath, "utf8")).rejects.toThrow();
  }, installerTestTimeout);

  it("rejects a dirty submodule before using its files or invoking the installer", async () => {
    const harness = await createRepositoryHarness();
    await writeFile(
      join(harness.sourceRoot, harness.sourcePath, "SKILL.md"),
      "# uncommitted source override\n",
      "utf8",
    );

    const result = runInstaller(harness);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Pinned skill source checkout is dirty",
    );
    await expect(readFile(harness.argsPath, "utf8")).rejects.toThrow();
    await expect(
      readFile(
        join(
          harness.profile,
          ".codex",
          "skills",
          "fixture-skill",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).rejects.toThrow();
  }, installerTestTimeout);

  it("keeps binary bytes exact while text line endings are canonical", async () => {
    const harness = await createRepositoryHarness();
    expect(runInstaller(harness).status).toBe(0);
    const installedBinary = join(
      harness.profile,
      ".codex",
      "skills",
      "fixture-skill",
      "asset.bin",
    );
    await writeFile(
      installedBinary,
      Buffer.from([0, 65, 10, 66, 0, 67]),
    );
    await rm(harness.argsPath, { force: true });

    const result = runInstaller(harness);

    expect(result.status).toBe(1);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Installed skill drift detected: fixture-skill",
    );
    expect(
      [...await readFile(installedBinary)],
    ).toEqual([0, 65, 10, 66, 0, 67]);
    await expect(readFile(harness.argsPath, "utf8")).rejects.toThrow();
  }, installerTestTimeout);
});

async function createHarness() {
  const profile = await mkdtemp(join(tmpdir(), "showcase-skill-install-"));
  temporaryProfiles.push(profile);
  const fakeInstaller = join(
    profile,
    ".codex",
    "skills",
    ".system",
    "skill-installer",
    "scripts",
    "install-skill-from-github.py",
  );
  const argsPath = join(profile, "installer-args.json");
  await mkdir(dirname(fakeInstaller), { recursive: true });
  await writeFile(
    fakeInstaller,
    [
      "import json, os, pathlib, shutil, sys",
      "args = sys.argv[1:]",
      "path_index = args.index('--path')",
      "paths = args[path_index + 1:]",
      "pathlib.Path(os.environ['INSTALLER_ARGS_PATH']).write_text(json.dumps(args), encoding='utf-8')",
      "project = pathlib.Path.cwd()",
      "install_root = pathlib.Path(os.environ['USERPROFILE']) / '.codex' / 'skills'",
      "for source_path in paths:",
      "    source = project / 'skills-source' / 'MengTo-Skills' / pathlib.PurePosixPath(source_path)",
      "    destination = install_root / pathlib.PurePosixPath(source_path).name",
      "    shutil.copytree(source, destination)",
      "    for copied in destination.rglob('*'):",
      "        if copied.is_file() and copied.suffix.lower() in {'.md', '.yaml', '.yml', '.py'}:",
      "            copied.write_bytes(copied.read_bytes().replace(b'\\r\\n', b'\\n').replace(b'\\r', b'\\n'))",
    ].join("\n"),
    "utf8",
  );
  return { profile, argsPath, installerScript };
}

async function createRepositoryHarness() {
  const root = await mkdtemp(join(tmpdir(), "showcase-skill-repo-"));
  temporaryProfiles.push(root);
  const project = join(root, "project");
  const profile = join(root, "profile");
  const sourceRoot = join(project, "skills-source", "MengTo-Skills");
  const sourcePath = "agent-skills/game-development/fixture-skill";
  const sourceDirectory = join(sourceRoot, sourcePath);
  const scriptsDirectory = join(project, "scripts");
  const configDirectory = join(project, "config");
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(scriptsDirectory, { recursive: true });
  await mkdir(configDirectory, { recursive: true });
  await copyFile(installerScript, join(scriptsDirectory, "install-selected-skills.ps1"));
  await copyFile(
    join(suiteRoot, "scripts", "check-selected-skills.mjs"),
    join(scriptsDirectory, "check-selected-skills.mjs"),
  );
  await writeFile(
    join(sourceDirectory, "SKILL.md"),
    "# fixture skill\n\nLocked text.\n",
    "utf8",
  );
  await writeFile(
    join(sourceDirectory, "details.yaml"),
    "name: fixture-skill\n",
    "utf8",
  );
  await writeFile(
    join(sourceDirectory, "asset.bin"),
    Buffer.from([0, 65, 13, 10, 66, 0, 67]),
  );
  initializeRepository(sourceRoot);
  const commit = git(sourceRoot, ["rev-parse", "HEAD"]).trim();
  await writeFile(
    join(configDirectory, "selected-skills.json"),
    JSON.stringify({
      skills: [{
        name: "fixture-skill",
        sourcePath,
        installPath: join(profile, ".codex", "skills", "fixture-skill"),
      }],
    }),
    "utf8",
  );
  await writeFile(
    join(configDirectory, "skill-source-lock.json"),
    JSON.stringify({
      repository: "https://github.com/MengTo/Skills.git",
      branch: "main",
      commit,
      recordedAt: "2026-07-29T00:00:00Z",
    }),
    "utf8",
  );
  initializeRepository(project);

  const fakeInstaller = join(
    profile,
    ".codex",
    "skills",
    ".system",
    "skill-installer",
    "scripts",
    "install-skill-from-github.py",
  );
  const argsPath = join(profile, "installer-args.json");
  await mkdir(dirname(fakeInstaller), { recursive: true });
  await writeFile(
    fakeInstaller,
    [
      "import json, os, pathlib, shutil, sys",
      "args = sys.argv[1:]",
      "paths = args[args.index('--path') + 1:]",
      "pathlib.Path(os.environ['INSTALLER_ARGS_PATH']).write_text(json.dumps(args), encoding='utf-8')",
      "project = pathlib.Path.cwd()",
      "install_root = pathlib.Path(os.environ['USERPROFILE']) / '.codex' / 'skills'",
      "for source_path in paths:",
      "    source = project / 'skills-source' / 'MengTo-Skills' / pathlib.PurePosixPath(source_path)",
      "    destination = install_root / pathlib.PurePosixPath(source_path).name",
      "    shutil.copytree(source, destination, ignore=shutil.ignore_patterns('.git'))",
    ].join("\n"),
    "utf8",
  );
  return {
    profile,
    argsPath,
    installerScript: join(scriptsDirectory, "install-selected-skills.ps1"),
    sourceRoot,
    sourcePath,
  };
}

function initializeRepository(path) {
  git(path, ["init", "--quiet"]);
  git(path, ["config", "user.email", "fixture@example.invalid"]);
  git(path, ["config", "user.name", "Fixture"]);
  git(path, ["add", "."]);
  git(path, ["commit", "--quiet", "-m", "fixture"]);
}

function git(path, args) {
  const result = spawnSync("git", ["-C", path, ...args], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout);
  }
  return result.stdout;
}

function runInstaller({ profile, argsPath, installerScript: script }) {
  return spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
    ],
    {
      cwd: suiteRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        USERPROFILE: profile,
        INSTALLER_ARGS_PATH: argsPath,
      },
    },
  );
}
