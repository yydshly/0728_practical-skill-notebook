# 《雾村：逃离》README 真实发布整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用三张当前浏览器证据、准确的双层 README、可解析的来源链和恢复后的第 07 项索引，把《雾村：逃离》整理并推送到远端 `main`。

**Architecture:** 现有游戏运行时代码保持不变；文档测试先固定事实合同，再分别修正项目内层说明与根 README 展示。三张 1280×720 PNG 从合并后的真实 Vite 页面采集并由根 README 与项目 README 共用，最终以完整 Node、音频、Chromium、构建和根仓库测试作为推送门禁。

**Tech Stack:** Markdown、Node.js `node:test`、Vite、Three.js、Playwright Chromium、Git

## Global Constraints

- 不修改 `rural-mutation-escape/src/`、玩法、画面、模型、音频或运行时逻辑。
- 根 README 的第 01–05 项内容保持不变；第 06 项继续是《雾村：逃离》；只恢复已有的第 07 项索引、章节和 GIF。
- 三张新图必须来自最终待提交的本地页面，统一为 1280×720 PNG，不使用概念图或外部画面。
- 截图是三个确定性浏览器证据场景，不宣传为连续无剪辑通关。
- 南门必须描述为中心半径 4.5 米的静态出口触发区；不得声称动态开门、门碰撞或门外结算线已经实现。
- `threaten` 不得描述为攻击或捕获；当前没有失败、检查点、感知 AI、伤害或重试。
- 来源说明必须区分上游提交 `d9b237b...`、原独立仓库记录 `3f704...`、subtree 基线 `4cb1e700...` 和整合提交 `c1a01ac...`。
- 不提交 `.superpowers/`、根 `test-results/`、忽略的 `claude-of-duty-research/`、其工作树或保存中的旧 README stash/补丁。
- 不创建 tag、release、部署或 Pull Request；全部门禁通过后只推送本地 `main` 到 `origin/main`。

---

## File Structure

### Create

- `tests/readme-release.test.mjs`：单独约束第 06/07 项根索引、两层 README 的共享演示路径和 PNG 格式。
- `docs/demos/06-rural-radio-interaction.png`：收音机交互与任务引导证据。
- `docs/demos/06-rural-pursuit-danger.png`：追逐者保持间距与近身威胁 HUD 证据。
- `docs/demos/06-rural-south-gate.png`：静态南门出口触发区的章节完成证据。

### Modify

- `tests/rural-mutation-escape-migration.test.mjs`：固定内部 README、来源链和未实现边界的事实合同。
- `rural-mutation-escape/README.md`：修正操作、相机、碰撞、追逐、南门、音频和验证说明，并嵌入共享演示。
- `rural-mutation-escape/docs/REFERENCES.md`：区分四类提交/迁移标识及可解析性。
- `README.md`：为第 06 项加入三图展示，并恢复第 07 项目录和章节。

### Preserve

- `rural-mutation-escape/src/**`：本轮不得修改。
- `rural-mutation-escape/artifacts/**`：保留为历史阶段证据，不覆盖或重新命名。
- `docs/demos/07-mengto-skills-showcase.gif`：复用既有 GIF，不重新生成。
- `.superpowers/`、`test-results/`、`claude-of-duty-research/` 与 stash：保持现状。

---

### Task 1: 固定并修正项目内部事实

**Files:**

- Modify: `tests/rural-mutation-escape-migration.test.mjs`
- Modify: `rural-mutation-escape/README.md`
- Modify: `rural-mutation-escape/docs/REFERENCES.md`

**Interfaces:**

- Consumes: `src/camera-pointer-input.js` 的 pointer-lock/拖动分支、`src/level.js` 的 `cameraOccluders`、`src/level-data.js` 的 `south_gate_exit.radius`、`src/pursuer.js` 的状态阈值、`src/audio-lifecycle.js` 的页面生命周期。
- Produces: 供 Task 2 嵌入演示的真实项目 README 骨架，以及根仓库可自动检查的来源/能力合同。

