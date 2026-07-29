# Mech Atelier 发布验证记录

## 状态与范围

- 候选提交：`a0d55bd649d176f8478d8457d4e783324dadc607`（`feat: harden Mech Atelier release`）
- 当前定位：可本地运行的产品配置演示；不含价格、库存、订单、支付或任何商业履约承诺。
- 验证日期：2026-07-29（Asia/Shanghai）。
- 运行环境：Playwright Chromium 的确定性本地开发/生产预览；性能结论只描述本次自动化环境，不替代真机或真实用户研究。

## 自动化结果

以下每组核心检查连续执行两轮，均以退出码 `0` 完成：

| 命令 | 第 1 轮 | 第 2 轮 |
| --- | ---: | ---: |
| `npm test --workspace @showcase/mech-atelier` | 34/34 | 34/34 |
| `npm test --workspace @showcase/game-assets -- mech-assembly` | 11/11 | 11/11 |
| `npm run build --workspace @showcase/mech-atelier` | 通过 | 通过 |
| `npm run test:browser --workspace @showcase/mech-atelier` | 37/37（191.4s） | 37/37（188.8s） |
| `git diff --check` | 通过 | 通过 |

生产构建预览还执行了关键路径矩阵：

- `npx playwright test --config playwright.production.config.ts tests/browser/fallback.spec.ts tests/browser/mobile.spec.ts tests/browser/poster.spec.ts tests/browser/release-hardening.spec.ts`：13/13 通过。
- `npx playwright test --config playwright.production.config.ts tests/browser/configure.spec.ts tests/browser/share.spec.ts`：19/19 通过。

以上预览用例覆盖构建后的入口、配置、分享、回退、移动布局、海报、诊断与性能控制路径，并在常规路径中检查页面错误、控制台错误和失败资源请求。

## 功能与回退覆盖

- 默认配置、三种底盘/头部/环境切换、兼容性规范化、摘要、状态持久化、非法分享链接、确认式重置和爆炸/相机控制均有浏览器用例。
- WebGL 构造异常与显式强制失败都保留配置、摘要、分享和重置；页面明确标注“3D 预览不可用”和“静态示意”，不会把回退描述为实时 3D。
- 海报使用点击时冻结的配置快照生成 1600×1200 PNG；读取失败会给出中文可操作提示，重试不下载空文件，文件名随快照配置变化。
- 键盘操作、焦点返回、`aria-live`、禁用原因和移动端 44px 触控目标均有覆盖。390×844 竖屏和 844×390 横屏均验证产品、底部配置面板、摘要和主操作可达。

## 性能与资源证据

所有性能采样都在 1440×900 同页、稳定预热后读取；“默认/normal”使用当前的 `control` 渲染配置。诊断将浏览器 `requestAnimationFrame` 回调间隔与包围 `renderer.render()` 的 CPU 时长分开记录。

| 场景 | 渲染时长 p50 / p95（第 1 轮） | 渲染时长 p50 / p95（第 2 轮） | 结论 |
| --- | --- | --- | --- |
| 1440 默认 control | 1.00 / 2.40 ms | 1.10 / 2.50 ms | 满足 p50 < 24 ms、p95 < 34 ms |
| 1440 review full（阴影） | 2.30 / 4.80 ms | 1.80 / 3.70 ms | 仅 review 使用；仍低于阈值 |
| 390×844 control，DPR 0.6 | 1.10 / 2.10 ms | 0.40 / 1.70 ms | 两次移动采样均通过 |
| review empty 同页基线 | 0 / 0 ms | 0 / 0 ms | 不调用 `renderer.render()` |

空基线的 rAF 为约 16.7ms，而完整 review 采样的 rAF 常见 50–66.7ms；两者在渲染时长已分别为 0ms 和约 1–3ms 的情况下仍明显不同。这说明无头浏览器的 rAF 是调度节拍，不能直接当作渲染耗时；因此发布判定使用分离的 `renderer.render()` 时长，而不是 rAF。

50 次真实部件切换前后，full review 保持 `calls=51`、`triangles=4362`、`geometries=23`、`textures=3`、`listeners=7`。性能矩阵还比对 full（DPR 1/0.75/0.6）、no-shadows、key-light、control、empty 和关闭热点：review-only 的 empty 控制可证明调度与实际渲染分离；高阴影仅在 review profile 中启用，不会成为常规体验的默认负担。

## 包体

本次 `vite build` 的产物摘要：

- HTML：0.66 kB（gzip 0.36 kB）
- CSS：16.88 kB（gzip 4.64 kB）
- 入口 JavaScript：49.32 kB（gzip 18.20 kB）
- Mech 资产 JavaScript：15.35 kB（gzip 5.26 kB）
- Three.js 分包 gzip：50.98 kB、83.53 kB
- JavaScript gzip 合计：157.97 kB；最大单分包 gzip：83.53 kB

构建没有引入额外的本地大媒体资产；下载内容由上述应用脚本、样式和入口组成。

## 已知边界

- 这份记录不声称已完成真人可用性研究、真实低端设备性能或线上商业流程验证；它只证明所列的本地自动化与生产预览通过。
- Review 参数和诊断全局只在明确的 review URL 上暴露；普通 URL 不暴露诊断对象，也不会持久化这些参数。
