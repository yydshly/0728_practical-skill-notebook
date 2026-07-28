# Demo README and recording design

## Goal

Make the repository root README the entry point for two independent interactive studies, with an inline visual preview for each one.

## Scope

- Keep the root README in Chinese and list both projects in its directory table.
- Expand the lighthouse entry with a short description of the scroll-driven scene and the interactive signal-text veil.
- Add the World Cup typographic-flags demo as a tracked top-level project, with its own short description and local run command.
- Capture one concise GIF for each project and store the files under `docs/demos/` so the root README renders them directly on GitHub.
- Capture the lighthouse during the fog-signal section, showing the text veil responding to a pointer pass.
- Capture the World Cup demo while the pointer sets several typographic flag strands swinging.
- Commit the README, recordings, and World Cup demo to `main`, then push `main` to `origin`.

## Boundaries

- No changes to either product's visual design or behavior beyond what is needed to run and record it.
- GIFs should be short and optimized for repository use; they are demonstrations rather than exhaustive tutorials.
- The existing per-project READMEs remain unchanged.

## Acceptance checks

- Root README links to both projects, shows both GIFs, and gives a runnable command for each.
- Both GIFs render locally and use relative repository paths.
- The World Cup demo is staged as project source only, excluding dependencies and generated build output.
- Existing lighthouse validation still passes before the main branch is pushed.
