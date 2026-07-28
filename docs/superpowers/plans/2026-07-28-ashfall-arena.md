# Ashfall Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independently runnable 8–12 minute Three.js action-game vertical slice with deterministic combat, fair enemies, one complete encounter arc, progression, saves, mobile controls, and release evidence.

**Architecture:** A fixed-step serializable simulation owns authoritative movement, contact, damage, AI intent, rewards, and save state. Three.js rendering, camera, input devices, VFX, audio, and HUD observe simulation events without deciding gameplay outcomes.

**Tech Stack:** Vite 8, TypeScript, Three.js, shared showcase packages, Vitest 4, Playwright 1.62, Web Audio API, localStorage.

## Global Constraints

- Work only under `mengto-skills-showcase/apps/ashfall-arena` and approved shared packages.
- Read `build-isometric-arpg` first, then the narrow level, camera, combat, enemy, AI, inventory, VFX, audio, mobile, performance, testing, and release skills when their task begins.
- Keep simulation state deterministic and serializable.
- Use authoritative simulation contact events; visual overlap never causes damage.
- Provide one compact arena, two regular enemy types, one elite, and one boss.
- Provide one player, two weapons, one upgrade choice, retry, completion, and local continuation.
- Support keyboard/mouse, touch, and standard gamepad controls.
- First-time completion target is 8–12 minutes.
- Respect reduced motion and expose readable non-audio feedback.

---

## File Map

```text
apps/ashfall-arena/
├── index.html
├── package.json
├── vite.config.ts
├── playwright.config.ts
├── src/
│   ├── main.ts
│   ├── styles.css
│   ├── content/arena-content.ts
│   ├── simulation/types.ts
│   ├── simulation/create-initial-state.ts
│   ├── simulation/step-game.ts
│   ├── simulation/combat.ts
│   ├── simulation/enemy-ai.ts
│   ├── simulation/encounters.ts
│   ├── simulation/inventory.ts
│   ├── persistence/save-game.ts
│   ├── scene/create-arena-scene.ts
│   ├── scene/create-game-camera.ts
│   ├── scene/sync-entities.ts
│   ├── input/create-input-adapter.ts
│   ├── feedback/create-vfx.ts
│   ├── feedback/create-audio.ts
│   ├── review/create-review-api.ts
│   └── ui/render-hud.ts
├── tests/
│   ├── simulation.test.ts
│   ├── combat.test.ts
│   ├── enemy-ai.test.ts
│   ├── encounters.test.ts
│   ├── inventory.test.ts
│   ├── save-game.test.ts
│   └── helpers/simulation-fixtures.ts
├── tests/browser/
│   ├── fresh-start.spec.ts
│   ├── combat-journey.spec.ts
│   ├── complete-run.spec.ts
│   ├── save-retry.spec.ts
│   ├── mobile-controls.spec.ts
│   └── reduced-motion.spec.ts
└── docs/VALIDATION.md
packages/game-assets/
├── src/player/create-vesper-knight.ts
└── tests/player-avatar.test.ts
```

### Task 1: Establish the deterministic simulation contract

**Files:**
- Create: `apps/ashfall-arena/src/simulation/types.ts`
- Create: `apps/ashfall-arena/src/simulation/create-initial-state.ts`
- Create: `apps/ashfall-arena/src/simulation/step-game.ts`
- Create: `apps/ashfall-arena/src/content/arena-content.ts`
- Create: `apps/ashfall-arena/tests/simulation.test.ts`
- Create: `apps/ashfall-arena/tests/helpers/simulation-fixtures.ts`

**Interfaces:**
- Produces: `GameState`, `GameIntent`, `GameEvent`, `GameContent`, `createInitialState(seed)`, and `stepGame(state, intent, fixedDelta, content)`.
- Consumes: normalized `PlayerIntent` from `@showcase/input-system`.

- [ ] **Step 1: Write the failing fixed-step test**

