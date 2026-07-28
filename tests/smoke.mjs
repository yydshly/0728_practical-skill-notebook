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

  const objectiveAfterRadio = await page.evaluate(() => {
    window.__RURAL_ESCAPE__.interactForTest('radio');
    return window.__RURAL_ESCAPE__.story.objective;
  });
  if (objectiveAfterRadio !== 'visit_courtyard') {
    throw new Error(`Expected radio to advance objective to visit_courtyard, got ${objectiveAfterRadio}`);
  }

  const pursuerState = await page.evaluate(() => {
    window.__RURAL_ESCAPE__.setPlayerForTest(0, 2);
    window.__RURAL_ESCAPE__.updatePursuerForTest(0.016);
    return window.__RURAL_ESCAPE__.pursuer.state;
  });
  if (pursuerState !== 'chase') throw new Error(`Expected pursuer chase state, got ${pursuerState}`);

  const flashlightSubtitle = await page.evaluate(() => {
    const game = window.__RURAL_ESCAPE__;
    game.interactForTest('neighbour');
    game.interactForTest('flashlight');
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
