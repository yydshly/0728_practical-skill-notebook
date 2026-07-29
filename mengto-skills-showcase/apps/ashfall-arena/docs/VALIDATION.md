# Ashfall Arena｜灰烬竞技场：发布候选验证记录

## 当前结论与验证边界

- Task 9 基线为 `97991ccbc33184aa6b01e0733e5917b5e76f7a34`（`fix: unlock Ashfall audio from focused gameplay keys`），最终门禁/状态候选为 `f2ac76ead8f0d0d2658330fa34134d479eedcfe6`。
- 下表中明确标为“本轮新鲜”的 Ashfall onboarding、unit、functional、performance、preview、bundle 预算与差异检查来自 2026-07-29 对本轮候选的全新串行重跑。根工作区、Skill 安装器、工作区契约、Skill 只读审计和依赖审计只保留前序历史结果，并明确标注本轮未重跑，供 Task 13 统一终验；不把它们冒充为本轮证据。
- 当前状态：**发布候选 / 自动验收通过，人工可用性门槛未关闭**。
- 8–12 分钟首次人工完成门槛：**待人工验证**。没有有效的首次人工完成时长，也没有可计算的中位数。
- 本记录证明的是本地开发服务、自动化浏览器旅程和本地生产预览；本任务没有部署到公网，也没有验证线上 CDN、缓存或真实移动设备。
- 自动化加速审阅使用确定性手动时钟；它证明完整状态机和战斗路径可达，**不是人工游戏时长**，不得用于关闭 8–12 分钟人工门槛。

## 验证环境

| 项目 | 值 |
| --- | --- |
| 操作系统 | Microsoft Windows NT `10.0.26200.0` |
| Node.js | `v22.15.0` |
| npm | `10.9.2` |
| Playwright | `1.62.0`，捆绑 Chromium、无头模式 |
| 候选工作区 | `codex/showcase-hub-onboarding` 分支，Task 9 最终候选 `f2ac76ead8f0d0d2658330fa34134d479eedcfe6` |
| 自动通关入口 | `/?fixture=fresh&seed=7481&reviewControls=1` |
| 生产验证入口 | Vite `dist` 本地 preview；默认使用独占严格端口 `4184` |

本轮新鲜 Ashfall 数字来自同一 Task 9 工作树状态；标为前序历史证据的行保留原候选记录，等待 Task 13 重跑。

## 自动化门槛与结果

| 门槛 | 结果 |
| --- | --- |
| Ashfall onboarding 聚焦矩阵 | 初始 Task 9 RED：`21` 项中 `15` 通过、`6` 按预期失败；审查修复 RED：sequence 用例 `2/2` 按预期以 `:4` 失败；最终 GREEN：`22/22` 通过（`26.9s`） |
| Ashfall 单元测试 | `16` 个文件，`312/312` 通过（`1.09s`） |
| Ashfall 开发服务浏览器全套 | 严格串行启动两个独立 Playwright 进程：普通功能矩阵 `63/63`（`2.5m`），独占性能矩阵 `5/5`（`24.2s`），合计 `68/68` |
| 根工作区测试 | 前序历史证据，本轮未重跑：`37` 个文件，`450/450` 通过 |
| Ashfall 生产预览 | 先重新构建并检查包体预算，再以 `dist` 运行；`1/1` 通过 |
| Skill 安装器回归 | 前序历史证据，本轮未重跑：`4/4` 通过 |
| 根工作区构建 | 前序历史证据，本轮未重跑；本轮只执行 Ashfall production build |
| 工作区契约 | 前序历史证据，本轮未重跑：`npm run validate` 通过 |
| Skill 只读审计 | 前序历史证据，本轮未重跑：批准的 `16/16` 项均存在可读 `SKILL.md` |
| 依赖审计 | 前序历史证据，本轮未重跑：`npm audit` 为 `0 vulnerabilities` |
| 差异检查 | 本轮新鲜：`git diff --check` 与 staged diff-check 均通过 |
| 候选提交 | `f2ac76ead8f0d0d2658330fa34134d479eedcfe6`；Task 9 范围为 `97991cc…` 基线之后到该提交 |

本轮实际验证命令从套件根目录 `mengto-skills-showcase` 或所示 Ashfall 目录严格串行执行：