```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "../src/simulation/create-initial-state";
import { stepGame } from "../src/simulation/step-game";
import { arenaContent } from "../src/content/arena-content";

describe("fixed-step simulation", () => {
  it("produces identical state for identical seed and intent sequence", () => {
    const run = () => {
      let state = createInitialState(7481);
      for (let frame = 0; frame < 120; frame += 1) {
        state = stepGame(state, {
          moveX: 0,
          moveY: 1,
          attackPressed: frame === 60,
          guardHeld: false,
          dodgePressed: false,
          lockPressed: false,
          healPressed: false,
          switchWeaponPressed: false,
          pausePressed: false,
        }, 1 / 60, arenaContent).state;
      }
      return state;
    };
    expect(run()).toEqual(run());
  });

  it("starts with the approved player values", () => {
    expect(createInitialState(1).player).toMatchObject({
      health: 105,
      maxHealth: 105,
      stamina: 100,
      maxStamina: 100,
      weaponId: "oathblade",
      healingCharges: 3,
    });
  });
});
```

- [ ] **Step 2: Run the test and confirm the simulation is absent**

```powershell
npm test --workspace @showcase/ashfall-arena -- simulation
```

Expected: FAIL because simulation modules do not exist.

- [ ] **Step 3: Define serializable state and event interfaces**

```ts
import type { PlayerIntent } from "@showcase/input-system";

export interface Vec2 { x: number; y: number }
export type GameStatus = "playing" | "upgrade" | "defeated" | "complete";
export type EnemyKind = "glass-crawler" | "ash-warden" | "bell-elite" | "bell-sovereign";
export interface GameIntent extends PlayerIntent {
  healPressed: boolean;
  switchWeaponPressed: boolean;
  pausePressed: boolean;
}

export interface ActorState {
  id: string;
  position: Vec2;
  facingRadians: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  action: "idle" | "move" | "attack" | "guard" | "dodge" | "hit" | "dead";
  actionTime: number;
}

export interface GameState {
  version: 1;
  seed: number;
  tick: number;
  status: GameStatus;
  player: ActorState & {
    weaponId: "oathblade" | "ember-bow";
    healingCharges: number;
    souls: number;
    powerMultiplier: 1 | 1.2;
    upgradeId: "vitality" | "power" | null;
  };
  enemies: Record<string, ActorState & { kind: EnemyKind; intent: string; cooldown: number }>;
  encounter: { phase: "training" | "wave-one" | "elite" | "boss" | "complete"; gateOpen: boolean };
  drops: Array<{ id: string; position: Vec2; kind: "souls" | "healing"; amount: number }>;
}

export type GameEvent =
  | { type: "contact"; attackerId: string; targetId: string; attackId: string }
  | { type: "damage"; targetId: string; amount: number; guarded: boolean }
  | { type: "defeated"; actorId: string }
  | { type: "drop"; dropId: string }
  | { type: "upgrade-offered" }
  | { type: "encounter-complete" };

export interface GameContent {
  arena: {
    min: Vec2;
    max: Vec2;
    playerSpawn: Vec2;
    trainingCenter: Vec2;
    waveCenter: Vec2;
    eliteCenter: Vec2;
    bossCenter: Vec2;
  };
  weapons: Record<string, {
    damage: number;
    stamina: number;
    startup: number;
    active: number;
    recovery: number;
  }>;
  enemyHealth: Record<EnemyKind, number>;
}
```

Create deterministic test helpers with these exact exports:

