# Peach Orchard Overall Scene Design

## Objective

Turn the existing technical feasibility route into a visually coherent,
playable rural peach-orchard vertical slice. The player must be able to see and
understand the complete work loop from the world itself: accept work at the
farmhouse yard, drive along a village road, park at the orchard, pick and pack
fruit, load the electric tricycle, return, and deliver.

This iteration prioritizes the overall world and business-flow experience. It
does not replace, remodel, localize, or otherwise refine the current runtime
character.

## Current baseline

The `codex/feasibility-slice` branch already provides the load-bearing runtime:

- approved electric-tricycle and current farmer GLBs;
- fixed-step Rapier vehicle physics and on-foot movement;
- player/vehicle authority transfer and follow-camera transitions;
- contextual interaction;
- the complete harvest domain flow;
- deterministic ten-loop browser fixtures and runtime telemetry.

The current course is a technical collision route. Its visual layer is absent
when debug mode is disabled, and its slope/platform layout does not represent a
readable rural orchard. This design keeps the mechanics and replaces the test
course presentation and route definition with a flat authored world.

## Experience boundary

The deliverable is one small, complete map rather than an open village:

```text
farmhouse yard / job and delivery
    -> concrete village road
    -> orchard gate and parking apron
    -> peach-tree rows and picking area
    -> crate and vehicle loading
    -> return to farmhouse delivery
```

Target footprint is approximately 80 by 60 metres. Every player, vehicle,
interaction, collision, recovery, and navigation anchor remains on one flat
gameplay plane. Hills, distant fields, roofs beyond the playable boundary, and
other height variation are non-walkable background dressing only.

## Art direction

The existing asset style guide remains authoritative. The world depicts a
maintained contemporary North China peach orchard during harvest season:

- warm-grey concrete yards and road patches;
- red-tile or practical sheet roofs, muted brick, and off-white render;
- faded agricultural green metal and equipment;
- leaf green with peach-pink fruit as the focal accent;
- restrained dust, drainage marks, repairs, and ordinary working wear;
- warm late-afternoon sunlight with clear gameplay visibility.

North American farm shorthand, historical-theme-village decoration,
photogrammetry noise, toy proportions, showroom surfaces, brand marks, and
legible plates remain prohibited.

## Visible-asset policy

Visible world content must be authored or imported GLB assets with recognizable
silhouette, material separation, and surface treatment. Runtime `BoxGeometry`,
plain cylinders, wireframe surfaces, sensor volumes, and other debug primitives
must never substitute for visible buildings, trees, roads, crates, or props.

Simple boxes, capsules, and convex hulls are allowed only for hidden collision,
interaction sensing, and recovery checks.

This iteration may use:

1. repository-authored Blender assets for the farmhouse, peach trees, road and
   yard surfaces, walls, gates, crates, and orchard props; and
2. zero-cost licensed base assets when they have recorded provenance, compatible
   modification rights, and a style-compatible result.

No paid acquisition is authorized in this iteration. Missing assets fail
visibly; the runtime must not silently replace them with basic geometry.

## Map composition

### Farmhouse yard

The south side of the map contains one modest farmhouse and working yard. The
yard is the spawn, job-acceptance, return, and delivery landmark. A visible gate,
sorting edge, stacked ventilated plastic crates, low wall, drainage detail, and
clear tricycle turning space make its purpose legible.

### Village road

A roughly five-metre-wide concrete road connects the yard and orchard. Edge
breakup, soil shoulders, drainage traces, utility details, and vegetation make
it read as a maintained rural work road. It stays flat and provides enough
clearance for camera follow, steering correction, and safe on-foot movement.

### Orchard arrival

The orchard entrance has a visible gate or boundary change, a parking apron,
and a loading/work zone. The parking, basket, crate, cargo, and picking targets
must be visible before the player commits to the final approach.

### Peach-tree rows

The orchard uses six rows of approximately five or six trees. Nominal spacing
is 4.5 metres within a row and 5 metres between rows, preserving at least one
clear vehicle corridor. Controlled rotation, crown tint, foliage density, and
fruit variation prevent obvious repetition while keeping one shared asset
family and material language.

### Background

Non-walkable distant hills, fields, roof silhouettes, tree belts, and haze close
the composition without creating navigation targets. Background dressing must
not occlude the road, orchard entrance, task targets, or follow camera.

## Runtime architecture

The world is separated into independently testable layers:

1. **Authored level data** — stable IDs, transforms, route width, orchard rows,
   spawn poses, safe points, interaction anchors, and world bounds.
2. **Visual assembly** — GLB loading, instancing, LOD selection, lighting,
   background dressing, and disposal.
