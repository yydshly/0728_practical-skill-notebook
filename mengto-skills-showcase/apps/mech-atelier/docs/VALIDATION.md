# Mech Atelier 发布验证记录

## 状态与范围

- 候选提交：`b560d636eed004c7b09e88f34ad7c5e17adb44e9`（`fix: harden showcase release boundaries`）
- 当前定位：可本地运行的产品配置演示；界面展示概念性积分价格，但不代表真实定价，也不含库存、订单、支付或任何商业履约承诺。
- 验证日期：2026-07-29（Asia/Shanghai）。
- 运行环境：Playwright Chromium 的确定性本地开发/生产预览；性能结论只描述本次自动化环境，不替代真机或真实用户研究。

## 自动化结果

以下是本轮候选的一次完整检查，均以退出码 `0` 完成；历史轮次不作为本轮结论：

| 命令 | 本轮结果 |
| --- | ---: |
| `npm test --workspace @showcase/mech-atelier` | 5 个文件，37/37 |
| `npm test --workspace @showcase/game-assets -- mech-assembly` | 11/11 |
| `npm run build --workspace @showcase/mech-atelier` | 通过 |
| `npm run test:browser --workspace @showcase/mech-atelier` | 45/45（约 3.7m） |
| `npm run test:preview --workspace @showcase/mech-atelier` | 先从当前源码构建，再以 `dist` 运行同一 45 项矩阵；45/45（约 3.5m） |
| 根工作区 `npm test` | 37 个文件，447/447 |
| 根工作区 `npm run build` / `npm run validate` | 通过 / 通过 |
| `git diff --check` | 通过 |

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
