# Fabrica visual-refinement record

## Design contract

- Entry mode: reference-led revision.
- Request revision: 2 — lower-page source calibration and in-app interaction retest completed on 2026-07-28.
- Target: a faithful local React recreation of the BestWebsiteTemplate Fabrica detail page.
- Visual ambition: Editorial.
- Experience architecture: Editorial Flow.
- Visual constraints: match the supplied source page's white/neutral editorial system, three-column checkerboard rails, non-sticky template bar, wide media treatment, mobile overlays, and white footer with the oversized wordmark.
- Primary journey: inspect Fabrica, open search or mobile navigation, control the preview, browse related templates, then follow the marketplace visit link.
- Required surfaces: desktop 1280 × 720 and mobile 390 × 844; search, mobile menu, preview control, cookie state, and local image/video rendering.
- Autonomy authorization: the user approved direct implementation and explicitly authorized copying the source-page media into local assets.
- Completion criteria: each local asset renders without a source-media network request; primary interactions work on both target viewports; the source-captured layout coordinates and full-page height match in the local build.

## Coverage record

| Requirement | Surface/state | Evidence | Stage | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| Local source assets | All media states | Asset inventory and local file check | 1 | pass | Recheck after any data-path change. |
| Primary desktop composition | 1280 × 720 | Side-by-side source/clone screenshot | 2–3 | pass | Header, identity bar, preview layout, and first score rows recalibrated from captured evidence. |
| Search and preview controls | Mobile local runtime | Browser interaction evidence | 4–6 | pass | In-app browser confirmed search open/close, menu open/close, and Pause→Play control change. |
| Mobile layout and menu | 390 × 844 source capture; live local runtime | Browser screenshot and interaction | 7 | pass | Header, horizontal media strip, score rows, search, and menu checked against the capture. |
| Full-page editorial rhythm | Desktop lower sections | Source/clone coordinate and screenshot comparison | 3, 7 | pass | Local height 7,831px; recommendation begins at 1,279px; related cards and footer begin at the captured source positions. |
| Engineering checks | Build and test suite | Fresh terminal output | 9 | pass | 14 unit tests, production build, and applicable browser tests pass. |

## Current evidence

- Local copy inventory: `fabrica-template-detail-clone/public/assets/ASSET-SOURCES.md`.
- Canonical local runtime: `npm run dev -- --host 127.0.0.1 --port 5176 --strictPort`, served at `http://127.0.0.1:5176/`.
- Fresh engineering evidence after lower-page calibration: 14 unit tests, production build, and the two applicable browser checks pass.
- Direct Playwright comparison permission was granted by the user. Captures of source/clone at both target viewports are retained in ignored refinement evidence.