- [ ] **Step 1: 扩展内部 README 的失败合同**

在 `project README is complete and distinguishes shipped from planned behavior` 的 `assertIncludesAll` 数组中加入：

```js
"默认第三人称、可切换第一人称",
"左键点击游戏画面请求指针锁定",
"锁定成功后移动鼠标即可环顾",
"若锁定失败，则按住左键拖动环顾",
"中心半径 4.5 米的出口触发区",
"主循环仍继续运行",
"可见建筑遮挡 mesh",
"buildStructure()",
"距离阈值状态机",
"不造成攻击或捕获",
"BFCache",
"pagehide",
"pageshow",
```

并在同一测试中加入两个负断言：

```js
assert.ok(
  !readme.includes("只移动鼠标而不按住画面不会旋转镜头"),
  "README must distinguish pointer-lock movement from drag fallback",
);
assert.ok(
  !readme.includes("镜头遮挡则只读取标记为 `blocksCamera`"),
  "README must not claim camera occlusion reads blocksCamera",
);
```

在 `reference document pins the upstream and the independent implementation boundary` 的必需值中加入：

```js
"3f7041737d1d6ba09435e622a14482de7b5c7818",
"当前仓库不保证可直接解析",
"4cb1e7006664057897cb1140f2f043dc0d002cb0",
"git-subtree-split",
"c1a01ac55b315329e20b29766ed631090f62eab3",
"整合提交",
```

- [ ] **Step 2: 运行聚焦测试并确认 RED**

Run:

```powershell
node --test tests\rural-mutation-escape-migration.test.mjs
```

Expected: FAIL；至少报告项目 README 缺少“默认第三人称、可切换第一人称”或来源文档缺少 `4cb1e700...`。若测试在文档修改前通过，先检查断言是否实际加入了对应测试。

- [ ] **Step 3: 修正项目 README 的首屏、流程和操作**

把首句收紧为：

```markdown
一个以黄昏农村、居民躲藏和突发变异为背景的桌面浏览器逃生序章原型；默认第三人称、可切换第一人称。当前版本可完成一条四步线性调查路线，但还不是包含失败与重试的完整游戏。
```

把当前路线的完成条件写为：

```markdown
当前固定版本可以从主角家出发，调查收音机、寻找躲藏的邻居、取得粮仓旁的手电，并在取得手电后进入南门中心半径 4.5 米的出口触发区完成序章。南门目前是开放式静态景物；章节完成后主循环与追逐仍继续运行。
```

用以下操作说明替换原鼠标行和“只移动鼠标”段落：

```markdown
| 左键点击游戏画面 | 请求指针锁定 |
| 指针锁定成功后移动鼠标 | 环顾；按 `Esc` 由浏览器释放指针锁定 |
| 若指针锁定失败 | 按住左键拖动环顾 |

当前游戏没有暂停菜单。`Esc` 只用于浏览器释放指针锁定，不会暂停游戏。
```

第一人称说明仅写“切换相机 pose”，不得声称隐藏玩家 rig 或提供完整 FPS 呈现。

- [ ] **Step 4: 修正碰撞、相机、追逐和音频技术说明**

将共享碰撞段落改为：

```markdown
`src/collision.js` 提供 box/circle 碰撞和滑动求解，`src/player.js` 与 `src/pursuer.js` 分别使用同一组由关卡数据生成的静态 world collider。建筑、院墙、路障和路灯杆会阻挡人物；玩家与追逐者之间没有通用实体互撞或推挤系统，南门景物也没有动态 gate collider。
```

将相机遮挡说明改为：

```markdown
`src/camera.js`、`src/camera-math.js` 和 `src/camera-pointer-input.js` 负责跟随、视角切换、俯仰/偏航限制和 pointer-lock/拖动回退。第三人称镜头对 `buildStructure()` 暴露的可见建筑遮挡 mesh 做 raycast 收缩；它不读取静态角色碰撞体的 `blocksCamera` 标记。
```

