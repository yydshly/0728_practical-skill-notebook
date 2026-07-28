import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = 4174;
const vite = resolve(root, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
const server = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
  shell: process.platform === 'win32',
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
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });

  const title = await page.title();
  if (title !== '雾村：逃离') throw new Error(`Expected title 雾村：逃离, got ${title || '(empty)'}`);

  const gameHandle = await page.evaluate(() => Boolean(window.__RURAL_ESCAPE__));
  if (!gameHandle) throw new Error('Expected window.__RURAL_ESCAPE__ to be available');

  const beforeMove = await page.evaluate(() => window.__RURAL_ESCAPE__.player.position.toArray());
  await page.evaluate(() => window.__RURAL_ESCAPE__.moveForTest(0, 2));
  const afterMove = await page.evaluate(() => window.__RURAL_ESCAPE__.player.position.toArray());
  if (Math.hypot(afterMove[0] - beforeMove[0], afterMove[2] - beforeMove[2]) < 0.5) {
    throw new Error('Expected debug player movement to change position');
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

  const escapeState = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.setPlayerForTest(0, -34);
    game.updateStoryForTest();
    return game.story.objective;
  });
  if (escapeState !== 'complete') throw new Error(`Expected village exit to complete chapter, got ${escapeState}`);

  await browser.close();
  console.log('Smoke test passed: title, player movement, and camera modes are available.');
} finally {
  server.kill();
}
