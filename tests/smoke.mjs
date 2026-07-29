import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function reservePort(requestedPort) {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', rejectPort);
    probe.listen(requestedPort, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolvePort(address.port));
    });
  });
}

async function selectTestPort() {
  try {
    return await reservePort(4174);
  } catch {
    return reservePort(0);
  }
}

const port = await selectTestPort();
const vite = resolve(root, 'node_modules', 'vite', 'bin', 'vite.js');
const server = spawn(process.execPath, [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
let browser;
let testError;
let cleanupError;

function waitForChildExit(child, timeoutMs = 3000) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise((resolveExit) => {
    function onExit() {
      clearTimeout(timeout);
      resolveExit(true);
    }
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolveExit(false);
    }, timeoutMs);
    child.once('exit', onExit);
  });
}

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
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  const pageErrors = [];
  const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

  const title = await page.title();
  if (title !== '雾村：逃离') throw new Error(`Expected title 雾村：逃离, got ${title || '(empty)'}`);

  const gameHandle = await page.evaluate(() => Boolean(window.__RURAL_ESCAPE__));
  if (!gameHandle) throw new Error('Expected window.__RURAL_ESCAPE__ to be available');

  const guidanceHud = await page.evaluate(() => ({
    missionStep: document.querySelector('#mission-step')?.textContent,
    missionTitle: document.querySelector('#mission-title')?.textContent,
    missionClue: document.querySelector('#mission-clue')?.textContent,
    compassHidden: document.querySelector('#objective-compass')?.hidden,
    markerHidden: document.querySelector('#screen-marker')?.hidden,
    tutorialText: document.querySelector('#tutorial-hint')?.textContent,
    mutePressed: document.querySelector('#mute-toggle')?.getAttribute('aria-pressed'),
  }));
  if (guidanceHud.missionStep !== '任务 1/4') throw new Error('Expected mission step 1/4');
  if (guidanceHud.missionTitle !== '调查收音机') throw new Error('Expected radio mission title');
  if (!guidanceHud.missionClue) throw new Error('Expected mission clue');
  if (guidanceHud.compassHidden !== false) throw new Error('Expected objective compass');
  if (guidanceHud.tutorialText !== 'WASD 移动') throw new Error('Expected first tutorial hint');
  if (guidanceHud.mutePressed !== 'false') throw new Error('Expected sound enabled state');

  const normalEvidenceDataset = await page.evaluate(() => {
    const { evidenceState, renderCalls, renderTriangles } = document.querySelector('.game-shell').dataset;
    return { evidenceState, renderCalls, renderTriangles };
  });
  if (
    normalEvidenceDataset.evidenceState !== undefined
    || normalEvidenceDataset.renderCalls !== undefined
    || normalEvidenceDataset.renderTriangles !== undefined
  ) {
    throw new Error('Expected normal URL to omit browser evidence datasets');
  }

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

  const keyboardStart = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(0, 17);
    return {
      position: [game.player.position.x, game.player.position.z],
      yaw: game.camera.yaw,
    };
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(160);
  await page.keyboard.up('KeyW');
  const keyboardEnd = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    return [game.player.position.x, game.player.position.z];
  });
  const keyboardForwardDot = (keyboardEnd[0] - keyboardStart.position[0])
    * Math.sin(keyboardStart.yaw)
    + (keyboardEnd[1] - keyboardStart.position[1]) * Math.cos(keyboardStart.yaw);
  if (keyboardForwardDot <= 0.05) {
    throw new Error(
      `Expected real KeyW movement along camera forward, got dot ${keyboardForwardDot}`,
    );
  }
  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-8, 33));

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

  await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(-8, 33);
    game.setCameraMode('third-person');
  });
  await page.keyboard.press('KeyC');
  const firstPersonCamera = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    return {
      mode: game.camera.mode,
      pose: game.camera.getPoseSnapshot?.(),
      player: game.player.position.toArray(),
    };
  });
  if (firstPersonCamera.mode !== 'first-person') {
    throw new Error(`Expected first-person camera, got ${firstPersonCamera.mode}`);
  }
  if (!firstPersonCamera.pose) throw new Error('Expected a readable live camera pose snapshot');
  if (
    Math.hypot(
      firstPersonCamera.pose.position[0] - firstPersonCamera.player[0],
      firstPersonCamera.pose.position[2] - firstPersonCamera.player[2],
    ) > 0.001
    || Math.abs(firstPersonCamera.pose.position[1] - 1.82) > 0.001
  ) {
    throw new Error(
      `Expected first-person eye at player head, got ${firstPersonCamera.pose.position}`,
    );
  }
  if (
    firstPersonCamera.pose.direction[2] > -0.9
    || firstPersonCamera.pose.direction[1] > -0.1
  ) {
    throw new Error(
      `Expected first-person camera to face forward with pitch, got ${firstPersonCamera.pose.direction}`,
    );
  }

  await page.keyboard.press('KeyC');
  const restoredCamera = await page.evaluate(() => ({
    mode: window.__RURAL_ESCAPE__.camera.mode,
    pose: window.__RURAL_ESCAPE__.camera.getPoseSnapshot?.(),
  }));
  if (restoredCamera.mode !== 'third-person') {
    throw new Error(`Expected second KeyC to restore third-person, got ${restoredCamera.mode}`);
  }
  if (
    !restoredCamera.pose
    || Math.hypot(
      restoredCamera.pose.position[0] + 8,
      restoredCamera.pose.position[2] - 33,
    ) < 5
  ) {
    throw new Error('Expected restored third-person camera to snap behind the player');
  }

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

  const initialGuidance = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(-8, 33);
    game.refreshFeedbackForTest(1 / 60);
    return {
      objectiveId: game.guidance.objectiveId,
      distance: game.guidance.distance,
      proximity: game.guidance.proximity,
      worldMarkerVisible: document.querySelector('#screen-marker').hidden === false,
      missionStep: document.querySelector('#mission-step').textContent,
    };
  });
  if (initialGuidance.objectiveId !== 'leave_home') throw new Error('Expected guided radio objective');
  if (initialGuidance.missionStep !== '任务 1/4') throw new Error('Expected stage 1/4');
  if (!Number.isFinite(initialGuidance.distance)) throw new Error('Expected objective distance');
  if (initialGuidance.proximity !== 'approach') {
    throw new Error(`Expected initial radio approach guidance, got ${initialGuidance.proximity}`);
  }
  if (!initialGuidance.worldMarkerVisible) {
    throw new Error('Expected initial radio marker to remain visible inside its guidance radius');
  }

  const pursuerBeforeDanger = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    const snapshot = {
      position: game.pursuer.object.position.toArray(),
      rotationY: game.pursuer.object.rotation.y,
    };
    game.pursuer.reset();
    game.pursuer.object.position.set(0, 0, 0);
    game.setPlayerForTest(0, 5);
    game.updatePursuerForTest(1 / 60);
    game.refreshFeedbackForTest(1 / 60);
    return snapshot;
  });
  const dangerHud = await page.evaluate(() => ({
    mode: document.querySelector('.game-shell').dataset.danger,
    label: document.querySelector('#danger-state').textContent,
  }));
  if (!['chase', 'threaten'].includes(dangerHud.mode)) throw new Error('Expected visible danger mode');
  if (!dangerHud.label) throw new Error('Expected danger label');
  await page.evaluate(({ position, rotationY }) => {
    const pursuer = window.__RURAL_ESCAPE__.pursuer;
    pursuer.reset();
    pursuer.object.position.fromArray(position);
    pursuer.object.rotation.y = rotationY;
  }, pursuerBeforeDanger);

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(10.4, 24.4));
  const farPromptHidden = await page.evaluate(() => document.querySelector('#interaction').hidden);
  if (!farPromptHidden) throw new Error('Expected wrong-objective interaction prompt to stay hidden');

  await page.keyboard.press('KeyE');
  const objectiveAfterFarKey = await page.evaluate(() => window.__RURAL_ESCAPE__.story.objective);
  if (objectiveAfterFarKey !== 'leave_home') {
    throw new Error(`Expected distant KeyE to leave objective unchanged, got ${objectiveAfterFarKey}`);
  }

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-7, 32.8));
  const approachPrompt = await page.evaluate(() => ({
    approachVisible: !document.querySelector('#approach-prompt').hidden,
    interactionVisible: !document.querySelector('#interaction').hidden,
  }));
  if (!approachPrompt.approachVisible || approachPrompt.interactionVisible) {
    throw new Error('Expected approach-only radio prompt between 2.2m and 5m');
  }

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-9, 32.8));
  const interactPrompt = await page.evaluate(() => ({
    approachVisible: !document.querySelector('#approach-prompt').hidden,
    interactionVisible: !document.querySelector('#interaction').hidden,
  }));
  if (interactPrompt.approachVisible || !interactPrompt.interactionVisible) {
    throw new Error('Expected E interaction prompt within 2.2m');
  }

  await page.keyboard.press('KeyE');
  const radioCompletion = await page.evaluate(() => ({
    objective: window.__RURAL_ESCAPE__.story.objective,
    toastVisible: !document.querySelector('#completion-toast').hidden,
    toastText: document.querySelector('#completion-toast').textContent,
    missionState: document.querySelector('.mission-hud').dataset.state,
    compassHidden: document.querySelector('#objective-compass').hidden,
    markerHidden: document.querySelector('#screen-marker').hidden,
    approachHidden: document.querySelector('#approach-prompt').hidden,
    interactionHidden: document.querySelector('#interaction').hidden,
  }));
  if (radioCompletion.objective !== 'visit_courtyard') {
    throw new Error(`Expected radio to advance objective to visit_courtyard, got ${radioCompletion.objective}`);
  }
  if (!radioCompletion.toastVisible) throw new Error('Expected radio completion toast');
  if (radioCompletion.toastText !== '✓ 调查收音机') {
    throw new Error(`Expected one radio completion message, got ${radioCompletion.toastText}`);
  }
  if (
    radioCompletion.missionState !== 'complete'
    || !radioCompletion.compassHidden
    || !radioCompletion.markerHidden
    || !radioCompletion.approachHidden
    || !radioCompletion.interactionHidden
  ) {
    throw new Error('Expected guidance to stay suppressed during the completion transition');
  }
  await page.waitForFunction(() => document.querySelector('#completion-toast').hidden);

  const pursuerState = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.pursuer.reset();
    game.pursuer.object.position.set(0, 0, 8);
    game.setPlayerForTest(0, 2);
    game.updatePursuerForTest(0.016);
    return game.pursuer.state;
  });
  if (pursuerState !== 'chase') throw new Error(`Expected pursuer chase state, got ${pursuerState}`);

  const pursuerContact = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.pursuer.reset();
    game.pursuer.object.position.set(0, 0, 0);
    game.setPlayerForTest(0, 5);
    let minimumDistance = Infinity;
    for (let frame = 0; frame < 240; frame += 1) {
      game.updatePursuerForTest(1 / 60);
      minimumDistance = Math.min(
        minimumDistance,
        game.pursuer.object.position.distanceTo(game.player.position),
      );
    }
    return {
      state: game.pursuer.state,
      distance: game.pursuer.object.position.distanceTo(game.player.position),
      minimumDistance,
    };
  });
  if (pursuerContact.state !== 'threaten') {
    throw new Error(`Expected close pursuer to threaten, got ${pursuerContact.state}`);
  }
  if (pursuerContact.minimumDistance < 2.2 || pursuerContact.distance < 2.35) {
    throw new Error(
      `Expected readable player-pursuer spacing, got min ${pursuerContact.minimumDistance} `
      + `and final ${pursuerContact.distance}`,
    );
  }

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-11.2, 32.8));
  const oldObjectivePromptHidden = await page.evaluate(() => document.querySelector('#interaction').hidden);
  if (!oldObjectivePromptHidden) throw new Error('Expected completed radio prompt to stay hidden');

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(10.4, 24.4));
  const neighbourPromptVisible = await page.evaluate(() => !document.querySelector('#interaction').hidden);
  if (!neighbourPromptVisible) throw new Error('Expected neighbour interaction prompt');
  await page.keyboard.press('KeyE');
  const neighbourCompletion = await page.evaluate(() => ({
    objective: window.__RURAL_ESCAPE__.story.objective,
    toastVisible: !document.querySelector('#completion-toast').hidden,
  }));
  if (neighbourCompletion.objective !== 'reach_granary') {
    throw new Error(
      `Expected neighbour to advance objective to reach_granary, got ${neighbourCompletion.objective}`,
    );
  }
  if (!neighbourCompletion.toastVisible) throw new Error('Expected neighbour completion toast');
  await page.waitForFunction(() => document.querySelector('#completion-toast').hidden);

  await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(13.2, -4.6));
  const flashlightPromptVisible = await page.evaluate(() => !document.querySelector('#interaction').hidden);
  if (!flashlightPromptVisible) throw new Error('Expected flashlight interaction prompt');
  await page.keyboard.press('KeyE');

  const flashlightState = await page.evaluate(() => ({
    objective: window.__RURAL_ESCAPE__.story.objective,
    objectiveText: document.querySelector('#objective').textContent,
    subtitle: document.querySelector('#subtitle').textContent,
  }));
  if (flashlightState.objective !== 'escape_south_gate') {
    throw new Error(
      `Expected flashlight to advance objective to escape_south_gate, got ${flashlightState.objective}`,
    );
  }
  if (flashlightState.objectiveText !== '沿主路逃往南侧村口。') {
    throw new Error(`Expected south-gate escape HUD, got ${flashlightState.objectiveText}`);
  }
  const expectedFlashlightSubtitle = '手电亮起的一刻，主路尽头传来了一声不像人类的喘息。';
  if (flashlightState.subtitle !== expectedFlashlightSubtitle) {
    throw new Error(`Expected flashlight reveal subtitle, got ${flashlightState.subtitle}`);
  }

  const flashlightPromptHidden = await page.evaluate(
    () => document.querySelector('#interaction').hidden,
  );
  if (!flashlightPromptHidden) throw new Error('Expected flashlight prompt to hide after pickup');

  await page.keyboard.press('KeyE');
  const subtitleAfterSecondKey = await page.evaluate(
    () => document.querySelector('#subtitle').textContent,
  );
  if (subtitleAfterSecondKey !== flashlightState.subtitle) {
    throw new Error('Expected repeated KeyE to preserve the flashlight reveal subtitle');
  }

  const escapeState = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(0, -34);
    game.updateStoryForTest();
    return game.story.objective;
  });
  if (escapeState !== 'complete') throw new Error(`Expected village exit to complete chapter, got ${escapeState}`);

  const evidenceCases = [
    {
      id: 'birth',
      position: [-8, 33],
      objective: 'leave_home',
      flags: { radio: false, neighbour: false, flashlight: false },
      objectiveText: '离开主角家，调查村里的异常。',
      missionStep: '任务 1/4',
      missionTitle: '调查收音机',
      compassVisible: true,
      dangerMode: 'safe',
    },
    {
      id: 'sighting',
      position: [0, 8],
      pursuerPosition: [-1, 3],
      pursuerYaw: Math.atan2(1, 5),
      freezePursuer: true,
      objective: 'escape_south_gate',
      flags: { radio: true, neighbour: true, flashlight: true },
      objectiveText: '沿主路逃往南侧村口。',
      missionStep: '任务 4/4',
      missionTitle: '逃往南门',
      compassVisible: true,
      dangerMode: 'safe',
    },
    {
      id: 'contact',
      position: [0, 8],
      pursuerPosition: [0, 5.6],
      contactPursuer: true,
      minimumPursuerDistance: 2.35,
      objective: 'escape_south_gate',
      flags: { radio: true, neighbour: true, flashlight: true },
      objectiveText: '沿主路逃往南侧村口。',
      missionStep: '任务 4/4',
      missionTitle: '逃往南门',
      compassVisible: true,
      dangerMode: 'threaten',
    },
    {
      id: 'south-gate',
      position: [0, -32],
      objective: 'complete',
      flags: { radio: true, neighbour: true, flashlight: true },
      objectiveText: '第一章完成：你穿过了南侧村口。',
      missionStep: '任务 4/4',
      missionTitle: '逃出雾村',
      compassVisible: false,
      dangerMode: 'safe',
    },
  ];

  for (const evidenceCase of evidenceCases) {
    await page.goto(
      `http://127.0.0.1:${port}/?evidence=${evidenceCase.id}`,
      { waitUntil: 'domcontentloaded' },
    );
    const fixtureState = await page.evaluate(() => {
      const game = window.__RURAL_ESCAPE__;
      const shellElement = document.querySelector('.game-shell');
      return {
        evidenceState: shellElement.dataset.evidenceState,
        playerPosition: [game.player.position.x, game.player.position.z],
        cameraMode: game.camera.mode,
        storyObjective: game.story.objective,
        storyFlags: { ...game.story.flags },
        objectiveText: document.querySelector('#objective').textContent,
        missionStep: document.querySelector('#mission-step').textContent,
        missionTitle: document.querySelector('#mission-title').textContent,
        compassVisible: !document.querySelector('#objective-compass').hidden,
        markerVisible: !document.querySelector('#screen-marker').hidden,
        dangerMode: shellElement.dataset.danger,
        uiPhase: shellElement.dataset.uiPhase,
        titleHidden: document.querySelector('.title-lockup').getAttribute('aria-hidden'),
      };
    });
    if (fixtureState.evidenceState !== evidenceCase.id) {
      throw new Error(
        `Expected ${evidenceCase.id} evidence dataset, got ${fixtureState.evidenceState}`,
      );
    }
    if (
      Math.hypot(
        fixtureState.playerPosition[0] - evidenceCase.position[0],
        fixtureState.playerPosition[1] - evidenceCase.position[1],
      ) > 0.001
    ) {
      throw new Error(
        `Expected ${evidenceCase.id} player position ${evidenceCase.position}, `
        + `got ${fixtureState.playerPosition}`,
      );
    }
    if (fixtureState.cameraMode !== 'third-person') {
      throw new Error(`Expected ${evidenceCase.id} third-person camera`);
    }
    if (fixtureState.storyObjective !== evidenceCase.objective) {
      throw new Error(
        `Expected ${evidenceCase.id} objective ${evidenceCase.objective}, `
        + `got ${fixtureState.storyObjective}`,
      );
    }
    if (
      fixtureState.storyFlags.radio !== evidenceCase.flags.radio
      || fixtureState.storyFlags.neighbour !== evidenceCase.flags.neighbour
      || fixtureState.storyFlags.flashlight !== evidenceCase.flags.flashlight
    ) {
      throw new Error(`Expected ${evidenceCase.id} deterministic story flags`);
    }
    if (fixtureState.objectiveText !== evidenceCase.objectiveText) {
      throw new Error(
        `Expected ${evidenceCase.id} HUD "${evidenceCase.objectiveText}", `
        + `got "${fixtureState.objectiveText}"`,
      );
    }
    if (
      fixtureState.missionStep !== evidenceCase.missionStep
      || fixtureState.missionTitle !== evidenceCase.missionTitle
    ) {
      throw new Error(
        `Expected ${evidenceCase.id} mission ${evidenceCase.missionStep} `
        + `"${evidenceCase.missionTitle}", got ${fixtureState.missionStep} `
        + `"${fixtureState.missionTitle}"`,
      );
    }
    if (fixtureState.compassVisible !== evidenceCase.compassVisible) {
      throw new Error(
        `Expected ${evidenceCase.id} compass visible=${evidenceCase.compassVisible}, `
        + `got ${fixtureState.compassVisible}`,
      );
    }
    if (fixtureState.dangerMode !== evidenceCase.dangerMode) {
      throw new Error(
        `Expected ${evidenceCase.id} danger ${evidenceCase.dangerMode}, `
        + `got ${fixtureState.dangerMode}`,
      );
    }
    if (evidenceCase.id === 'contact' && !fixtureState.markerVisible) {
      throw new Error('Expected pursuit danger to preserve visible objective guidance');
    }
    if (evidenceCase.id === 'south-gate' && fixtureState.markerVisible) {
      throw new Error('Expected completed escape guidance to stay suppressed');
    }
    if (fixtureState.uiPhase !== 'playing' || fixtureState.titleHidden !== 'true') {
      throw new Error(`Expected ${evidenceCase.id} evidence fixture to dismiss the intro`);
    }

    if (evidenceCase.freezePursuer) {
      await page.waitForTimeout(600);
      const stablePursuer = await page.evaluate(() => {
        const game = window.__RURAL_ESCAPE__;
        return {
          position: [game.pursuer.object.position.x, game.pursuer.object.position.z],
          rotationY: game.pursuer.object.rotation.y,
          state: game.pursuer.state,
          playerDistance: game.pursuer.object.position.distanceTo(game.player.position),
        };
      });
      if (
        Math.hypot(
          stablePursuer.position[0] - evidenceCase.pursuerPosition[0],
          stablePursuer.position[1] - evidenceCase.pursuerPosition[1],
        ) > 0.001
      ) {
        throw new Error(
          `Expected ${evidenceCase.id} pursuer to remain at `
          + `${evidenceCase.pursuerPosition}, got ${stablePursuer.position}`,
        );
      }
      if (
        !Number.isFinite(stablePursuer.rotationY)
        || Math.abs(stablePursuer.rotationY - evidenceCase.pursuerYaw) > 0.001
      ) {
        throw new Error(
          `Expected ${evidenceCase.id} finite authored pursuer yaw, got `
          + `${stablePursuer.rotationY}`,
        );
      }
      if (stablePursuer.state !== 'patrol') {
        throw new Error(
          `Expected ${evidenceCase.id} frozen pursuer state, got ${stablePursuer.state}`,
        );
      }
      if (!Number.isFinite(stablePursuer.playerDistance) || stablePursuer.playerDistance < 4) {
        throw new Error(
          `Expected ${evidenceCase.id} readable pursuer spacing, got `
          + `${stablePursuer.playerDistance}`,
        );
      }
    }

    if (evidenceCase.contactPursuer) {
      await page.waitForTimeout(600);
      const contactPursuer = await page.evaluate(() => {
        const game = window.__RURAL_ESCAPE__;
        const shellElement = document.querySelector('.game-shell');
        return {
          position: [game.pursuer.object.position.x, game.pursuer.object.position.z],
          state: game.pursuer.state,
          playerDistance: game.pursuer.object.position.distanceTo(game.player.position),
          datasetState: shellElement.dataset.pursuerState,
          datasetDistance: Number(shellElement.dataset.pursuerDistance),
        };
      });
      if (
        Math.hypot(
          contactPursuer.position[0] - evidenceCase.pursuerPosition[0],
          contactPursuer.position[1] - evidenceCase.pursuerPosition[1],
        ) > 0.05
      ) {
        throw new Error(
          `Expected ${evidenceCase.id} pursuer to hold contact position `
          + `${evidenceCase.pursuerPosition}, got ${contactPursuer.position}`,
        );
      }
      if (
        contactPursuer.state !== 'threaten'
        || contactPursuer.datasetState !== 'threaten'
      ) {
        throw new Error(
          `Expected ${evidenceCase.id} threaten state, got `
          + `${contactPursuer.state}/${contactPursuer.datasetState}`,
        );
      }
      if (
        !Number.isFinite(contactPursuer.playerDistance)
        || contactPursuer.playerDistance < evidenceCase.minimumPursuerDistance
        || !Number.isFinite(contactPursuer.datasetDistance)
        || contactPursuer.datasetDistance < evidenceCase.minimumPursuerDistance
      ) {
        throw new Error(
          `Expected ${evidenceCase.id} readable live spacing, got `
          + `${contactPursuer.playerDistance}/${contactPursuer.datasetDistance}`,
        );
      }
    }

    await page.waitForFunction(() => {
      const { renderCalls, renderTriangles } = document.querySelector('.game-shell').dataset;
      const calls = Number(renderCalls);
      const triangles = Number(renderTriangles);
      return Number.isFinite(calls) && calls > 0
        && Number.isFinite(triangles) && triangles > 0;
    });
    const renderEvidence = await page.evaluate(() => {
      const { renderCalls, renderTriangles } = document.querySelector('.game-shell').dataset;
      return { calls: Number(renderCalls), triangles: Number(renderTriangles) };
    });
    if (
      !Number.isFinite(renderEvidence.calls)
      || renderEvidence.calls <= 0
      || !Number.isFinite(renderEvidence.triangles)
      || renderEvidence.triangles <= 0
    ) {
      throw new Error(`Expected positive renderer evidence for ${evidenceCase.id}`);
    }
  }

  await page.click('#mute-toggle');
  const mutedState = await page.evaluate(() => ({
    pressed: document.querySelector('#mute-toggle').getAttribute('aria-pressed'),
    muted: window.__RURAL_ESCAPE__.audio.muted,
  }));
  if (mutedState.pressed !== 'true' || mutedState.muted !== true) {
    throw new Error('Expected mute control to update UI and audio state');
  }

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(
      `http://127.0.0.1:${port}/?evidence=birth`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-9, 32.8));
    const hudRects = await page.evaluate(() => Object.fromEntries(
      ['.mission-hud', '#objective-compass', '#interaction', '#tutorial-hint', '#mute-toggle']
        .map((selector) => {
          const element = document.querySelector(selector);
          return [selector, element.hidden ? null : element.getBoundingClientRect().toJSON()];
        }),
    ));
    for (const [selector, rect] of Object.entries(hudRects)) {
      if (
        rect
        && (
          rect.left < 0
          || rect.top < 0
          || rect.right > viewport.width
          || rect.bottom > viewport.height
        )
      ) {
        throw new Error(
          `Expected ${selector} inside ${viewport.width}x${viewport.height}, got `
          + `${rect.left},${rect.top},${rect.right},${rect.bottom}`,
        );
      }
    }
    const overlaps = (first, second) => Boolean(
      first
      && second
      && first.left < second.right
      && first.right > second.left
      && first.top < second.bottom
      && first.bottom > second.top
    );
    if (overlaps(hudRects['.mission-hud'], hudRects['#objective-compass'])) {
      throw new Error(`Mission card overlaps compass at ${viewport.width}x${viewport.height}`);
    }
    if (overlaps(hudRects['#interaction'], hudRects['#tutorial-hint'])) {
      throw new Error(`Interaction prompt overlaps tutorial hint at ${viewport.width}x${viewport.height}`);
    }
  }

  const reducedPageErrors = [];
  const reducedConsoleErrors = [];
  const reducedPage = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
  });
  reducedPage.on('pageerror', (error) => reducedPageErrors.push(error.message));
  reducedPage.on('console', (message) => {
    if (message.type() === 'error') reducedConsoleErrors.push(message.text());
  });
  await reducedPage.goto(
    `http://127.0.0.1:${port}/?evidence=contact`,
    { waitUntil: 'domcontentloaded' },
  );
  const reducedMotion = await reducedPage.evaluate(() => ({
    markerAnimation: getComputedStyle(document.querySelector('#screen-marker')).animationName,
    toastTransition: getComputedStyle(document.querySelector('#completion-toast')).transitionDuration,
  }));
  if (reducedMotion.markerAnimation !== 'none') {
    throw new Error('Expected reduced-motion marker animation to be disabled');
  }
  if (reducedMotion.toastTransition !== '0s') {
    throw new Error('Expected reduced-motion completion transition to be disabled');
  }
  await reducedPage.close();

  if (pageErrors.length || reducedPageErrors.length) {
    throw new Error(`Expected zero page errors, got ${[...pageErrors, ...reducedPageErrors].join(' | ')}`);
  }
  if (consoleErrors.length || reducedConsoleErrors.length) {
    throw new Error(
      `Expected zero console errors, got ${[...consoleErrors, ...reducedConsoleErrors].join(' | ')}`,
    );
  }

  console.log(
    'Smoke test passed: guidance, traversal, story, pursuit, mute, viewports, reduced motion, '
    + 'console health, and camera.',
  );
} catch (error) {
  testError = error;
} finally {
  try {
    await browser?.close();
  } catch (error) {
    cleanupError = error;
  }
  try {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    const exited = await waitForChildExit(server);
    if (!exited && server.exitCode === null && server.signalCode === null) {
      server.kill('SIGKILL');
      if (!(await waitForChildExit(server))) {
        throw new Error(`Vite test server did not exit after forced teardown on port ${port}`);
      }
    }
  } catch (error) {
    cleanupError ??= error;
  }
}

if (testError) {
  if (cleanupError) console.error('Smoke cleanup also failed:', cleanupError);
  throw testError;
}
if (cleanupError) throw cleanupError;