将追逐状态说明改为：

```markdown
`src/pursuer.js` 当前是单敌人的距离阈值状态机，并沿少量导航点巡逻。`lost` 是回到巡逻前的短暂过渡；`threaten` 表示近距停步、朝向玩家并保持约 2.2–2.4 米间距，不造成攻击或捕获。`src/danger.js` 只根据追逐状态和距离输出危险标签、画面强度与心跳速度。
```

将音频生命周期说明改为：

```markdown
`src/audio-lifecycle.js` 串行协调 `visibilitychange` 引发的暂停与恢复；BFCache 的持久 `pagehide/pageshow` 会保留监听并恢复音频，非持久 `pagehide` 才执行终止清理。快速隐藏/恢复或单次音频操作失败不会让后续协调永久卡死。
```

同步更新能力表和“已知限制”，保持“无失败/重试、无攻击/捕获、静态南门、完成后不停机”的边界一致。

- [ ] **Step 5: 修正来源文档的迁移链**

把 `docs/REFERENCES.md` 的上游列表扩展为：

```markdown
- 仓库：<https://github.com/mshumer/Claude-of-Duty>
- 固定基准提交：`d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853`
- 上游许可证：MIT
- 原独立项目迁移记录：`3f7041737d1d6ba09435e622a14482de7b5c7818`；当前仓库不保证可直接解析该对象
- 当前仓库 `git-subtree-split` 导入基线：`4cb1e7006664057897cb1140f2f043dc0d002cb0`
- 合入当前仓库 `main` 的整合提交：`c1a01ac55b315329e20b29766ed631090f62eab3`
```

把“原创”表述收紧为：

```markdown
仓库中的项目代码、确定性生成脚本和 manifest 将这些内容声明并记录为独立程序化实现；本地技术审计用于验证可追溯性，不替代法律权利判断。
```

- [ ] **Step 6: 运行聚焦测试并确认 GREEN**

Run:

```powershell
node --test tests\rural-mutation-escape-migration.test.mjs
git diff --check
```

Expected: migration 测试全部 PASS；`git diff --check` 无输出。

- [ ] **Step 7: 审查并提交内部事实修正**

Run:

```powershell
git diff -- rural-mutation-escape/README.md rural-mutation-escape/docs/REFERENCES.md tests/rural-mutation-escape-migration.test.mjs
git status --short
```

Expected: 只出现这三个受控文件，以及原有未跟踪 `.superpowers/`、`test-results/`。

Commit:

```powershell
git add -- tests/rural-mutation-escape-migration.test.mjs rural-mutation-escape/README.md rural-mutation-escape/docs/REFERENCES.md
git commit -m "docs: correct rural escape project facts"
```

---

### Task 2: 采集并发布三张共享演示，恢复第 07 项

**Files:**

- Create: `tests/readme-release.test.mjs`
- Create: `docs/demos/06-rural-radio-interaction.png`
- Create: `docs/demos/06-rural-pursuit-danger.png`
- Create: `docs/demos/06-rural-south-gate.png`
- Modify: `README.md`
- Modify: `rural-mutation-escape/README.md`

**Interfaces:**

- Consumes: Task 1 的准确项目口径；`?evidence=birth`、`?evidence=contact`、`?evidence=south-gate` 三个受 smoke 测试约束的浏览器状态；既有 `docs/demos/07-mengto-skills-showcase.gif`。
- Produces: 根仓库可直接观看的第 06 项三图序列，以及不会再误删第 07 项的独立索引测试。

- [ ] **Step 1: 新建根 README 与 PNG 的失败合同**

创建 `tests/readme-release.test.mjs`：

