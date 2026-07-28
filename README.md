# 0728 Practical Skill Notebook

用于记录前端视觉、交互与创意编程探索的实践仓库。每个子目录都是可独立运行的案例；根 README 按可观看的演示单元组织。

## 演示目录

| 编号 | 演示 | 对应项目 | 说明 |
| --- | --- | --- | --- |
| 01 | [雾屿灯塔](./isle-of-quiet-signals/) | `isle-of-quiet-signals` | 原生滚动驱动的电影式 2.5D 灯塔场景。 |
| 02 | [雾中的信号](./isle-of-quiet-signals/) | `isle-of-quiet-signals` | 灯塔叙事中的悬挂文字帘；进入雾信号段后可被鼠标带动。 |
| 03 | [World Cup Letter Flags](./world-cup-letter-flags-demo/) | `world-cup-letter-flags-demo` | 由球员姓名拼成的国旗窗帘，字符沿 Verlet 物理线绳摆动。 |

## 01 · 雾屿灯塔

滚动会推动海雾、前景、灯塔与叙事文字进入不同层次；不是视频播放，而是页面真实滚动驱动的场景变化。

<img src="./docs/demos/01-lighthouse-scene.gif" alt="雾屿灯塔的滚动场景演示" width="720">

## 02 · 雾中的信号

在灯塔的“雾中的信号”段落，文字被排成一层悬挂的信号帘。它使用 Canvas、约束链和轻量指针冲量模拟：鼠标划过时，局部字符会被带动并自然回落。小屏与“减少动态效果”偏好会自动省略此装饰层。

<img src="./docs/demos/02-fog-signal-veil.gif" alt="灯塔雾中信号文字帘的交互演示" width="720">

## 03 · World Cup Letter Flags

一项独立的创意编程案例：西班牙、英格兰、法国和阿根廷的旗帘由完整球员名单的字母构成。移动鼠标或拖动即可让局部姓名线绳产生摆动。

<img src="./docs/demos/03-world-cup-letter-curtain.gif" alt="World Cup 字母窗帘被指针带动的演示" width="720">

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

## 相关文档

- [灯塔项目 README](./isle-of-quiet-signals/README.md)
- [灯塔素材清单](./isle-of-quiet-signals/docs/ASSETS.md)
- [灯塔时间轴设计](./isle-of-quiet-signals/docs/TIMELINE.md)
- [灯塔验证报告](./isle-of-quiet-signals/docs/VALIDATION.md)
- [World Cup 项目 README](./world-cup-letter-flags-demo/README.md)
