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
- 历史资产捕获候选：`43ef034d06f341f525740fbfd243a6d9aabc0b20`。
- 历史资产验收证据提交：`2c03f5a889e35a9abb14c45a2077cb40d8ae59ad`。

这两个 SHA 只追溯截图来源与转换，不代表后续 Hub 功能、组合构建或当前套件
重新执行了同一轮资产捕获。

## Phase 2 分层验证

| 层级 | 状态 | 证据 / 边界 |
| --- | --- | --- |
| PNG 名称、尺寸、比例、替代文本与总预算 | pass | 历史候选 `d9ef199d646e12f235c56a7833c4b04208efba62`；`tests/previews.test.ts` 2/2；目标总计 538,589 bytes |
| 1440×900、390×844、320×844、720×900 重排代理 | pass | Task 14 捕获候选 `527776cc393a95c5e477d26530e1c417c2eb7525`；Hub `responsive.spec.ts` 与 `dialog-navigation.spec.ts` 8/8。390/320 的 dialog 外层均为 `clientHeight=scrollHeight=810`，panel 底边 843px，两个操作的视口交集高度为 48.375px / 50px；720 只证明重排。 |
| 图片请求失败、键盘与 reduced-motion | pass | Task 14 捕获候选 `527776cc393a95c5e477d26530e1c417c2eb7525`；预览 404 保留文本和两个操作；Tab、Shift+Tab、Enter、Space、Escape 可完成说明开关并返回焦点；媒体偏好下无运行中的位移动画。 |
| 普通/组合生产入口、包体和 URL 扫描 | pass | 组合候选 `5a85355221943f3f1f8f59345ace1ab14406383b`；`npm run build:showcase`、独立扫描与普通 `npm run build` 通过。扫描允许三产品中的 XHTML namespace 与 shader 论文注释惰性字面量，除此之外无远程或 loopback 运行时 URL；Hub 本身不含 Three.js。 |
| 三产品同标签组合往返 | pass | 组合候选 `10d99e1307bce62c279c05c5b6650f65a5f403ab`；`npm run test:showcase-preview` 4/4，单一 Page、精确 hash/焦点及链接扫描通过。这是套件组合旅程，不替代 Hub 自身完整浏览器矩阵。 |
| 真实浏览器 200% 缩放 | defer | 已两次尝试 in-app Browser，均在执行前报 `failed to write kernel assets: 系统找不到指定的路径`；真实 Chrome 的 200% 会话无法控制或读取。Playwright Chromium 中 `Ctrl++` / `Ctrl+=` 只到 renderer，`inner/outer` 尺寸、DPR、`visualViewport.scale` 均不变；720×900 重排通过但不冒充真实缩放。未验证风险是浏览器 chrome 占高与真实文字重排造成裁切；获得可读取 zoom 指示值的可控 Chrome 后，以明确 200%、窗口尺寸、主旅程和截图复验。 |
| 实体设备 safe-area | defer | 已验证 `100dvh`、`env(safe-area-inset-bottom)` 支持、390/320 无横向溢出、单一滚动所有者和底部安全留白；桌面模拟的 inset 为 0。未验证风险是真实刘海/圆角/系统手势区遮挡底部操作；获得非零 safe-area 的目标 iOS/Android 实机后，以纵横屏打开说明层并测量两个操作复验。 |

## Task 14 最终浏览器证据

浏览器为仓库安装的 Playwright Chromium `151.0.7922.34`，捕获日期为
2026-07-30，截图捕获候选为
`527776cc393a95c5e477d26530e1c417c2eb7525`。最终记录提交不能在自身内容中
自指，以紧随该候选的 Git 历史为准。

| 文件 | 路由 / 视口 | 固定状态 |
| --- | --- | --- |
| `docs/evidence/showcase-desktop.png` | `http://127.0.0.1:4172/` / 1440×900 | 默认首屏；眉题、完整 H1、三产品关系和两个开始参观入口同屏 |
| `docs/evidence/showcase-dialog.png` | `http://127.0.0.1:4172/` / 1440×900 | Monster Forge 完整产品说明；任务、业务、能力、时间和两个操作同屏 |
| `docs/evidence/showcase-mobile.png` | `http://127.0.0.1:4172/` / 390×844 | 页面先固定到单列 Monster 卡片 `scrollY=828`，再打开移动底部说明层的初始滚动状态；截图直接证明说明层与两个完整操作，底层单列卡由同一捕获脚本状态及 responsive DOM/几何断言支撑 |

- `npm test -- --run tests/showcase-evidence.test.mjs`：1/1，固定且仅允许上述三张
  PNG，尺寸为 1440×900、1440×900、390×844。
- `npm run test:browser --workspace @showcase/hub -- responsive.spec.ts dialog-navigation.spec.ts`：
  8/8。
- `npm run test:browser --workspace @showcase/monster-forge -- guide.spec.ts`：6/6。
- `npm run test:browser --workspace @showcase/ashfall-arena`：功能 63/63、性能 5/5。
- `npm run test:browser --workspace @showcase/mech-atelier -- guide.spec.ts`：7/7。
