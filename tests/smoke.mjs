import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 4174;
const vite = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});

async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return;
    } catch {
      // The Vite process needs another turn to listen.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error('Vite test server did not start');
}

try {
  await waitForServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

  const title = await page.title();
  if (title !== '雾村：逃离') throw new Error(`Expected title 雾村：逃离, got ${title || '(empty)'}`);

  const gameHandle = await page.evaluate(() => Boolean(window.__RURAL_ESCAPE__));
  if (!gameHandle) throw new Error('Expected window.__RURAL_ESCAPE__ to be available');

  const visualHooks = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    const beforeObjective = document.querySelector('#objective').textContent;
    const hasStorySetter = typeof game.setStoryStateForTest === 'function';
    if (hasStorySetter) {
      game.setStoryStateForTest(
        { radio: true, neighbour: true, flashlight: false },
        'reach_granary',
      );
    }
    return {
      hasStorySetter,
      pixelRatio: game.rendererPixelRatio,
      objectiveRect: document.querySelector('.mission-hud').getBoundingClientRect().toJSON(),
      storyObjective: game.story.objective,
      storyFlags: { ...game.story.flags },
      beforeObjective,
      afterObjective: document.querySelector('#objective').textContent,
    };
  });
  if (!visualHooks.hasStorySetter) throw new Error('Expected deterministic story-state hook');
  if (visualHooks.pixelRatio > 1.5) {
    throw new Error(`Pixel ratio exceeds cap: ${visualHooks.pixelRatio}`);
  }
  if (visualHooks.objectiveRect.right > 640) {
    throw new Error('Mission HUD is too wide at 1280px');
  }
  if (visualHooks.storyObjective !== 'reach_granary') {
    throw new Error(`Expected deterministic story objective, got ${visualHooks.storyObjective}`);
  }
  if (!visualHooks.storyFlags.radio || !visualHooks.storyFlags.neighbour) {
    throw new Error('Expected deterministic story flags to be applied');
  }
  if (!visualHooks.afterObjective || visualHooks.afterObjective === visualHooks.beforeObjective) {
    throw new Error('Expected deterministic story state to render the mission HUD');
  }
  const completeVisualState = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setStoryStateForTest(
      { radio: true, neighbour: true, flashlight: true },
      'complete',
    );
    return {
      objective: game.story.objective,
      objectiveText: document.querySelector('#objective').textContent,
    };
  });
  if (completeVisualState.objective !== 'complete') {
    throw new Error(`Expected deterministic complete state, got ${completeVisualState.objective}`);
  }
  if (
    !completeVisualState.objectiveText
    || completeVisualState.objectiveText === visualHooks.afterObjective
  ) {
    throw new Error('Expected deterministic complete state to render the completed objective');
  }
  await page.evaluate(() => window.__RURAL_ESCAPE__.setStoryStateForTest(
    { radio: false, neighbour: false, flashlight: false },
    'leave_home',
  ));

  const traversal = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    const routeSegments = [
      {
        id: 'courtyard',
        waypoints: [[0, 33], [0, 17], [6.8, 17]],
        zone: { center: [8, 17], radius: 5 },
      },
      {
        id: 'granary',
        waypoints: [[6.8, 8], [0, 8], [0, -10], [8.8, -10]],
        zone: { center: [11, -10], radius: 6 },
      },
      {
        id: 'south_gate',
        waypoints: [[6, -16], [6, -25], [4, -29], [4, -35], [0, -35]],
        zone: { center: [0, -35], radius: 4.5 },
      },
    ];
    const start = game.player.position.toArray();
    const endpoints = [];
    let maxRequestedStep = 0;

    for (const segment of routeSegments) {
      for (const [targetX, targetZ] of segment.waypoints) {
        for (let attempt = 0; attempt < 1000; attempt += 1) {
          const deltaX = targetX - game.player.position.x;
          const deltaZ = targetZ - game.player.position.z;
          const distance = Math.hypot(deltaX, deltaZ);
          if (distance <= 0.001) break;

          const requestedStep = Math.min(0.25, distance);
          maxRequestedStep = Math.max(maxRequestedStep, requestedStep);
          const beforeX = game.player.position.x;
          const beforeZ = game.player.position.z;
          game.moveForTest(
            (deltaX / distance) * requestedStep,
            (deltaZ / distance) * requestedStep,
          );
          const actualStep = Math.hypot(
            game.player.position.x - beforeX,
            game.player.position.z - beforeZ,
          );
          if (actualStep <= 0.000001) {
            throw new Error(
              `Continuous route stuck before ${segment.id} at `
              + `${game.player.position.x.toFixed(3)},${game.player.position.z.toFixed(3)}`,
            );
          }
        }
      }

      const endpoint = [game.player.position.x, game.player.position.z];
      endpoints.push({
        id: segment.id,
        endpoint,
        targetDistance: Math.hypot(
          endpoint[0] - segment.waypoints.at(-1)[0],
          endpoint[1] - segment.waypoints.at(-1)[1],
        ),
        zoneDistance: Math.hypot(
          endpoint[0] - segment.zone.center[0],
          endpoint[1] - segment.zone.center[1],
        ),
        zoneRadius: segment.zone.radius,
      });
    }

    return { start, endpoints, maxRequestedStep };
  });
  if (Math.hypot(traversal.start[0] + 8, traversal.start[2] - 33) > 0.001) {
    throw new Error(`Expected continuous route to start at canonical player_home, got ${traversal.start}`);
  }
  if (traversal.maxRequestedStep > 0.250001) {
    throw new Error(`Continuous route step exceeded 0.25: ${traversal.maxRequestedStep}`);
  }
  for (const endpoint of traversal.endpoints) {
    if (endpoint.targetDistance > 0.001) {
      throw new Error(
        `Expected continuous route to arrive at ${endpoint.id} endpoint; `
        + `distance ${endpoint.targetDistance}`,
      );
    }
    if (endpoint.zoneDistance > endpoint.zoneRadius) {
      throw new Error(
        `Expected continuous route to reach ${endpoint.id}; `
        + `distance ${endpoint.zoneDistance} exceeds ${endpoint.zoneRadius}`,
      );
    }
  }

  const wallMove = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(-6.3, 28);
    const before = game.player.position.toArray();
    game.moveForTest(-0.2, 0);
    return { before, after: game.player.position.toArray() };
  });
  if (Math.abs(wallMove.after[0] - wallMove.before[0]) > 0.001) {
    throw new Error('Expected protagonist home wall to block player movement');
  }

  await page.evaluate(() => window.__RURAL_ESCAPE__.setCameraMode('first-person'));
  const cameraMode = await page.evaluate(() => window.__RURAL_ESCAPE__.camera.mode);
  if (cameraMode !== 'first-person') throw new Error(`Expected first-person camera, got ${cameraMode}`);

  const canvasHeight = await page.locator('#game').evaluate((canvas) => getComputedStyle(canvas).height);
  if (canvasHeight !== '720px') throw new Error(`Expected full viewport game canvas, got ${canvasHeight}`);

  await page.evaluate(() => window.__RURAL_ESCAPE__.completeIntroForTest());
  const hudState = await page.evaluate(() => ({
    shellPhase: document.querySelector('.game-shell').dataset.uiPhase,
    titleHidden: document.querySelector('.title-lockup').getAttribute('aria-hidden'),
    interactionHidden: document.querySelector('#interaction').hidden,
  }));
  if (hudState.shellPhase !== 'playing') throw new Error(`Expected playing HUD, got ${hudState.shellPhase}`);
  if (hudState.titleHidden !== 'true') throw new Error('Expected chapter title to leave the main view');
  if (!hudState.interactionHidden) throw new Error('Expected interaction prompt to start hidden');

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(10.4, 24.4));
  const farPromptHidden = await page.evaluate(() => document.querySelector('#interaction').hidden);
  if (!farPromptHidden) throw new Error('Expected wrong-objective interaction prompt to stay hidden');

  await page.keyboard.press('KeyE');
  const objectiveAfterFarKey = await page.evaluate(() => window.__RURAL_ESCAPE__.story.objective);
  if (objectiveAfterFarKey !== 'leave_home') {
    throw new Error(`Expected distant KeyE to leave objective unchanged, got ${objectiveAfterFarKey}`);
  }

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-8.99, 32.8));
  const outsideRadiusHidden = await page.evaluate(() => document.querySelector('#interaction').hidden);
  if (!outsideRadiusHidden) throw new Error('Expected interaction prompt beyond radius 2.2 to stay hidden');

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-9, 32.8));
  const nearPromptVisible = await page.evaluate(() => !document.querySelector('#interaction').hidden);
  if (!nearPromptVisible) throw new Error('Expected interaction prompt at radius 2.2 from the radio');

  await page.keyboard.press('KeyE');
  const objectiveAfterRadio = await page.evaluate(() => window.__RURAL_ESCAPE__.story.objective);
  if (objectiveAfterRadio !== 'visit_courtyard') {
    throw new Error(`Expected radio to advance objective to visit_courtyard, got ${objectiveAfterRadio}`);
  }

  const pursuerState = await page.evaluate(() => {
    window.__RURAL_ESCAPE__.setPlayerForTest(0, 2);
    window.__RURAL_ESCAPE__.updatePursuerForTest(0.016);
    return window.__RURAL_ESCAPE__.pursuer.state;
  });
  if (pursuerState !== 'chase') throw new Error(`Expected pursuer chase state, got ${pursuerState}`);

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-11.2, 32.8));
  const oldObjectivePromptHidden = await page.evaluate(() => document.querySelector('#interaction').hidden);
  if (!oldObjectivePromptHidden) throw new Error('Expected completed radio prompt to stay hidden');

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(10.4, 24.4));
  const neighbourPromptVisible = await page.evaluate(() => !document.querySelector('#interaction').hidden);
  if (!neighbourPromptVisible) throw new Error('Expected neighbour interaction prompt');
  await page.keyboard.press('KeyE');
  const objectiveAfterNeighbour = await page.evaluate(() => window.__RURAL_ESCAPE__.story.objective);
  if (objectiveAfterNeighbour !== 'reach_granary') {
    throw new Error(`Expected neighbour to advance objective to reach_granary, got ${objectiveAfterNeighbour}`);
  }

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(13.2, -4.6));
  const flashlightPromptVisible = await page.evaluate(() => !document.querySelector('#interaction').hidden);
  if (!flashlightPromptVisible) throw new Error('Expected flashlight interaction prompt');
  await page.keyboard.press('KeyE');

  const flashlightSubtitle = await page.evaluate(() => {
    return document.querySelector('#subtitle').textContent;
  });
  const expectedFlashlightSubtitle = '手电亮起的一刻，主路尽头传来了一声不像人类的喘息。';
  if (flashlightSubtitle !== expectedFlashlightSubtitle) {
    throw new Error(`Expected flashlight reveal subtitle, got ${flashlightSubtitle}`);
  }

  const flashlightPromptHidden = await page.evaluate(
    () => document.querySelector('#interaction').hidden,
  );
  if (!flashlightPromptHidden) throw new Error('Expected flashlight prompt to hide after pickup');

  await page.keyboard.press('KeyE');
  const subtitleAfterSecondKey = await page.evaluate(
    () => document.querySelector('#subtitle').textContent,
  );
  if (subtitleAfterSecondKey !== flashlightSubtitle) {
    throw new Error('Expected repeated KeyE to preserve the flashlight reveal subtitle');
  }

  const escapeState = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(0, -34);
    game.updateStoryForTest();
    return game.story.objective;
  });
  if (escapeState !== 'complete') throw new Error(`Expected village exit to complete chapter, got ${escapeState}`);

  await browser.close();
  console.log('Smoke test passed: visual hooks, viewport safety, traversal, story, and camera.');
} finally {
  server.kill();
}
