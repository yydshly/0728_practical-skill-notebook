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

async function assertPoleAcceptance(page, viewportLabel) {
  const acceptance = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    const posts = game.actorColliders.filter(
      ({ id }) => /^road_lantern_[ab]_body$/.test(id),
    );
    const approaches = [
      {
        id: 'north',
        start: [0, 1],
        direct: [0, -0.5],
        diagonal: [0.2, -0.5],
        expectedSlide: [0.2, 1],
      },
      {
        id: 'south',
        start: [0, -1],
        direct: [0, 0.5],
        diagonal: [0.2, 0.5],
        expectedSlide: [0.2, -1],
      },
      {
        id: 'east',
        start: [1, 0],
        direct: [-0.5, 0],
        diagonal: [-0.5, 0.2],
        expectedSlide: [1, 0.2],
      },
      {
        id: 'west',
        start: [-1, 0],
        direct: [0.5, 0],
        diagonal: [0.5, 0.2],
        expectedSlide: [-1, 0.2],
      },
    ];
    const movements = [];
    const pursuits = [];
    const storyBefore = {
      objective: game.story.objective,
      flags: { ...game.story.flags },
    };

    for (const post of posts) {
      for (const approach of approaches) {
        const start = [
          post.x + approach.start[0],
          post.z + approach.start[1],
        ];
        game.setPlayerForTest(...start);
        game.moveForTest(...approach.direct);
        const blocked = [game.player.position.x, game.player.position.z];

        game.setPlayerForTest(...start);
        game.moveForTest(...approach.diagonal);
        const sliding = [game.player.position.x, game.player.position.z];

        movements.push({
          postId: post.id,
          approachId: approach.id,
          start,
          blocked,
          sliding,
          expectedSlide: [
            post.x + approach.expectedSlide[0],
            post.z + approach.expectedSlide[1],
          ],
        });
      }

      game.pursuer.reset();
      game.pursuer.object.position.set(post.x, 0, post.z + 2);
      game.setPlayerForTest(post.x, post.z - 4);
      let minimumDistance = Infinity;
      let minimumPlayerDistance = Infinity;
      for (let index = 0; index < 180; index += 1) {
        game.updatePursuerForTest(1 / 60);
        minimumDistance = Math.min(
          minimumDistance,
          Math.hypot(
            game.pursuer.object.position.x - post.x,
            game.pursuer.object.position.z - post.z,
          ),
        );
        minimumPlayerDistance = Math.min(
          minimumPlayerDistance,
          game.pursuer.object.position.distanceTo(game.player.position),
        );
      }
      pursuits.push({
        postId: post.id,
        minimumDistance,
        minimumPlayerDistance,
        position: game.pursuer.object.position.toArray(),
      });
    }

    game.pursuer.reset();
    game.setPlayerForTest(-8, 33);
    return {
      postCount: posts.length,
      movements,
      pursuits,
      reset: {
        player: game.player.position.toArray(),
        pursuerState: game.pursuer.state,
        story: {
          objective: game.story.objective,
          flags: { ...game.story.flags },
        },
      },
      storyBefore,
    };
  });

  if (
    acceptance.postCount !== 2
    || acceptance.movements.length !== 8
    || acceptance.pursuits.length !== 2
  ) {
    throw new Error(
      `[${viewportLabel}] Expected two road-lantern colliders and eight movement cases: `
      + `${JSON.stringify(acceptance)}`,
    );
  }
  for (const result of acceptance.movements) {
    if (
      Math.abs(result.blocked[0] - result.start[0]) > 0.001
      || Math.abs(result.blocked[1] - result.start[1]) > 0.001
    ) {
      throw new Error(
        `[${viewportLabel}] Expected ${result.postId}/${result.approachId} to block: `
        + `${JSON.stringify(result)}`,
      );
    }
    if (
      Math.abs(result.sliding[0] - result.expectedSlide[0]) > 0.001
      || Math.abs(result.sliding[1] - result.expectedSlide[1]) > 0.001
    ) {
      throw new Error(
        `[${viewportLabel}] Expected ${result.postId}/${result.approachId} to slide: `
        + `${JSON.stringify(result)}`,
      );
    }
  }
  for (const result of acceptance.pursuits) {
    if (result.minimumDistance < 0.62 - 0.001) {
      throw new Error(
        `[${viewportLabel}] Expected pursuer to avoid ${result.postId}: `
        + `${JSON.stringify(result)}`,
      );
    }
    if (result.minimumPlayerDistance < 2.2 - 0.001) {
      throw new Error(
        `[${viewportLabel}] Expected pursuer to retain player separation at ${result.postId}: `
        + `${JSON.stringify(result)}`,
      );
    }
  }
  if (
    Math.hypot(acceptance.reset.player[0] + 8, acceptance.reset.player[2] - 33) > 0.001
    || acceptance.reset.pursuerState !== 'patrol'
    || JSON.stringify(acceptance.reset.story) !== JSON.stringify(acceptance.storyBefore)
  ) {
    throw new Error(
      `[${viewportLabel}] Expected pole acceptance to restore player, pursuer, and story: `
      + `${JSON.stringify(acceptance.reset)}`,
    );
  }
}

