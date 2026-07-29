# MengTo Skills Showcase｜可玩产品能力展

这是一个中文优先的产品作品集：保留两个已经可运行的创意交互案例，并规划三个互相补足的 Three.js 产品。它用经批准的 16 个 MengTo Skills 指导 Codex 的开发流程；Skill 不是代码库，也不会自动替我们生成产品。Codex 会先读取适合当前任务的 `SKILL.md`，再实现并验证对应的产品工作。

## 产品矩阵

| 演示 / 产品 | 定位 | 当前可用状态 | 验证记录 |
| --- | --- | --- | --- |
| 雾屿灯塔（Isle of Quiet Signals） | 电影感滚动叙事、2.5D 图层与无障碍 | **已有演示，可运行** | [现有验证记录](../isle-of-quiet-signals/docs/VALIDATION.md) |
| Final Four — Typographic Flags | Canvas 字体排版、指针驱动物理交互 | **已有演示，可运行** | 暂无独立验证记录；以其 README 的构建命令为准 |
| Monster Forge｜怪物铸造所 | 3D 游戏资产目录、模型审阅、动画与来源追踪 | **已实现，可本地运行** | [验证记录](apps/monster-forge/docs/VALIDATION.md) |
| Ashfall Arena｜灰烬竞技场 | 完整网页动作游戏切片：战斗、敌人、AI、成长与存档 | **发布候选；自动验收通过，人工可用性门槛未关闭** | [验证记录](apps/ashfall-arena/docs/VALIDATION.md) |
| Mech Atelier｜机甲定制工坊 | 商业化 3D 产品配置、参数联动、分享与海报导出 | **发布候选；自动验收通过** | [验证记录](apps/mech-atelier/docs/VALIDATION.md) |

前两个是仓库中已有演示；Monster Forge 已实现可审阅的程序化怪物目录、实时检查器和可读回退。Ashfall Arena 已形成可从训练、波次、精英一路打到首领并保存进度的发布候选，自动验收已经通过；8–12 分钟首次人工完成门槛仍待真人验证，因此当前不是 Ready。Mech Atelier 已形成可本地运行的 3D 定制流程，自动验收、生产预览、移动端与 WebGL 回退均已验证；它仍是产品演示，不包含下单、价格或支付承诺。

## 本地运行

### 前置条件

- Node.js 22+（使用 `node --version` 确认）
- npm
- 支持 WebGL 的浏览器；没有 WebGL 时，未来三个产品必须提供如实的静态/信息降级状态

首次进入本套件时：

```powershell
cd mengto-skills-showcase
npm install
```

### 当前基础层可执行命令

以下命令已经在当前基础工作区验证成功：

```powershell
npm run validate
npm test
node scripts/check-selected-skills.mjs
npm run build
git diff --check
```

### 当前可运行：Monster Forge｜怪物铸造所

Monster Forge 已完成本地可运行的 3D 资产审阅流程。它包含四张透明目录 PNG、一个可复用的实时 Three.js 检查器、五个确定性动作、三项技术叠加和 WebGL 回退；完整的浏览器、性能与无障碍证据见[验证记录](apps/monster-forge/docs/VALIDATION.md)。在本套件根目录执行：

```powershell
npm run dev:forge
npm test --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/monster-forge
npm run build --workspace @showcase/monster-forge
```

### 当前可运行：Ashfall Arena｜灰烬竞技场

Ashfall Arena 已实现中文优先的等距视角动作游戏切片，包含键鼠、触控和手柄输入，训练、普通波次、精英、升级、首领、音画反馈、断点重试与本地存档。开发用的 Skill 只指导实现过程，不会被打入生产包。运行和自动验证：

```powershell
npm run dev:arena
npm test --workspace @showcase/ashfall-arena
npm run test:browser --workspace @showcase/ashfall-arena
npm run test:preview --workspace @showcase/ashfall-arena
```

生产检查会真实构建和预览 `dist`，确认入口资源可加载、页面可交互、每个 JavaScript 分包小于 500 KiB，并限制 JavaScript gzip 合计不超过 190 KiB、CSS gzip 合计不超过 8 KiB。自动通关使用固定种子和真实战斗事件，不能替代最终人工试玩计时与主观手感验收。

