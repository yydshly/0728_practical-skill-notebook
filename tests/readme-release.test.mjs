import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const demoNames = [
  "06-rural-radio-interaction.png",
  "06-rural-pursuit-danger.png",
  "06-rural-south-gate.png",
];

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function assertReadmePng(name) {
  const relativePath = path.join("docs", "demos", name);
  const image = await readFile(path.join(repoRoot, relativePath));
  assert.ok(image.length > 10_000, `${name} must contain a readable screenshot`);
  assert.ok(image.length < 2_000_000, `${name} must stay below 2 MiB`);
  assert.ok(image.subarray(0, 8).equals(pngSignature), `${name} must be PNG`);
  assert.equal(image.toString("ascii", 12, 16), "IHDR");
  assert.equal(image.readUInt32BE(16), 1280, `${name} width`);
  assert.equal(image.readUInt32BE(20), 720, `${name} height`);
}

test("rural README evidence uses three valid 1280x720 PNG files", async () => {
  for (const name of demoNames) await assertReadmePng(name);
});

test("root and project READMEs share the rural evidence sequence", async () => {
  const rootReadme = await read("README.md");
  const projectReadme = await read("rural-mutation-escape/README.md");
  for (const name of demoNames) {
    assert.ok(rootReadme.includes(`./docs/demos/${name}`), `root README missing ${name}`);
    assert.ok(projectReadme.includes(`../docs/demos/${name}`), `project README missing ${name}`);
  }
  for (const phrase of [
    "三个确定性浏览器证据场景",
    "不代表攻击或捕获 AI",
    "不展示动态开门",
  ]) {
    assert.ok(rootReadme.includes(phrase), `root README missing boundary: ${phrase}`);
  }
});

test("root README keeps project 06 and restores the tracked project 07", async () => {
  const rootReadme = await read("README.md");
  for (const required of [
    "| 06 | [《雾村：逃离》](./rural-mutation-escape/)",
    "## 06 · 《雾村：逃离》",
    "| 07 | [MengTo Skills 三产品能力展](./mengto-skills-showcase/)",
    "## 07 · MengTo Skills 三产品能力展",
    "./docs/demos/07-mengto-skills-showcase.gif",
    "./mengto-skills-showcase/README.md",
    "./mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md",
  ]) {
    assert.ok(rootReadme.includes(required), `root README missing: ${required}`);
  }
  assert.equal([...rootReadme.matchAll(/^## 06 ·/gm)].length, 1);
  assert.equal([...rootReadme.matchAll(/^## 07 ·/gm)].length, 1);
  assert.ok(!rootReadme.includes("./claude-of-duty-research/"));
  await access(path.join(repoRoot, "docs", "demos", "07-mengto-skills-showcase.gif"));
  await access(path.join(repoRoot, "mengto-skills-showcase", "README.md"));
});
