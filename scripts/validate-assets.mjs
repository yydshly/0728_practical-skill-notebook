import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_ROLES = ["00", "10", "20", "30", "40", "41", "50"];
const REQUIRED_ROUTES = ["tidal-garden", "echo-bay", "keeper-house", "north-wind-path"];

export function validateManifest(manifest) {
  const errors = [];
  const scene = manifest.scene ?? [];
  const routes = manifest.routes ?? [];
  const roles = scene.map(({ role }) => role);
  const routeIds = routes.map(({ id }) => id);

  for (const role of REQUIRED_ROLES) {
    if (!roles.includes(role)) errors.push(`Missing scene role ${role}`);
  }

  for (const id of REQUIRED_ROUTES) {
    if (!routeIds.includes(id)) errors.push(`Missing route ${id}`);
  }

  for (const item of [...scene, ...routes]) {
    if (!item.file?.startsWith("/assets/")) errors.push(`Invalid public asset path ${item.file}`);
    if (!(item.width > 0 && item.height > 0)) errors.push(`Invalid dimensions for ${item.file}`);
  }

  return { errors };
}

async function run() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDirectory, "..");
  const manifestPath = path.join(projectRoot, "public", "assets", "asset-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const result = validateManifest(manifest);

  for (const item of [...manifest.scene, ...manifest.routes]) {
    const assetPath = path.join(projectRoot, "public", item.file.replace(/^\//, ""));
    try {
      await access(assetPath);
    } catch {
      result.errors.push(`Missing file ${item.file}`);
    }
  }

  if (result.errors.length) {
    process.stderr.write(`${result.errors.join("\n")}\n`);
    process.exitCode = 1;
  }
}

const currentPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (currentPath === fileURLToPath(import.meta.url)) {
  await run();
}