完整的自动化、性能、包体、三次环境阻塞的首次代理体验尝试及人工门槛见 [Ashfall Arena 验证记录](apps/ashfall-arena/docs/VALIDATION.md)。其中 `47.482s` 和 `50.809s` 是加速审阅测试墙钟时间，不是游戏时长；当前状态是“发布候选 / 自动验收通过，人工可用性门槛未关闭”。

### 当前可运行：Mech Atelier｜机甲定制工坊

Mech Atelier 提供底盘、头部与环境的真实 3D 装配，兼容性提示、可分享状态、海报导出和 WebGL 静态示意回退。运行与验证：

```powershell
npm run dev --workspace @showcase/mech-atelier
npm test --workspace @showcase/mech-atelier
npm run test:browser --workspace @showcase/mech-atelier
npm run build --workspace @showcase/mech-atelier
npm run test:preview --workspace @showcase/mech-atelier
```

验证边界、性能采样和已覆盖场景见 [Mech Atelier 验证记录](apps/mech-atelier/docs/VALIDATION.md)。

已有演示仍在套件外独立运行：

```powershell
cd ../isle-of-quiet-signals
npm install
npm run dev
npm test
npm run build

cd ../world-cup-letter-flags-demo
npm install
npm run dev
npm run build
```

## Skill 源码与安装目录

本项目刻意维护两份用途不同的内容：

1. 本地只读来源（完整上游仓库、可审查、可固定版本）：`skills-source/MengTo-Skills`，即工作区中的 `mengto-skills-showcase/skills-source/MengTo-Skills`。
2. Codex 全局发现目录（按 Skill 单独安装）：`C:\Users\yun68\.codex\skills\<skill-name>`。

来源固定为 `https://github.com/MengTo/Skills.git` 的 `main` 分支，当前完整提交 SHA 记录在 [`config/skill-source-lock.json`](config/skill-source-lock.json)。本地来源让本项目可以审查和复现采用的上游内容；全局安装目录让 Codex 在后续对话中发现相应 Skill。

全局安装会影响**所有 Codex 项目**的 Skill 发现，而不是只影响这个目录。它们是开发操作规范，不是运行时依赖：不会被浏览器加载，**不会进入最终产品包**、部署产物或 `node_modules`。产品代码也不得从 `.codex` 或 `skills-source` 导入内容。