```js
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const demoNames = [
  "06-rural-radio-interaction.png",
  "06-rural-pursuit-danger.png",
  "06-rural-south-gate.png",
];

async function read(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

async function assertReadmePng(name) {
  const relativePath = path.join("docs", "demos", name);
  const image = await readFile(path.join(repoRoot, relativePath));
  assert.ok(image.length > 10_000, `${name} must contain a readable screenshot`);
  assert.ok(image.length < 2_000_000, `${name} must stay below 2 MiB`);
  assert.ok(image.subarray(0, 8).equals(pngSignature), `${name} must be PNG`);
  assert.equal(image.toString("ascii", 12, 16), "IHDR");
  assert.equal(image.readUInt32BE(16), 1280, `${name} width`);
  assert.equal(image.readUInt32BE(20), 720, `${name} height`);
}

test("rural README evidence uses three valid 1280x720 PNG files", async () => {
  for (const name of demoNames) await assertReadmePng(name);
});

test("root and project READMEs share the rural evidence sequence", async () => {
  const rootReadme = await read("README.md");
  const projectReadme = await read("rural-mutation-escape/README.md");
  for (const name of demoNames) {
    assert.ok(rootReadme.includes(`./docs/demos/${name}`), `root README missing ${name}`);
    assert.ok(projectReadme.includes(`../docs/demos/${name}`), `project README missing ${name}`);
  }
  for (const phrase of [
    "三个确定性浏览器证据场景",
    "不代表攻击或捕获 AI",
    "不展示动态开门",
  ]) {
    assert.ok(rootReadme.includes(phrase), `root README missing boundary: ${phrase}`);
  }
});

test("root README keeps project 06 and restores the tracked project 07", async () => {
  const rootReadme = await read("README.md");
  for (const required of [
    "| 06 | [《雾村：逃离》](./rural-mutation-escape/)",
    "## 06 · 《雾村：逃离》",
    "| 07 | [MengTo Skills 三产品能力展](./mengto-skills-showcase/)",
    "## 07 · MengTo Skills 三产品能力展",
    "./docs/demos/07-mengto-skills-showcase.gif",
    "./mengto-skills-showcase/README.md",
    "./mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md",
  ]) {
    assert.ok(rootReadme.includes(required), `root README missing: ${required}`);
  }
  assert.equal([...rootReadme.matchAll(/^## 06 ·/gm)].length, 1);
  assert.equal([...rootReadme.matchAll(/^## 07 ·/gm)].length, 1);
  assert.ok(!rootReadme.includes("./claude-of-duty-research/"));
  await access(path.join(repoRoot, "docs", "demos", "07-mengto-skills-showcase.gif"));
  await access(path.join(repoRoot, "mengto-skills-showcase", "README.md"));
});
```

- [ ] **Step 2: 运行新测试并确认 RED**

Run:

```powershell
node --test tests\readme-release.test.mjs
```

Expected: FAIL with `ENOENT` for `06-rural-radio-interaction.png` or a missing README path; this proves the test is exercising the new release evidence.

- [ ] **Step 3: 启动受控页面并采集收音机交互图**

Start the Vite server from `rural-mutation-escape/` on a strict dedicated port:

```powershell
npm.cmd run dev -- --host 127.0.0.1 --port 5190 --strictPort
```

Using the in-app browser or Playwright Chromium:

1. Set the viewport to 1280×720.
2. Open `http://127.0.0.1:5190/?evidence=birth`.
3. Wait for `.game-shell[data-evidence-state="birth"]` and positive WebGL renderer data.
4. Focus the game and hold `D` for about 450 ms; with the authored initial camera yaw this moves from `player_home` toward the radio.
5. Wait until the visible prompt contains `E` and `调查收音机`.
6. Capture the viewport to `docs/demos/06-rural-radio-interaction.png`.

Expected: task 1/4, radio guidance, player, house light and the `E` interaction prompt are readable; no intro layer covers the game.

- [ ] **Step 4: 采集追逐和南门图**

With the same 1280×720 browser:

