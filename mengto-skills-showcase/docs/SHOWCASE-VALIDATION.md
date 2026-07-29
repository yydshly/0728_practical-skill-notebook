# 展厅实施执行账本

本文按候选和证据层记录套件结果；最终状态只允许 `pass` 或 `defer`。Task 13
的文档/契约工作以
`10d99e1307bce62c279c05c5b6650f65a5f403ab` 为基线；Task 13 最终提交无法在
自身内容中自指，完整 SHA 由 Git 历史与 Task 13 报告登记。历史候选的专项结果
不会改写成当前 HEAD 的重跑，本轮未执行的命令也不会标为通过。

Ashfall 的普通组合往返证据只在**真实 live runtime**中成立：进入产品后必须确认
没有 `[data-runtime-fallback]`、`html` 不是
`data-render-mode="information-fallback"`，且 `[data-game-canvas]` 可见。
信息降级页的导览与销毁顺序不能替代这条证据。

## 可追溯候选

| 证据层 | 完整候选 SHA | 已执行证据 |
| --- | --- | --- |
| Monster 中文导览 | `af211294d590103bbdd0c4f742c268cffd9825c3` | unit 18/18；开发浏览器 22/22；生产 preview 1/1；产品 build |
| Mech 中文导览 | `29c66e5d5936e6e64030da7bdc9693fccd74c38a` | unit 38/38；开发浏览器 52/52；生产 preview 52/52；产品 build |
| Ashfall 门禁与状态 | `f2ac76ead8f0d0d2658330fa34134d479eedcfe6` | onboarding 22/22；unit 312/312；功能浏览器 63/63；性能 5/5；preview 1/1 |
| 四服务 supervisor | `71cf6407c9681ae5ecf1f38aaae7c2a904507872` | supervisor 44/44；真实 4172–4175 smoke；进程树清理与端口重绑 |
| 同源组合构建 | `5a85355221943f3f1f8f59345ace1ab14406383b` | build 契约 176/176；`build:showcase`、独立扫描、普通 build、validate |
| 同标签组合往返 | `10d99e1307bce62c279c05c5b6650f65a5f403ab` | `test:showcase-preview` 4/4；Ashfall live runtime focused 1/1；strict TypeScript、build、validate |
| Task 14 浏览器精修与最终截图 | `527776cc393a95c5e477d26530e1c417c2eb7525` | Hub responsive/dialog 8/8；Monster guide 6/6；Ashfall 功能 63/63 + 性能 5/5；Mech guide 7/7；三张固定 PNG 与证据测试 1/1 |

## 执行账本

