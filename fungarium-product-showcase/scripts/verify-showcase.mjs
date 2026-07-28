import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { createServer, request as createProxyRequest } from "node:http";
import net from "node:net";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(packageRoot, "..");
const deploymentOrigin = "http://127.0.0.1:4178";
const deploymentBase = `${deploymentOrigin}/fungarium-product-showcase/`;
const evidenceDir = path.join(packageRoot, "test-results", "scripted");

const projects = [
  {
    name: "fungarium-product-showcase",
    root: packageRoot,
    port: 4180,
  },
  {
    name: "isle-of-quiet-signals",
    root: path.join(repositoryRoot, "isle-of-quiet-signals"),
    port: 4181,
  },
  {
    name: "world-cup-letter-flags-demo",
    root: path.join(repositoryRoot, "world-cup-letter-flags-demo"),
    port: 4182,
  },
  {
    name: "fabrica-template-detail-clone",
    root: path.join(repositoryRoot, "fabrica-template-detail-clone"),
    port: 4183,
  },
];

const capabilities = [
  {
    label: "沉浸式叙事",
    title: "让产品故事可以被亲手探索",
    href: "../isle-of-quiet-signals/",
    caseTitle: "雾屿灯塔",
  },
  {
    label: "互动活动",
    title: "让访客参与，而不只是观看",
    href: "../world-cup-letter-flags-demo/",
    caseTitle: "Final Four",
  },
  {
    label: "产品原型",
    title: "让决策在真实界面中发生",
    href: "../fabrica-template-detail-clone/",
    caseTitle: "Fabrica template detail",
  },
];

function requireValue(value, message) {
  if (!value) throw new Error(message);
  return value;
}

