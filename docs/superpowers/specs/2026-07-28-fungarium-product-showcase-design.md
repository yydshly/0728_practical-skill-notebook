# Fungarium Product Showcase — Design

## Goal

Add `fungarium-product-showcase/` as a standalone, client-facing product-experience exploration inside this repository. It must demonstrate the interaction and presentation patterns of `nesdesignco/fungarium` while presenting the repository's own work as evidence of product capability.

The new project is an experiment and does not replace the root README or modify the existing `isle-of-quiet-signals`, `world-cup-letter-flags-demo`, or `fabrica-template-detail-clone` projects.

## Audience and business use

The visitor is a prospective client. The first screen should answer three questions without requiring technical knowledge:

1. What kinds of digital product experiences can be delivered?
2. What does each experience help a client achieve?
3. Where can the visitor see a working example?

The business scenario is an interactive-product studio showroom. It turns a portfolio from a grid of screenshots into a guided, explorable experience; it is not presented as a mushroom reference, a generic template, or a GitHub README replacement.

## Upstream relationship and licensing boundary

`nesdesignco/fungarium` is a complete React/Three.js application, not an installable package. This exploration will adapt its MIT-licensed application source and architecture into a new first-party project directory. It will not add `fungarium` as an npm dependency, create a git submodule, or modify the upstream repository.

The new directory will record the upstream repository URL and the exact imported commit in `UPSTREAM.md`, and retain the upstream MIT license notice. The upstream repository states that third-party models and textures retain their own licenses; those assets will not be copied by default. The showcase will use project-owned visual assets and simple procedural Three.js geometry until every reused asset has a clear redistribution right.

## Experience architecture

The page keeps the meaningful Fungarium interaction model while changing the subject matter:

| Fungarium concept | Showcase equivalent | Client-facing purpose |
| --- | --- | --- |
| Specimen shelf | Capability selector | Choose a type of product experience |
| Bench specimen | Active case object | Focus attention on one offer and its proof |
| Parchment label | Outcome card | Explain business value in plain language |
| Bench / Gills / Crown cameras | Overview / Interaction / Case views | Move from promise to mechanism to evidence |
| Scene capture | Shareable case image | Preserve a client discussion artifact |

The initial three showcase entries are grounded in the projects already in this repository:

- **Immersive storytelling** — `isle-of-quiet-signals`; suitable for narrative brand and destination experiences.
- **Interactive campaign** — `world-cup-letter-flags-demo`; suitable for participatory marketing moments.
- **Product prototype** — `fabrica-template-detail-clone`; suitable for high-fidelity product or marketing-page validation.

Each entry holds a short, non-technical promise, the appropriate client scenario, a concise implementation note, and a link to the local working case. No unverified client results or fabricated metrics are shown.

## Project structure

```text
fungarium-product-showcase/
  public/
    assets/                 # Project-owned showcase imagery
    models/                 # Original or clearly licensed scene models
  src/
    config/showcaseConfig.js
    components/scene/       # Scene, lights, camera, selectors and artifacts
    components/ui/          # Outcome panel, controls, loader and dialog
    store/                  # Shared DOM/scene state
    App.jsx
  scripts/                  # Showcase-specific browser verification
  package.json
  README.md
  LICENSE
  UPSTREAM.md
```

The source is componentized around scene, UI, content configuration, and shared state. Content edits should normally require changing `showcaseConfig.js`, not scene code.

## Visual and interaction requirements

- A persistent warm, atmospheric 3D showroom uses the spatial composition of Fungarium: a central display area, selectable items on a shelf, a left information panel, and right selection controls.
- The active item moves from the shelf to the primary display without unexpectedly changing the visitor's zoom.
- The visitor can rotate the active item, switch camera views, select each capability using mouse, touch, or keyboard, and open the related local case.
- The interface uses the showcase's own naming and art direction. It may borrow the layout grammar and interaction behavior, but it must not present Fungarium's name, mushroom data, or unlicensed artwork as its own.
- WebGPU is preferred with WebGL fallback. A non-3D fallback communicates the same content when rendering is unavailable or reduced motion is requested.

## Data flow and resilience

`showcaseConfig.js` is the single content source. It supplies selector order, titles, client scenario, outcome, technical note, model/visual reference, and local case link. A shared Zustand store coordinates selection and camera state between the DOM controls and Three.js scene.

If a model or optional texture fails to load, the application keeps the selected entry available using a procedural placeholder and visible content. Invalid or missing local case links are disabled rather than routing to an error page.

## Validation

- Build with the project's declared Node version and `npm run build`.
- Verify desktop and narrow mobile layouts in a real browser.
- Exercise capability selection, view switching, object rotation, keyboard controls, the local-case link, and image capture.
- Confirm WebGL fallback / non-3D content remains readable when WebGPU is unavailable.
- Adapt the upstream verification approach to the showcase's own controls and require zero console errors.

## Explicit non-goals

- No backend, account system, CMS, analytics service, or external client data.
- No changes to existing example projects beyond linking to their local routes or pages where available.
- No copying of upstream third-party models or textures without a documented license check.
- No claim that this is a production sales site; it is a runnable capability demonstration.
