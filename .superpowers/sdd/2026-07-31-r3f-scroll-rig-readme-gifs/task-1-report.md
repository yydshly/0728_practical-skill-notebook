# Task 1 Report — Reproducible dual-demo recording pipeline

## Status

DONE_WITH_CONCERNS

## RED

Command:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: failed as expected before implementation. Node reported that
`../scripts/lib/r3f-scroll-rig-recording.mjs` did not provide the requested
`buildScrollFrames` export (`SyntaxError`, `ERR_TEST_FAILURE`).

## GREEN and verification

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: PASS — 5 tests passed, 0 failed.

```powershell
cd r3f-scroll-rig-showcase
npm test
```

Result: PASS — Vitest: 10 test files and 63 tests passed.

```powershell
cd r3f-scroll-rig-showcase
npm run build
```

Result: PASS — Vite production build exited 0.

## Dependency and browser check

- Installed exact development dependency `playwright@1.62.0`.
- `chromium.executablePath()` resolved to
  `C:\Users\yun68\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe`.
- That executable already existed, so Chromium was not downloaded again.

## Files

- `r3f-scroll-rig-showcase/package.json`
- `r3f-scroll-rig-showcase/package-lock.json`
- `scripts/lib/r3f-scroll-rig-recording.mjs`
- `scripts/record-r3f-scroll-rig-demos.mjs`
- `tests/r3f-scroll-rig-recording.test.mjs`

## Commit

`2574cc1ec2ca3138de6d021718928c2812e784dd` — `feat: add r3f demo recording pipeline`

## Self-review

- `buildScrollFrames` and `resolveStaticAsset` were added with the required
  behavioral tests; the test was observed failing before implementation.
- The pipeline validates the pinned historical repository, supports explicit
  `legacyDir` before `R3F_LEGACY_DIR`, and serves only `examples/build` with
  traversal protection and SPA fallback.
- The Vite process is started with the required Node/Vite entrypoint, startup
  errors include captured stdout and stderr, and cleanup closes browser, Vite,
  static server, then the task-created temporary directory.
- Playwright uses the showcase-local package dynamically, the required WebGL
  flags and readiness checks, deterministic 40-frame scroll sequences, and the
  specified FFmpeg GIF conversion command.
- No final GIF was generated and README was not changed, as required for Task 1.

## Concerns

- `npm install` reported 5 audit findings (1 moderate, 3 high, 1 critical) in
  the showcase dependency graph; this task only added the pinned Playwright
  development dependency and did not change unrelated dependency versions.
- Vite completed successfully but retained its existing warning that the main
  production chunk exceeds 500 kB. No artifact recording command was run,
  deliberately, because Task 1 excludes final GIF generation.

## Fix round 1 — pin historical resolved dependency

The legacy validation previously accepted any semantic version for the
installed `@14islands/r3f-scroll-rig` package. It now exports
`UPSTREAM_RESOLVED_VERSION = "6.0.5"` and rejects every other value before a
recording can proceed.

Coverage updated in `tests/r3f-scroll-rig-recording.test.mjs`:

- The valid historical fixture now uses `6.0.5`.
- A fixture using the showcase dependency version `8.15.0` must throw the
  legacy resolved-version error.

### RED

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: failed as expected before the fix. The legacy source validation test
reported `Missing expected exception.` for the `8.15.0` fixture at line 62;
4 tests passed and 1 failed.

### GREEN

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Complete result: exit code 0; all 5 subtests passed (`recording contract`,
`GIF validation`, `legacy source validation`, `four story stops`, and `static
server resolution`); 0 failed, cancelled, skipped, or todo.

Commit: `c62eb52f43dfcdbc3fe36199610548f34762eda1` —
`fix: pin historical recording dependency version`.

## Fix round 2 — historical demo navigation readiness

### Root cause

The historical page finishes parsing and renders its required copy while a
`blob:http://127.0.0.1:5223/...` request remains active. The observed page had
`document.readyState === "complete"`, one exact readiness-text match, 40
completed ordinary requests, and no failed requests, but the active blob request
kept Playwright's `networkidle` condition from becoming true. The 30-second
navigation timeout was therefore unrelated to static serving or failed assets.

### Fix and coverage

- Added `navigateOriginalPage(page)`, which calls the original demo URL with
  `{ waitUntil: "domcontentloaded" }`.
- `captureOriginal` calls that helper, then retains its existing exact
  `getByText("A ScrollScene with a Cube mesh inside using global lights.")`
  wait as the actual readiness gate.