3. **Collision and navigation** — hidden flat-plane colliders, movement
   clearance, vehicle boundaries, and recovery observations.
4. **Business zones** — existing semantic sensor IDs bound to visible world
   anchors: `parking`, `tree-inventory`, `basket`, `crate`, `cargo-slot`, and
   `delivery`.
5. **Presentation** — task objective, contextual interaction prompt, current
   load/progress, and completion feedback. Technical telemetry remains available
   only in explicit debug mode.

Stable IDs and transforms are shared through authored data. Collision and
interaction boundaries are never inferred from decorative meshes.

The existing harvest domain, vehicle controller, on-foot controller, control
authority, contextual action resolver, and follow camera remain the behavioral
core. Scene work must not duplicate business state inside visual objects.

## Interaction and state flow

The visible world communicates the existing state sequence:

```text
available
  -> accepted / vehicle prepared
  -> drive to orchard
  -> park and exit
  -> pick fruit
  -> transfer to basket and crate
  -> load cargo
  -> return
  -> deliver at farmhouse yard
```

Each transition has one world anchor and one concise HUD prompt. Target markers
are contextual rather than permanently glowing. Completed work changes visible
state where useful: fruit availability, filled crate, occupied cargo slot, and
delivery completion.

## Camera, lighting, and readability

The existing on-foot and vehicle follow cameras remain. Layout must preserve
their sight lines instead of adding camera-specific teleports or vertical
routes. Tree crowns, yard walls, roofs, and background props must not obscure
the controlled actor or the next major target at normal play distance.

Global illumination consists of a warm directional sun, soft sky/hemisphere
fill, restrained ambient haze, and shadow settings suitable for WebGL. Local
lights are added only when attached to a visible emitter. No unexplained
floating point lights are permitted.

## Interface

The default `/feasibility` view becomes a spatial game stage rather than a
technical dashboard:

- the canvas fills the primary viewport;
- a compact objective block identifies the current job step;
- a contextual prompt appears only near a valid action;
- a small harvest/cargo indicator shows fruit and crate progress;
- control help is concise and can collapse after first use;
- debug telemetry remains behind `?debug`.

The interface must not move the primary task into a long page below the scene.

## Performance budgets

The first overall-effect target is desktop browser play at a stable 60 fps on
the existing development machine, with graceful quality reduction on weaker
hardware. Initial scene budgets are:

- no more than 200 steady-state draw calls;
- no more than 350,000 visible triangles in the normal route view;
- instancing for repeated trees, crates, and suitable props;
- compressed, mipmapped textures with no unnecessary 4K images;
- shadow casters limited to gameplay-relevant near-field assets;
- no per-frame scene traversal for static-world discovery.

These are route-view budgets, not permission to hide loading failure or visual
substitution.

## Failure handling

Critical visible-asset loading is fail-closed. The stage shows the missing
asset ID and stops before play rather than producing an incomplete world.
Optional distant dressing may be omitted only when the omission is declared in
the loading result and does not affect route readability, collision, or
business targets.

Level-data validation rejects duplicate IDs, missing anchor references,
out-of-plane gameplay data, route/collider disagreement, unreachable targets,
and missing light-emitter bindings.

## Verification

### Automated

- validate every gameplay, collision, recovery, and interaction anchor against
  the flat gameplay plane;
- verify route clearance for player capsule and tricycle envelope;
- verify stable sensor-to-visual-anchor bindings;
- verify deterministic reset, recovery, and repeated reward behavior;
- preserve the existing ten-loop business fixture without fallback, ownership
  violations, or console errors;
- test critical asset failure and declared optional-dressing omission;
- assert that default scene output contains no visible debug primitives.

### Browser evidence

Capture and inspect the canonical runtime at desktop and mobile-sized
viewports in these states:

1. farmhouse spawn and job acceptance;
2. road traversal with readable orchard landmark;
3. orchard entrance and parking approach;
4. on-foot picking and crate interaction;
5. loaded vehicle and return route;
6. farmhouse delivery completion;
7. debug mode with diagnostics separated from the normal presentation.

Manually drive and walk every critical route. Verify uninterrupted movement,
camera framing, target visibility, interaction prompts, collision contact,
console health, frame time, draw calls, memory stability, and asset-loading
failure behavior.

## Acceptance boundary

The scene is accepted when a user can open `/feasibility`, immediately read a
contemporary rural peach-orchard world, and complete the full harvest business
loop without seeing debug geometry or needing an explanation of the route.

Character replacement, new character art, expanded village exploration,
interiors, weather cycles, traffic, NPC population, and production-scale open
world streaming are explicitly deferred.
