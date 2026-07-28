# Fabrica Template Detail Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, responsive React clone of the supplied Fabrica template-detail page with the observed visual states and interactions.

**Architecture:** A Vite React single-page app holds page records in `src/data/pageData.js` and composes narrow visual components from that data. `App.jsx` owns only overlay, filter, video, and local cookie state; layout and responsive behavior are CSS-driven. Browser tests verify the key visible states at the source desktop and mobile viewports.

**Tech Stack:** Vite, React, vanilla CSS, Vitest, React Testing Library, Playwright.

## Global Constraints

- Build only the public page at `https://bestwebsitetemplate.com/templates/framer/fabrica`, not its external destination pages.
- Use authorized local assets only. No finished-app URL may point at `bestwebsitetemplate.com`, its image CDN, or any source video URL.
- Target 1280 × 720 and 390 × 844 for reference comparison.
- Preserve the source page’s semantics: accessible buttons, descriptive media alternatives, and visible keyboard focus.
- Keep cookie acceptance local with `localStorage`; do not add analytics, trackers, a backend, or a CMS.
- Keep the project under `fabrica-template-detail-clone/` and do not modify the existing demo projects.

---

## File Structure

```text
fabrica-template-detail-clone/
  public/assets/
    media/fabrica-preview.mp4
    templates/*.webp
    blogs/*.webp
    icons/*.svg
    fonts/*
  src/
    components/
      SiteHeader.jsx
      SearchOverlay.jsx
      MobileMenu.jsx
      TemplateTopBar.jsx
      PreviewMedia.jsx
      MetadataTable.jsx
      TemplateGrid.jsx
      TemplateCard.jsx
      BlogRail.jsx
      CookieBanner.jsx
      SiteFooter.jsx
    data/pageData.js
    styles/app.css
    App.jsx
    main.jsx
  tests/browser/fabrica-detail.spec.js
  src/App.test.jsx
  src/data/pageData.test.js
  package.json
  vite.config.js
  design-qa.md
```

`pageData.js` is the single source of static content. `App.jsx` exposes callback props to child components instead of passing mutable state through the data module. Each component receives only the records it renders.

### Task 1: Establish the isolated Vite project and authorized asset inventory

**Files:**
- Create: `fabrica-template-detail-clone/package.json`
- Create: `fabrica-template-detail-clone/index.html`
- Create: `fabrica-template-detail-clone/vite.config.js`
- Create: `fabrica-template-detail-clone/src/main.jsx`
- Create: `fabrica-template-detail-clone/public/assets/ASSET-SOURCES.md`
- Create: `fabrica-template-detail-clone/src/App.test.jsx`

**Interfaces:**
- Produces the `npm run dev`, `npm run test`, and `npm run test:e2e` commands used by every later task.
- Produces `public/assets/ASSET-SOURCES.md`, whose rows are `local path | source URL | license/permission basis | replacement status`.

- [ ] **Step 1: Capture and document each authorized source asset before creating UI code**

Record the observed Fabrica preview video, 1440 × 810 template covers, blog covers, site mark, and menu icon in `public/assets/ASSET-SOURCES.md`. For a missing authorization, write `replacement required` and do not download that file. Copy only cleared assets into the matching local `public/assets/` subdirectory.

```md
| Local path | Source URL | Permission basis | Status |
| --- | --- | --- | --- |
| media/fabrica-preview.mp4 | [authorized source] | user-confirmed reproduction permission | cleared |
```

- [ ] **Step 2: Write the failing smoke test**

Create `src/App.test.jsx` with a test for a not-yet-created app heading.

```jsx
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the Fabrica template identity', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Fabrica' })).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the smoke test and verify the expected red result**

Run: `npm run test -- --run src/App.test.jsx`

Expected: the command fails because `./App` does not yet exist.

- [ ] **Step 4: Scaffold the smallest runnable React application**

Create the Vite scripts and dependency set, `main.jsx`, and a minimal `App.jsx` that renders `<h1>Fabrica</h1>`. Configure Vitest with jsdom and Testing Library setup so the smoke test can run.

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 5: Run the smoke test and production build**

Run: `npm run test -- --run src/App.test.jsx && npm run build`

Expected: Vitest reports one passing test and Vite completes a production build.

- [ ] **Step 6: Commit the runnable project foundation**

```bash
git add fabrica-template-detail-clone
git commit -m "feat: scaffold fabrica detail clone"
```

### Task 2: Model page content and global visual tokens

**Files:**
- Create: `fabrica-template-detail-clone/src/data/pageData.js`
- Create: `fabrica-template-detail-clone/src/data/pageData.test.js`
- Create: `fabrica-template-detail-clone/src/styles/app.css`
- Modify: `fabrica-template-detail-clone/src/App.jsx`

**Interfaces:**
- Produces `pageData`, `platformFilters`, and `mobileMenuItems` named exports.
- `pageData` contains `template`, `preview`, `details`, `recommendations`, `blogs`, and `footerGroups` fields.

- [ ] **Step 1: Write the failing data contract tests**

```js
import { pageData, platformFilters } from './pageData';

