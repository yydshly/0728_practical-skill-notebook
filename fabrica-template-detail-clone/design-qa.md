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

## Remaining calibration work

- Full-page recommendation, blog, and footer spacing still needs a lower-page screenshot pass before a one-to-one claim.
- The full source page is taller than the local page, so lower-page vertical rhythm remains an active calibration item.

final result: in progress
