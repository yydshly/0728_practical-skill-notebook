# 展厅实施执行账本

本文按候选和证据层记录套件结果。Task 13 的文档/契约工作以
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

## 执行账本

| 用户阶段 | 要求或产物 | 状态 | 证据或复验条件 |
| --- | --- | --- | --- |
| 统一展厅 | 第一屏固定说明三产品关系 | pass | 历史候选 `d9ef199d646e12f235c56a7833c4b04208efba62`；Hub 内容测试与开发/生产浏览器检查覆盖固定文案和三卡默认层。Task 14 仍需保存最终 1440×900 截图。 |
| 统一展厅 | 三卡默认层可扫读、说明层信息完整 | pass | 历史候选 `d9ef199d646e12f235c56a7833c4b04208efba62`；内容模型与 dialog 浏览器旅程覆盖两层信息。 |
| 统一展厅 | 产品说明可开关 | pass | 历史候选 `d9ef199d646e12f235c56a7833c4b04208efba62`；点击、Escape、背景 inert、滚动锁定和焦点返回由 Hub 浏览器矩阵覆盖。 |
| 统一展厅 | 390px、320px、safe-area CSS 与 44px 触控目标 | pass | 历史候选 `d9ef199d646e12f235c56a7833c4b04208efba62`；自动化覆盖 390×844、320×844、无横向溢出和触控目标。实体 safe-area 另列外部门槛，不由此行外推。 |
| 统一展厅 | reduced-motion | pass | 历史候选 `d9ef199d646e12f235c56a7833c4b04208efba62`；媒体偏好下卡片非必要过渡为即时状态。 |
| 统一展厅 | 真实浏览器 200% 放大 | continue | 720×900 仅是重排代理，不能冒充浏览器级 200% 缩放；Task 14 必须真实尝试后再写 pass，或写清替代路径、风险和复验触发。 |
| 产品内引导 | Monster 首访、重开、返回和 Glass Crawler + 骨架 | pass | 候选 `af211294d590103bbdd0c4f742c268cffd9825c3`；unit 18/18、browser 22/22、preview 1/1。 |
| 产品内引导 | Ashfall 首帧、四状态、重复开关、fallback、dispose、移动/攻击 | pass | 候选 `f2ac76ead8f0d0d2658330fa34134d479eedcfe6`；onboarding 22/22、unit 312/312、functional 63/63、performance 5/5、preview 1/1。 |
| 产品内引导 | Mech 首访、重开、返回、移动面板、Halo 摘要/URL、fallback | pass | 候选 `29c66e5d5936e6e64030da7bdc9693fccd74c38a`；unit 38/38、开发 browser 52/52、生产 preview 52/52。 |
| 产品内引导 | 引导版本与三个产品互不污染 | pass | 历史候选 `3cc102f0fb237fa3ac724f207506b10b8f2041ac`；共享 guide unit 9/9、browser 13/13。 |
| 产品内引导 | storage getter/read/write 失败仍可使用 | pass | 历史候选 `3cc102f0fb237fa3ac724f207506b10b8f2041ac`；共享 guide unit/browser 分别覆盖 getter、read、write 失败。 |
| 跨产品导航 | 当前标签往返对应卡片 | pass | 候选 `10d99e1307bce62c279c05c5b6650f65a5f403ab`；组合预览 4/4。每条旅程使用空 storage、单一 Page、精确 `#product-*` 和焦点；唯一允许的回环源站为 `127.0.0.1:4292`。 |
| 一条命令运行 | 四服务固定端口就绪与完整清理 | pass | 候选 `71cf6407c9681ae5ecf1f38aaae7c2a904507872`；focused 44/44。受控真实 smoke 中 4172–4175 各返回 200 且 marker/title 精确，signal 后根 PID 消失并可重新绑定四端口。 |
| 工程 | 四应用普通与同源组合构建 | pass | 候选 `5a85355221943f3f1f8f59345ace1ab14406383b`；build 契约 176/176、`npm run build:showcase`、独立产物扫描与普通 `npm run build` 通过。扫描允许三个产品各自的 XHTML namespace 和 shader 论文注释两个惰性字面量，除此之外无远程或 loopback 运行时 URL。 |
| Ashfall 生命周期 | 普通组合导航的公共 DOM 三阶段 | pass | 候选 `10d99e1307bce62c279c05c5b6650f65a5f403ab`；click 与 pagehide-start 均保持 dialog/scroll lock，且 runtime 未销毁；pagehide-after-dispose 已关闭 dialog/lock 并报告 disposed。样本只经唯一 sessionStorage 测试键桥接并立即删除。 |
| Ashfall 生命周期 | 私有 gate 与恢复帧 | pass | 候选 `f2ac76ead8f0d0d2658330fa34134d479eedcfe6`；`onboarding-guide.spec.ts` 在 `reviewControls=1&guideReview=1` 下直接断言 `guideGateOpen=true`、`recoveryFrames=0` 和 synthetic pagehide 清理。该证据不是普通组合旅程。 |
| 文档 | 非技术中文快速开始与四个 browser 入口 | pass | Task 13 工作候选（基线 `10d99e1307bce62c279c05c5b6650f65a5f403ab` 加本文档/契约差异）；`npm test -- --run tests/workspace-contract.test.mjs` 在最终结构上连续两次 19/19，覆盖中文快速开始、四应用/六共享包、四个 browser 入口、动态 Skill 表和 Playwright/Vitest 隔离。最终提交 SHA 由 Git 历史与 Task 13 报告登记。 |
| 工程 | 根单元/结构回归与 Skill 只读审计 | pass | 同一 Task 13 工作候选；`npm test` 为 48 files、701/701，旧 Ashfall SHA 唯一失败已消除；`npm run validate` 输出 `Workspace contract valid.`；`node scripts/check-selected-skills.mjs` 显示批准的 16/16 项均为 `installed=true`；普通 `npm run build` 通过。 |
| 最终视觉 | 1440×900 首页、说明态、390×844 手机态 | continue | 由 Task 14 通过受控浏览器保存最多三张最终截图；当前自动化不冒充最终人工视觉复核。 |
| 首次理解 | 30 秒首次理解 | defer | 已用自动化确认固定文案与路线，但自动化不能证明理解；未验证风险是非技术访客仍可能混淆三产品与 Skill。复验触发：一名未读 README 的首次非技术访客完成计时复述并记录原话。 |
| Ashfall 体验 | 8–12 分钟首次挑战 | defer | 已验证完整状态机和加速审阅路线，但未取得真实首次玩家时长。复验触发：有效首次玩家样本完成全流程并记录开始、结束和阻塞点。 |
| 外部环境 | 真实设备与公开部署 | defer | 已验证本地响应式与同源组合预览，但未验证实体刘海、安全区、GPU 和公网缓存。复验触发：确定目标设备矩阵或公开托管地址后执行真机/线上 smoke。 |