async function assertFullViewportAcceptance(page, testPort, viewport) {
  const viewportLabel = `${viewport.width}x${viewport.height}`;
  await page.setViewportSize(viewport);
  await page.goto(`http://127.0.0.1:${testPort}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setStoryStateForTest(
      { radio: false, neighbour: false, flashlight: false },
      'leave_home',
    );
    game.pursuer.reset();
    game.setPlayerForTest(-8, 33);
    game.completeIntroForTest();
  });

  await assertPoleAcceptance(page, viewportLabel);

  const routeSteps = [
    {
      id: 'radio',
      position: [-9, 32.8],
      expectedObjective: 'visit_courtyard',
      waitForToast: true,
    },
    {
      id: 'neighbour',
      position: [10.4, 24.4],
      expectedObjective: 'reach_granary',
      waitForToast: true,
    },
    {
      id: 'flashlight',
      position: [13.2, -4.6],
      expectedObjective: 'escape_south_gate',
      waitForToast: false,
    },
  ];
  for (const routeStep of routeSteps) {
    const promptVisible = await page.evaluate(([x, z]) => {
      window.__RURAL_ESCAPE__.setPlayerForTest(x, z);
      return !document.querySelector('#interaction').hidden;
    }, routeStep.position);
    if (!promptVisible) {
      throw new Error(
        `[${viewportLabel}] Expected ${routeStep.id} interaction prompt on canonical route`,
      );
    }

    await page.keyboard.press('KeyE');
    const objective = await page.evaluate(() => window.__RURAL_ESCAPE__.story.objective);
    if (objective !== routeStep.expectedObjective) {
      throw new Error(
        `[${viewportLabel}] Expected ${routeStep.id} objective `
        + `${routeStep.expectedObjective}, got ${objective}`,
      );
    }
    if (routeStep.waitForToast) {
      await page.waitForFunction(() => document.querySelector('#completion-toast').hidden);
    }
  }

  const completedObjective = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(0, -34);
    game.updateStoryForTest();
    return game.story.objective;
  });
  if (completedObjective !== 'complete') {
    throw new Error(
      `[${viewportLabel}] Expected south-gate route completion, got ${completedObjective}`,
    );
  }

  await page.goto(
    `http://127.0.0.1:${testPort}/?evidence=contact`,
    { waitUntil: 'domcontentloaded' },
  );
  await page.waitForFunction(() => {
    const { renderCalls, renderTriangles } = document.querySelector('.game-shell').dataset;
    return Number(renderCalls) > 0 && Number(renderTriangles) > 0;
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
    throw new Error(
      `[${viewportLabel}] Expected positive renderer evidence: `
      + `${JSON.stringify(renderEvidence)}`,
    );
  }

  await page.goto(`http://127.0.0.1:${testPort}/`, { waitUntil: 'domcontentloaded' });
  const reset = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setStoryStateForTest(
      { radio: false, neighbour: false, flashlight: false },
      'leave_home',
    );
    game.pursuer.reset();
    game.setPlayerForTest(-8, 33);
    return {
      viewport: [window.innerWidth, window.innerHeight],
      player: game.player.position.toArray(),
      pursuerState: game.pursuer.state,
      objective: game.story.objective,
      flags: { ...game.story.flags },
    };
  });
  if (
    reset.viewport[0] !== viewport.width
    || reset.viewport[1] !== viewport.height
    || Math.hypot(reset.player[0] + 8, reset.player[2] - 33) > 0.001
    || reset.pursuerState !== 'patrol'
    || reset.objective !== 'leave_home'
    || reset.flags.radio
    || reset.flags.neighbour
    || reset.flags.flashlight
  ) {
    throw new Error(
      `[${viewportLabel}] Expected full acceptance reset invariants: ${JSON.stringify(reset)}`,
    );
  }

  return renderEvidence;
}

const AUDIO_FILES = Object.freeze([
  'rural-dusk-bed',
  'mutation-danger-layer',
  'mutation-reveal-stinger',
  'south-gate-escape-stinger',
]);

function audioAssetIdentity(url) {
  const parsed = new URL(url);
  if (parsed.searchParams.has('import')) return null;
  const match = parsed.pathname.match(
    /\/(rural-dusk-bed|mutation-danger-layer|mutation-reveal-stinger|south-gate-escape-stinger)\.(ogg|mp3)$/,
  );
  return match ? `${match[1]}.${match[2]}` : null;
}

