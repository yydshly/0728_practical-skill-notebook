# Mech Atelier Task 3 设计契约

## 契约

- Entry mode: brief-led implementation
- Request revision: Task 3 / revision 1
- Target user and context: 想快速组合并检查概念机甲方案的中文用户；桌面浏览器优先，支持触控和键盘操作
- Desired first impression: 一台清晰、可信地落在展示台上的英雄机甲，旁边是可直接操作的配置与精确数据
- Visual ambition: Immersive
- Experience architecture: Spatial Stage
- Scene base: WebGL / Three.js；DOM 承担全部可读内容、选择、状态与摘要
- Scene persistence: 桌面端在整个配置旅程中持续可见；1024px 仍保持预览与配置同屏
- Foreground control model: 语义化 fieldset/radio、重置视图按钮、中文状态说明和精确摘要
- State-to-scene mapping: 合法配置实时更新部件与材质；环境选择更新本地灯光；非法组合先规范化并播报，再更新场景
- Mobile transformation: 本任务只承诺 1024px 及以上；390px 移动端完整底部面板属于后续 Task 6
- Fallback: 完整静态 WebGL 降级属于后续 Task 6；本任务不声称已交付该能力
- Visual constraints: 工业铸造工坊气氛；暖铜、暗钢与冷色状态点缀；首屏只有一个英雄主体；不使用远程纹理
- Information constraints: 所有可见文案使用中文；价格旁明确“概念配置，不提供结算或库存功能”；不暗示真实商品、照片级模型、付款或库存
- Operation constraints: 拖拽旋转、滚轮和双指缩放、重置视图；兼容项可发现且禁用原因紧邻；键盘可完成配置
- State constraints: 三个底盘、三套环境及受支持的材质值均可确定复现；未知 review 值回到默认并播报
- Environment constraints: Vite 开发端口 4175；浏览器测试可用 `MECH_PLAYWRIGHT_PORT` 隔离，production preview 使用 `MECH_PREVIEW_PORT`；禁止远程资源
- Primary journey: 打开默认机甲 → 比较兼容性 → 更换底盘和模块 → 调整材质与环境 → 检查精确价格和性能 → 旋转/缩放/重置观察
- User-defined phases: Mech Atelier implementation plan Task 3 only
- Required artifacts: 可运行应用、场景与 UI 模块、浏览器旅程测试、临时视觉证据、构建与预览证据
- Autonomy authorization: 用户已授权继续；父任务明确授权在既定 Task 3 范围内直接实施
- User-decision boundary: 不新增分享、持久化、分解视图、海报导出、完整降级或商城业务
- Asset state: 项目自制程序化几何
- Quality level: L2 Inspectable；可旋转和检查，不宣称照片级或真实商品
- Selected pattern: Product case → single product viewer/configurator
- Evidence branch: Mech Atelier Task 1 纯配置规则 + Task 2 共享程序化装配
- Expected output: 可运行、可配置、单 canvas 的 Three.js 产品查看器
- Review boundary: `?review=default|bastion-guard|oracle-dusk` 只映射白名单视觉状态；只读诊断只在合法 review 或 `reviewControls=1` 暴露，普通 `/` 不暴露调试 API
- Skill update: 本任务不修改技能；证据只写入项目

## 覆盖清单

| 用户阶段 | 要求 | 表面 / 状态 | 证据 | 阶段 | 状态 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- |
| Task 3 | 默认配置和精确摘要 | 1440×900 / 默认 | DOM 断言 + 截图 | 1–3 | pass | — |
| Task 3 | 合法改装只替换变化部件 | 桌面 / 选择状态 | 浏览器调试状态 + DOM 断言 | 5–6 | pass | — |
| Task 3 | 非法项禁用且显示原因 | 桌面 / Strider | 可访问名称、禁用状态、原因文本 | 4–6 | pass | — |
| Task 3 | 切换底盘后规范化非法配置 | 桌面 / 受限组合 | aria-live 中文播报 + 已选值 | 5–6 | pass | — |
| Task 3 | 三环境映射真实灯光 | foundry / hangar / dusk | 场景调试快照 + 像素证据 | 5 | pass | — |
| Task 3 | 三底盘均按测量包围盒取景 | 三个底盘 | 相机包围盒调试快照 | 5 | pass | — |
| Task 3 | 拖拽、滚轮、双指和重置 | 鼠标 / 触控 | 交互前后调试快照 | 5 | pass | — |
| Task 3 | 单 canvas、非空 WebGL、resize | 1440×900 / 1024×768 | canvas 身份、像素、尺寸断言 | 1 / 7 | pass | — |
| Task 3 | 确定性 review 状态 | 合法、未知 review | DOM + 播报 + 调试快照 | 6 | pass | — |
| Task 3 | 无 pageerror、console error、404 | 开发与 production preview | 浏览器监听 + 响应断言 | 9 | pass | — |
| Task 3 | 1024 无横向滚动且键盘可用 | 1024×768 | 浏览器尺寸和键盘操作 | 7 | pass | — |
| Task 3 | 真实 vendor/chunk 策略和生产构建 | production build | 构建输出和 preview smoke | 8–9 | pass | — |
| Task 3 | 临时视觉证据自检 | 1440×900、1024×768 | 忽略目录截图 + 人工检查 | 2–3 / 7 | pass | — |

## 验收证据

- 失败基线：最小 HTML 返回 200 后，7 个浏览器旅程均因标题、画布、配置控件或 review 状态缺失而失败；随后按红—绿循环实现。
- 单元测试：`npm test --workspace @showcase/mech-atelier` 连续两轮均为 2 files / 15 tests passed。
- 开发浏览器：端口 4192 与隔离端口 4194 连续两轮均为 7 tests passed；所有旅程真实打开页面。
- Production preview：端口 4185 上 7 tests passed；同一组测试持续监听 pageerror、console error 和 404。
- 默认摘要：184,000 信用点、28 / 32 kg、火力 62、防护 41、机动 78。
- 合法改装：堡垒运输型 + 神盾为 224,000 信用点、40 / 52 kg、火力 54、防护 73、机动 44；renderer、canvas、scene、assembly 身份保持，只有变化槽位的部件身份改变。
- 规范化：堡垒运输型的反应式堡垒装甲切回游骑侦察型时，自动恢复陶瓷外壳，并通过 `aria-live` 播报中文原因。
- 视觉检查：1440×900 和 1024×768 截图均在忽略的 `test-results` 中以原尺寸检查；英雄机甲完整落地、层级清晰、控制可达、无横向溢出。
- 生产包：入口 10.04 kB gzip、机甲资产 5.28 kB gzip、Three.js 拆分为 50.56 / 83.45 kB gzip；没有通过提高 warning limit 隐藏警告，Mech Atelier 构建无大块警告。
- 工作区：33 files / 421 tests passed；workspace build 和 workspace contract validation passed。工作区构建仍显示 Monster Forge 的既有单块警告，与本任务 Mech Atelier 分包无关。
