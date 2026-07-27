# 覆盖清单：雾屿灯塔

| 用户阶段 | 要求或交付 | 证据 | 状态 | 结果 |
| --- | --- | --- | --- | --- |
| 1 | 原创统一母场景与七个对齐图层 | 清单、尺寸/Alpha 校验、首屏复查 | pass | 见 `docs/ASSETS.md`。 |
| 1 | 关键图层资源门槛与失败降级 | 失败层端到端测试 | pass | `asset-fallback.spec.js`。 |
| 2 | 电影式滚动叙事与可逆时间轴 | Playwright、真实滚动复查 | pass | `cinematic.spec.js`。 |
| 2 | 开场焦点与层次 | 1440 × 900 真实截图 | pass | 远岛残影已移除。 |
| 2 | 叙事内容可读性 | 样式变量与截图 | pass | `.27` 与 `.58` 均已复查。 |
| 3 | 航线档案交互 | 按钮、拖拽、触摸、键盘、详情 | pass | `archive.spec.js` 与真实点击。 |
| 3 | 导航跳转 | 页头按钮真实点击 | pass | 灯塔与航线均复查。 |
| 4 | 跨视口 | 5 个目标尺寸 | pass | 截图与无溢出断言见验证报告。 |
| 4 | 减少动态效果 | `prefers-reduced-motion: reduce` | pass | `reduced-motion.spec.js`。 |
| 4 | 200% 放大约束 | 720 × 450 有效视口 | pass | `zoom.spec.js`。 |
| 4 | 控制台错误 | 最终状态日志 | pass | error/warning 为空。 |
| 4 | 文档交付 | README、素材、时间轴、验证 | pass | 本次提交。 |
