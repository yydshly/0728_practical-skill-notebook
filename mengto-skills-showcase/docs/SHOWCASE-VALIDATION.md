# 展厅实施执行账本

这是实施执行账本；每个阶段只更新自己已实际执行的行；最终不得残留 `continue`。`defer` 必须同时写出已尝试的替代路径、未验证风险和复验触发条件。

| 用户阶段 | 要求或产物 | 表面 / 状态 | 所需证据 | 阶段 | 状态 | 证据或复验条件 |
| --- | --- | --- | --- | --- | --- | --- |
| 统一展厅 | 第一屏说明三产品关系 | 1440px 桌面首屏 | 截图 + DOM 文案 | 2 | continue | 实现后捕获首屏 |
| 统一展厅 | 三卡默认层可扫读、说明层信息完整 | 桌面默认态 + 说明态 | 浏览器检查 + 内容测试 | 1–2 | continue | 添加两层内容模型测试 |
| 统一展厅 | 产品说明可开关 | 对话框打开/关闭 | 点击、Escape、背景 inert、滚动锁定、焦点返回 | 1–2 | continue | 添加浏览器旅程 |
| 统一展厅 | 手机可理解和操作 | 390px、320px、safe-area | 截图 + 44px 触摸目标 + 无横向滚动 | 2 | continue | 添加移动浏览器检查 |
| 统一展厅 | 键盘与放大路径完整 | 桌面键盘、200% 放大 | Tab、Enter、Escape、焦点与可读名称证据 | 2 | continue | 添加键盘与缩放旅程 |
| 统一展厅 | 减少动态效果 | reduced-motion | 浏览器媒体偏好证据 | 2 | continue | 添加媒体偏好测试 |
| 产品内引导 | Monster 首访任务 | 首访、重开、返回 | 浏览器交互 | 3 | continue | 集成共享引导 |
| 产品内引导 | Ashfall 独立门禁 | 首帧、玩家暂停、升级/失败/完成、重复开关、销毁 | frame/tick/state/input/audio/save 证据 | 4 | continue | 单独阶段先写失败测试 |
| 产品内引导 | Mech 首访任务 | 首访、重开、返回 | 浏览器交互 | 3 | continue | 集成共享引导 |
| 产品内引导 | 引导版本与三个产品互不污染 | 关闭、持久隐藏、版本升级 | 单元 + 浏览器测试 | 1、3–4 | pass | 候选 `3cc102f0fb237fa3ac724f207506b10b8f2041ac`；`npm test --workspace @showcase/showcase-guide`：9/9，`builds the exact versioned product-scoped auto-hidden key` 与 `isolates products and guide versions` 通过；`npm run test:browser --workspace @showcase/showcase-guide`：13/13，`persistent preferences remain isolated by product and guide version` 通过。 |
| 产品内引导 | 存储不可用仍可使用 | getter/read/write 抛错 | 单元 + 浏览器测试 | 1、3–4 | pass | 候选 `3cc102f0fb237fa3ac724f207506b10b8f2041ac`；`npm test --workspace @showcase/showcase-guide`：9/9，`keeps the guide usable when storage getter/read/write throws` 三项通过；`npm run test:browser --workspace @showcase/showcase-guide`：13/13，真实 Chromium 的 `storage getter/read/write failure still permits open, close and reopen` 三项通过。 |
| 跨产品导航 | 当前标签往返对应卡片 | DEV 与组合生产预览 | URL、锚点、焦点、无 loopback 证据 | 2–5 | continue | 添加往返浏览器旅程 |
| 一条命令运行 | 四服务固定端口就绪与完整清理 | Windows 成功、占用、超时、崩溃、中断 | 进程树 + HTTP + 退出码证据 | 5 | continue | 添加脚本集成测试 |
| 首次理解 | 访客能复述三产品与 Skill 关系 | 不阅读 README 的首次走查 | 真人回答记录 | 6 | continue | 实现后邀请至少一名访客走查 |
| 文档 | 非技术快速开始 | README 首段 | 文档契约测试 | 6 | continue | 更新 README |
| 工程 | 单元与结构回归 | 根工作区 | `npm test`、`npm run validate` | 6 | continue | 实现后全量执行 |
| 工程 | 四应用生产构建 | 根工作区 | `npm run build`、`npm run build:showcase` | 5–6 | continue | 实现后全量执行 |
| 最终证据 | 展厅桌面、说明态、手机态 | 3 个最终状态 | 最多 3 张最终截图 | 6 | continue | 浏览器终验后保留 |
