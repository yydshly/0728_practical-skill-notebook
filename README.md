# 雾屿灯塔 / Isle of Quiet Signals

一个由原生滚动驱动的电影式微型网站：七张对齐的 2.5D 图层维持同一片暮蓝海面，叙事在滚动中进入与退场，最后落在可拖拽、可键盘操作的四条航线档案。

## 运行

```powershell
npm install
npm run dev
npm test
npm run test:browser
npm run build
npm run preview
```

开发与预览使用 `http://127.0.0.1:4173`。首次运行浏览器测试时，如本机尚未安装 Chromium，可执行：

```powershell
npx playwright install chromium
```

生产构建输出在 `dist/`。

## 结构

- `src/scene-config.js`：文案、四条航线、时间轴段落与页头跳转点；修改故事或路线时优先从这里开始。
- `src/timeline.js`：无副作用的插值、缓动与区段计算。
- `src/stage.js`：局部滚动进度、图层 CSS 变量、视差、降级模式与档案可操作状态。
- `src/route-archive.js`：路线卡片、按钮、拖拽、键盘、实时播报与详情展开。
- `src/assets.js`：关键图像的解码等待与加载失败标记。
- `public/assets/`：母场景、七张合成图层、路线图与资源清单。

## 交互与可访问性

页头“灯塔 / 信号 / 航线”跳转到真实滚动进度。航线档案支持前后按钮、左右方向键、Home、End、触摸/鼠标拖拽和路线详情展开；状态变化会写入实时播报区域。`prefers-reduced-motion: reduce` 时，舞台回退为线性、可顺序阅读的内容。

更多交付信息见：

- [素材清单](docs/ASSETS.md)
- [时间轴地图](docs/TIMELINE.md)
- [验证报告](docs/VALIDATION.md)
