# Mech Atelier 发布验证记录

## 2026-07-29 中文导览、移动面板协调与配置小成功点

本节记录从基线 `af211294d590103bbdd0c4f742c268cffd9825c3` 增加 Mech Atelier v1 中文导览后的新鲜证据；最终候选为 `29c66e5d5936e6e64030da7bdc9693fccd74c38a`。下方既有发布记录继续保留，不能替代本节的增量验证。

- 首访导览说明产品用途、第一步和预计 3–5 分钟体验时长；完成后可由“导览”按钮重新打开，`Escape` 关闭后焦点回到触发按钮。`localStorage` getter 被浏览器拒绝时，导览仍可用。
- 返回入口在同一标签页打开固定的 `#product-mech-atelier` 锚点。URL 单测覆盖显式环境变量、开发默认、生产默认和 `../` 相对 Hub 基址；生产产物扫描未发现 `127.0.0.1`、`localhost`、`4172` 或 `[::1]`。
- 390px 移动视口打开导览时会无焦点抢夺地关闭配置底部面板；普通关闭配置面板仍保留原有焦点返回。导览触发器与对话框的计算层级分别为 `50` 和 `60`。
- WebGL 回退仍保留导览与返回入口。将头部改为 Halo 后，摘要同步为价格 `194000`、重量 `29 / 32`、功率 `66`、防护 `43`、机动 `74`，规范 URL 同步 `v/c/h` 参数且页面只保留一个 canvas。
- 重复开关导览不会改变当前配置 URL、Halo 选中状态或摘要数值；`pagehide` 先 flush 配置持久化，再销毁导览，最后释放持久化和场景资源。

| 命令 | 新鲜结果 |
| --- | ---: |
| `npm test --workspace @showcase/mech-atelier -- showcase-hub-url` | 1/1 |
| `npm run test:browser --workspace @showcase/mech-atelier -- guide` | 7/7 |
| `npm test --workspace @showcase/mech-atelier` | 6 个文件，38/38 |
| `npm run build --workspace @showcase/mech-atelier` | 通过 |
| `npm run test:browser --workspace @showcase/mech-atelier` | 52/52（约 3.7m） |
| `npm run test:preview --workspace @showcase/mech-atelier` | 先构建再运行 `dist`；52/52（约 3.2m） |

开发矩阵第一次执行时，现有 50 次切换压力用例在 60 秒上限内停在一次 radio `check`，没有断言或资源计数不匹配；同文件独立重跑 6/6、随后完整开发矩阵 52/52 均通过，且未修改超时或核心场景逻辑，因此记录为本机 SwiftShader 并发资源波动。

## 当前组合候选与历史范围

- 当前组合候选为 `10d99e1307bce62c279c05c5b6650f65a5f403ab`。其 `npm run test:showcase-preview` 4/4 证明 Mech 普通首访导览、单一 Page、同标签返回精确 `#product-mech-atelier` 卡片与焦点，并证明组合链接没有泄漏开发端口；它不替代 Mech 完整专项矩阵。
- `43ef034d06f341f525740fbfd243a6d9aabc0b20` 只保留为历史公共根门禁候选；Task 13 修改契约后的新鲜根测试另由套件账本与 Task 13 报告登记。
- 下文发布硬化产品专项证据候选仍为历史候选 `b560d636eed004c7b09e88f34ad7c5e17adb44e9`（`fix: harden showcase release boundaries`）。
- 当前定位：可本地运行的产品配置演示；界面展示概念性积分价格，但不代表真实定价，也不含库存、订单、支付或任何商业履约承诺。
- 验证日期：2026-07-29（Asia/Shanghai）。
- 运行环境：Playwright Chromium 的确定性本地开发/生产预览；性能结论只描述本次自动化环境，不替代真机或真实用户研究。

## 自动化结果

以下结果来自产品专项证据候选 `b560d636eed004c7b09e88f34ad7c5e17adb44e9`，均以退出码 `0` 完成；本轮没有把这些专项结果冒充为 `43ef034…` 的重跑：

| 命令 | 历史候选结果 |
| --- | ---: |
| `npm test --workspace @showcase/mech-atelier` | 5 个文件，37/37 |
| `npm test --workspace @showcase/game-assets -- mech-assembly` | 11/11 |
| `npm run build --workspace @showcase/mech-atelier` | 通过 |
| `npm run test:browser --workspace @showcase/mech-atelier` | 45/45（约 3.7m） |
| `npm run test:preview --workspace @showcase/mech-atelier` | 先从当前源码构建，再以 `dist` 运行同一 45 项矩阵；45/45（约 3.5m） |

历史公共候选 `43ef034d06f341f525740fbfd243a6d9aabc0b20` 的记录为：根测试 `37` 个文件、`450/450`，根构建、`npm run validate` 和 16 项 Skill 只读审计通过。它们只描述该历史候选，不替代 `29c66e5…` 的中文导览矩阵、`b560d636…` 的发布硬化矩阵，也不冒充当前组合候选的产品全量重跑。

