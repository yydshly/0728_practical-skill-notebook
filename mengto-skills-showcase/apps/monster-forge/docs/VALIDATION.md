# Monster Forge｜怪物铸造所：验证记录

## 验证对象与边界

- Fix Round 1 候选验证提交：`8d66825416b09ab18005c86fa62a2ef485d40c3c`。该提交已在干净工作区运行本记录列出的完整验证；旧候选没有包含真实单指/双指触控证明，不能再作为本记录的受测版本。本文件的后继证据提交只补充这条事实，不把尚未存在的 SHA 写成“已测试”。
- 本地运行入口：在套件根目录执行 `npm run dev:forge`，默认地址为 `http://127.0.0.1:4173`。
- 确定性审阅入口：`/?review=ash-warden`；其他 ID 为 `glass-crawler`、`bell-knight`、`mire-hound`。`?capture=1` 仅用于生成目录预览。
- 本记录不代表已部署：本任务没有发布、托管或外部服务连接。

## 交付资产与真实来源

所有目录卡只使用 `<img>`，不创建卡片 canvas；每张图片经 PNG 元数据测试确认是 `512 × 512`、`RGBA`，且至少一个角像素 alpha 为 `0`。

| 目录 PNG | 尺寸与 alpha | 程序化工厂 | 来源分类 |
| --- | --- | --- | --- |
| `/asset-catalog/monsters/ash-warden.png` | 512 × 512；RGBA；透明角 | `biped` | `procedural`，项目编写的 Three.js 几何体 |
| `/asset-catalog/monsters/glass-crawler.png` | 512 × 512；RGBA；透明角 | `crawler` | `procedural`，项目编写的 Three.js 几何体 |
| `/asset-catalog/monsters/bell-knight.png` | 512 × 512；RGBA；透明角 | `armored` | `procedural`，项目编写的 Three.js 几何体 |
| `/asset-catalog/monsters/mire-hound.png` | 512 × 512；RGBA；透明角 | `quadruped` | `procedural`，项目编写的 Three.js 几何体 |

没有导入 GLB、FBX、贴图、外部 AI 图像资产或外部动画片段。实时模型来自 `packages/game-assets/src/monsters/create-procedural-monster.ts` 的四个工厂配方。

## 审阅旅程、无障碍与回退

- 桌面：在 `1440 × 900` 打开 Ash Warden，切换四项资产；检查器始终只有一个实时 canvas，支持拖拽旋转、滚轮缩放、动作与叠加切换。
- 五个确定性动作：`Idle`、`Walk`、`Attack`、`Hit`、`Death`；另有暂停/继续和重新播放。
- 键盘：原生 Tab 顺序覆盖四张卡、五个动作、暂停、重新播放、骨架/碰撞体/挂点三个复选框。焦点使用 `:focus-visible` 3px 描边；选中卡同步 `aria-pressed` 与 `aria-current`，状态区域以 `aria-live="polite"` 播报。
- 移动端：Playwright 在 `390 × 844` 竖屏与 `844 × 390` 横屏验证了无横向溢出、44 CSS px 最小控制目标和画布 `touch-action: none`。390 宽度使用 Chromium 的 `Input.dispatchTouchEvent` 真实触控事件路径：单指 down/move/up 会改变只读相机 yaw（radius 不变），双指 pinch 会在 `1.2–10` 的 clamp 内改变 radius；两种手势均保持 `scrollY` 不变，结束后 `activePointerCount` 和 `pinchDistance` 都归零。
- 减少动态效果：`prefers-reduced-motion: reduce` 模拟中，卡片的 CSS 过渡被压缩至 `0.01ms`；实时相机本来就采用即时定位，诊断值为 `cameraEasing: "none"`，因此没有在减少动态效果模式下伪造一个额外的相机动画开关。
- WebGL 回退：当 WebGL 被禁用或渲染器/模型创建失败时，仍显示同一 PNG、名称、来源、尺寸、动作、具体原因与“重试 3D 预览”按钮；重试不会新增 canvas。

## 资源、控制台与性能采样

代表性场景为 Ash Warden（`1440 × 900`、DPR `1`、`Idle`、默认叠加关闭、浏览器本地开发服务）。在启动后采样 250ms，并在 1 秒后再次采样：帧计数从 `49` 到 `110`，即样本期间新增 `61` 帧；两次均无 console error 或 page error。

| 指标 | 采样值 |
| --- | --- |
| renderer calls / frame | 15 |
| triangles / frame | 420 |
| lines / frame | 34 |
| geometries | 15 |
| textures | 1 |
| device pixel ratio | 1 |
| 生产 CSS | 6.16 kB raw / 2.04 kB gzip |
| 生产 JavaScript | 693.49 kB raw / 180.94 kB gzip |
| 生产 HTML | 0.47 kB raw / 0.35 kB gzip |

回归浏览器测试会先让一次完整替换序列稳定，再执行 20 轮四资产切换（80 次选择），并断言：仅 1 个 canvas、仅 1 个场景根、仅 1 个叠加根、纹理数不增长、几何数不增长、RAF 帧计数继续前进、console/page error 均为 0。Three.js 的 `renderer.info.memory` 会在后续帧清理已释放几何体，因此该断言以“不会增长”而不是一次性临时计数的完全相等来判断资源没有累计泄漏。

生产构建出现 Vite 的大 chunk 提示（JavaScript 超过 500 kB），这是一项已记录的性能观察，不影响本次可玩的本地审阅流程；尚未为了得到更小数字而牺牲模型审阅可读性。

## 自动化验证命令

候选提交生成后，在干净候选提交上执行下列命令；结果会在精确 SHA 证据提交中固定：

```powershell
npm test --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/monster-forge
npm test
npm run build --workspace @showcase/monster-forge
npm run validate
node scripts/check-selected-skills.mjs
git diff --check
```

## 最终审查修复：目录重捕获与模型创建故障

- 四张目录 PNG 已从当前程序化运行时重新捕获；使用各自 `?review=<id>&capture=1` 路由、固定 Idle 姿态、相机、灯光和透明背景。路径与名称不变，均为 `512 × 512` RGBA，并保留透明角。
- manifest 与运行时 provenance 现在都记录为 `delivered-captured`：目录 PNG 来自同一程序化模型的当前运行时捕获，不再标记为等待重捕获。
- `?forceModelFailure=1` 是一次性、确定性的模型构建故障夹具。首次真实模型工厂调用抛错并进入 `model-creation-failed` 边界；回退显示同一资产的 PNG、名称、程序化来源、尺寸、动作和中文具体原因。
- 故障状态下切换目录卡会同步更新回退元数据。点击“重试 3D 预览”会消费故障并复用同一渲染场景恢复真实 3D：回退隐藏、像素非空、选中资产正确，页面始终只有一个 canvas。`forceWebglFailure=1` 的独立回退旅程继续通过。
- 本节不预填最终候选 SHA；精确提交只在提交实际生成后由交付报告引用。

## 已批准的非目标

- 不部署、不发布，也不声明生产线上已验证。
- 不导入或冒充外部 GLB、FBX、贴图、AI 图像或动画资产。
- 不把此产品的运行时代码写入全局 Codex Skill，也不修改 Skill 上游来源或 Git 子模块。