| 用户阶段 | 要求或产物 | 状态 | 证据或复验条件 |
| --- | --- | --- | --- |
| 统一展厅 | 第一屏固定说明三产品关系 | pass | Task 14 捕获候选 `527776cc393a95c5e477d26530e1c417c2eb7525`；`showcase-desktop.png` 为 `/`、1440×900 默认首屏，眉题、完整 H1、三产品关系和两个开始参观入口同屏；Hub 内容与说明测试保持通过。 |
| 统一展厅 | 三卡默认层可扫读、说明层信息完整 | pass | 同一 Task 14 候选；`showcase-dialog.png` 为 `/`、1440×900 Monster 完整说明，任务、业务、能力、时间和两个操作同屏；默认卡仍无任务墙或 Skill 墙。 |
| 统一展厅 | 产品说明可开关 | pass | 同一 Task 14 候选；Hub `responsive.spec.ts` + `dialog-navigation.spec.ts` 8/8，覆盖点击、Enter、Space、Escape、Tab、Shift+Tab、背景 inert、滚动锁定、焦点陷阱与焦点返回。 |
| 统一展厅 | 390px、320px、safe-area CSS 与 44px 触控目标 | pass | 修复提交 `527776cc393a95c5e477d26530e1c417c2eb7525`；390/320 的 dialog 外层均为 `clientHeight=scrollHeight=810`，panel 底边 843px，操作视口交集为 48.375px / 50px；无横向溢出。实体 safe-area 另列环境门槛。 |
| 统一展厅 | reduced-motion | pass | Task 14 Hub focused 8/8；媒体偏好匹配，产品卡过渡为即时状态且无运行中的位移动画。 |
| 统一展厅 | 真实浏览器 200% 放大 | defer | 已两次尝试 in-app Browser，均在执行前报 `failed to write kernel assets: 系统找不到指定的路径`；真实 Chrome 200% 会话无法控制或读取。Playwright Chromium 发送 `Ctrl++` / `Ctrl+=` 时按键只进入 renderer，`inner/outer` 尺寸、DPR、`visualViewport.scale` 均不变；720×900 重排通过但不冒充真实缩放。未验证风险：浏览器 chrome 占高与真实文字重排可能裁切主旅程。复验触发：获得可读取 zoom 指示值的可控 Chrome，将 zoom 明确设为 200%，记录窗口、旅程和截图。 |
| 产品内引导 | Monster 首访、重开、返回和 Glass Crawler + 骨架 | pass | Task 14 捕获候选 `527776cc393a95c5e477d26530e1c417c2eb7525`；`guide.spec.ts` 6/6，覆盖首访/重开、storage、fallback、无导览捕获态、Glass Crawler 成功点与同标签返回。 |
| 产品内引导 | Ashfall 首帧、四状态、重复开关、fallback、dispose、移动/攻击 | pass | 同一 Task 14 候选；功能 63/63、性能 5/5，覆盖首访冻结、真实移动/攻击、暂停、升级、失败、完成、fallback、返回、存储和完整输入/表现矩阵。 |
| 产品内引导 | Mech 首访、重开、返回、移动面板、Halo 摘要/URL、fallback | pass | 同一 Task 14 候选；`guide.spec.ts` 7/7，覆盖首访/重开、移动配置面板互斥、Halo 摘要/规范 URL、storage、fallback 和返回。 |
| 产品内引导 | 引导版本与三个产品互不污染 | pass | 历史候选 `3cc102f0fb237fa3ac724f207506b10b8f2041ac`；共享 guide unit 9/9、browser 13/13。 |
| 产品内引导 | storage getter/read/write 失败仍可使用 | pass | 历史候选 `3cc102f0fb237fa3ac724f207506b10b8f2041ac`；共享 guide unit/browser 分别覆盖 getter、read、write 失败。 |
| 跨产品导航 | 当前标签往返对应卡片 | pass | 候选 `10d99e1307bce62c279c05c5b6650f65a5f403ab`；组合预览 4/4。每条旅程使用空 storage、单一 Page、精确 `#product-*` 和焦点；唯一允许的回环源站为 `127.0.0.1:4292`。 |
| 一条命令运行 | 四服务固定端口就绪与完整清理 | pass | 候选 `71cf6407c9681ae5ecf1f38aaae7c2a904507872`；focused 44/44。受控真实 smoke 中 4172–4175 各返回 200 且 marker/title 精确，signal 后根 PID 消失并可重新绑定四端口。 |
| 工程 | 四应用普通与同源组合构建 | pass | 候选 `5a85355221943f3f1f8f59345ace1ab14406383b`；build 契约 176/176、`npm run build:showcase`、独立产物扫描与普通 `npm run build` 通过。扫描允许三个产品各自的 XHTML namespace 和 shader 论文注释两个惰性字面量，除此之外无远程或 loopback 运行时 URL。 |
| Ashfall 生命周期 | 普通组合导航的公共 DOM 三阶段 | pass | 候选 `10d99e1307bce62c279c05c5b6650f65a5f403ab`；click 与 pagehide-start 均保持 dialog/scroll lock，且 runtime 未销毁；pagehide-after-dispose 已关闭 dialog/lock 并报告 disposed。样本只经唯一 sessionStorage 测试键桥接并立即删除。 |
| Ashfall 生命周期 | 私有 gate 与恢复帧 | pass | 候选 `f2ac76ead8f0d0d2658330fa34134d479eedcfe6`；`onboarding-guide.spec.ts` 在 `reviewControls=1&guideReview=1` 下直接断言 `guideGateOpen=true`、`recoveryFrames=0` 和 synthetic pagehide 清理。该证据不是普通组合旅程。 |
| 文档 | 非技术中文快速开始与四个 browser 入口 | pass | Task 13 工作候选（基线 `10d99e1307bce62c279c05c5b6650f65a5f403ab` 加本文档/契约差异）；`npm test -- --run tests/workspace-contract.test.mjs` 在最终结构上连续两次 19/19，覆盖中文快速开始、四应用/六共享包、四个 browser 入口、动态 Skill 表和 Playwright/Vitest 隔离。最终提交 SHA 由 Git 历史与 Task 13 报告登记。 |
| 工程 | 根单元/结构回归与 Skill 只读审计 | pass | 同一 Task 13 工作候选；`npm test` 为 48 files、701/701，旧 Ashfall SHA 唯一失败已消除；`npm run validate` 输出 `Workspace contract valid.`；`node scripts/check-selected-skills.mjs` 显示批准的 16/16 项均为 `installed=true`；普通 `npm run build` 通过。 |
| 最终视觉 | 1440×900 首页、说明态、390×844 手机态 | pass | Task 14 捕获候选 `527776cc393a95c5e477d26530e1c417c2eb7525`；仅保留 `showcase-desktop.png`、`showcase-dialog.png`、`showcase-mobile.png`。手机图底层先固定到单列 Monster 卡片 `scrollY=828`，再打开真实移动底部说明层初始态；两操作完整可见。`tests/showcase-evidence.test.mjs` 1/1 锁定三文件与 1440×900、1440×900、390×844。 |
| 首次理解 | 30 秒首次理解 | defer | 已尝试路径：Hub 内容/浏览器测试、1440×900 首屏目视和固定主旅程均确认三产品关系与两个入口，但当前环境没有未读 README 的首次非技术访客。未验证风险：访客仍可能混淆三产品、关卡和 Skill。复验触发：一名未读 README 的首次非技术访客在 30 秒后计时复述“是什么、三款差异、下一步”，记录原话与阻塞点。 |
| Ashfall 体验 | 8–12 分钟首次挑战 | defer | 已尝试路径：真实输入功能 63/63、完整 seed 7481 流程、状态/性能 5/5 与加速审阅路线均通过，但自动化是确定性且不是首次玩家。未验证风险：新手可能在移动、防御、升级或 boss 节奏上超过 12 分钟。复验触发：未接触产品的真实首次玩家完成全流程，记录开始、结束、失败次数与阻塞点。 |
| 外部环境 | 实体 safe-area | defer | 已尝试路径：`100dvh`/`env(safe-area-inset-bottom)` CSS 契约、390/320 模拟视口、单一滚动所有者与底部安全留白均通过；桌面模拟 inset 为 0。未验证风险：真实刘海、圆角和系统手势区遮挡底部操作。复验触发：获得非零 safe-area 的目标 iOS/Android 实机后，纵横屏打开说明层并测量两个操作。 |
| 外部环境 | 实体 GPU | defer | 已尝试路径：Playwright Chromium 的三产品 WebGL、fallback 与 Ashfall 性能 5/5 通过，fallback 用例只产生预期 WebGL context 错误；当前没有目标实体 GPU 设备矩阵。未验证风险：移动驱动、热降频或显存限制引发掉帧/上下文丢失。复验触发：确定目标低/中/高档实体设备后记录加载、主旅程、帧时间和 fallback 恢复。 |
| 外部环境 | 公网部署 | defer | 已尝试路径：普通/组合构建、产物 URL 扫描与本地同源预览均通过；本任务未获公开部署授权，也没有公开地址。未验证风险：TLS、CDN 缓存、base path 和跨应用资源策略只在公网暴露。复验触发：获得发布授权和正式 URL 后执行四入口、资产、同标签往返、缓存刷新与错误页 smoke。 |
