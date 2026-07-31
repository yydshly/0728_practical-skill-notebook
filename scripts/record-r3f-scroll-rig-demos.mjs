import { recordR3fScrollRigDemos } from "./lib/r3f-scroll-rig-recording.mjs";

recordR3fScrollRigDemos()
  .then((files) => {
    console.log(`Recorded r3f-scroll-rig GIFs:\n${files.join("\n")}`);
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
