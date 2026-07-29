# Showcase Hub 验证记录

## 真实预览资产来源

三张预览来自既有本地产品验收截图，不是新生成的概念图。来源文件虽使用
`.png` 扩展名，字节魔数均为 JPEG/JFIF
`ff d8 ff e0 00 10 4a 46 49 46 00 01`；展厅目标则转换为固定
`800×500` 的真实 PNG。

| 产品 | 本地来源 | 来源尺寸 / 字节 | 来源 SHA-256 | 展厅目标 / 字节 | 目标 SHA-256 |
| --- | --- | ---: | --- | ---: | --- |
| Monster Forge | `D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\02-monster-forge-inspect.png` | 1425×891 / 84,861 | `78d7171e6ea6d6ee65abb028491cb41a1c598f6668c97fa175a7a28cdc289779` | `public/previews/monster-forge-review.png` / 202,000 | `019e6c823af025fbaff14685ee83a9982a8428dfa799a02c89ad0d89370abafe` |
| Ashfall Arena | `D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\03-ashfall-start.png` | 1425×891 / 60,000 | `a1871ba5a3f980f0de8670d71a63f1aa5c89ca361fef98eeb0908d37c1e1c456` | `public/previews/ashfall-arena-combat.png` / 187,771 | `57a77df75ae184721e103dc539c05ce3b7cc366964fdacc027aa08ead477c7e7` |
| Mech Atelier | `D:\codex_project_work\0728_some_github\.superpowers\mengto-skills-showcase-audit\screenshots\05-mech-summary.png` | 1440×900 / 64,623 | `114b291323adb869f372d12856ed2446e10829a45c8950327a8dc320351fc1f6` | `public/previews/mech-atelier-configurator.png` / 148,818 | `a1288d18a9ff4f24dfe67861b0e034ee5e26256f2148ab0c0df9fb18df0b2f04` |

- 来源总计：209,484 bytes。
- 目标总计：538,589 bytes，低于 600 KiB 固定预算。
- 来源与目标因格式和尺寸转换而具有不同 SHA-256。
- 原始候选提交：`43ef034d06f341f525740fbfd243a6d9aabc0b20`。
- 既有验收证据提交：`2c03f5a889e35a9abb14c45a2077cb40d8ae59ad`。

## Phase 2 分层验证

| 层级 | 状态 | 证据 / 边界 |
| --- | --- | --- |
| PNG 名称、尺寸、比例、替代文本与总预算 | pass | `tests/previews.test.ts`，2/2；目标总计 538,589 bytes |
| 1440×900、390×844、320×844、720×900 重排代理 | pass | 开发与生产 Playwright 均通过；320/390 无横向溢出、可见交互目标不小于 44×44，720 可打开说明层 |
| 图片请求失败与 reduced-motion | pass | 三张预览 404 时显示真实文本节点且保留两种操作；reduced-motion 下卡片过渡为 0s |
| 生产入口、包体预算、无远程运行时依赖 | pass | `npm run build` 与 `scripts/verify-build.mjs`；JS 5.32 KiB gzip、CSS 2.25 KiB gzip，运行时文本中 loopback 匹配为 0 |
| 真实浏览器 200% 缩放 | continue | 自动 720px 重排代理不冒充浏览器级缩放 |
| 实体设备 safe-area | continue | CSS 契约与移动视口自动化不替代实体设备验证 |
