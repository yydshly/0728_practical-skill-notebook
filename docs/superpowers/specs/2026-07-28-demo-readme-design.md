# Demo README and recording design

## Goal

Make the repository root README an entry point for three visual demonstrations across two independent interactive studies.

## Scope

- Keep the root README in Chinese and organize its directory table by three demonstrations:
  - 01: the scroll-driven lighthouse scene;
  - 02: the lighthouse's fog-signal text veil;
  - 03: the World Cup typographic flag curtain.
- Entries 01 and 02 both link to the lighthouse project, while retaining distinct descriptions and recordings.
- Add the World Cup typographic-flags demo as a tracked top-level project and connect entry 03 to it, with a local run command.
- Capture three concise GIFs under `docs/demos/` so the root README renders them directly on GitHub.
- Record 01 as the lighthouse's main scroll-driven atmosphere, 02 as the pointer-responsive text veil in the fog-signal section, and 03 as the pointer-responsive World Cup letter curtain.
- Commit the README, recordings, and World Cup demo to `main`, then push `main` to `origin`.

## Boundaries

- No changes to either product's visual design or behavior beyond what is needed to run and record it.
- GIFs should be short and optimized for repository use; they are demonstrations rather than exhaustive tutorials.
- The existing per-project READMEs remain unchanged.

## Acceptance checks

- Root README shows the 01/02/03 correspondence, includes all three GIFs, and gives a runnable command for each underlying project.
- All GIFs render locally and use relative repository paths.
- The World Cup demo is staged as project source only, excluding dependencies and generated build output.
- Existing lighthouse validation still passes before the main branch is pushed.