- Lighthouse navigation and readiness behavior were not changed.
- Added a regression test using a narrow page double to assert the production
  helper's actual `goto` URL and options. It fails if `networkidle` is restored
  or the historical navigation helper is not exported.

### RED

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: failed as expected because the module did not export
`navigateOriginalPage` (`SyntaxError: does not provide an export named
'navigateOriginalPage'`; `ERR_TEST_FAILURE`).

### GREEN

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Complete result: exit code 0; all 6 subtests passed, including `original demo
navigation waits for DOM content instead of an idle network`; 0 failed,
cancelled, skipped, or todo.

Commit: `7a5102be92c423a0f74ca36471ef106003c49b7c` —
`fix: avoid idle wait for historical demo`.

## Fix round 3 — lighthouse navigation readiness

### Root cause

The lighthouse Vite server was available in 256 ms, and after DOM content
loaded the document was complete with 57 ordinary requests completed, no failed
requests, `webgl-ready` set, and the required `雾屿灯塔` heading plus `稳定构图`
button present. A persistent `blob:http://127.0.0.1:5224/...` request remained
active, however, so Playwright's `networkidle` navigation condition could not
settle within its timeout. This was not a Vite, asset, or WebGL readiness
failure.

### Fix and coverage

- Added `navigateLighthousePage(page)`, which navigates to the showcase URL
  with `{ waitUntil: "domcontentloaded" }`.
- `captureLighthouse` calls that helper and keeps all three existing real
  readiness gates unchanged: exact `雾屿灯塔` h1, exact `稳定构图` button, and
  the `webgl-ready` document class.
- Added a narrow regression test that observes the helper's actual `goto` URL
  and options, rejecting a future return to `networkidle`.

### RED

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: failed as expected because the module did not export
`navigateLighthousePage` (`SyntaxError: does not provide an export named
'navigateLighthousePage'`; `ERR_TEST_FAILURE`).

### GREEN

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Complete result: exit code 0; all 7 subtests passed, including `lighthouse
navigation waits for DOM content instead of an idle network`; 0 failed,
cancelled, skipped, or todo.

Commit: `53e93882324cce4d8b51ec757804543dafbf205a` —
`fix: avoid idle wait for lighthouse demo`.

## Fix round 4 — exact lighthouse readiness heading

### Status

DONE

### Root cause

`captureLighthouse` passed the stale accessible name `雾岚灯塔` to Playwright's
exact heading locator. The Task 1 requirements and the rendered application h1
both use `雾屿灯塔`, so the readiness wait could never match the live page.

### Coverage

Updated `tests/r3f-scroll-rig-recording.test.mjs` with `lighthouse readiness
targets the exact rendered heading`. The test exercises the production
`waitForLighthouseHeading(page)` helper and observes the actual Playwright
boundary call, requiring:

```js
getByRole("heading", { name: "雾屿灯塔", exact: true })
```

Changing the production locator back to `雾岚灯塔` makes this assertion fail.

### RED

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: exit code 1; 7 subtests passed and the new regression subtest failed
with `TypeError: recording.waitForLighthouseHeading is not a function`. This
confirmed the existing production path had no testable heading-readiness
contract before the fix.

### GREEN

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: exit code 0; all 8 subtests passed, including `lighthouse readiness
targets the exact rendered heading`; 0 failed, cancelled, skipped, or todo.

### Self-review

- Extracted only the lighthouse heading wait into
  `waitForLighthouseHeading(page)` and made `captureLighthouse` call it, so the
  regression test covers the production capture path rather than inspecting
  source text.
- The locator now matches the requirements and rendered h1 exactly:
  `雾屿灯塔`, with `exact: true`.
- The stable-composition button wait, `webgl-ready` wait, navigation behavior,
  frame capture, and all other recording behavior remain unchanged.
- Only the recording module, its targeted test, and this report were changed.
  Task 2 was not run, no GIF was generated, and README was not modified.

### Concerns

None for this targeted fix.

Commit: `42ea85165ece863449adaf1bb20b3c8053cdb402` —
`fix: correct lighthouse readiness heading`.

## Fix round 5 - capture timeline and visual-stage audit

### Status

BLOCKED

The lighthouse recording now has four distinct, readable stage anchors. The
historical recording now waits for the loading overlay, starts on rendered 3D,
and reaches the intended Sticky and parallax sections at exact frame anchors.
However, the pinned historical build still renders no image texture in either
parallax anchor. Consequently this round cannot honestly claim that the
original GIF's image-parallax stage is discernible.

