import { spawnSync } from "node:child_process";
import {
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
  });

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
  });
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
    ].join("\n"),
    "utf8",
  );
  return { profile, argsPath };
}

function runInstaller({ profile, argsPath }) {
  return spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      installerScript,
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