1. Open `http://127.0.0.1:5190/?evidence=contact`.
2. Wait for `.game-shell[data-evidence-state="contact"]`, `任务 4/4` and `近身威胁`.
3. Capture `docs/demos/06-rural-pursuit-danger.png`.
4. Open `http://127.0.0.1:5190/?evidence=south-gate`.
5. Wait for `.game-shell[data-evidence-state="south-gate"]` and `第一章完成`.
6. Capture `docs/demos/06-rural-south-gate.png`.
7. Stop only the Vite process started for port 5190.

Expected: the pursuit image keeps player and pursuer visibly separated; the completion image shows the static south gate and completed HUD. No image may imply an opening animation.

- [ ] **Step 5: 人工检查三张图片**

Open all three images at original detail and check:

- exact 1280×720 dimensions;
- Chinese glyphs are intact;
- no browser chrome, error overlay, blank canvas or debug console;
- player and pursuer do not overlap;
- interaction, threat and completion states match their captions;
- no image contains private filesystem paths or unrelated tabs.

If a check fails, recapture only that image from the same evidence state before editing README.

- [ ] **Step 6: 在项目 README 嵌入共享演示**

在“当前状态”后加入：

```markdown
## 当前效果

以下是从当前合并版本重新采集的三个确定性浏览器证据场景，不是一段无剪辑连续通关。

收音机交互：任务卡、目标导引和 `E` 提示共同说明当前交互边界。

<img src="../docs/demos/06-rural-radio-interaction.png" alt="雾村收音机任务与 E 交互提示" width="720">

追逐威胁：近身 HUD 和保持间距的变异体来自距离状态机，不代表攻击或捕获 AI。

<img src="../docs/demos/06-rural-pursuit-danger.png" alt="雾村追逐者和近身威胁反馈" width="720">

序章完成：进入静态南门出口触发区后自动完成，不展示动态开门、门碰撞或门外结算线。

<img src="../docs/demos/06-rural-south-gate.png" alt="雾村静态南门与第一章完成状态" width="720">
```

- [ ] **Step 7: 在根 README 完成第 06 项三图展示**

保留第 06 项当前定位与四步路线说明，在项目链接前加入：

```markdown
以下是从当前合并版本重新采集的三个确定性浏览器证据场景，不是一段无剪辑连续通关。

收音机交互与任务引导：

<img src="./docs/demos/06-rural-radio-interaction.png" alt="雾村收音机任务与 E 交互提示" width="720">

追逐与近身威胁；展示距离状态机，不代表攻击或捕获 AI：

<img src="./docs/demos/06-rural-pursuit-danger.png" alt="雾村追逐者和近身威胁反馈" width="720">

静态南门出口触发区的序章完成状态；不展示动态开门、门碰撞或门外结算线：

<img src="./docs/demos/06-rural-south-gate.png" alt="雾村静态南门与第一章完成状态" width="720">
```

- [ ] **Step 8: 恢复根 README 的第 07 项**

在演示目录表的第 06 项后加入：

```markdown
| 07 | [MengTo Skills 三产品能力展](./mengto-skills-showcase/) | `mengto-skills-showcase` | 用固定、可审计的 MengTo Skills 工作流，完成 3D 资产审阅、等距动作游戏与复杂商品配置三款独立产品，并由统一中文展厅串联体验与验证。 |
```

在第 06 项之后、获取仓库命令之前恢复：

````markdown
## 07 · MengTo Skills 三产品能力展

这是一个统一中文 Showcase Hub 加三款独立 Three.js 产品的能力展：Monster Forge 审阅怪物资产，Ashfall Arena 展示可玩的动作游戏系统，Mech Atelier 配置复杂 3D 商品。仓库中有四个可运行应用、三款产品；Hub 是解释和导航入口，不是独立的第四个产品。

<img src="./docs/demos/07-mengto-skills-showcase.gif" alt="MengTo Skills 三产品能力展的四阶段演示" width="720">