```powershell
npm test --workspace @showcase/ashfall-arena

cd apps/ashfall-arena
$env:ASHFALL_PLAYWRIGHT_PORT='4194'
npx playwright test --config playwright.config.ts onboarding-guide.spec.ts --grep "window review writes"
npx playwright test --config playwright.config.ts onboarding-guide.spec.ts
npx playwright test --config playwright.config.ts
$env:ASHFALL_PERFORMANCE_PORT='4195'
npx playwright test --config playwright.performance.config.ts
cd ../..

npm run test:preview --workspace @showcase/ashfall-arena

git diff --check
git status --porcelain=v1
```

Playwright 的服务配置使用 `--strictPort` 且不复用已有服务。普通浏览器矩阵和 `release-performance.spec.ts` 严格串行运行，各自创建新的浏览器与 Vite 服务；本轮成功运行使用 `4194` 和 `4195`，测试完成后服务退出。这样性能采样不承受前 `63` 项在长期浏览器/GPU 进程中的累积影响，所有既有性能阈值和超时保持不变。

## Task 9 导览状态与生命周期证据

- pause、upgrade、defeated、complete 四种既有 modal 均与产品导览排他：请求导览时页面始终只有一个打开的 dialog；恢复战斗、选择真实升级、从检查点重试或确认新开一局后，导览分别可手动打开或完成 pending 自动重试。
- 连续 `5` 次关闭/重开导览后，深拷贝的可序列化 `GameState`、`ashfall-arena:v1` 原始保存字符串、listener registration 数均与之前完全相同；`.showcase-guide-dialog` 与 `.showcase-guide-trigger` 始终各只有 `1` 个。
- `guideGateOpen` 为 true 时，`advanceInput`、`triggerCameraShake`、`queueEnemyMove`、`drivePlayerDodge`、`drivePlayerStrike`、`drivePlayerDefeat`、`retryLatestCheckpoint` 以及 `window.__review` 的三个写入口都以 `guide gate is open` 拒绝；拒绝发生在读取状态、分配 attack ID 或任何副作用之前，权威状态保持不变，关闭导览后的首次合法 player-hit / set-health ID 仍分别以 `review:player-hit:1` / `review:set-health:1` 开始。只读 snapshot、`getSerializableState`、`resetPerformanceSamples` 和测试设置所需的 `setManualReviewClock` 保持可用。
- localStorage getter 抛出 `SecurityError` 时，导览仍能自动打开、关闭并手动重开；返回能力展厅保持没有 `target` 的普通同标签页链接，并保留 `#product-ashfall-arena` 锚点。
- WebGL fallback 在禁用旧游戏控件后创建独立导览；导览按钮、复选框和返回链接可用，而模拟、输入采样、RAF、音频上下文和表现时钟均未启动。诊断固定报告 information-fallback、`guideGateOpen=false`、`inputSampleCount=0`、`contextState=not-created`。
- live pagehide 的实际顺序是设置 disposed、取消 RAF，再依次销毁 input、audio、guide；fallback pagehide 则先销毁其独立 guide，再清理其余拥有的资源。两者的 disposal snapshot 都报告 `disposed=true`、`guideGateOpen=false`、`recoveryFrames=0`，诊断 API 和导览 DOM 均已移除，且都没有调用普通 close 恢复分支。
- Task 8 的音频 trigger/gameplay 键矩阵由本轮完整功能浏览器套件继续覆盖：导览按钮、Escape 关闭和导航键保持音频中性；关闭后的真实 W/J、画布 Space 与 pointer 游戏手势仍可按既有契约解锁，重复游戏手势不重复创建 AudioContext。
- 这些字段只存在于运行时 review diagnostics；本轮没有改变 `GameState`、保存 schema、`state.paused` 或 `stepGame()` 语义。

## 当前组合往返的独立证据

组合候选 `10d99e1307bce62c279c05c5b6650f65a5f403ab` 的
`npm run test:showcase-preview` 为 4/4；其中 Ashfall focused 旅程 1/1。该旅程
使用普通 `/ashfall-arena/`、空 storage、无 `reviewControls`/`guideReview`，
并先确认没有 `[data-runtime-fallback]`、不是
`data-render-mode="information-fallback"`、真实 `[data-game-canvas]` 可见。