function createNavigationLog(page) {
  let active = false;
  let responses = new Map();
  let pageErrors = [];
  let consoleErrors = [];
  let consoleWarnings = [];
  page.on('response', (response) => {
    if (!active) return;
    const identity = audioAssetIdentity(response.url());
    if (!identity) return;
    const records = responses.get(identity) ?? [];
    records.push({ status: response.status(), url: response.url() });
    responses.set(identity, records);
  });
  page.on('pageerror', (error) => {
    if (active) pageErrors.push(error.message);
  });
  page.on('console', (message) => {
    if (!active) return;
    if (message.type() === 'error') consoleErrors.push(message.text());
    if (message.type() === 'warning') consoleWarnings.push(message.text());
  });
  return {
    start() {
      responses = new Map();
      pageErrors = [];
      consoleErrors = [];
      consoleWarnings = [];
      active = true;
    },
    freeze() {
      active = false;
      return {
        responses: new Map(
          [...responses].map(([identity, records]) => [identity, [...records]]),
        ),
        pageErrors: [...pageErrors],
        consoleErrors: [...consoleErrors],
        consoleWarnings: [...consoleWarnings],
      };
    },
  };
}

function assertNoBrowserErrors(log, label) {
  if (log.pageErrors.length) {
    throw new Error(`${label} page errors: ${log.pageErrors.join(' | ')}`);
  }
  if (log.consoleErrors.length) {
    throw new Error(`${label} console errors: ${log.consoleErrors.join(' | ')}`);
  }
}

function assertAudioRequestAccounting({ responses, consoleWarnings }) {
  for (const stem of AUDIO_FILES) {
    const ogg = responses.get(`${stem}.ogg`) ?? [];
    if (ogg.length !== 1 || ogg[0].status !== 200) {
      throw new Error(
        `Expected one HTTP 200 OGG request for ${stem}, got ${JSON.stringify(ogg)}`,
      );
    }
    const mp3 = responses.get(`${stem}.mp3`) ?? [];
    if (mp3.length > 1 || (mp3.length === 1 && mp3[0].status !== 200)) {
      throw new Error(
        `Expected at most one successful MP3 fallback for ${stem}, got ${JSON.stringify(mp3)}`,
      );
    }
  }
  const mp3Counts = AUDIO_FILES.map(
    (stem) => (responses.get(`${stem}.mp3`) ?? []).length,
  );
  const oggRejected = consoleWarnings.some(
    (warning) => warning.includes('[music-director:ogg-decode-or-spec]'),
  );
  if (mp3Counts.some(Boolean) && !oggRejected) {
    throw new Error(
      `Expected MP3 only after Chromium rejects OGG, got counts ${mp3Counts}`,
    );
  }
  if (mp3Counts.some(Boolean) && mp3Counts.some((count) => count !== 1)) {
    throw new Error(`Expected MP3 fallback to replace the complete codec set: ${mp3Counts}`);
  }
  for (const [identity, records] of responses) {
    if (records.some(({ status }) => status === 200) && records.length !== 1) {
      throw new Error(`Expected selected ${identity} URL to be fetched once`);
    }
  }
}

async function waitForPlayingAudio(page) {
  await page.waitForFunction(() => {
    const audio = window.__RURAL_ESCAPE__?.audio;
    return audio?.musicState?.playback === 'playing'
      && audio.contextState === 'running';
  }, null, { timeout: 15000 });
}

async function completeStoryRoute(page) {
  const route = [
    { position: [-9, 32.8], objective: 'visit_courtyard' },
    { position: [10.4, 24.4], objective: 'reach_granary' },
    { position: [13.2, -4.6], objective: 'escape_south_gate' },
  ];
  for (const step of route) {
    await page.evaluate(([x, z]) => window.__RURAL_ESCAPE__.setPlayerForTest(x, z), step.position);
    await page.keyboard.press('KeyE');
    await page.waitForFunction(
      (objective) => window.__RURAL_ESCAPE__.story.objective === objective,
      step.objective,
    );
    await page.waitForFunction(() => document.querySelector('#completion-toast').hidden);
  }
  await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(0, -34);
    game.updateStoryForTest();
  });
  await page.waitForFunction(() => window.__RURAL_ESCAPE__.story.objective === 'complete');
}

