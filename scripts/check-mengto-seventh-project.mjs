import { checkSeventhProject } from "./lib/mengto-seventh-project.mjs";

const result = await checkSeventhProject();
if (result.failures.length > 0) {
  for (const failure of result.failures) {
    console.error(`FAIL: ${failure}`);
  }
  process.exitCode = 1;
} else {
  const { signature, width, size } = result.artifact;
  console.log(
    `MengTo project 07 check passed: ${signature}, ${width}px, ${size} bytes.`,
  );
}