公共 DOM 三阶段样本显示：点击返回时与 `pagehide-start` 时 dialog/scroll lock
仍为真且 runtime 未销毁；`pagehide-after-dispose` 时 dialog/lock 已清理且
`data-runtime-disposed=true`。样本只经唯一 sessionStorage 测试键桥接，新 Hub
读取后立即删除。它证明普通 live runtime 的页面生命周期顺序，但不声称直接读取
私有 `guideGateOpen`。私有 gate 与 `recoveryFrames=0` 仍只由
`f2ac76e…` 上 `reviewControls=1&guideReview=1` 的既有
`onboarding-guide.spec.ts` 单独证明。

## 完整加速审阅旅程

`complete-run.spec.ts` 从固定 fresh 种子开始，不从 wave、boss 或 complete 夹具直接跳入终局：

1. 以真实键盘 `W`、`Q`、`Space` 和鼠标右键完成训练输入。
2. 切换到只在显式 `reviewControls=1` 下可用的 60 Hz 手动审阅时钟，使后续模拟不依赖机器墙钟速度。
3. 通过真实 `stepGame` 输入、攻击接触、伤害、敌人死亡和奖励事件完成第一波。
4. 选择一次升级，进入精英阶段；验证闸门、奖励与检查点。
5. 进入首领阶段，完成首领与召唤物战斗，写入 completion。
6. 重新载入不带 fixture 的审阅页面，从真实本地存档恢复完成记录。

这条通路没有调用 `defeatEnemy`，也没有使用 `drivePlayerStrike` 或 `queueEnemyMove` 代替完整通关战斗。本候选的浏览器全套验证了 `7` 次玩家真实 contact、`7` 次敌人真实 damage 和 `7` 个敌人 defeated。测试墙钟时间只说明加速、确定性的审阅路线能够稳定完成，不表示首次玩家能在相同时间内完成游戏。

## 玩家旅程与输入证据

- Fresh：验证全新开局、训练目标、玩家移动、锁定、攻击、格挡、闪避、治疗和武器切换的权威状态。
- 失败与重试：通过真实伤害进入 defeated，从最近检查点恢复；生命、精力、升级和已领取奖励保持正确，不重复瞬态事件。
- 成长与存档：第一波后只能选择一次活力或力量升级；保存、重载、损坏存档、配额失败和 localStorage getter 被阻止时均有明确、安全的行为。
- 首领与完成：首领阶段、阈值召唤、完成记录和完成后重载均通过；终局会清理仍存活的召唤物，但不会把清理误报为玩家伤害。
- 桌面：覆盖键盘、鼠标、标准手柄所有权切换；空闲或断开的手柄不会抢占正在使用的键鼠输入。
- 触控：`390 × 844` 竖屏和 `844 × 390` 横屏均覆盖移动、攻击、格挡、闪避、锁定、治疗、换武器和暂停，无横向溢出；`390 × 844` 发布性能用例走真实 pointer touch 路径。
- 标准手柄：模拟标准 mapping 的有效按键后输入模式切换为 gamepad；释放和断开不会留下粘滞输入。
- 减少动态效果：`prefers-reduced-motion: reduce` 独立关闭相机 shake 和粒子位移，但保留伤害闪光、盾环、字幕等语义反馈；它不被质量档位代替。
- 音频恢复：第一次 `AudioContext.resume()` 被浏览器阻止后诊断为 blocked；第二次用户手势可以在同一上下文恢复到 `unlocked: true`。静音时等价视觉反馈仍存在。
- 反馈字幕：优先级会跨多次事件消费持续到字幕 TTL 结束；高优先级受击不会被稍后的闪避起步覆盖，但治疗仍可更新当前受击提示，升级和通关提示可立即覆盖战斗字幕。
- WebGL 不可用：浏览器用例让真实 `HTMLCanvasElement.getContext()` 返回 `null`，覆盖 `WebGLRenderer` 构造失败；画布会隐藏并显示中文静态信息模式，目标、阶段、生命与武器仍可读。该模式不创建输入或音频控制器、不启动 RAF/模拟、不改写存档；旧游戏交互控件禁用，而在禁用步骤后创建的独立导览与同标签返回链接保持可用。诊断中的帧、tick、renderer 资源保持为零，清理后监听器和资源也为零。
- 运行健康：相关旅程检查 console error、page error 和未处理拒绝；生产预览还检查请求失败与 `4xx/5xx`，结果均为空。

