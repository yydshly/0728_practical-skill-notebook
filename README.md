# 0728 Practical Skill Notebook

用于记录前端视觉、交互与创意编程探索的实践仓库。每个子目录都是可独立运行的案例；根 README 按可观看的演示单元组织。

## 演示目录

| 编号 | 演示 | 对应项目 | 说明 |
| --- | --- | --- | --- |
| 01 | [雾屿灯塔](./isle-of-quiet-signals/) | `isle-of-quiet-signals` | 原生滚动驱动的电影式 2.5D 灯塔场景。 |
| 02 | [雾中的信号](./isle-of-quiet-signals/) | `isle-of-quiet-signals` | 灯塔叙事中的悬挂文字帘；进入雾信号段后可被鼠标带动。 |
| 03 | [World Cup Letter Flags](./world-cup-letter-flags-demo/) | `world-cup-letter-flags-demo` | 由球员姓名拼成的国旗窗帘，字符沿 Verlet 物理线绳摆动。 |
| 04 | [Fabrica 模板详情页复刻](./fabrica-template-detail-clone/) | `fabrica-template-detail-clone` | 从线上模板详情页采集视觉、交互与素材证据后，以 React/Vite 本地重建的网页复刻案例。 |
| 05 | [Fungarium 原版与业务展厅改造](./fungarium-product-showcase/) | `fungarium-product-showcase` | 对照上游标本展厅交互与本仓库的中文业务能力展厅。 |

## 01 · 雾屿灯塔

滚动会推动海雾、前景、灯塔与叙事文字进入不同层次；不是视频播放，而是页面真实滚动驱动的场景变化。

<img src="./docs/demos/01-lighthouse-scene.gif" alt="雾屿灯塔的滚动场景演示" width="720">

## 02 · 雾中的信号

在灯塔的“雾中的信号”段落，文字被排成一层悬挂的信号帘。它使用 Canvas、约束链和轻量指针冲量模拟：鼠标划过时，局部字符会被带动并自然回落。小屏与“减少动态效果”偏好会自动省略此装饰层。

<img src="./docs/demos/02-fog-signal-veil.gif" alt="灯塔雾中信号文字帘的交互演示" width="720">

## 03 · World Cup Letter Flags

一项独立的创意编程案例：西班牙、英格兰、法国和阿根廷的旗帘由完整球员名单的字母构成。移动鼠标或拖动即可让局部姓名线绳产生摆动。

<img src="./docs/demos/03-world-cup-letter-curtain.gif" alt="World Cup 字母窗帘被指针带动的演示" width="720">

## 04 · Fabrica 模板详情页复刻

一个网页效果研究与复刻案例：先在桌面和手机端采集源页的布局、卡片网格、字体、媒体、页脚和可交互状态，再使用本地素材与组件化 React 页面重新实现。复刻重点不只是首屏，而是三列棋盘式推荐区、博客区、长页面节奏与响应式弹层。

<img src="./docs/demos/04-fabrica-template-detail.png" alt="Fabrica 模板详情页本地复刻的桌面预览" width="720">

复刻过程、目录说明、验证方式与素材边界见：[Fabrica 项目 README](./fabrica-template-detail-clone/README.md) 与 [视觉复刻记录](./docs/interactive-refinement/fabrica-visual-refinement.md)。

## 05 · Fungarium 原版与业务展厅改造

这一项记录一次“原版交互语言 → 业务展示应用”的独立探索：上游 Fungarium 用 3D 标本、观察视角与信息卡片组织内容；本仓库则把同类展示思路改造成中文能力展厅，让访客在沉浸式叙事、互动活动和产品原型之间切换，并直接进入已有案例。

原版效果（标本切换与观察视角）：

<img src="./docs/demos/05-fungarium-original.gif" alt="Fungarium 原版的标本切换与观察视角演示" width="720">

本仓库的业务展厅改造（能力选择与案例视角）：

<img src="./docs/demos/05-fungarium-product-showcase.gif" alt="中文业务能力展厅的展品和案例视角演示" width="720">

上游参考：[nesdesignco/fungarium](https://github.com/nesdesignco/fungarium)，固定提交 [`a139bd08fc64cf0be76bd1dae447da6848d89899`](https://github.com/nesdesignco/fungarium/tree/a139bd08fc64cf0be76bd1dae447da6848d89899)。上游作品及其权利归原作者所有，并适用其 MIT 许可；本仓库未复制上游源码或第三方 GLB/PBR 素材。本项目只借鉴其交互展示思路，属于独立探索，不存在官方关联。

## 获取项目库代码

```powershell
git clone https://github.com/yydshly/0728_practical-skill-notebook.git
cd 0728_practical-skill-notebook
```

项目库按案例拆分；进入对应目录后安装依赖并启动即可。Fabrica 案例位于 `fabrica-template-detail-clone/`。

## 本地运行

### 灯塔项目

```powershell
cd isle-of-quiet-signals
npm install
npm run dev
```

测试与构建：

```powershell
npm test
npm run test:browser
npm run build
```

### World Cup 字母窗帘

```powershell
cd world-cup-letter-flags-demo
npm install
npm run dev
```

构建：

```powershell
npm run build
```

### Fabrica 模板详情页复刻

```powershell
cd fabrica-template-detail-clone
npm install
npm run dev
```

验证：

```powershell
npm run test -- --run
npm run build
npm run test:e2e
```

### Fungarium 原版与业务展厅改造

```powershell
cd fungarium-product-showcase
npm install
npm run dev
npm test
npm run build
npm run test:browser
npm run verify
cd ..
node scripts/record-fungarium-demos.mjs
node scripts/check-fungarium-fifth-project.mjs
```

## 相关文档

- [灯塔项目 README](./isle-of-quiet-signals/README.md)
- [灯塔素材清单](./isle-of-quiet-signals/docs/ASSETS.md)
- [灯塔时间轴设计](./isle-of-quiet-signals/docs/TIMELINE.md)
- [灯塔验证报告](./isle-of-quiet-signals/docs/VALIDATION.md)
- [World Cup 项目 README](./world-cup-letter-flags-demo/README.md)
- [Fabrica 项目 README](./fabrica-template-detail-clone/README.md)
- [Fabrica 视觉复刻记录](./docs/interactive-refinement/fabrica-visual-refinement.md)
