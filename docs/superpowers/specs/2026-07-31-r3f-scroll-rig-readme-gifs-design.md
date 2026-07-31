# r3f-scroll-rig README 双 GIF 展示设计

## 目标

为项目 08 的根 README 与项目 README 增加两张真实浏览器录制的动画 GIF，分别证明：

1. 原库 Demo 能实现 DOM/WebGL 同步、滚动驱动、Sticky 固定段落与图片视差。
2. 本仓库《雾屿灯塔》Demo 能把这些能力用于完整的滚动视觉叙事。

本次不新增双入口页面，不改造现有 Demo UI，也不提交上游仓库或临时截图目录。

## 交付物

- `docs/demos/08-r3f-scroll-rig-original.gif`
- `docs/demos/08-r3f-scroll-rig-lighthouse.gif`
- 根 `README.md` 中的双 GIF 对照展示
- `r3f-scroll-rig-showcase/README.md` 中的双 GIF 对照展示
- 可重复执行的录制脚本及必要测试

## 录制内容

### 原库 Demo

使用固定历史来源：

- 仓库：<https://github.com/14islands/r3f-scroll-rig>
- 提交：`adf7d47ea5bf3d8e8cf957b0f3667bea752e5f63`
- 仓库元数据版本：`7.0.7`
- 历史示例实际安装版本：`6.0.5`

GIF 依次展示内联 3D/WebGL 对象、Sticky 固定段落和图片视差区域。

### 灯塔 Demo

使用 `r3f-scroll-rig-showcase/` 当前实现和 `@14islands/r3f-scroll-rig 8.15.0`。GIF 依次展示开场、接近灯塔、信号阶段与路线档案，默认保持“稳定构图”模式。

## 视觉与文件约束

- 浏览器视口：`960 × 640`
- 不包含浏览器边框、调试工具或错误覆盖层
- 循环播放，目标时长约 8–12 秒
- 每张 GIF 大小在 10 KB 与 8 MB 之间
- 采用关键滚动阶段采集，保证每个能力点可辨认，不使用无法阅读的高速连续滚动

## README 表达

根 README 和项目 README 都按“原库能力 → 我们的应用”顺序嵌入 GIF，并明确写出：

- 原库 Demo 回答“这个库能做什么”。
- 灯塔 Demo 回答“我们如何把它用于真实场景”。
- 该库不是把图片自动转换成 3D 的工具。
- 上游采用 ISC 许可；本项目是独立研究与应用验证，不表示官方关联。

## 验证

- 两张文件都具有有效 GIF 签名、可循环播放且满足尺寸约束。
- 浏览器截图检查确认没有空白 Canvas、错误覆盖层、调试控件或明显裁切。
- 根测试、项目 Vitest 与生产构建全部通过。
- Git 跟踪范围不包含 `r3f-scroll-rig-legacy-demo/`、`r3f-scroll-rig-research/`、`node_modules/`、`dist/` 或临时帧目录。

