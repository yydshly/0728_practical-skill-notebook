# Fabrica visual-refinement record

## Design contract

- Entry mode: reference-led revision.
- Request revision: 1 — source-media authorization received on 2026-07-28.
- Target: a faithful local React recreation of the BestWebsiteTemplate Fabrica detail page.
- Visual ambition: Editorial.
- Experience architecture: Editorial Flow.
- Visual constraints: match the supplied source page's white/neutral editorial system, dense template grid, sticky template bar, wide media treatment, mobile overlays, and black footer.
- Primary journey: inspect Fabrica, open search or mobile navigation, control the preview, browse related templates, then follow the marketplace visit link.
- Required surfaces: desktop 1280 × 720 and mobile 390 × 844; search, mobile menu, preview control, cookie state, and local image/video rendering.
- Autonomy authorization: the user approved direct implementation and explicitly authorized copying the source-page media into local assets.
- Completion criteria: each local asset renders without a source-media network request; primary interactions work on both target viewports; a real-browser comparison documents remaining visible gaps.

## Coverage record

| Requirement | Surface/state | Evidence | Stage | Status | Next action |
| --- | --- | --- | --- | --- | --- |
| Local source assets | All media states | Asset inventory and local file check | 1 | pass | Recheck after any data-path change. |
| Primary desktop composition | 1280 × 720 | Side-by-side source/clone screenshot | 2–3 | continue | Capture both pages in an approved browser route. |
| Search and preview controls | 390 × 844 | Browser interaction evidence | 4–6 | pass | Retest after visual calibration. |
| Mobile layout and menu | 390 × 844 | Browser screenshot and interaction | 7 | continue | Capture in an approved browser route. |
| Engineering checks | Build and test suite | Fresh terminal output | 9 | pass | Rerun before delivery. |

## Current evidence

- Local copy inventory: `fabrica-template-detail-clone/public/assets/ASSET-SOURCES.md`.
- Fresh engineering evidence after asset mapping: 14 unit tests, production build, and the two applicable Playwright checks pass.
- Browser limitation: the in-app browser binding is unavailable in this environment. A direct Playwright screenshot route requires separate user permission under the active browser policy.