```ts
// tests/helpers/simulation-fixtures.ts
import { arenaContent } from "../../src/content/arena-content";
import { stepGame } from "../../src/simulation/step-game";
import type { ActorState, EnemyKind, GameEvent, GameIntent, GameState } from "../../src/simulation/types";

export const neutralIntent: GameIntent = {
  moveX: 0,
  moveY: 0,
  attackPressed: false,
  guardHeld: false,
  dodgePressed: false,
  lockPressed: false,
  healPressed: false,
  switchWeaponPressed: false,
  pausePressed: false,
};

export function createEnemyState(
  kind: EnemyKind,
  overrides: Partial<ActorState> = {},
): GameState["enemies"][string] {
  return {
    id: "enemy-1",
    kind,
    position: { x: 0, y: 1.4 },
    facingRadians: Math.PI,
    health: 36,
    maxHealth: 36,
    stamina: 100,
    maxStamina: 100,
    action: "idle",
    actionTime: 0,
    intent: "observe",
    cooldown: 0,
    ...overrides,
  };
}

export function runTicks(
  initial: GameState,
  intents: ReadonlyMap<number, Partial<GameIntent>>,
  count: number,
) {
  let state = initial;
  const events: GameEvent[] = [];
  for (let tick = 0; tick < count; tick += 1) {
    const result = stepGame(state, { ...neutralIntent, ...intents.get(tick) }, 1 / 60, arenaContent);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}
```

- [ ] **Step 4: Implement pure fixed-step movement and state transitions**

Use `1 / 60` as the only accepted simulation delta. Reject other values in development tests. Player walk speed is `4.2` world units/second; dodge speed is `9`, duration `0.24` seconds, stamina cost `24`, and invulnerability window `0.08–0.20` seconds. Clamp the player to the authored arena bounds.

`stepGame` clones only changed branches, increments one tick, returns `{state, events}`, and contains no DOM, Three.js, audio, random global, or wall-clock access.

- [ ] **Step 5: Verify and commit the simulation foundation**

```powershell
npm test --workspace @showcase/ashfall-arena -- simulation
git add mengto-skills-showcase/apps/ashfall-arena/src/simulation mengto-skills-showcase/apps/ashfall-arena/src/content mengto-skills-showcase/apps/ashfall-arena/tests/simulation.test.ts
git commit -m "feat: add deterministic Ashfall simulation"
```

### Task 2: Author the arena, player avatar, camera, and input adapters

**Files:**
- Create: `apps/ashfall-arena/index.html`
- Create: `apps/ashfall-arena/package.json`
- Create: `apps/ashfall-arena/vite.config.ts`
- Create: `apps/ashfall-arena/playwright.config.ts`
- Create: `apps/ashfall-arena/src/main.ts`
- Create: `apps/ashfall-arena/src/styles.css`
- Create: `apps/ashfall-arena/src/scene/create-arena-scene.ts`
- Create: `apps/ashfall-arena/src/scene/create-game-camera.ts`
- Create: `apps/ashfall-arena/src/scene/sync-entities.ts`
- Create: `apps/ashfall-arena/src/input/create-input-adapter.ts`
- Create: `packages/game-assets/src/player/create-vesper-knight.ts`
- Create: `packages/game-assets/tests/player-avatar.test.ts`
- Create: `apps/ashfall-arena/tests/browser/fresh-start.spec.ts`

**Interfaces:**
- Consumes: `GameState`, shared monster factories, and normalized input.
- Produces: `createArenaScene(canvas)`, `createGameCamera(camera, target)`, `syncEntities(state)`, and `createInputAdapter(element)`.

- [ ] **Step 1: Write failing avatar and fresh-start tests**

```ts
import { expect, it } from "vitest";
import { createVesperKnight } from "../src/player/create-vesper-knight";

it("provides named weapon sockets and disposable geometry", () => {
  const knight = createVesperKnight();
  expect([...knight.sockets.keys()]).toEqual(expect.arrayContaining(["right-hand", "left-hand", "back"]));
  expect(knight.root.userData.provenance.type).toBe("procedural");
  knight.dispose();
  expect(knight.isDisposed()).toBe(true);
});
```

```ts
test("fresh start exposes the training objective and all input modes", async ({ page }) => {
  await page.goto("/?fixture=fresh");
  await expect(page.getByRole("heading", { name: "Ashfall Arena" })).toBeVisible();
  await expect(page.getByText("Enter the first amber practice ring")).toBeVisible();
  await expect(page.getByText("105 / 105")).toBeVisible();
  await expect(page.locator("[data-game-canvas]")).toHaveCount(1);
});
```