## 性能诊断与自适应质量

### 测量边界与本轮门槛

诊断现在把两种信号分开记录：

- `frame` 是浏览器 `requestAnimationFrame` 回调间隔，会包含无头浏览器调度、软件渲染和运行环境节流；它驱动自动质量判断，但不等同于 GPU 完成时间。
- `work` 包围真实游戏更新、DOM/HUD 同步和 `renderer.render()` 的主线程提交工作。它不调用 `gl.finish()`，因此也不等同于 GPU 完成时间或端到端帧时间。
- review-only 的 `reviewPerformance=empty` 在同一页面、同一 rAF 循环中跳过产品更新和渲染。本轮要求 `submittedFrames=0` 且 `work.p95≤1ms`，用于区分调度基线与产品主线程工作。

本候选的 wave-one 与 boss 自动质量用例均采集至少 `30` 个 live work 样本，并通过 `median≤12ms`、`p95≤24ms`、`max<100ms`；draw-call 上限分别是 wave `125`、boss `100`。自动质量仍只根据真实 rAF 窗口决策：每 `45` 个有效间隔形成一个窗口，超过 `median 24ms` 或 `p95 34ms` 时按 high → medium → low 单向降档；若环境没有触发降档，则该窗口必须已经满足这两个阈值。

本机无头环境的同页 empty rAF 基线约为 median `16.7ms`、p95 `16.8ms`，而 live rAF 可能因软件渲染明显变慢并触发自动降档。该差异不被包装成“真实设备帧率已达标”；当前只关闭主线程提交预算、资源计数与自动降档行为，GPU 完成时间仍是未测边界。

固定 high/low 对照先在同一浏览器环境采集 empty 调度基线，再要求 low 相对该基线的 rAF 增量满足原有 `median≤24ms`、`p95≤34ms`，同时 high/low 都继续满足 live work 的 `median≤12ms`、`p95≤24ms`、`max<100ms`，没有放宽产品工作预算。该对照还验证了 low 的 DPR、drawing-buffer 像素数和局部灯数量都低于 high，且显式 `quality=high`、`medium` 或 `low` 不会被 auto 覆盖。阴影始终关闭，档位不会通过隐藏场景内容伪造收益。

质量档位可以解释为：

| 档位 | 渲染比例 / DPR 上限 | 局部灯 | 单次高强度 VFX 数量 |
| --- | --- | ---: | ---: |
| high | `1.0` / `2.0` | `4` | 最多 `4` |
| medium | `0.8` / `1.25` | `2` | 最多 `2` |
| low | `0.65` / `0.85` | `0` | `1` |

质量档位不写入 localStorage；刷新后仍由 URL 显式档位或默认 auto 决定。`prefers-reduced-motion` 是独立的可访问性信号，不会被质量控制覆盖。

### 移动低档、堆内存与生命周期

`390 × 844` 用例在 fixed low、reduced-motion 下走真实触控、标准手柄和音频恢复路径，并通过有效 rAF/renderer/资源样本的边界检查。Chromium `performance.memory` 只用于确认 `used ≤ total ≤ limit`，不作为泄漏证明。

泄漏门槛使用真实 renderer、场景、监听器和对象池计数。连续 defeat → retry 后，几何体、纹理、场景根、监听器和对象池均不得超过稳定基线。触发 pagehide/dispose 后：

- renderer geometries / textures：`0 / 0`
- scene children / entity roots：`0 / 0`
- listener registrations：`0`
- active pooled objects：`0`
- pool capacity 仍可在已释放控制器的诊断对象中报告为 `42`，但没有活动对象，也不再持有 renderer 资源

## 生产包与生产预览

Ashfall 使用真实代码分包，没有通过提高 Vite warning limit 隐藏问题：

| 资源 | raw | gzip |
| --- | ---: | ---: |
| `three-runtime-BF9wd6mB.js` | `335.79 KiB` | `80.94 KiB` |
| `three-runtime-C-7BDurz.js` | `178.40 KiB` | `47.95 KiB` |
| `index-DPmEmFta.js` | `127.24 KiB` | `39.79 KiB` |
| `game-assets-DS5U0l33.js` | `16.46 KiB` | `6.13 KiB` |
| `index-CKHNb0m9.css` | `14.54 KiB` | `3.91 KiB` |

