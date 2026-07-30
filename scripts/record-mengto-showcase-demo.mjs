import { recordMengToShowcaseDemo } from "./lib/mengto-showcase-recording.mjs";

recordMengToShowcaseDemo()
  .then(({ output, signature, width, size }) => {
    console.log(
      `Recorded ${output}\n${signature} ${width}px ${size} bytes`,
    );
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