- [ ] **Step 2: Run tests and confirm the scene is absent**

```powershell
npm test --workspace @showcase/game-assets -- player-avatar
npm run test:browser --workspace @showcase/ashfall-arena -- fresh-start
```

Expected: FAIL for missing avatar and application.

- [ ] **Step 3: Author the compact arena**

Add the direct renderer dependency:

```powershell
npm install three --workspace @showcase/ashfall-arena
```

The app manifest defines:

```json
{
  "name": "@showcase/ashfall-arena",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 4174",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:browser": "playwright test"
  }
}
```

`playwright.config.ts` starts this exact dev command, uses `http://127.0.0.1:4174`, and fails on browser console errors collected by each test fixture.

Create a 36×24 unit arena with:

- player spawn at `(0, -9)`;
- amber training ring centered `(0, -5)` radius `2`;
- wave-one yard centered `(0, 0)` radius `6`;
- elite threshold centered `(0, 6)` radius `4`;
- boss court centered `(0, 10)` radius `6`;
- solid perimeter and authored interior blockers separate from visual meshes;
- a gate between elite threshold and boss court controlled by encounter state.

Use flat collision primitives and low-poly project-authored visual geometry. Lighting must communicate route and enemy readability rather than serve as collision.

- [ ] **Step 4: Implement player, follow camera, and device adapters**

The camera uses a three-quarter follow view, soft target offset, lock-on framing, bounded shake, obstacle-aware minimum distance, and reduced-motion mode that disables shake and shortens easing.

Input mapping:

| Intent | Keyboard/mouse | Touch | Standard gamepad |
| --- | --- | --- | --- |
| Move | WASD | left virtual stick | left stick |
| Attack | left click | A button | south face button |
| Guard | right click | Y button | left trigger |
| Dodge | Space | B button | east face button |
| Lock | Q | lock button | right stick press |
| Switch weapon | 1/2 | weapon button | d-pad left/right |
| Heal | E | flask button | north face button |
| Pause | Escape | pause button | menu button |

- [ ] **Step 5: Run fresh-start verification and commit**

```powershell
npm test --workspace @showcase/game-assets -- player-avatar
npm run test:browser --workspace @showcase/ashfall-arena -- fresh-start
npm run build --workspace @showcase/ashfall-arena
git add mengto-skills-showcase/apps/ashfall-arena mengto-skills-showcase/packages/game-assets
git commit -m "feat: build Ashfall arena foundation"
```

### Task 3: Implement authoritative combat and weapon behavior

**Files:**
- Create: `apps/ashfall-arena/src/simulation/combat.ts`
- Create: `apps/ashfall-arena/tests/combat.test.ts`
- Modify: `apps/ashfall-arena/src/simulation/step-game.ts`
- Modify: `apps/ashfall-arena/src/simulation/types.ts`

**Interfaces:**
- Produces: `stepCombat(state, intent, events, content): {state: GameState; events: GameEvent[]}`.
- Produces: authoritative `contact`, `damage`, and `defeated` events.

- [ ] **Step 1: Write failing attack, guard, and dodge tests**

```ts
it("applies oathblade damage once during its active window", () => {
  const state = createInitialState(1);
  state.enemies["enemy-1"] = createEnemyState("glass-crawler");
  const result = runTicks(state, new Map([[0, { attackPressed: true }]]), 60);
  expect(result.events.filter((event) => event.type === "damage")).toEqual([
    { type: "damage", targetId: "enemy-1", amount: 18, guarded: false },
  ]);
});

it("guard reduces frontal damage and consumes stamina", () => {
  const player = createInitialState(1).player;
  const result = resolveIncomingDamage(player, { damage: 20, angleDegrees: 20 }, true);
  expect(result).toMatchObject({ health: 98, stamina: 91, guarded: true });
});

it("dodge invulnerability rejects contact only inside the authored window", () => {
  expect(isContactAccepted({ action: "dodge", actionTime: 0.12 })).toBe(false);
  expect(isContactAccepted({ action: "dodge", actionTime: 0.22 })).toBe(true);
});
```

