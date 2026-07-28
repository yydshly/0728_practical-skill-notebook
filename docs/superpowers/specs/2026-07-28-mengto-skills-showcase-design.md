# MengTo Skills Showcase Design

Date: 2026-07-28  
Status: Approved for implementation planning

## 1. Purpose

Build a suite of complementary, independently runnable web products that demonstrates the breadth of the `MengTo/Skills` repository. The suite must show that the skills can guide:

- cinematic and creative web interactions;
- reusable Three.js asset pipelines;
- complete browser-game systems;
- commercial 3D product experiences;
- mobile, accessibility, performance, testing, and release work.

The existing `Isle of Quiet Signals` and `Final Four — Typographic Flags` demos remain part of the broader portfolio. The new suite adds three products that share selected 3D infrastructure and assets without sharing product-specific state.

## 1.1 Documentation Language Policy

The project is Chinese-first for human-facing documentation and product copy:

- root and product README files use Chinese as the primary language;
- installation records, validation reports, architecture explanations, and handoff summaries use Chinese;
- product navigation, controls, status messages, tutorials, errors, and accessibility labels use Chinese by default;
- important technical terms may show Chinese followed by the canonical English term once, for example `固定时间步（fixed timestep）`;
- source-code identifiers, file names, package names, commands, URLs, API names, and third-party error output remain English so they match the executable system;
- upstream `MengTo/Skills` files remain unchanged in their original language to preserve provenance, diffability, and update compatibility;
- every installed skill receives a Chinese purpose and impact explanation in the project README and `docs/skill-installation.md`;
- Codex explanations and project delivery reports to the user are written in Chinese unless the user explicitly requests English.

Language choice must not change product behavior, validation criteria, or runtime dependencies.

## 2. Product Suite

### 2.1 Monster Forge

Monster Forge is a 3D asset review tool for game-development teams.

The first release includes:

- four visually and behaviorally distinct monsters;
- a card-based asset catalog;
- live model rotation and zoom;
- Idle, Walk, Attack, Hit, and Death animation playback;
- optional skeleton, collider, and equipment-socket overlays;
- model provenance, geometry, material, animation, and asset-path metadata;
- desktop and mobile layouts;
- static-image fallback when WebGL or a model is unavailable.

The first release excludes model uploading, online modeling, animation authoring, and multi-user collaboration.

### 2.2 Ashfall Arena

Ashfall Arena is the flagship playable 3D action-game vertical slice.

The first release includes:

- one compact, explorable arena;
- one player character and two weapons;
- two regular enemy archetypes, one elite, and one boss;
- attack chains, guard, dodge, lock-on, damage, recovery, and death;
- health, stamina, healing, drops, and one upgrade choice;
- loss, retry, completion, and local save continuation;
- keyboard, mouse, touch, and standard gamepad controls;
- one complete play session lasting 8–12 minutes for a first-time player.

The first release excludes an open world, multiplayer, extensive narrative, a large quest system, and live-service features.

### 2.3 Mech Atelier

Mech Atelier turns the same 3D pipeline into a commercial product configurator.

The first release includes:

- three base mech chassis;
- interchangeable head, armor, left-weapon, right-weapon, and rear modules;
- color, metalness, roughness, and lighting-environment controls;
- live statistics, weight, and price updates;
- exploded-view animation and part hotspots;
- local configuration persistence;
- shareable configuration URLs;
- exportable product-poster composition;
- responsive product presentation.

The first release excludes real checkout, inventory, payments, user accounts, and order management.

## 3. Portfolio Positioning

The products share one original dark science-fantasy world and selected visual assets, but each must be understandable and usable independently.

| Product | Primary proof |
| --- | --- |
| Monster Forge | 3D asset ingestion, inspection, animation, provenance, and review |
| Ashfall Arena | Camera, controls, combat, enemies, AI, progression, saves, VFX, audio, and gameplay QA |
| Mech Atelier | Commercial WebGL presentation, configuration rules, responsive UI, and shareable state |

Together with the existing demos, the portfolio covers:

- 2.5D cinematic scrolling;
- Canvas typography and pointer-driven physics;
- Three.js tools;
- browser games;
- commercial 3D products.

## 4. Workspace and Repository Layout

Create the suite under the current workspace:

```text
D:\codex_project_work\0728_some_github\
└── mengto-skills-showcase\
    ├── skills-source\
    │   └── MengTo-Skills\
    ├── apps\
    │   ├── monster-forge\
    │   ├── ashfall-arena\
    │   └── mech-atelier\
    ├── packages\
    │   ├── three-runtime\
    │   ├── game-assets\
    │   ├── input-system\
    │   ├── ui-system\
    │   └── content-schema\
    ├── docs\
    │   ├── product-design\
    │   └── validation\
    ├── AGENTS.md
    ├── README.md
    └── package.json
```

`skills-source/MengTo-Skills` is a pinned local copy of the upstream repository. Product code must not modify this directory. Any project-specific adaptations belong in the suite's documentation, content definitions, or source packages.

Each application must build, test, and run independently. Shared packages may fail at build time, but a runtime failure or corrupt state in one deployed product must not affect another product.

## 5. Skill Installation and Use

### 5.1 Two copies with different purposes

The workflow intentionally keeps two representations of the selected skills:

1. Project source copy:

   ```text
   D:\codex_project_work\0728_some_github\mengto-skills-showcase\
   └── skills-source\MengTo-Skills\
   ```

   This preserves the full upstream repository, source references, and pinned revision used by the project.

2. Codex installation:

   ```text
   C:\Users\yun68\.codex\skills\<skill-name>\
   ```

   This allows Codex to discover and invoke individual skills during development.

The installed skills guide development only. They are not runtime dependencies and must not be included in application bundles or deployments.

### 5.2 Initial selected skills

Install only the game-development skills required by the approved products:

- `build-isometric-arpg`
- `author-game-levels`
- `build-game-camera-controls`
- `design-action-combat`
- `build-threejs-enemy-systems`
- `build-game-monster-system`
- `tune-enemy-ai`
- `build-game-inventory`
- `build-hybrid-game-assets`
- `build-vesperfall-review-assets`
- `create-game-vfx`
- `build-game-audio-feedback`
- `build-mobile-threejs-games`
- `optimize-threejs-games`
- `test-playable-web-games`
- `ship-web-games`

Web-design skills may be added later only when an approved product requirement needs them. Installing the full repository by default is explicitly out of scope.

### 5.3 Skill-driven development phases

Skills are invoked by phase rather than all at once:

| Phase | Primary skills |
| --- | --- |
| Asset pipeline and Monster Forge | `build-hybrid-game-assets`, `build-game-monster-system`, `build-vesperfall-review-assets` |
| Arena foundation | `build-isometric-arpg`, `author-game-levels`, `build-game-camera-controls` |
| Combat and enemies | `design-action-combat`, `build-threejs-enemy-systems`, `tune-enemy-ai` |
| Player systems and feedback | `build-game-inventory`, `create-game-vfx`, `build-game-audio-feedback` |
| Mobile and performance | `build-mobile-threejs-games`, `optimize-threejs-games` |
| Validation and release | `test-playable-web-games`, `ship-web-games` |

`AGENTS.md` will record which skill applies to which directory and require the narrowest matching skill to be read before work begins.

## 6. Required README Documentation

The suite root `README.md` must be treated as part of the deliverable, not as optional cleanup.

It must document:

- the suite's purpose and the three products;
- local prerequisites and exact run, test, and build commands;
- the local upstream source directory;
- the exact pinned upstream repository URL, branch or tag, and commit SHA;
- the Codex installation root;
- every installed skill and its source path;
- why each skill was installed;
- which products and development phases each skill can influence;
- confirmation that skills are development instructions, not runtime dependencies;
- whether installing a skill affects other Codex tasks globally;
- how to check whether each skill is installed;
- how to update skills intentionally;
- how to remove an installed skill safely;
- how the local pinned source and globally installed copies can diverge;
- project-specific validation and release records.

The README must not claim that installing a skill automatically builds a product. It must explain that Codex reads the relevant skill and then implements and validates the corresponding project work.

The first implementation phase will also add `docs/skill-installation.md` for detailed installation records. The root README will link to it and retain the essential summary.

## 7. Shared Architecture

Use Vite, TypeScript, and Three.js for the new suite. Use Vitest for deterministic logic tests and Playwright for browser journeys.

The shared packages have narrow responsibilities:

- `three-runtime`: renderer lifecycle, scene setup, camera primitives, lighting, model loading, animation cleanup, and quality tiers;
- `game-assets`: asset manifest, source paths, previews, model and texture references, provenance, and reusable loaders;
- `input-system`: normalized keyboard, mouse, touch, and controller intent;
- `ui-system`: tokens and basic reusable controls, excluding product-specific screens;
- `content-schema`: shared base records for models, animation clips, sockets, and dimensions.

Product-specific data remains inside each application:

- Monster Forge owns review state and technical inspection metadata;
- Ashfall Arena owns combat, AI, progression, save, and encounter state;
- Mech Atelier owns compatibility, commercial attributes, price, and shared-configuration state.

No application may import another application's private modules.

## 8. Data Flow

Each 3D asset has one base manifest containing:

- model, texture, and preview paths;
- animation names and durations;
- skeleton and socket declarations;
- measured bounds and grounding data;
- collider references;
- provenance and license notes.

Applications extend that manifest without changing its meaning:

- Monster Forge adds inspection fixtures and review annotations;
- Ashfall Arena adds combat and AI content records;
- Mech Atelier adds module compatibility, commercial attributes, and pricing.

Loading flows must be cancellable and disposable. Switching products, assets, or configurations must release old animations, materials, event listeners, and GPU resources when they are no longer shared.

## 9. Failure Handling and Accessibility

The products must degrade honestly:

- missing models show the static preview and a visible unavailable state;
- missing animations disable only the affected action;
- unavailable WebGL retains readable product and asset information;
- invalid shared configurations fall back to the nearest valid configuration;
- incompatible saves use explicit version migration or a user-visible reset choice;
- low-performance devices reduce shadows, particles, post-processing, and render resolution;
- `prefers-reduced-motion` reduces non-essential motion;
- keyboard focus, labels, contrast, and screen-reader status updates are included in each application.

No fallback may silently claim that a model, animation, or configuration loaded successfully.

## 10. Validation

Validation occurs at four levels:

1. Asset validation
   - required paths exist;
   - image and model metadata is truthful;
   - animations, sockets, materials, and bounds match declarations.
2. Deterministic logic validation
   - combat and AI fixtures produce repeatable results;
   - price, compatibility, and stat calculations are exact;
   - save and shared-URL migrations preserve valid state.
3. Browser journey validation
   - desktop and touch journeys complete;
   - keyboard and reduced-motion modes remain usable;
   - model failure and WebGL fallback states remain readable;
   - console errors, overflow, broken media, and dead controls are absent.
4. Performance validation
   - representative scenes have recorded frame-time and memory evidence;
   - quality tiers take effect;
   - switching assets or configurations does not leak GPU resources;
   - production builds have documented size and loading budgets.

Each product keeps its evidence under `docs/validation`.

## 11. Implementation Order

Implement in this order:

1. Create the suite workspace and documentation baseline.
2. Pin the upstream repository locally and record the revision.
3. Install and record the approved skills.
4. Establish shared schemas, asset validation, and Three.js lifecycle.
5. Build Monster Forge and validate the asset pipeline.
6. Build Ashfall Arena using validated assets.
7. Build Mech Atelier using the proven rendering and configuration pipeline.
8. Perform cross-product mobile, accessibility, performance, and release validation.

Each product requires its own implementation plan and acceptance evidence. A later product must not block shipping an earlier independently complete product.

## 12. Success Criteria

The suite is successful when:

- all three products run independently from documented commands;
- the README accurately records installation directories, selected skills, revisions, and impacts;
- every installed skill has an explicit development purpose;
- no installed skill appears in a production runtime bundle;
- Monster Forge proves truthful asset inspection;
- Ashfall Arena provides one complete 8–12 minute game loop;
- Mech Atelier supports valid configuration, sharing, and fallback behavior;
- desktop, touch, keyboard, and reduced-motion journeys are verified;
- performance and release evidence is stored with the project;
- the existing two creative demos plus the new suite clearly demonstrate five distinct product capabilities.

## 13. Explicit Non-Goals

- Installing every skill from `MengTo/Skills`.
- Treating skills as runtime libraries.
- Modifying the pinned upstream source in place.
- Building an open-world or multiplayer game.
- Building a full DCC editor.
- Adding real commerce, accounts, payments, or inventory systems.
- Forcing the three products into one runtime application.
