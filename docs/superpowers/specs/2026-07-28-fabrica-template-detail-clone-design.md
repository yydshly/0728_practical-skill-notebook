# Fabrica Template Detail Clone — Design

## Goal

Create a standalone fourth demo project, `fabrica-template-detail-clone`, that faithfully recreates the public page at `https://bestwebsitetemplate.com/templates/framer/fabrica` as a local, responsive React application. The project is a visual and interaction study of the supplied template-detail page, not a copy of the downstream Fabrica website.

The implementation must be based on captured source evidence and use locally stored, authorized assets. It must not hotlink source images, video, fonts, or icons in the finished app.

## Scope

### Included

- Desktop and mobile layouts at 1280 × 720 and 390 × 844.
- Header navigation, desktop search affordance, mobile search overlay, and mobile menu panel.
- Sticky template identity/action bar.
- Two-panel template preview with a looping muted video, poster image, and accessible pause/play control.
- Template metadata table, recommendation cards, related-blog rail, footer, and locally persisted cookie-banner dismissal.
- Responsive behavior observed in the reference: two preview panes on desktop; horizontal snapped preview panes on mobile; three-column recommendation presentation on desktop; single-column template cards and horizontal blog rail on mobile; multi-column desktop footer and two-column mobile footer.
- Outbound destination URLs remain as links but their destination pages are out of scope.

### Excluded

- Backend, search indexing, live analytics, tracking, CMS authoring, internationalized routes, and any external destination pages.
- Use of source assets without permission or source-code extraction.

## Visual System

- Poppins is the primary typeface, with local fallback handling.
- White primary background, `#f2f2f2` content bands/cards, black primary action buttons, and thin neutral separators.
- Core responsive tokens derived from the observed layout:
  - header height: `clamp(52px, 3.125vw, 60px)`;
  - horizontal page padding: `calc(100vw / 48)`;
  - detail padding: `clamp(16px, 2.08vw, 40px)`;
  - metadata label width: `clamp(120px, 17vw, 240px)`;
  - card radius: `10px`.

## Component Architecture

`App` owns static page data and small UI states. Components remain presentational where possible:

- `SiteHeader`: desktop header, search trigger/input, and mobile menu trigger.
- `SearchOverlay`: category platform filters and search field; closes without changing page state.
- `MobileMenu`: full-screen navigation panel.
- `TemplateTopBar`: sticky title and Visit action.
- `PreviewMedia`: video/poster panes and playback state.
- `MetadataTable`: declarative label/value rows.
- `TemplateGrid` and `TemplateCard`: recommendation content and link affordances.
- `BlogRail`: desktop grid and mobile horizontal rail.
- `SiteFooter`: responsive navigation groups and oversized wordmark treatment.
- `CookieBanner`: local-only acceptance state in `localStorage`.

All mutable interaction state is kept in React state, except accepted-cookie state, which is read and saved locally. Static content lives in a data module so markup does not mix with data records.

## Asset Strategy

The project uses an `assets/` hierarchy grouped by `media/`, `templates/`, `blogs/`, `icons/`, and `fonts/`. Before copying a source file, confirm it is authorized for this reproduction. If authorization is absent, replace it with licensed equivalent media while retaining the measured dimensions and crop behavior; document each replacement.

## Validation

- Run the project locally using its standard Vite development command.
- Verify responsive screenshots at 1280 × 720 and 390 × 844 alongside the captured reference state.
- Test video pause/play, search overlay open/close, mobile menu open/close, card links, blog rail scrolling, and local cookie dismissal.
- Capture a design QA report in the project root. No P0–P2 visual or interaction mismatch may remain before handoff.

## Project Layout

```text
fabrica-template-detail-clone/
  public/
    assets/
      media/
      templates/
      blogs/
      icons/
      fonts/
  src/
    components/
    data/
    styles/
    App.jsx
    main.jsx
  tests/
  design-qa.md
```