- [ ] **Step 2: Run combat tests and verify they fail**

```powershell
npm test --workspace @showcase/ashfall-arena -- combat
```

Expected: FAIL because combat resolution is absent.

- [ ] **Step 3: Implement centralized combat timing**

Use these values:

| Action | Startup | Active | Recovery | Damage | Stamina |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oathblade light 1 | 0.16 | 0.12 | 0.28 | 18 | 12 |
| Oathblade light 2 | 0.18 | 0.14 | 0.34 | 24 | 16 |
| Ember bow shot | 0.28 | contact event | 0.42 | 15 | 10 |
| Guard | 0 | held | 0.12 release | 35% received | 9 per hit |
| Dodge | 0.04 | 0.16 invulnerable | 0.04 | 0 | 24 |

Attack instances carry unique IDs and a hit set so one active attack cannot damage the same target twice. Contact uses simulation range, facing cone, authored projectile travel, and collision layers; renderer bounds are never queried.

Export `resolveIncomingDamage(player, hit, guardHeld)` and `isContactAccepted({action, actionTime})` for direct deterministic verification. The former returns `{health, stamina, guarded}` without mutating the input actor.

- [ ] **Step 4: Verify combat and commit**

```powershell
npm test --workspace @showcase/ashfall-arena -- combat simulation
git add mengto-skills-showcase/apps/ashfall-arena/src/simulation mengto-skills-showcase/apps/ashfall-arena/tests/combat.test.ts
git commit -m "feat: add authoritative Ashfall combat"
```

### Task 4: Add enemy AI and the complete encounter arc

**Files:**
- Create: `apps/ashfall-arena/src/simulation/enemy-ai.ts`
- Create: `apps/ashfall-arena/src/simulation/encounters.ts`
- Create: `apps/ashfall-arena/tests/enemy-ai.test.ts`
- Create: `apps/ashfall-arena/tests/encounters.test.ts`
- Modify: `apps/ashfall-arena/src/simulation/step-game.ts`
- Create: `apps/ashfall-arena/tests/browser/combat-journey.spec.ts`

**Interfaces:**
- Produces: `chooseEnemyIntent(enemy, context): "observe" | "approach" | "orbit" | "telegraph" | "attack" | "recover" | "retreat" | "stagger" | "dead"`.
- Produces: `stepEncounter(state, events): {state: GameState; events: GameEvent[]}`.
- Consumes: shared procedural monster factories for rendering only.

- [ ] **Step 1: Write failing AI fairness tests**

```ts
it("does not attack before perception and telegraph complete", () => {
  const enemy = createEnemyState("glass-crawler", { position: { x: 0, y: 3 } });
  expect(chooseEnemyIntent(enemy, {
    playerDistance: 3,
    visibleSeconds: 0.1,
    meleeSlotOwner: null,
  })).toBe("observe");
  expect(chooseEnemyIntent(enemy, {
    playerDistance: 3,
    visibleSeconds: 0.5,
    meleeSlotOwner: null,
  })).toBe("approach");
});

it("respects role spacing when another melee enemy owns the attack slot", () => {
  const enemy = createEnemyState("ash-warden", { position: { x: 0, y: 2.5 } });
  expect(chooseEnemyIntent(enemy, {
    playerDistance: 2.5,
    visibleSeconds: 1,
    meleeSlotOwner: "enemy-1",
  })).toBe("orbit");
});
```

```ts
it("opens the boss gate only after the elite is defeated", () => {
  const state = createInitialState(1);
  state.encounter = { phase: "elite", gateOpen: false };
  state.enemies["elite-1"] = {
    ...createEnemyState("bell-elite"),
    id: "elite-1",
    health: 0,
  };
  const result = stepEncounter(state, [{ type: "defeated", actorId: "elite-1" }]);
  expect(result.state.encounter).toMatchObject({ phase: "boss", gateOpen: true });
});
```

- [ ] **Step 2: Run tests and confirm AI and encounter modules are absent**