- JavaScript gzip 合计：`174.81 KiB / 190.00 KiB`
- CSS gzip 合计：`3.91 KiB / 8.00 KiB`
- 每个 Ashfall JavaScript 分包均小于 `500 KiB`，构建没有 Ashfall 大 chunk 警告。

根工作区构建仍会报告 Monster Forge 单包 `564.22 kB` 的 Vite 警告。这是另一个产品的已知项，不属于 Ashfall 性能通过证据。

最终生产 smoke 从新构建的 `dist` 启动 Vite preview，入口返回 `200`，加载至少 `5` 个生产资源，显示一个真实 WebGL canvas且没有 runtime fallback；键盘移动会改变权威玩家位置，RAF 帧数继续增长。请求失败、`4xx/5xx`、console error 和 page error 均为 `0`。这是本机生产构建验证，不是公网部署验证。

## 三次首次代理体验尝试与人工门槛

三次独立的首次代理体验尝试都在页面可试玩之前被环境阻塞：

| 尝试 | 表面 / 环境 | 结果 | 计时 |
| --- | --- | --- | --- |
| A | Browser | `Browser unavailable` | 未开始 |
| B | Browser | `Browser unavailable` | 未开始 |
| C | `node_repl` | `node_repl kernel assets path error` | 未开始 |

三次都没有到达 fresh 可交互页面，因此没有开始计时、没有完成时长、不能计算中位数。它们是代理环境可用性尝试，**不是真人研究，也不是三名玩家测试**。

待执行的人工门槛是：让没有参与开发、未看过路线的首次真人玩家从 fresh 页面开始，以看到可交互游戏为计时起点，以完成记录出现为终点；记录每次原始时长和主要卡点。只有取得有效人工样本后，才能判断 8–12 分钟首次完成目标，并决定是否关闭人工可用性门槛。

## 本地运行、存储与回滚

从套件根目录运行：

```powershell
npm install
npm run dev:arena
```

开发服务默认地址为 `http://127.0.0.1:4174`。生产式本地验证：

```powershell
npm run build --workspace @showcase/ashfall-arena
npm run verify:release --workspace @showcase/ashfall-arena
npm run preview --workspace @showcase/ashfall-arena
```

preview 默认使用严格端口 `4184`。`test:preview` 会重新构建、执行包体预算，再启动生产 preview，不会复用已有服务。

精确的 localStorage 键：

- 游戏存档：`ashfall-arena:v1`
- 音频设置：`ashfall-arena:audio-settings:v1`

“新开一局”只清除游戏存档键，不清除音频设置。需要完全重置本地状态时可在该站点的开发者工具执行：

```javascript
localStorage.removeItem("ashfall-arena:v1");
localStorage.removeItem("ashfall-arena:audio-settings:v1");
```

若需要撤销 Task 9，先审阅完整范围
`97991ccbc33184aa6b01e0733e5917b5e76f7a34..f2ac76ead8f0d0d2658330fa34134d479eedcfe6`
中的代码、测试和文档提交，再从范围末端按逆序执行可审计的 `git revert`。不要只
定位并撤销 `test: close Ashfall onboarding state boundaries`，因为后续正式修复
同样属于 Task 9；也不要使用 `git reset --hard`。回滚范围必须在执行前由维护者
核对，避免误撤后续共享工作。

## 非目标与遗留限制

- 未完成三次有效的首次人工试玩，未得到 8–12 分钟人工完成中位数。
- 未进行真人可用性研究、手感访谈、长期平衡测试或辅助技术真人测试。
- 未在真实 iOS / Android 设备、Safari、Firefox 或低端独立 GPU 上建立性能结论；移动证据来自 Playwright Chromium 视口与触控事件。
- 未部署公网，不声明 CDN、跨区域网络、缓存策略或线上持久化已验证。
- reviewControls、固定夹具、手动审阅时钟和加速敌人生命只用于显式测试路由，不是正常玩家入口。
- heap 数值受 Chromium 与 GC 时机影响；资源不增长以 renderer、场景、监听器、对象池和 dispose 计数为准。
- Monster Forge `564.22 kB` 大 chunk 警告是跨产品已知项，未被当作 Ashfall 的通过证据。

在人工门槛关闭之前，最终状态保持：**发布候选 / 自动验收通过，人工可用性门槛未关闭**。