async function assertTrustedNonButtonUnlocks(browserInstance, testPort) {
  const cases = [
    {
      label: 'keydown',
      activate: (page) => page.keyboard.press('KeyW'),
    },
    {
      label: 'canvas pointer/click',
      activate: (page) => page.click('#game', { position: { x: 20, y: 20 } }),
    },
  ];
  for (const acceptanceCase of cases) {
    const context = await browserInstance.newContext({
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    const navigationLog = createNavigationLog(page);
    try {
      navigationLog.start();
      await page.goto(
        `http://127.0.0.1:${testPort}/?evidence=birth`,
        { waitUntil: 'domcontentloaded' },
      );
      await page.waitForFunction(() => Boolean(window.__RURAL_ESCAPE__));
      const initial = await page.evaluate(() => ({
        contextState: window.__RURAL_ESCAPE__.audio.contextState,
        playback: window.__RURAL_ESCAPE__.audio.musicState.playback,
        audioState: document.querySelector('#mute-toggle').dataset.audioState,
      }));
      if (
        initial.audioState !== 'locked'
        || initial.playback === 'playing'
        || initial.contextState === 'running'
      ) {
        throw new Error(
          `Expected fresh ${acceptanceCase.label} context to begin locked: `
          + `${JSON.stringify(initial)}`,
        );
      }
      await acceptanceCase.activate(page);
      await waitForPlayingAudio(page);
      const unlocked = await page.evaluate(() => ({
        contextState: window.__RURAL_ESCAPE__.audio.contextState,
        playback: window.__RURAL_ESCAPE__.audio.musicState.playback,
        audioState: document.querySelector('#mute-toggle').dataset.audioState,
      }));
      if (
        unlocked.audioState !== 'playing'
        || unlocked.playback !== 'playing'
        || unlocked.contextState !== 'running'
      ) {
        throw new Error(
          `Expected first trusted ${acceptanceCase.label} to unlock: `
          + `${JSON.stringify(unlocked)}`,
        );
      }
      assertNoBrowserErrors(
        navigationLog.freeze(),
        `${acceptanceCase.label} audio navigation`,
      );
    } finally {
      await context.close();
    }
  }
}

async function assertAudioAcceptance(browserInstance, testPort) {
  const context = await browserInstance.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const navigationLog = createNavigationLog(page);
  try {
    navigationLog.start();
    await page.goto(
      `http://127.0.0.1:${testPort}/?evidence=birth`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForFunction(() => Boolean(window.__RURAL_ESCAPE__));
    const initial = await page.evaluate(() => {
      const button = document.querySelector('#mute-toggle');
      return {
        ariaLabel: button.getAttribute('aria-label'),
        audioState: button.dataset.audioState,
      };
    });
    if (initial.audioState !== 'locked' || initial.ariaLabel !== '开启声音') {
      throw new Error(`Expected initially locked sound control, got ${JSON.stringify(initial)}`);
    }

    const syntheticState = await page.evaluate(() => {
      document.querySelector('#mute-toggle').click();
      const button = document.querySelector('#mute-toggle');
      return {
        audioState: button.dataset.audioState,
        muted: window.__RURAL_ESCAPE__.audio.muted,
      };
    });
    await page.click('#mute-toggle');
    await waitForPlayingAudio(page);
    if (syntheticState.audioState !== 'locked' || syntheticState.muted) {
      throw new Error(
        `Expected synthetic click to remain locked, got ${JSON.stringify(syntheticState)}`,
      );
    }

    const playback = await page.evaluate(() => {
      const audio = window.__RURAL_ESCAPE__.audio;
      const descriptors = Object.getOwnPropertyDescriptors(audio);
      return {
        contextState: audio.contextState,
        playback: audio.musicState.playback,
        activeVoices: audio.activeVoices,
        keys: Object.keys(audio).sort(),
        frozen: Object.isFrozen(audio),
        getterOnly: Object.values(descriptors).every(
          ({ get, set, value }) => typeof get === 'function'
            && set === undefined
            && value === undefined,
        ),
      };
    });
    if (
      playback.playback !== 'playing'
      || playback.contextState !== 'running'
      || !Number.isFinite(playback.activeVoices)
      || playback.activeVoices < 0
    ) {
      throw new Error(`Expected healthy playing snapshot: ${JSON.stringify(playback)}`);
    }
    const expectedDebugKeys = [
      'activeVoices',
      'assetState',
      'contextState',
      'dangerMix',
      'musicState',
      'muted',
    ];
    if (
      !playback.frozen
      || !playback.getterOnly
      || JSON.stringify(playback.keys) !== JSON.stringify(expectedDebugKeys)
    ) {
      throw new Error(`Expected frozen getter-only audio debug facade: ${JSON.stringify(playback)}`);
    }
    const birthLog = navigationLog.freeze();
    assertNoBrowserErrors(birthLog, 'normal audio navigation');
    assertAudioRequestAccounting(birthLog);

    navigationLog.start();
    await page.goto(
      `http://127.0.0.1:${testPort}/?evidence=contact`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.waitForFunction(() => window.__RURAL_ESCAPE__?.pursuer?.state === 'threaten');
    await page.click('#mute-toggle');
    await waitForPlayingAudio(page);
    const initialGeneration = await page.evaluate(
      () => window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
    );
    if (initialGeneration !== 1) {
      throw new Error(`Expected first contact loop generation 1, got ${initialGeneration}`);
    }

    await page.evaluate(() => {
      const game = window.__RURAL_ESCAPE__;
      const pursuer = game.pursuer.object.position;
      game.setPlayerForTest(pursuer.x, pursuer.z + 6);
    });
    await page.waitForFunction(() => (
      window.__RURAL_ESCAPE__.pursuer.state === 'chase'
      && window.__RURAL_ESCAPE__.audio.musicState.mode === 'chase'
    ));
    const chaseMix = await page.evaluate(() => window.__RURAL_ESCAPE__.audio.dangerMix);

    await page.evaluate(() => {
      const game = window.__RURAL_ESCAPE__;
      const pursuer = game.pursuer.object.position;
      game.setPlayerForTest(pursuer.x, pursuer.z);
    });
    await page.waitForFunction(() => (
      window.__RURAL_ESCAPE__.pursuer.state === 'threaten'
      && window.__RURAL_ESCAPE__.audio.musicState.mode === 'threaten'
    ));
    const threatenMix = await page.evaluate(() => window.__RURAL_ESCAPE__.audio.dangerMix);
    if (!(threatenMix > chaseMix)) {
      throw new Error(`Expected threaten mix ${threatenMix} above chase mix ${chaseMix}`);
    }

    const recoverStartedAt = await page.evaluate(() => {
      window.__RURAL_ESCAPE__.setPlayerForTest(-8, 33);
      return performance.now();
    });
    await page.waitForFunction(() => window.__RURAL_ESCAPE__.audio.musicState.mode === 'recover');
    await page.waitForFunction((startedAt) => (
      performance.now() - startedAt >= 3900
      || window.__RURAL_ESCAPE__.audio.musicState.mode !== 'recover'
    ), recoverStartedAt);
    const recoverWindow = await page.evaluate((startedAt) => ({
      elapsed: performance.now() - startedAt,
      mode: window.__RURAL_ESCAPE__.audio.musicState.mode,
      loopGeneration: window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
    }), recoverStartedAt);
    if (recoverWindow.elapsed < 3900 || recoverWindow.mode !== 'recover') {
      throw new Error(`Expected full four-second recover window: ${JSON.stringify(recoverWindow)}`);
    }
    await page.waitForFunction(() => window.__RURAL_ESCAPE__.audio.musicState.mode === 'safe');

    const generationAfterDanger = await page.evaluate(
      () => window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
    );
    if (generationAfterDanger !== initialGeneration) {
      throw new Error('Expected danger transitions to preserve the loop generation');
    }

    await page.click('#mute-toggle');
    await page.waitForFunction(() => window.__RURAL_ESCAPE__.audio.muted === true);
    const mutedGeneration = await page.evaluate(
      () => window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
    );
    await page.click('#mute-toggle');
    await waitForPlayingAudio(page);
    const unmutedGeneration = await page.evaluate(
      () => window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
    );
    if (mutedGeneration !== 1 || unmutedGeneration !== 1) {
      throw new Error(
        `Expected same-document mute cycle to preserve generation 1, got `
        + `${mutedGeneration}/${unmutedGeneration}`,
      );
    }

    await page.click('#mute-toggle');
    await page.waitForFunction(() => window.__RURAL_ESCAPE__.audio.muted === true);
    navigationLog.freeze();
    navigationLog.start();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__RURAL_ESCAPE__?.audio?.muted === true);
    const persisted = await page.evaluate(() => {
      const button = document.querySelector('#mute-toggle');
      const audio = window.__RURAL_ESCAPE__.audio;
      return {
        audioState: button.dataset.audioState,
        loopGeneration: audio.musicState.loopGeneration,
        muted: audio.muted,
      };
    });
    if (
      !persisted.muted
      || persisted.audioState !== 'muted'
      || persisted.loopGeneration !== 0
    ) {
      throw new Error(`Expected reload to restore mute without loops: ${JSON.stringify(persisted)}`);
    }
    await page.click('#mute-toggle');
    await waitForPlayingAudio(page);
    const reloadedGeneration = await page.evaluate(
      () => window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
    );
    if (reloadedGeneration !== 1) {
      throw new Error(`Expected new document's first generation 1, got ${reloadedGeneration}`);
    }
    await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-8, 33));
    await page.waitForFunction(() => (
      window.__RURAL_ESCAPE__.audio.musicState.mode === 'safe'
      && window.__RURAL_ESCAPE__.audio.activeVoices === 0
    ), null, { timeout: 10000 });
    const revealStartedAt = await page.evaluate(() => {
      const game = window.__RURAL_ESCAPE__;
      game.setStoryStateForTest(
        { radio: true, neighbour: true, flashlight: false },
        'reach_granary',
      );
      game.interactForTest('flashlight');
      return performance.now();
    });
    await page.waitForFunction((startedAt) => (
      performance.now() - startedAt >= 500
      || window.__RURAL_ESCAPE__.audio.activeVoices === 0
    ), revealStartedAt);
    const sustainedReveal = await page.evaluate((startedAt) => ({
      activeVoices: window.__RURAL_ESCAPE__.audio.activeVoices,
      elapsed: performance.now() - startedAt,
    }), revealStartedAt);
    if (sustainedReveal.elapsed < 500 || sustainedReveal.activeVoices <= 0) {
      throw new Error(
        `Expected reveal stinger beyond oscillator window: ${JSON.stringify(sustainedReveal)}`,
      );
    }
    await page.waitForFunction((startedAt) => (
      window.__RURAL_ESCAPE__.audio.activeVoices === 0
      || performance.now() - startedAt >= 4000
    ), revealStartedAt);
    const completedReveal = await page.evaluate((startedAt) => ({
      activeVoices: window.__RURAL_ESCAPE__.audio.activeVoices,
      elapsed: performance.now() - startedAt,
    }), revealStartedAt);
    if (
      completedReveal.activeVoices !== 0
      || completedReveal.elapsed < 2500
      || completedReveal.elapsed >= 4000
    ) {
      throw new Error(
        `Expected reveal stinger to finish in its bounded window: `
        + `${JSON.stringify(completedReveal)}`,
      );
    }

    const beforeFreeze = await page.evaluate(() => ({
      activeVoices: window.__RURAL_ESCAPE__.audio.activeVoices,
      loopGeneration: window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
      startedAt: window.__RURAL_ESCAPE__.audio.musicState.startedAt,
    }));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    const contextState = await page.evaluate(
      () => window.__RURAL_ESCAPE__.audio.contextState,
    );
    if (contextState !== 'running') {
      await page.click('#game', { position: { x: 20, y: 20 } });
      await page.waitForFunction(() => window.__RURAL_ESCAPE__.audio.contextState === 'running');
    }
    const postReactivateStartedAt = await page.evaluate(() => performance.now());
    await page.waitForFunction((startedAt) => (
      performance.now() - startedAt >= 1000
      || window.__RURAL_ESCAPE__.audio.activeVoices > 0
    ), postReactivateStartedAt);
    const afterFreeze = await page.evaluate(() => ({
      activeVoices: window.__RURAL_ESCAPE__.audio.activeVoices,
      loopGeneration: window.__RURAL_ESCAPE__.audio.musicState.loopGeneration,
      startedAt: window.__RURAL_ESCAPE__.audio.musicState.startedAt,
    }));
    if (
      afterFreeze.loopGeneration !== beforeFreeze.loopGeneration
      || afterFreeze.startedAt !== beforeFreeze.startedAt
      || afterFreeze.activeVoices !== 0
    ) {
      throw new Error(
        `Expected freeze/reactivate to preserve loops and stingers: `
        + `${JSON.stringify({ beforeFreeze, afterFreeze })}`,
      );
    }
    assertNoBrowserErrors(navigationLog.freeze(), 'audio persistence navigation');
  } finally {
    await context.close();
  }
}

async function assertPortraitAudioAcceptance(browserInstance, testPort) {
  const context = await browserInstance.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const navigationLog = createNavigationLog(page);
  try {
    navigationLog.start();
    await page.goto(
      `http://127.0.0.1:${testPort}/?evidence=birth`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.click('#mute-toggle');
    await waitForPlayingAudio(page);
    await page.evaluate(() => window.__RURAL_ESCAPE__.setPlayerForTest(-9, 32.8));
    const portrait = await page.evaluate(() => {
      const button = document.querySelector('#mute-toggle');
      const tutorial = document.querySelector('#tutorial-hint');
      const interaction = document.querySelector('#interaction');
      const audio = window.__RURAL_ESCAPE__.audio;
      const rect = (element) => (
        element.hidden ? null : element.getBoundingClientRect().toJSON()
      );
      const expectedState = audio.muted
        ? 'muted'
        : audio.assetState === 'error' || audio.musicState.playback === 'error'
          ? 'error'
          : audio.musicState.playback === 'loading'
            ? 'loading'
            : audio.musicState.playback === 'playing'
              ? 'playing'
              : 'locked';
      return {
        ariaBusy: button.getAttribute('aria-busy'),
        ariaLabel: button.getAttribute('aria-label'),
        ariaPressed: button.getAttribute('aria-pressed'),
        audioState: button.dataset.audioState,
        expectedState,
        pointerEvents: getComputedStyle(button).pointerEvents,
        button: rect(button),
        tutorial: rect(tutorial),
        interaction: rect(interaction),
        viewport: [innerWidth, innerHeight],
      };
    });
    const overlaps = (left, right) => Boolean(
      left
      && right
      && left.left < right.right
      && left.right > right.left
      && left.top < right.bottom
      && left.bottom > right.top
    );
    const expectedAria = {
      locked: { label: '开启声音', pressed: 'false', busy: 'false' },
      loading: { label: '正在加载声音', pressed: 'false', busy: 'true' },
      playing: { label: '关闭声音', pressed: 'false', busy: 'false' },
      muted: { label: '开启声音', pressed: 'true', busy: 'false' },
      error: { label: '重试声音', pressed: 'false', busy: 'false' },
    }[portrait.expectedState];
    if (
      !portrait.button
      || portrait.button.width < 44
      || portrait.button.height < 44
      || portrait.button.left < 0
      || portrait.button.top < 0
      || portrait.button.right > portrait.viewport[0]
      || portrait.button.bottom > portrait.viewport[1]
      || portrait.pointerEvents === 'none'
      || portrait.audioState !== portrait.expectedState
      || portrait.ariaLabel !== expectedAria?.label
      || portrait.ariaPressed !== expectedAria?.pressed
      || portrait.ariaBusy !== expectedAria?.busy
      || overlaps(portrait.button, portrait.tutorial)
      || overlaps(portrait.button, portrait.interaction)
    ) {
      throw new Error(`Expected accessible non-overlapping portrait audio control: ${JSON.stringify(portrait)}`);
    }
    assertNoBrowserErrors(navigationLog.freeze(), 'portrait audio navigation');
  } finally {
    await context.close();
  }
}

async function assertMissingAudioAcceptance(browserInstance, testPort) {
  const context = await browserInstance.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  const navigationLog = createNavigationLog(page);
  try {
    navigationLog.start();
    await page.goto(
      `http://127.0.0.1:${testPort}/?evidence=birth&audio-fixture=missing`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.click('#mute-toggle');
    await page.waitForFunction(() => (
      window.__RURAL_ESCAPE__?.audio?.assetState === 'error'
      && document.querySelector('#mute-toggle').dataset.audioState === 'error'
    ));
    const failure = await page.evaluate(() => {
      const button = document.querySelector('#mute-toggle');
      return {
        ariaLabel: button.getAttribute('aria-label'),
        assetState: window.__RURAL_ESCAPE__.audio.assetState,
        audioState: button.dataset.audioState,
      };
    });
    if (
      failure.audioState !== 'error'
      || failure.ariaLabel !== '重试声音'
      || failure.assetState !== 'error'
    ) {
      throw new Error(`Expected deterministic missing-audio state: ${JSON.stringify(failure)}`);
    }
    await completeStoryRoute(page);
    await page.waitForFunction(() => {
      const shell = document.querySelector('.game-shell');
      return Number(shell.dataset.renderCalls) > 0
        && Number(shell.dataset.renderTriangles) > 0;
    });
    const renderer = await page.evaluate(() => {
      const shell = document.querySelector('.game-shell');
      return {
        calls: Number(shell.dataset.renderCalls),
        triangles: Number(shell.dataset.renderTriangles),
        objective: window.__RURAL_ESCAPE__.story.objective,
      };
    });
    if (
      renderer.objective !== 'complete'
      || !Number.isFinite(renderer.calls)
      || renderer.calls <= 0
      || !Number.isFinite(renderer.triangles)
      || renderer.triangles <= 0
    ) {
      throw new Error(`Expected healthy story and renderer after audio failure: ${JSON.stringify(renderer)}`);
    }
    const failureLog = navigationLog.freeze();
    assertNoBrowserErrors(failureLog, 'missing audio navigation');
    const warningClasses = new Map();
    for (const warning of failureLog.consoleWarnings) {
      const failureClass = warning.match(/\[(?:audio-feedback|music-director):([^\]]+)\]/)?.[0];
      if (!failureClass) continue;
      warningClasses.set(failureClass, (warningClasses.get(failureClass) ?? 0) + 1);
    }
    for (const [failureClass, count] of warningClasses) {
      if (count > 1) {
        throw new Error(`Expected one ${failureClass} warning, got ${count}`);
      }
    }
  } finally {
    await context.close();
  }
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await assertAudioAcceptance(browser, port);
  await assertTrustedNonButtonUnlocks(browser, port);
  await assertPortraitAudioAcceptance(browser, port);
  await assertMissingAudioAcceptance(browser, port);
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
    compassLive: document.querySelector('#objective-compass')?.getAttribute('aria-live'),
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

  await assertPoleAcceptance(page, '1280x720');

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
      pursuerPosition: [1.6, 6.211145618],
      contactPursuer: true,
      expectedContactDistance: 2.4,
      minimumLateralSeparation: 1.4,
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
    await page.waitForFunction(
      (dangerMode) => document.querySelector('.game-shell').dataset.danger === dangerMode,
      evidenceCase.dangerMode,
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
          rotationY: game.pursuer.object.rotation.y,
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
      if (
        Math.abs(contactPursuer.playerDistance - evidenceCase.expectedContactDistance) > 0.01
        || Math.abs(contactPursuer.datasetDistance - evidenceCase.expectedContactDistance) > 0.01
      ) {
        throw new Error(
          `Expected ${evidenceCase.id} authored 2.4m contact distance, got `
          + `${contactPursuer.playerDistance}/${contactPursuer.datasetDistance}`,
        );
      }
      const lateralSeparation = Math.abs(
        contactPursuer.position[0] - evidenceCase.position[0],
      );
      if (lateralSeparation < evidenceCase.minimumLateralSeparation) {
        throw new Error(
          `Expected ${evidenceCase.id} at least `
          + `${evidenceCase.minimumLateralSeparation}m lateral separation, got `
          + `${lateralSeparation}`,
        );
      }
      const toPlayerX = evidenceCase.position[0] - contactPursuer.position[0];
      const toPlayerZ = evidenceCase.position[1] - contactPursuer.position[1];
      const inverseDistance = 1 / Math.hypot(toPlayerX, toPlayerZ);
      const facingAlignment = Math.sin(contactPursuer.rotationY) * toPlayerX * inverseDistance
        + Math.cos(contactPursuer.rotationY) * toPlayerZ * inverseDistance;
      if (!Number.isFinite(facingAlignment) || facingAlignment < 0.999) {
        throw new Error(
          `Expected ${evidenceCase.id} pursuer to face the player, got alignment `
          + `${facingAlignment}`,
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

  await page.goto(
    `http://127.0.0.1:${port}/?evidence=birth`,
    { waitUntil: 'domcontentloaded' },
  );
  const dragStart = await page.evaluate(() => ({
    yaw: window.__RURAL_ESCAPE__.camera.yaw,
    markerHidden: document.querySelector('#screen-marker').hidden,
    markerEdge: document.querySelector('#screen-marker').dataset.edge,
  }));
  const canvasBox = await page.locator('#game').boundingBox();
  if (!canvasBox) throw new Error('Expected game canvas bounds for camera drag');
  const dragStartX = canvasBox.x + canvasBox.width * 0.1;
  const dragY = canvasBox.y + canvasBox.height * 0.5;
  await page.mouse.move(dragStartX, dragY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.9, dragY, { steps: 12 });
  await page.mouse.up({ button: 'left' });
  await page.waitForTimeout(120);
  const dragEnd = await page.evaluate(() => ({
    yaw: window.__RURAL_ESCAPE__.camera.yaw,
    markerHidden: document.querySelector('#screen-marker').hidden,
    markerEdge: document.querySelector('#screen-marker').dataset.edge,
  }));
  if (Math.abs(dragEnd.yaw - dragStart.yaw) < 0.2) {
    throw new Error(
      `Expected real left-button drag to rotate camera yaw, got `
      + `${dragStart.yaw} -> ${dragEnd.yaw}`,
    );
  }
  if (dragEnd.markerHidden || dragEnd.markerEdge !== 'true') {
    throw new Error(
      `Expected dragged camera to preserve edge guidance, got `
      + `hidden=${dragEnd.markerHidden} edge=${dragEnd.markerEdge}`,
    );
  }
  await page.goto(
    `http://127.0.0.1:${port}/?evidence=birth`,
    { waitUntil: 'domcontentloaded' },
  );

  await page.click('#mute-toggle');
  await waitForPlayingAudio(page);
  const enabledState = await page.evaluate(() => ({
    pressed: document.querySelector('#mute-toggle').getAttribute('aria-pressed'),
    muted: window.__RURAL_ESCAPE__.audio.muted,
  }));
  if (enabledState.pressed !== 'false' || enabledState.muted !== false) {
    throw new Error('Expected first sound-control click to enable playback');
  }
  await page.click('#mute-toggle');
  await page.waitForFunction(() => window.__RURAL_ESCAPE__.audio.muted === true);
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
    { width: 390, height: 844 },
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

  const portraitPageErrorStart = pageErrors.length;
  const portraitConsoleErrorStart = consoleErrors.length;
  await assertFullViewportAcceptance(page, port, { width: 390, height: 844 });
  const portraitPageErrors = pageErrors.slice(portraitPageErrorStart);
  const portraitConsoleErrors = consoleErrors.slice(portraitConsoleErrorStart);
  if (portraitPageErrors.length) {
    throw new Error(
      `Expected zero 390x844 page errors, got ${portraitPageErrors.join(' | ')}`,
    );
  }
  if (portraitConsoleErrors.length) {
    throw new Error(
      `Expected zero 390x844 console errors, got ${portraitConsoleErrors.join(' | ')}`,
    );
  }

  if (guidanceHud.compassLive !== null) {
    throw new Error('Expected changing compass distance outside a live region');
  }

  const normalMotion = await page.evaluate(() => ({
    missionTransition: getComputedStyle(document.querySelector('.mission-hud')).transitionDuration,
  }));
  if (normalMotion.missionTransition === '0s') {
    throw new Error('Expected normal mission HUD transition to remain animated');
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
    missionTransition: getComputedStyle(document.querySelector('.mission-hud')).transitionDuration,
    toastTransition: getComputedStyle(document.querySelector('#completion-toast')).transitionDuration,
  }));
  if (reducedMotion.markerAnimation !== 'none') {
    throw new Error('Expected reduced-motion marker animation to be disabled');
  }
  if (reducedMotion.toastTransition !== '0s') {
    throw new Error('Expected reduced-motion completion transition to be disabled');
  }
  if (reducedMotion.missionTransition !== '0s') {
    throw new Error('Expected reduced-motion mission transition to be disabled');
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
    + 'console health, camera, and pole collision.',
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