```powershell
npm test --workspace @showcase/ashfall-arena -- enemy-ai encounters
```

Expected: FAIL.

- [ ] **Step 3: Implement bounded enemy decision states**

Enemy intents are `observe`, `approach`, `orbit`, `telegraph`, `attack`, `recover`, `retreat`, `stagger`, and `dead`. Decisions run every six simulation ticks and use only current serialized context.

Roles:

- Glass Crawler: quick approach, short lunge, low health.
- Ash Warden: keeps 4–6 units, fires a readable projectile.
- Bell Elite: slow armored sweep, guard-break pressure.
- Bell Sovereign: alternates sweep, bell shockwave, and summon at health thresholds 65% and 30%.

Every attack has at least `0.35` seconds visible telegraph. At most one melee enemy owns the close attack slot and one ranged enemy may fire during the same 0.5-second window.

- [ ] **Step 4: Implement encounter phases**

Encounter sequence:

1. Training ring teaches attack and guard without lethal damage.
2. Wave one spawns two Crawlers and one Warden.
3. Elite threshold spawns one Bell Elite plus one Crawler.
4. Boss gate opens after elite defeat.
5. Bell Sovereign boss completes the run and emits `encounter-complete`.

All spawns use fixed IDs and positions from `arena-content.ts`. Query fixtures can start at `fresh`, `wave-one`, `elite`, `boss`, or `complete`.

- [ ] **Step 5: Verify AI, encounter, and browser combat**

```powershell
npm test --workspace @showcase/ashfall-arena -- enemy-ai encounters combat
npm run test:browser --workspace @showcase/ashfall-arena -- combat-journey
git add mengto-skills-showcase/apps/ashfall-arena/src/simulation mengto-skills-showcase/apps/ashfall-arena/tests
git commit -m "feat: add Ashfall enemies and encounters"
```

### Task 5: Add drops, one upgrade choice, inventory, save, and retry

**Files:**
- Create: `apps/ashfall-arena/src/simulation/inventory.ts`
- Create: `apps/ashfall-arena/src/persistence/save-game.ts`
- Create: `apps/ashfall-arena/tests/inventory.test.ts`
- Create: `apps/ashfall-arena/tests/save-game.test.ts`
- Create: `apps/ashfall-arena/tests/browser/save-retry.spec.ts`
- Modify: `apps/ashfall-arena/src/simulation/step-game.ts`

**Interfaces:**
- Produces: `collectDrop`, `applyUpgrade`, `useHealingCharge`, `serializeSave`, `parseSave`, `writeSave`, and `readSave`.
- Uses save key `ashfall-arena:v1`.

- [ ] **Step 1: Write failing atomicity and migration tests**

```ts
it("collects a drop exactly once", () => {
  const state = createInitialState(1);
  state.drops.push({
    id: "souls-1",
    position: { x: 0, y: 0 },
    kind: "souls",
    amount: 20,
  });
  const first = collectDrop(state, "souls-1");
  const second = collectDrop(first, "souls-1");
  expect(first.player.souls).toBe(20);
  expect(second.player.souls).toBe(20);
});

it("applies exactly one upgrade", () => {
  const state = createInitialState(1);
  state.status = "upgrade";
  expect(applyUpgrade(state, "vitality").player.maxHealth).toBe(125);
  expect(() => applyUpgrade(applyUpgrade(state, "vitality"), "power")).toThrow("upgrade already chosen");
});

it("healing consumes one charge and never exceeds maximum health", () => {
  const state = createInitialState(1);
  state.player.health = 80;
  const healed = useHealingCharge(state);
  expect(healed.player).toMatchObject({ health: 105, healingCharges: 2 });
});

it("rejects an unsupported save without mutating storage", () => {
  expect(parseSave('{"version":99}')).toEqual({ ok: false, reason: "unsupported-version" });
});
```

- [ ] **Step 2: Run tests and confirm inventory and persistence are absent**

```powershell
npm test --workspace @showcase/ashfall-arena -- inventory save-game
```

