# 产品能力展厅（Fungarium 探索项目）

这是核心仓库中的一个独立演示项目：用可操作的三维展台，把已有项目
可以为客户解决的体验类型讲清楚。它用于产品介绍、方案沟通和交互方向
讨论；它不是已经交付给某个客户的正式生产站点，也不承诺业务或性能结果。

## 可以看什么

展厅中的三件“能力展品”都指向本仓库已存在的本地案例：

1. **沉浸式叙事**：以 `isle-of-quiet-signals` 展示滚动叙事与空间体验。
2. **互动活动**：以 `world-cup-letter-flags-demo` 展示可触发的动态与参与感。
3. **产品原型**：以 `fabrica-template-detail-clone` 展示高保真页面重建与交互验证。

在页面中可选择展品、切换“概览／交互／案例”视角、拖动查看三维场景，
并使用“保存当前画面”导出一张 PNG。每个展品都保留了跳转到对应本地案例的链接。

## 启动方式

需要 Node.js 22 或更新版本。进入本目录后执行：

```bash
npm install
npm run dev
```

开发服务器启动后，按终端显示的地址在浏览器中打开即可。

## 构建与检查

```bash
npm run build
npm test
npm run test:browser
npm run verify
node scripts/check-docs.mjs
```

- `npm run build` 生成可部署的 `dist/` 文件。
- `npm test` 运行组件、状态与场景的单元测试。
- `npm run test:browser` 用浏览器覆盖展品选择、视角切换、拖动、截图和案例链接。
- `npm run verify` 在本地同时启动展厅与三个关联案例，验证真实跳转与页面交互。
- `node scripts/check-docs.mjs` 检查本说明与来源说明的必要信息是否齐全。

## 图形与降级方式

页面会优先尝试使用浏览器提供的 WebGPU；不能使用时自动改用 WebGL。若设备不支持
三维渲染，或访客设置了“减少动态效果”，页面会显示同样包含三种能力、说明和案例链接的
静态内容，因此关键信息不会依赖三维效果才能阅读。

## 与 Fungarium 的关系

本项目参考了 [nesdesignco/fungarium](https://github.com/nesdesignco/fungarium)
中“展架选品、聚焦展品、镜头切换”的交互思路，再用本仓库案例和自制程序化几何重新实现。
它不是 `fungarium` 的 npm 包、子模块或嵌入副本。具体提交、MIT 署名及资产边界见
[UPSTREAM.md](./UPSTREAM.md)；上游第三方模型与材质没有复制到这里。
