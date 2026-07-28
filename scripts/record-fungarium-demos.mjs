import { recordFungariumDemos } from "./lib/fungarium-recording.mjs";

recordFungariumDemos()
  .then((files) => {
    console.log(`Recorded Fungarium demo GIFs:\n${files.join("\n")}`);
  })
  .catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