Expected: FAIL.

- [ ] **Step 3: Implement atomic progression**

Regular enemy drops:

- Glass Crawler: 10 souls.
- Ash Warden: 15 souls.
- Bell Elite: 35 souls and one healing charge up to three.
- Bell Sovereign: completion only.

After wave one, pause simulation and offer:

- Vitality: maximum health `105 → 125`, restore 20 health.
- Power: Oathblade and bow damage multiplier `1 → 1.2`.

Apply one choice, record it in state, and resume at the elite phase.

`useHealingCharge` restores 35 health up to maximum, consumes exactly one charge, and is rejected while attacking, dodging, hit, dead, defeated, complete, or already at full health.

- [ ] **Step 4: Implement versioned local save and retry**

Save only after an encounter phase transition or upgrade choice. Persist version, seed, player progression, encounter phase, and completion flag. Do not persist active attack timers or renderer state.

On defeat, Retry restores the latest saved phase with full health and stamina but preserves the chosen upgrade. New Run clears only the exact `ashfall-arena:v1` key after explicit confirmation.

- [ ] **Step 5: Verify and commit progression**

```powershell
npm test --workspace @showcase/ashfall-arena -- inventory save-game simulation
npm run test:browser --workspace @showcase/ashfall-arena -- save-retry
git add mengto-skills-showcase/apps/ashfall-arena/src/simulation/inventory.ts mengto-skills-showcase/apps/ashfall-arena/src/persistence mengto-skills-showcase/apps/ashfall-arena/tests
git commit -m "feat: add Ashfall progression and saves"
```

### Task 6: Add HUD, VFX, audio, touch, and gamepad feedback

**Files:**
- Create: `apps/ashfall-arena/src/feedback/create-vfx.ts`
- Create: `apps/ashfall-arena/src/feedback/create-audio.ts`
- Create: `apps/ashfall-arena/src/ui/render-hud.ts`
- Create: `apps/ashfall-arena/src/review/create-review-api.ts`
- Create: `apps/ashfall-arena/tests/browser/mobile-controls.spec.ts`
- Create: `apps/ashfall-arena/tests/browser/reduced-motion.spec.ts`
- Modify: `apps/ashfall-arena/src/main.ts`
- Modify: `apps/ashfall-arena/src/styles.css`

**Interfaces:**
- Consumes: `GameEvent[]` and current `GameState`.
- Produces: pooled visual effects, prioritized audio cues, responsive HUD, and normalized touch/gamepad intent.

- [ ] **Step 1: Write failing mobile and reduced-motion journeys**

```ts
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test("touch controls expose the complete combat vocabulary", async ({ page }) => {
  await page.goto("/?fixture=wave-one");
  await expect(page.getByLabel("Movement stick")).toBeVisible();
  for (const name of ["Attack", "Guard", "Dodge", "Target lock", "Switch weapon"]) {
    await expect(page.getByRole("button", { name })).toBeVisible();
  }
});

test("reduced motion removes shake without hiding damage feedback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?fixture=boss&reviewControls=1");
  await page.evaluate(() => window.__review.triggerPlayerHit());
  await expect(page.locator("[data-damage-flash]")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-camera-shake", "off");
});
```

- [ ] **Step 2: Run journeys and confirm feedback surfaces are absent**

```powershell
npm run test:browser --workspace @showcase/ashfall-arena -- mobile-controls reduced-motion
```

Expected: FAIL.

- [ ] **Step 3: Implement bounded feedback**

VFX pools:

- 12 hit sparks;
- 8 guard arcs;
- 6 dodge trails;
- 12 projectile traces;
- 4 boss shockwave rings.

Audio priorities:

1. player damage and guard-break;
2. enemy telegraph and boss phase;
3. player attack and dodge;
4. ambient and UI.

Initialize Web Audio only after user input. Provide separate master, effects, and ambience controls. Every required audio cue has a visible or haptic-equivalent UI cue; audio is never the only telegraph.