生产配置不再依赖调用者预先构建：其 WebServer 命令先执行 `npm run build`，再以严格端口启动 Vite preview。完整 45 项矩阵覆盖构建后的入口、配置、分享、回退、移动布局、海报、诊断、性能控制与持久化失败路径，并在常规路径中检查页面错误、控制台错误和失败资源请求。

## 功能与回退覆盖

- 默认配置、三种底盘/头部/环境切换、兼容性规范化、摘要、状态持久化、非法分享链接、确认式重置和爆炸/相机控制均有浏览器用例。
- `window.localStorage` getter 本身抛错、读取失败和延迟写入失败都经过安全边界；浏览器拒绝存储时仍可继续配置，中文提示会明确说明刷新后可能无法恢复。
- WebGL 构造异常与显式强制失败都保留配置、摘要、分享和重置；页面明确标注“3D 预览不可用”和“静态示意”，不会把回退描述为实时 3D。
- 海报使用点击时冻结的配置快照生成 1600×1200 PNG；读取失败会给出中文可操作提示，重试不下载空文件，文件名随快照配置变化。
- 键盘操作、焦点返回、`aria-live`、禁用原因和移动端 44px 触控目标均有覆盖。真实 Tab 顺序覆盖 canvas、舞台操作、十个 radio group 的当前选项、可聚焦摘要和三项分享操作；Shift+Tab 返回上一操作。390×844 还通过 CDP `Input.dispatchTouchEvent` 的 touchStart/move/end 验证画布旋转会改变相机 yaw 且不改变 `scrollY`。844×390 验证产品、底部配置面板、摘要、分享、关闭和焦点返回。
- `viewport-fit=cover` 与统一 safe-area CSS 变量已接入；review-only `reviewSafeInset=24` 使配置按钮 right/bottom 从 16px 到 24px、面板 bottom padding 从 0px 到 24px。该证据是 CSS 响应仿真，不是实体刘海设备测试。

## 性能与资源证据

所有性能采样都在 1440×900 同页、稳定预热后读取；“默认/normal”使用当前的 `control` 渲染配置。诊断将浏览器 `requestAnimationFrame` 回调间隔与包围 `renderer.render()` 的 CPU **提交**时长分开记录。后者不等待 GPU，不是完整 frame-time，也不能代表 GPU 完成时间。

| 场景 | 渲染时长 p50 / p95（第 1 轮） | 渲染时长 p50 / p95（第 2 轮） | 结论 |
| --- | --- | --- | --- |
| 1440 默认 control | 1.00 / 2.40 ms | 1.10 / 2.50 ms | CPU 提交观察值，不是帧时间门槛 |
| 1440 review full（阴影） | 2.30 / 4.80 ms | 1.80 / 3.70 ms | 仅 review 使用的 CPU 提交观察值 |
| 390×844 control，DPR 0.6 | 1.10 / 2.10 ms | 0.40 / 1.70 ms | 两次移动 CPU 提交观察值 |
| review empty 同页基线 | 0 / 0 ms | 0 / 0 ms | 不调用 `renderer.render()` |

生产构建前台稳定窗口会输出 `MECH_RAF_CADENCE_OBSERVATION`/性能矩阵中的 rAF p50、p95，供观察调度节拍；本次 Chromium 无头环境常见约 16.7、33.3、50 或 66.7ms，不能强行解释为真实设备帧率。空基线的 rAF 约 16.7ms、CPU 提交 0ms，而完整 review 的 rAF 常见 50–66.7ms、CPU 提交约 1–3ms，说明两者是不同层面的信号。未使用 `gl.finish()`；当前未取得可验证的 `EXT_disjoint_timer_query` GPU timer，因此 GPU 完成时间**未测量**。

50 次真实部件切换前后，full review 保持 `calls=51`、`triangles=4362`、`geometries=23`、`textures=3`、`listeners=7`。性能矩阵还比对 full（DPR 1/0.75/0.6）、no-shadows、key-light、control、empty 和关闭热点：review-only 的 empty 控制可证明调度与实际渲染分离；高阴影仅在 review profile 中启用，不会成为常规体验的默认负担。

## 包体

本次 `vite build` 的产物摘要：

- HTML：0.68 kB（gzip 0.38 kB）
- CSS：18.28 kB（gzip 4.99 kB）
- 入口 JavaScript：54.01 kB（gzip 19.70 kB）
- Mech 资产 JavaScript：15.35 kB（gzip 5.26 kB）
- Three.js 分包 gzip：50.98 kB、83.53 kB
- JavaScript gzip 合计：约 159.47 kB；最大单分包 gzip：83.53 kB

构建没有引入额外的本地大媒体资产；下载内容由上述应用脚本、样式和入口组成。

## 已知边界

- 这份记录不声称已完成真人可用性研究、真实低端设备性能、GPU 完成时间、真实价格体系或线上商业流程验证；它只证明所列的本地自动化与生产预览行为通过。
- Review 参数和诊断全局只在明确的 review URL 上暴露；普通 URL 不暴露诊断对象，也不会持久化这些参数。