安装和只读审计：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-selected-skills.ps1
node scripts/check-selected-skills.mjs
```

详细的来源、安装保护和审计输出说明见 [Skill 安装与影响说明](docs/skill-installation.md)。

## 已安装 Skills

以下清单是本项目批准安装的全部 16 项。技术标识符保持英文，以便和真实目录、命令与上游文件一致；中文列解释它们为何会被使用。

| Skill | 上游路径 | 产品 ID | 阶段 ID |
| --- | --- | --- | --- |
| `build-isometric-arpg` | `agent-skills/game-development/build-isometric-arpg` | `ashfall-arena` | `foundation` |
| `author-game-levels` | `agent-skills/game-development/author-game-levels` | `ashfall-arena` | `foundation` |
| `build-game-camera-controls` | `agent-skills/game-development/build-game-camera-controls` | `ashfall-arena` | `foundation, mobile` |
| `design-action-combat` | `agent-skills/game-development/design-action-combat` | `ashfall-arena` | `combat` |
| `build-threejs-enemy-systems` | `agent-skills/game-development/build-threejs-enemy-systems` | `ashfall-arena` | `combat` |
| `build-game-monster-system` | `agent-skills/game-development/build-game-monster-system` | `monster-forge` | `assets` |
| `tune-enemy-ai` | `agent-skills/game-development/tune-enemy-ai` | `ashfall-arena` | `combat, validation` |
| `build-game-inventory` | `agent-skills/game-development/build-game-inventory` | `ashfall-arena` | `foundation` |
| `build-hybrid-game-assets` | `agent-skills/game-development/build-hybrid-game-assets` | `monster-forge, ashfall-arena, mech-atelier` | `assets` |
| `build-vesperfall-review-assets` | `agent-skills/game-development/build-vesperfall-review-assets` | `monster-forge` | `assets, validation` |
| `create-game-vfx` | `agent-skills/game-development/create-game-vfx` | `ashfall-arena` | `feedback` |
| `build-game-audio-feedback` | `agent-skills/game-development/build-game-audio-feedback` | `ashfall-arena` | `feedback` |
| `build-mobile-threejs-games` | `agent-skills/game-development/build-mobile-threejs-games` | `ashfall-arena` | `mobile` |
| `optimize-threejs-games` | `agent-skills/game-development/optimize-threejs-games` | `monster-forge, ashfall-arena, mech-atelier` | `performance` |
| `test-playable-web-games` | `agent-skills/game-development/test-playable-web-games` | `monster-forge, ashfall-arena, mech-atelier` | `validation` |
| `ship-web-games` | `agent-skills/game-development/ship-web-games` | `monster-forge, ashfall-arena, mech-atelier` | `release` |

`monster-forge`、`ashfall-arena` 和 `mech-atelier` 是目录/清单 ID；中文产品名分别是怪物铸造所、灰烬竞技场和机甲定制工坊。`foundation`、`assets`、`combat`、`feedback`、`mobile`、`performance`、`validation`、`release` 是开发阶段 ID，中文含义见下一节。

## Skill 对项目的影响

| 开发阶段 | 使用方式与产品效果 |
| --- | --- |
| 资产与审阅 | `build-hybrid-game-assets` 约束共享资产管线；Monster Forge 还使用 `build-game-monster-system` 与 `build-vesperfall-review-assets`，让模型、动画、碰撞体、插槽和来源可被真实审阅。 |
| Arena 基础 | `build-isometric-arpg` 先定义 Ashfall Arena 的可玩循环；再按任务选择 `author-game-levels`、`build-game-camera-controls` 等更窄的 Skill。 |
| 战斗、敌人与成长 | `design-action-combat`、`build-threejs-enemy-systems`、`tune-enemy-ai`、`build-game-inventory` 分别指导动作反馈、敌人状态、难度与成长，不会被同时强行套用。 |
| 反馈、移动端与性能 | `create-game-vfx`、`build-game-audio-feedback`、`build-mobile-threejs-games` 与 `optimize-threejs-games` 分别在相应需求出现时介入。 |
| 验证与发布 | `test-playable-web-games` 负责可复现的试玩旅程；`ship-web-games` 负责发布前的构建、交付和证据。 |
| Mech Atelier | 使用 `build-hybrid-game-assets` 处理共享资产，并在性能、验证和发布阶段使用对应通用规则；它不映射关卡、战斗、敌人、AI、背包、游戏 VFX 或游戏音频 Skill。任何 web-design Skill 都**未批准安装**，只有在需求获得批准并在清单中记录后，才可按精确任务接入。 |

准确的目录到 Skill 路由规则在 [AGENTS.md](AGENTS.md)。它要求先读取最窄范围的 `SKILL.md`，再改代码。

## 更新与卸载

本地来源和全局安装副本**不会自动同步**：更新 `skills-source/MengTo-Skills` 不会更新 `C:\Users\yun68\.codex\skills`，反过来也一样。任何更新都要先审查，再由明确批准的单项操作替换。

更新摘要：确认上游提交 → 更新本地只读来源 → 将完整 SHA 写入 `config/skill-source-lock.json` → 审阅变更 → 备份并逐项替换全局副本 → 在新的 Codex 对话中做只读审计。

可恢复卸载摘要：只定位一个准确的 `C:\Users\yun68\.codex\skills\<skill-name>` 目录 → 移到 `.codex\skills` 以外的备份位置 → 在新的 Codex 对话验证其余 Skill 仍可发现 → 得到明确批准后才删除备份。不要删除整个 `.codex\skills` 目录。

完整的安全边界和恢复步骤见 [Skill 安装与影响说明](docs/skill-installation.md)。

## 验证

每次文档或工作区契约变动后，从 `mengto-skills-showcase` 运行：

```powershell
npm run validate
npm test
node scripts/check-selected-skills.mjs
npm run build
git diff --check
```

`npm run validate` 检查固定的来源、16 项批准清单、中文 README 的关键承诺和 `AGENTS.md` 路由，不依赖会自然变化的记录时间。`node scripts/check-selected-skills.mjs` 是只读审计：它会逐项显示全局目录是否真的有可读的 `SKILL.md`。Ashfall Arena 已启用独立的浏览器与生产预览测试；其他规划中产品仍保留测试入口。

产品验证证据写入 `apps/<product>/docs/VALIDATION.md`。Ashfall Arena 已建立候选验证记录，但没有预填人工完成时间或人工结论；取得有效真人样本后才能更新其人工可用性门槛。