- [ ] **Step 4: Implement responsive HUD and device switching**

HUD includes health, stamina, weapon, healing charges, objective, target health, upgrade modal, pause, defeat, and completion states. Touch UI respects safe areas. Device prompts switch after the last meaningful keyboard, pointer, touch, or gamepad input without changing simulation state.

When and only when `reviewControls=1` is present, `create-review-api.ts` exposes:

```ts
declare global {
  interface Window {
    __review: {
      triggerPlayerHit(): void;
      setPlayerHealth(value: number): void;
      defeatEnemy(id: string): void;
      getSerializableState(): GameState;
    };
  }
}
```

Every method dispatches through the real simulation event path. Without the query flag, `window.__review` remains undefined.

- [ ] **Step 5: Verify and commit feedback**

```powershell
npm run test:browser --workspace @showcase/ashfall-arena -- mobile-controls reduced-motion
npm run build --workspace @showcase/ashfall-arena
git add mengto-skills-showcase/apps/ashfall-arena/src/feedback mengto-skills-showcase/apps/ashfall-arena/src/ui mengto-skills-showcase/apps/ashfall-arena/src/main.ts mengto-skills-showcase/apps/ashfall-arena/src/styles.css mengto-skills-showcase/apps/ashfall-arena/tests/browser
git commit -m "feat: add Ashfall combat feedback"
```

### Task 7: Prove the complete run, performance, and release readiness

**Files:**
- Create: `apps/ashfall-arena/tests/browser/complete-run.spec.ts`
- Create: `apps/ashfall-arena/docs/VALIDATION.md`
- Modify: `mengto-skills-showcase/README.md`

**Interfaces:**
- Consumes: completed game and deterministic review fixtures.
- Produces: one verified first-run journey and performance/release evidence.

- [ ] **Step 1: Write the complete deterministic browser journey**

The test starts with `?fixture=fresh&seed=7481&reviewControls=1` and uses review-safe input helpers to:

1. enter the training ring;
2. perform attack, guard, dodge, and lock;
3. defeat wave one;
4. choose Vitality;
5. defeat the elite;
6. verify the boss gate opens;
7. defeat the Bell Sovereign;
8. verify completion and saved continuation;
9. reload and verify the completion record.

The fixture may accelerate enemy health but must use the real combat, encounter, reward, and save paths.

- [ ] **Step 2: Run complete verification**

```powershell
npm test --workspace @showcase/ashfall-arena
npm run test:browser --workspace @showcase/ashfall-arena
npm run build --workspace @showcase/ashfall-arena
git diff --check
```

Expected: all commands PASS with no console errors or unhandled promise rejections.

- [ ] **Step 3: Record performance and playthrough evidence**

`docs/VALIDATION.md` records:

- exact tested commit;
- fresh, save, defeat/retry, upgrade, boss, and completion journeys;
- desktop and 390×844 touch evidence;
- keyboard, mouse, gamepad, and reduced-motion results;
- median first-time manual completion time from at least three runs;
- representative wave-one and boss frame-time, draw-call, geometry, texture, and memory observations;
- quality-tier behavior;
- production bundle size;
- approved non-goals and remaining limitations.

- [ ] **Step 4: Update README and commit the validated game**

```powershell
git add mengto-skills-showcase/apps/ashfall-arena/docs/VALIDATION.md mengto-skills-showcase/apps/ashfall-arena/tests/browser/complete-run.spec.ts mengto-skills-showcase/README.md
git commit -m "docs: validate Ashfall Arena"
```

## Ashfall Arena Completion Gate

- One fresh run reaches completion through the real game systems.
- Deterministic unit fixtures prove combat, AI, encounters, drops, upgrades, saves, and retry.
- Two regular enemy types, one elite, and one boss have readable counterplay.
- Keyboard/mouse, touch, and standard gamepad controls expose the full combat vocabulary.
- Reduced motion keeps all gameplay information readable.
- A first-time player can finish in 8–12 minutes.
- Production build, browser journeys, performance evidence, and release documentation are complete.
