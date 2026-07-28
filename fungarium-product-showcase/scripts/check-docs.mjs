import { readFile } from "node:fs/promises";

const required = [
  ["README.md", "npm run build"],
  ["README.md", "npm run test:browser"],
  ["UPSTREAM.md", "a139bd08fc64cf0be76bd1dae447da6848d89899"],
  ["UPSTREAM.md", "third-party GLB/PBR assets are not copied"],
];

for (const [fileName, expectedText] of required) {
  const contents = await readFile(new URL(`../${fileName}`, import.meta.url), "utf8");

  if (!contents.includes(expectedText)) {
    console.error(`Documentation check failed: ${fileName} is missing ${JSON.stringify(expectedText)}.`);
    process.exitCode = 1;
  }
}

if (process.exitCode !== 1) {
  console.log("Documentation check passed.");
}