- **Monster Forge：** 检查模型、动作、骨架、碰撞体、插槽和来源。
- **Ashfall Arena：** 体验等距移动、战斗、敌人 AI、成长、存档与音画反馈。
- **Mech Atelier：** 更换机甲部件，观察兼容性、价格、重量、性能和分享状态。

方法与工作流参考 [MengTo Skills](https://github.com/MengTo/Skills)，本项目实际审查和安装的版本固定为 [`93da48f13fb1b91bdbf4718d0f49df1a469edb45`](https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45)。[Vesperfall](https://vesperfall.mengto.chatgpt.site/) 仅作为关联效果参考。

Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。

Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。

```powershell
cd mengto-skills-showcase
npm install
npm run dev
```

四个本地应用就绪后打开 `http://127.0.0.1:4172/`。组合生产构建使用 `npm run build:showcase`；当前未公开部署，没有线上产品地址。

- [完整项目说明](./mengto-skills-showcase/README.md)
- [套件验证账本](./mengto-skills-showcase/docs/SHOWCASE-VALIDATION.md)
````

不得恢复旧的“第 06 项 Claude of Duty 技术研究”占位；当前第 06 项已经是已跟踪的《雾村：逃离》。

- [ ] **Step 9: 运行演示与索引测试并确认 GREEN**

Run:

```powershell
node --test tests\readme-release.test.mjs
node --test tests\rural-mutation-escape-migration.test.mjs
git diff --check
```

Expected: 两个测试文件全部 PASS；`git diff --check` 无输出。

- [ ] **Step 10: 审查并提交演示发布**

Run:

```powershell
git diff -- README.md rural-mutation-escape/README.md tests/readme-release.test.mjs
git status --short
```

Expected: 只出现两个 README、新测试、三张 PNG，以及原有未跟踪 `.superpowers/`、`test-results/`。

Commit:

```powershell
git add -- README.md rural-mutation-escape/README.md tests/readme-release.test.mjs docs/demos/06-rural-radio-interaction.png docs/demos/06-rural-pursuit-danger.png docs/demos/06-rural-south-gate.png
git commit -m "docs: publish rural escape README evidence"
```

---

### Task 3: 运行完整发布验证并记录真实结果

**Files:**

- Modify: `tests/rural-mutation-escape-migration.test.mjs`
- Modify: `rural-mutation-escape/README.md`

**Interfaces:**

- Consumes: Task 1 的事实口径、Task 2 的三张演示和恢复后的根索引。
- Produces: 带日期、命令、真实计数和构建警告边界的发布验证快照。

- [ ] **Step 1: 运行项目完整验证**

Run from `rural-mutation-escape/`:

```powershell
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd test
npm.cmd run build
```

Expected:

- unit：150/150 PASS；
- audio：17/17 PASS；
- `npm.cmd test`：unit、audio 与完整 Playwright Chromium smoke 全部通过；
- build：Vite 生产构建成功；
- 允许唯一既有非阻断警告：生产 JavaScript chunk 约 566 kB，大于默认 500 kB 提示线。

若数量、失败项或警告类型不同，停止发布，先保存原始输出并调查；不得把预期值直接写入 README。

- [ ] **Step 2: 运行根仓库完整验证**

Run from repository root:

```powershell
node --test tests\*.test.mjs
git diff --check
```

Expected: 加入三个 `readme-release` case 后共 14/14 PASS；`git diff --check` 无输出。

- [ ] **Step 3: 为真实验证快照增加失败合同**

在项目 README 测试的 `assertIncludesAll` 中加入：

```js
"### 2026-07-30 发布核验",
"150/150",
"17/17",
"Chromium smoke",
"14/14",
"约 566 kB",
"非阻断警告",
```

Run:

```powershell
node --test tests\rural-mutation-escape-migration.test.mjs
```

Expected: FAIL because the release verification heading is not yet present.

- [ ] **Step 4: 写入本轮真实验证快照**

在 `rural-mutation-escape/README.md` 的“测试、音频与构建”命令说明之后加入：

```markdown
### 2026-07-30 发布核验

- `npm.cmd run test:unit`：150/150 条 Node 测试记录通过。
- `npm.cmd run test:audio`：17/17 条音频资产测试记录通过。
- `npm.cmd test`：单元、音频与完整 Chromium smoke 脚本通过。
- `npm.cmd run build`：Vite 生产构建通过；仍有约 566 kB JavaScript chunk 大于 500 kB 提示线的非阻断警告。
- 根仓库 `node --test tests\*.test.mjs`：14/14 条测试记录通过。
```

这里的 `Chromium smoke` 是一支脚本式验收，不得改写成多个 `node:test` case。

- [ ] **Step 5: 再次验证快照合同**

Run:

```powershell
node --test tests\rural-mutation-escape-migration.test.mjs
node --test tests\*.test.mjs
git diff --check
```

Expected: migration 与根仓库测试全部 PASS；无 whitespace error。

- [ ] **Step 6: 提交验证快照**

Run:

```powershell
git diff -- tests/rural-mutation-escape-migration.test.mjs rural-mutation-escape/README.md
git status --short
```

Commit:

```powershell
git add -- tests/rural-mutation-escape-migration.test.mjs rural-mutation-escape/README.md
git commit -m "docs: record rural escape release verification"
```

Expected: 提交只含测试合同和内部 README 的实际结果。

---

### Task 4: 最终审计并推送 `main`

**Files:**

- No file changes expected.

**Interfaces:**

- Consumes: Tasks 1–3 的三个已审查提交和设计/计划提交。
- Produces: 与本地已验证 HEAD 完全一致的 `origin/main`。

- [ ] **Step 1: 使用完成前验证规范复核最终状态**

Invoke `superpowers:verification-before-completion`, then run:

```powershell
git status --short
git log -6 --oneline --decorate
git diff --check origin/main...HEAD
git stash list
```

Expected:

- 工作树只显示原有未跟踪 `.superpowers/`、`test-results/`；
- README 旧内容备份 stash 仍存在且未应用；
- 没有 `rural-mutation-escape/src/**` 变更；
- 最近提交依次包括设计、内部事实修正、演示发布和验证快照。

- [ ] **Step 2: 验证截图和 README 最终渲染**

逐张以 original detail 打开：

```text
docs/demos/06-rural-radio-interaction.png
docs/demos/06-rural-pursuit-danger.png
docs/demos/06-rural-south-gate.png
```

同时检查根 README 和项目 README 的图片顺序、caption、相对路径、第 06/07 项编号和 Markdown code fence。任何断图、乱码、重叠人物或越界声明都阻止推送。

- [ ] **Step 3: 获取远端最新状态**

Run:

```powershell
git fetch origin main
git rev-list --left-right --count origin/main...main
```

Expected: 左侧为 `0`，表示远端没有本地缺失的新提交；右侧为本地待发布提交数。若左侧不为 `0`，停止并先审查远端变化，不强推。

- [ ] **Step 4: 最后一次执行门禁**

Run:

```powershell
cd rural-mutation-escape
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd test
npm.cmd run build
cd ..
node --test tests\*.test.mjs
git diff --check
```

Expected: 与 Task 3 相同；不得用旧输出替代本次结果。

- [ ] **Step 5: 推送并核对远端 HEAD**

Run:

```powershell
git push origin main
git rev-parse HEAD
git ls-remote origin refs/heads/main
```

Expected: push succeeds；`git ls-remote` 返回的 hash 与本地 `git rev-parse HEAD` 完全一致。

- [ ] **Step 6: 发布后状态检查**

Run:

```powershell
git status --short
git rev-list --left-right --count origin/main...main
```

Expected:

- ahead/behind 为 `0 0`；
- 只保留原有未跟踪 `.superpowers/`、`test-results/`；
- 远端 feature branch 未删除；
- 未创建 tag、release、部署或 PR。
