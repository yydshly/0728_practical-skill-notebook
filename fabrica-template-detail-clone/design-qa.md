# Fabrica detail clone design QA

## Evidence and method

- The user authorized both source-media copying and local Playwright screenshot comparison on 2026-07-28.
- Source and clone captures at 1280 × 720 and 390 × 844 are retained outside the repository in the ignored refinement-evidence directory.
- All preview, recommendation, blog, mark, and menu assets now resolve from `public/assets`; no source-media request is made at runtime.

## Calibrated first view

### 1280 × 720

- Navigation, 60px header, template-identity bar, wide Visit button, two-pane preview, and score-table entry align with the source hierarchy.
- The card grid now uses the source checkerboard rhythm rather than a uniform three-card row.
- Preview-frame pixels are intentionally not compared frame-for-frame because the same looping source video can render different moments.

### 390 × 844

- Header, search field, template bar, Visit button, horizontally clipped preview strip, score rows, and cookie placement were compared against the source capture.
- Search opens and closes; mobile navigation opens and closes; the preview control changes its accessible label; cookie acceptance persists.

## Lower-page calibration

- The recommendation and blog rails now use the source three-column checkerboard positions, card dimensions, metadata, and vertical spacing.
- Desktop comparison at 1280 × 720 now matches the source document height (7,831px), recommendation start (1,279px), related-blog card positions, and footer start (7,002px).
- The footer’s column positions and oversized wordmark baseline are calibrated against the source. The local Poppins font files remove the fallback-font variance during local review.

final result: verified against the source’s captured desktop and mobile states