### Measurements and root causes

- The historical page's rendered document is 13,799 px tall at the pinned
  960 x 640 viewport (maximum scroll 13,159 px). The relevant measured
  positions are: inline cube copy at 2,560 px, Sticky's stable midpoint at
  5,368 px, parallax heading at 6,520 px, and its image container beginning at
  6,634 px. The previous stops `[0, 720, 1440, 2280]` never reached these
  chapters.
- The pinned demo replaces `window.scrollTo(x, y)` with a three-argument
  smoothing wrapper whose default lerp is `0.14`. A screenshot 120 ms after
  the old two-argument call therefore captured an intermediate position.
  Passing the wrapper's instant value, waiting until `window.scrollY` reaches
  the clamped target, and then waiting two animation frames makes the capture
  position deterministic.
- The inline copy is available at about 506 ms, while Drei's loading overlay
  is still visible (`Loading 45.91%`). In the measured run the overlay did not
  leave until about 5.39 s. Waiting only for copy caused the original first
  frame to capture Loading instead of 3D.
- The old interpolation placed the four lighthouse target stops at frames
  9/19/29/39. Contact frames 0/10/20/30 were therefore at
  `[0, 110, 1210, 2360]`; frame 10 was still below the first visible story
  transition at about 150 px and was pixel-identical to frame 0. The revised
  timeline places the exact stops at frames 0/10/20/30.

### TDD evidence

The first RED run added regression coverage for exact stage anchors, original
readiness, and deterministic historical scrolling before the corresponding
production exports existed:

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Result: exit code 1 with
`SyntaxError: ... does not provide an export named 'scrollPageTo'`.

A subsequent RED refinement required the measured Sticky target (5,368 rather
than 5,000), an observed final-position check, and two post-scroll paint
frames. Result: exit code 1; 8 subtests passed and 2 failed (the old constant
and missing position/paint behavior).

After the minimal readiness, scroll, stop, and timeline changes, the targeted
suite passed all 10 subtests. The final verification result is recorded below.

### Visual audit and unresolved blocker

Task 2's two workspace GIFs were never modified. All round-5 recordings and
contact sheets were written under the temporary `.tmp-r3f-round5` directory.
After the final recorder process finished, fresh contact sheets were generated
directly from those GIFs at frames 0/10/20/30 and inspected at original
resolution:

- Lighthouse: opening, keeper/approach, signal, and route archive are each
  visually distinct and readable.
- Historical: frame 0 contains the colored inline cube; frame 10 contains the
  full Sticky composition; frame 20 contains only the tiny
  `More ScrollScenes with Parallaxing images.` heading; frame 30 contains only
  the sticky-fullscreen heading. Both expected image regions are entirely
  blank.

The image failure is inside the immutable pinned build, not asset delivery:
all image requests returned 200, the test JPEG reports
`complete === true` with natural size 4160 x 6240, the canvas is 960 x 640,
and WebGL reports error 0. Activating the image ScrollScene raises:

```text
TypeError: r.fn is not a function
at .../static/js/2.45235e56.chunk.js:2:925798
```

The shipped source map resolves that call to
`react-spring/three.js:368`, where `applyAnimatedValues.fn(...)` is invoked.
The pinned `react-three-fiber/index.js` bundle does not provide the expected
`applyProps` host function, exposing a historical dependency mismatch exactly
when the parallax textures activate.

One isolated experiment suppressed only that stack signature and gradually
warmed the lazy ScrollScenes. Images appeared during an interactive manual
probe, but a complete temp recorder run still produced blank frames 20 and 30.
The experiment was therefore disproved for the actual workflow and removed;
no global prototype patch or speculative compatibility shim is included in
the commit.

### Scope and concerns

- The independently valid changes are limited to the recording helper, its
  targeted tests, and this report.
- README and both final GIFs are unchanged.
- The unresolved pinned-build image failure remains load-bearing for Task 2:
  the original GIF must not be presented as satisfying the requested
  image-parallax stage until that renderer can be made visible without
  changing the fixed historical source.

### Final verification

```powershell
node --test tests/r3f-scroll-rig-recording.test.mjs
```

Exit code 0: 10/10 subtests passed.

```powershell
cd r3f-scroll-rig-showcase
npm test -- --run
npm run build
```

Both commands exited 0: Vitest passed 10/10 files and 63/63 tests; Vite
transformed 639 modules and completed the production build. The existing
greater-than-500-kB chunk advisory remains a non-failing warning.