test('has a local preview asset and complete template metadata', () => {
  expect(pageData.preview.videoSrc).toMatch(/^\/assets\/media\//);
  expect(pageData.details).toHaveLength(10);
  expect(pageData.recommendations).toHaveLength(14);
});

test('defines the four visible search platforms', () => {
  expect(platformFilters.map(({ label }) => label)).toEqual(['All', 'Framer', 'Webflow', 'Shopify']);
});
```

- [ ] **Step 2: Run the data tests and verify the expected red result**

Run: `npm run test -- --run src/data/pageData.test.js`

Expected: the command fails because `pageData.js` does not exist.

- [ ] **Step 3: Implement page records and design tokens**

Create data records with the observed labels, scores, prices, URLs, local asset paths, and alt text. In `app.css`, define the measured layout tokens and reset styles.

```css
:root {
  --header-height: clamp(52px, 3.125vw, 60px);
  --side-padding: calc(100vw / 48);
  --detail-padding: clamp(16px, 2.08vw, 40px);
  --detail-label-width: clamp(120px, 17vw, 240px);
  --card-radius: 10px;
}
```

- [ ] **Step 4: Render the page name from `pageData`**

```jsx
import { pageData } from './data/pageData';

export default function App() {
  return <h1>{pageData.template.name}</h1>;
}
```

- [ ] **Step 5: Run data and smoke tests**

Run: `npm run test -- --run src/data/pageData.test.js src/App.test.jsx`

Expected: all three assertions pass.

- [ ] **Step 6: Commit the data and styling foundation**

```bash
git add fabrica-template-detail-clone/src
git commit -m "feat: add fabrica page data and tokens"
```

### Task 3: Build navigation, search, and mobile-menu states

**Files:**
- Create: `fabrica-template-detail-clone/src/components/SiteHeader.jsx`
- Create: `fabrica-template-detail-clone/src/components/SearchOverlay.jsx`
- Create: `fabrica-template-detail-clone/src/components/MobileMenu.jsx`
- Modify: `fabrica-template-detail-clone/src/App.jsx`
- Modify: `fabrica-template-detail-clone/src/App.test.jsx`
- Modify: `fabrica-template-detail-clone/src/styles/app.css`

**Interfaces:**
- `SiteHeader({ onOpenSearch, onToggleMenu, isMenuOpen })` renders both breakpoint variants.
- `SearchOverlay({ isOpen, activePlatform, onPlatformChange, onClose })` is hidden when `isOpen` is false.
- `MobileMenu({ isOpen, onClose, items })` exposes `aria-expanded` through its trigger and `aria-label="Mobile navigation"` on the panel.

- [ ] **Step 1: Write failing interaction tests**

```jsx
import userEvent from '@testing-library/user-event';

test('opens and closes the category search overlay', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Search templates' }));
  expect(screen.getByRole('dialog', { name: 'Search templates' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog', { name: 'Search templates' })).toBeNull();
});
```

- [ ] **Step 2: Run the interaction tests and verify the expected red result**

Run: `npm run test -- --run src/App.test.jsx`

Expected: failure because the search trigger and dialog do not exist.

- [ ] **Step 3: Implement local overlay state and navigation components**

In `App.jsx`, use `useState(false)` for `isSearchOpen` and `isMenuOpen`; close one overlay before opening the other. Give the search panel `role="dialog"`, a text input with the accessible name `Search for categories or templates`, and the source’s four platform filter buttons. Render mobile menu links from `mobileMenuItems`.

```jsx
const [isSearchOpen, setIsSearchOpen] = useState(false);
const [isMenuOpen, setIsMenuOpen] = useState(false);
const openSearch = () => { setIsMenuOpen(false); setIsSearchOpen(true); };
```

- [ ] **Step 4: Implement responsive header, overlay, and panel CSS**

Use a desktop header with logo, Templates, search field, and Blog; at `max-width: 767px`, show the source-style compact search button and menu trigger. Give overlays `position: fixed`, full viewport coverage, white background, and their observed internal spacing.

- [ ] **Step 5: Run header tests and build**

Run: `npm run test -- --run src/App.test.jsx && npm run build`

Expected: interaction tests and the production build pass.

- [ ] **Step 6: Commit navigation states**

```bash
git add fabrica-template-detail-clone/src
git commit -m "feat: add responsive navigation states"
```

### Task 4: Build the sticky template detail and media preview

**Files:**
- Create: `fabrica-template-detail-clone/src/components/TemplateTopBar.jsx`
- Create: `fabrica-template-detail-clone/src/components/PreviewMedia.jsx`
- Create: `fabrica-template-detail-clone/src/components/MetadataTable.jsx`
- Modify: `fabrica-template-detail-clone/src/App.jsx`
- Modify: `fabrica-template-detail-clone/src/App.test.jsx`
- Modify: `fabrica-template-detail-clone/src/styles/app.css`

**Interfaces:**
- `TemplateTopBar({ template })` renders a sticky identity bar and external Visit link.
- `PreviewMedia({ videoSrc, posterSrc, alt })` manages its own `isPaused` state and labels the control `Pause video` or `Play video`.
- `MetadataTable({ rows })` renders rows with a label and value.

- [ ] **Step 1: Write failing detail behavior tests**

```jsx
test('switches the preview control from pause to play', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('button', { name: 'Pause video' }));
  expect(screen.getByRole('button', { name: 'Play video' })).toBeVisible();
});

test('renders the complete metadata table', () => {
  render(<App />);
  expect(screen.getByText('Overall score')).toBeVisible();
  expect(screen.getByText('Fabrica works best for portfolio and agency projects that need smooth motion and video backgrounds.')).toBeVisible();
});
```

- [ ] **Step 2: Run detail tests and verify the expected red result**

Run: `npm run test -- --run src/App.test.jsx`

Expected: failure because no media control or detail rows exist.

- [ ] **Step 3: Implement the media and metadata components**

Use a muted looping `video` with `playsInline`, a local `poster`, and a `ref` for `.play()`/`.pause()`. Place it beside the static poster pane. Use `position: sticky; top: 0` for the identity bar and map `pageData.details` into labelled rows.

```jsx
const togglePlayback = () => {
  if (videoRef.current.paused) videoRef.current.play();
  else videoRef.current.pause();
  setIsPaused(videoRef.current.paused);
};
```

- [ ] **Step 4: Implement desktop and mobile media/detail layout**

Use a flex preview strip. At mobile widths it has `overflow-x: auto` and `scroll-snap-type: x mandatory`; at 768px and above each pane uses `flex: 1` and overflow is visible. Render metadata rows inside the neutral band with a 50% mobile label column and `--detail-label-width` on desktop.

- [ ] **Step 5: Run detail tests and build**

Run: `npm run test -- --run src/App.test.jsx && npm run build`

Expected: video-control tests, metadata tests, and the build pass.

- [ ] **Step 6: Commit the core detail experience**

```bash
git add fabrica-template-detail-clone/src
git commit -m "feat: add template preview and metadata"
```

### Task 5: Build recommendations, blogs, footer, and cookie state

**Files:**
- Create: `fabrica-template-detail-clone/src/components/TemplateGrid.jsx`
- Create: `fabrica-template-detail-clone/src/components/TemplateCard.jsx`
- Create: `fabrica-template-detail-clone/src/components/BlogRail.jsx`
- Create: `fabrica-template-detail-clone/src/components/CookieBanner.jsx`
- Create: `fabrica-template-detail-clone/src/components/SiteFooter.jsx`
- Modify: `fabrica-template-detail-clone/src/App.jsx`
- Modify: `fabrica-template-detail-clone/src/App.test.jsx`
- Modify: `fabrica-template-detail-clone/src/styles/app.css`

**Interfaces:**
- `TemplateGrid({ templates })` maps records to `TemplateCard`.
- `TemplateCard({ item })` requires `name`, `score`, `price`, `href`, `imageSrc`, and `imageAlt`.
- `CookieBanner({ accepted, onAccept })` renders no DOM when `accepted` is true.
- `SiteFooter({ groups })` renders headings and links from `pageData.footerGroups`.

- [ ] **Step 1: Write failing content and persistence tests**

```jsx
test('renders all recommended templates and dismisses the cookie banner', async () => {
  const user = userEvent.setup();
  render(<App />);
  expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(18);
  await user.click(screen.getByRole('button', { name: 'Accept' }));
  expect(screen.queryByText('We use cookies')).toBeNull();
  expect(window.localStorage.getItem('fabrica-cookie-accepted')).toBe('true');
});
```

- [ ] **Step 2: Run the tests and verify the expected red result**

Run: `npm run test -- --run src/App.test.jsx`

Expected: failure because recommendation cards, blog headings, and the banner have not been implemented.

- [ ] **Step 3: Implement card, blog, footer, and cookie components**

Use local asset paths for every `<img>`. Each card keeps score at the top, media centered, and name/price at the bottom; its Visit control is an affordance within the card. Read the initial cookie state from `localStorage` and write exactly `fabrica-cookie-accepted=true` after Accept.

```jsx
const [cookieAccepted, setCookieAccepted] = useState(
  () => window.localStorage.getItem('fabrica-cookie-accepted') === 'true',
);
const acceptCookies = () => {
  window.localStorage.setItem('fabrica-cookie-accepted', 'true');
  setCookieAccepted(true);
};
```

- [ ] **Step 4: Implement responsive content CSS**

At desktop widths, render the recommendation collection in three columns and related posts in two columns. At mobile widths, use a single-card recommendation column and `overflow-x: auto` for the blog rail. Render footer groups as desktop columns and two mobile columns, with the oversized black wordmark at the bottom.

- [ ] **Step 5: Run content tests and build**

Run: `npm run test -- --run src/App.test.jsx && npm run build`

Expected: recommendation, cookie, and heading assertions pass; Vite builds without errors.

- [ ] **Step 6: Commit page completion**

```bash
git add fabrica-template-detail-clone/src
git commit -m "feat: add detail page content sections"
```

### Task 6: Validate visual states and write design QA evidence

**Files:**
- Create: `fabrica-template-detail-clone/tests/browser/fabrica-detail.spec.js`
- Create: `fabrica-template-detail-clone/design-qa.md`
- Modify: `fabrica-template-detail-clone/playwright.config.js`

**Interfaces:**
- Browser test starts the Vite app, uses `desktop` at 1280 × 720 and `mobile` at 390 × 844, and asserts source-visible controls.
- `design-qa.md` ends with `final result: passed` only after screenshot comparison and interaction tests pass; otherwise it ends with `final result: blocked`.

- [ ] **Step 1: Write failing browser tests for source-critical states**

```js
import { test, expect } from '@playwright/test';

test('mobile opens search and pauses the preview', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Search templates' }).click();
  await expect(page.getByRole('dialog', { name: 'Search templates' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Pause video' }).click();
  await expect(page.getByRole('button', { name: 'Play video' })).toBeVisible();
});
```

- [ ] **Step 2: Run the browser test and verify the expected red result**

Run: `npm run test:e2e -- --project=mobile`

Expected: failure until Playwright configuration and the expected mobile implementation are present.

- [ ] **Step 3: Configure Playwright and satisfy the browser states**

Configure `webServer.command` as `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort`, set a local base URL, and add desktop/mobile projects. Fix only mismatches exposed by the interaction checks.

- [ ] **Step 4: Capture desktop and mobile reference comparisons**

Capture the clone at 1280 × 720 and 390 × 844. Compare it against the captured source page for top navigation, media crop, metadata alignment, recommendation spacing, blog rail, footer, and cookie-banner placement. Record each finding and resolution in `design-qa.md`.

```md
## 390 × 844

- Search overlay: pass
- Mobile menu: pass
- Preview scroll and pause/play: pass
- Metadata wrapping: pass

final result: passed
```

- [ ] **Step 5: Run the full verification suite**

Run: `npm run test -- --run && npm run build && npm run test:e2e`

Expected: all unit tests, build, and browser tests pass.

- [ ] **Step 6: Commit QA evidence**

```bash
git add fabrica-template-detail-clone
git commit -m "test: verify fabrica detail clone"
```

## Plan Self-Review

- Spec coverage: Tasks 1–6 cover source assets, standalone app setup, every named interaction, desktop and mobile layouts, local cookie storage, and final visual QA.
- Placeholder scan: this plan contains no unresolved task markers or deferred implementation language.
- Interface consistency: `pageData` supplies static records; `App` owns UI state; each listed component receives the props introduced in its own task before later tasks depend on it.
