# MengTo Skills Showcase｜可玩产品能力展

## 先看效果：一条命令打开三产品能力展厅

这个目录展示三款独立产品，它们的能力彼此互补：Monster Forge 用于检查 3D 资产，Ashfall Arena 用于体验可玩的动作游戏系统，Mech Atelier 用于配置复杂 3D 商品。它们不是同一款游戏的三个关卡。

```powershell
npm install
npm run dev
```

终端显示“全部可访问”后，打开 `http://127.0.0.1:4172/`。先在展厅看三款产品的作用，再进入任一产品；产品内的“这是什么？”可重新打开中文说明，“返回能力展厅”会回到对应产品卡。

Skill 是 Codex 开发与验收时读取的工作说明，网页运行时不会加载这些 Skill；最终交付是普通 Vite/Three.js 网页产品。换句话说，Skill 影响 Codex 如何设计、实现和检查产品，但访客打开的仍是普通网页。

## 产品矩阵

| 展厅产品 | 主要作用 | 适合场景 | 验证记录 |
| --- | --- | --- | --- |
| Monster Forge｜怪物铸造所 | 检查怪物模型、动作、骨架、碰撞体和来源 | 游戏资产库、角色编辑器、数字资产验收 | [验证记录](apps/monster-forge/docs/VALIDATION.md) |
| Ashfall Arena｜灰烬竞技场 | 体验战斗、敌人 AI、成长、存档和音画反馈 | 游戏原型、互动营销、战斗系统验证 | [验证记录](apps/ashfall-arena/docs/VALIDATION.md) |
| Mech Atelier｜机甲定制工坊 | 更换部件并观察 3D 外观、参数与分享链接变化 | 汽车选配、工业设备、家具和定制商品 | [验证记录](apps/mech-atelier/docs/VALIDATION.md) |

这三款产品分别展示“资产审阅”“可玩系统”“复杂商品配置”，组合起来说明同一套专业工作说明可以服务不同产品形态。Mech Atelier 中的价格是概念信用点，不代表真实定价，也不包含库存、订单、支付或履约承诺。

三款产品都是本地可运行、可自动检查的候选，但未公开部署。Ashfall 的自动化不能替代首次真人试玩，8–12 分钟人工可用性门槛未关闭；真实设备、GPU 完成时间和公网缓存也没有从本地测试外推为通过。

## 两个独立演示

雾屿灯塔（Isle of Quiet Signals）与 Final Four — Typographic Flags 是套件外的独立演示，不属于能力展厅三产品，也不是第四、第五款展厅产品。它们继续在各自目录独立运行：

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

## 本地运行

### 前置条件

- Node.js 22.12+（使用 `node --version` 确认；底层工具也兼容 Node.js 20.19+）
- npm
- 支持 WebGL 的浏览器；没有 WebGL 时，三个产品会保留如实的静态或信息降级状态

### 一条命令打开四个页面

```powershell
npm install
npm run dev
```

统一启动器固定使用以下本地地址，并在任一端口已被占用时明确失败，不会偷偷换端口：

| 页面 | 地址 |
| --- | --- |
| 能力展厅 | `http://127.0.0.1:4172/` |
| Monster Forge | `http://127.0.0.1:4173/` |
| Ashfall Arena | `http://127.0.0.1:4174/` |
| Mech Atelier | `http://127.0.0.1:4175/` |

结束体验时在启动终端按 `Ctrl+C`；supervisor 会关闭四棵产品进程树并释放 4172–4175。

### 分别运行与验证

```powershell
npm run dev:hub
npm run dev:forge
npm run dev:arena
npm run dev:atelier

npm run test:browser --workspace @showcase/hub
npm run test:browser --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/ashfall-arena
npm run test:browser --workspace @showcase/mech-atelier

npm run build
npm run build:showcase
npm run test:showcase-preview
```

`build:showcase` 会把展厅和三款产品组合到 `dist/showcase/`，使用同一源站和相对链接；这证明本地组合产物可以往返，不等于已经公开部署。

## Skill 源码与安装目录

本项目刻意维护两份用途不同的内容：

1. 本地只读来源（完整上游仓库、可审查、可固定版本）：`skills-source/MengTo-Skills`，即工作区中的 `mengto-skills-showcase/skills-source/MengTo-Skills`。
2. Codex 全局发现目录（按 Skill 单独安装）：`C:\Users\yun68\.codex\skills\<skill-name>`。

来源固定为 `https://github.com/MengTo/Skills.git` 的 `main` 分支，当前完整提交 SHA 记录在 [`config/skill-source-lock.json`](config/skill-source-lock.json)。本地来源让本项目可以审查和复现采用的上游内容；全局安装目录让 Codex 在后续对话中发现相应 Skill。

全局安装会影响**所有 Codex 项目**的 Skill 发现，而不是只影响这个目录。它们是开发操作规范，不是运行时依赖：不会被浏览器加载，**不会进入最终产品包**、部署产物或 `node_modules`。产品代码也不得从 `.codex` 或 `skills-source` 导入内容。

本项目代码位于当前 `mengto-skills-showcase` 套件目录；安装 Skill 不会把项目源码写进 `C:\Users\yun68\.codex\skills`，项目也不会修改 Codex 根目录中的 Skill 文件。

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

`npm run validate` 检查固定的来源、动态读取的批准清单、四应用/六共享包、中文 README 的关键承诺和 `AGENTS.md` 路由，不依赖会自然变化的测试总数或候选 SHA。`node scripts/check-selected-skills.mjs` 是只读审计：它会逐项显示全局目录是否真的有可读的 `SKILL.md`。

产品验证证据写入 `apps/<product>/docs/VALIDATION.md`，套件级证据写入 `docs/SHOWCASE-VALIDATION.md`。历史候选和本轮命令会分别标注；没有执行的命令、真人理解、真实设备和公开部署不会写成通过。