async function urlIsReady(url) {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function startViteBackend(project) {
  const viteEntry = path.join(
    project.root,
    "node_modules",
    "vite",
    "bin",
    "vite.js",
  );
  await access(viteEntry);

  const base = `/${project.name}/`;
  const child = spawn(
    process.execPath,
    [
      viteEntry,
      "--host",
      "127.0.0.1",
      "--port",
      String(project.port),
      "--strictPort",
      "--base",
      base,
    ],
    {
      cwd: project.root,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    },
  );
  let serverError = "";
  child.stderr.on("data", (chunk) => {
    serverError += chunk.toString();
  });

  const readyURL = `http://127.0.0.1:${project.port}${base}`;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await urlIsReady(readyURL)) return child;
    if (child.exitCode !== null) {
      throw new Error(
        `${project.name} Vite 服务启动失败：${serverError.trim()}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  child.kill();
  throw new Error(
    `等待 ${project.name} Vite 服务超时：${serverError.trim()}`,
  );
}

function projectForRequest(requestURL, referer) {
  const pathname = new URL(requestURL, deploymentOrigin).pathname;
  const directProject = projects.find(
    (project) =>
      pathname === `/${project.name}` ||
      pathname.startsWith(`/${project.name}/`),
  );
  if (directProject || !referer) return directProject;

  const refererPath = new URL(referer, deploymentOrigin).pathname;
  return projects.find(
    (project) =>
      refererPath === `/${project.name}` ||
      refererPath.startsWith(`/${project.name}/`),
  );
}

function proxyHttpRequest(request, response) {
  if (request.url === "/__health") {
    response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    response.end("ok");
    return;
  }

  if (request.url === "/") {
    response.writeHead(302, { location: "/fungarium-product-showcase/" });
    response.end();
    return;
  }

  const project = projectForRequest(request.url, request.headers.referer);
  if (!project) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not Found");
    return;
  }

  const projectPrefix = `/${project.name}`;
  const upstreamPath =
    request.url === projectPrefix || request.url.startsWith(`${projectPrefix}/`)
      ? request.url
      : `${projectPrefix}${request.url.startsWith("/") ? "" : "/"}${request.url}`;
  const upstream = createProxyRequest(
    {
      hostname: "127.0.0.1",
      port: project.port,
      path: upstreamPath,
      method: request.method,
      headers: {
        ...request.headers,
        host: `127.0.0.1:${project.port}`,
      },
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.headers,
      );
      upstreamResponse.pipe(response);
    },
  );

  upstream.on("error", (error) => {
    if (!response.headersSent) {
      response.writeHead(502, {
        "content-type": "text/plain; charset=utf-8",
      });
    }
    response.end(`Upstream error: ${error.message}`);
  });
  request.pipe(upstream);
}

function proxyWebSocketUpgrade(request, socket, head) {
  const project = projectForRequest(request.url, request.headers.referer);
  if (!project) {
    socket.destroy();
    return;
  }

  const upstream = net.connect(project.port, "127.0.0.1", () => {
    const headerLines = [];
    for (let index = 0; index < request.rawHeaders.length; index += 2) {
      const name = request.rawHeaders[index];
      const value =
        name.toLowerCase() === "host"
          ? `127.0.0.1:${project.port}`
          : request.rawHeaders[index + 1];
      headerLines.push(`${name}: ${value}`);
    }
    upstream.write(
      `${request.method} ${request.url} HTTP/${request.httpVersion}\r\n` +
        `${headerLines.join("\r\n")}\r\n\r\n`,
    );
    if (head.length > 0) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });

  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
}

async function closeDeployment(deployment) {
  await new Promise((resolve) => deployment.proxy.close(resolve));
  for (const child of deployment.backends) {
    child.kill();
  }
}

async function startDeployment() {
  if (await urlIsReady(`${deploymentOrigin}/__health`)) {
    return { external: true, close: async () => {} };
  }

  const backends = [];
  try {
    for (const project of projects) {
      backends.push(await startViteBackend(project));
    }

    const proxy = createServer(proxyHttpRequest);
    proxy.on("upgrade", proxyWebSocketUpgrade);
    await new Promise((resolve, reject) => {
      proxy.once("error", reject);
      proxy.listen(4178, "127.0.0.1", resolve);
    });

    const deployment = { external: false, proxy, backends };
    return {
      external: false,
      close: () => closeDeployment(deployment),
    };
  } catch (error) {
    for (const child of backends) child.kill();
    throw error;
  }
}

function collectRuntimeErrors(page, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(
        `console: ${message.text()} (${message.location().url || "unknown"})`,
      );
    }
  });
  page.on("pageerror", (error) => {
    errors.push(`pageerror: ${error.message}`);
  });
}

async function useWebGlFallback(page) {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "gpu", {
      configurable: true,
      get: () => undefined,
    });
  });
}

async function verifyCaseNavigation(browser, runtimeErrors) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  collectRuntimeErrors(page, runtimeErrors);
  await useWebGlFallback(page);

  try {
    for (const capability of capabilities) {
      await page.goto(deploymentBase, { waitUntil: "networkidle" });
      await page
        .getByRole("region", { name: "能力展品" })
        .getByRole("button", { name: capability.label, exact: true })
        .click();

      const caseLink = page.getByRole("link", { name: "查看案例" });
      const caseHref = await caseLink.getAttribute("href");
      requireValue(
        caseHref === capability.href,
        `${capability.label} 的案例链接不正确：${caseHref}`,
      );
      await access(path.resolve(packageRoot, caseHref));

      const expectedURL = new URL(capability.href, deploymentBase).href;
      const navigationPromise = page.waitForNavigation();
      await caseLink.click();
      const response = await navigationPromise;
      requireValue(response?.ok(), `${capability.label} 案例页面加载失败`);
      requireValue(page.url() === expectedURL, `${capability.label} 导航地址不正确`);
      requireValue(
        (await page.title()).includes(capability.caseTitle),
        `${capability.label} 案例页面标题不正确`,
      );
      requireValue(
        (await page.locator("body").innerText()).trim().length > 50,
        `${capability.label} 案例页面没有加载有效内容`,
      );
    }
  } finally {
    await page.close();
  }
}

async function verify() {
  await mkdir(evidenceDir, { recursive: true });
  const deployment = await startDeployment();
  let browser;

  try {
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const runtimeErrors = [];
    collectRuntimeErrors(page, runtimeErrors);
    await useWebGlFallback(page);

    await page.goto(deploymentBase, { waitUntil: "networkidle" });

    for (const capability of capabilities) {
      await page
        .getByRole("region", { name: "能力展品" })
        .getByRole("button", { name: capability.label, exact: true })
        .click();
      await page
        .getByRole("heading", { name: capability.title })
        .waitFor({ state: "visible" });

      const caseHref = await page
        .getByRole("link", { name: "查看案例" })
        .getAttribute("href");
      requireValue(
        caseHref === capability.href,
        `${capability.label} 的案例链接不正确：${caseHref}`,
      );
      await access(path.resolve(packageRoot, caseHref));
    }

    for (const view of ["概览", "交互", "案例"]) {
      const button = page.getByRole("button", { name: view });
      await button.click();
      requireValue(
        (await button.getAttribute("aria-pressed")) === "true",
        `无法切换到${view}视角`,
      );
    }

    const canvas = page.locator("canvas");
    await canvas.waitFor({ state: "visible" });
    const bounds = requireValue(await canvas.boundingBox(), "找不到可拖动的三维画布");
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width * 0.66,
      bounds.y + bounds.height * 0.42,
      { steps: 10 },
    );
    await page.mouse.up();

    const captureButton = page.getByRole("button", { name: "保存当前画面" });
    await captureButton.waitFor({ state: "visible" });
    requireValue(await captureButton.isEnabled(), "保存当前画面按钮不可用");
    const downloadPromise = page.waitForEvent("download");
    await captureButton.click();
    const download = await downloadPromise;
    requireValue(
      download.suggestedFilename().endsWith(".png"),
      "保存当前画面没有生成 PNG 文件",
    );

    await page.screenshot({
      path: path.join(evidenceDir, "desktop-showroom.png"),
      fullPage: true,
    });

    await verifyCaseNavigation(browser, runtimeErrors);

    if (runtimeErrors.length > 0) {
      throw new Error(`浏览器运行时出现错误：\n${runtimeErrors.join("\n")}`);
    }

    console.log(
      `Showcase verified: ${capabilities.length} capabilities and live case links, 3 views, drag, PNG capture, 0 console/page errors.`,
    );
  } finally {
    await browser?.close();
    await deployment.close();
  }
}

async function serveDeployment() {
  const deployment = await startDeployment();
  const shutdown = async () => {
    await deployment.close();
    process.exit(0);
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
  console.log(`Deployment proxy ready at ${deploymentOrigin}`);
  await new Promise(() => {});
}

const command = process.argv[2];
const task = command === "--serve-deployment" ? serveDeployment() : verify();
task.catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
