# Fabrica 模板详情页复刻

这是项目库的第 04 个测试项目：将 [Best Website Template 的 Fabrica 详情页](https://bestwebsitetemplate.com/templates/framer/fabrica) 复刻为一个可独立运行的 React/Vite 前端，并记录网页效果是如何被拆解与重建的。

> 仅应对自己拥有或获得明确许可的网站执行复刻。页面结构和交互规律可用于学习；品牌、文案、图片、视频、字体和商标的再发布需要分别确认使用权。

## 本地运行

```powershell
npm install
npm run dev
```

验证命令：

```powershell
npm run test -- --run
npm run build
npm run test:e2e
```

## 这次如何完成复刻

复刻不是下载或拼接源站代码，而是对可见页面进行“采集、拆解、重建、校准”的过程：

1. **采集源站**：在桌面与手机视口观察全页，截取首屏、推荐区、博客区、页脚与关键状态。
2. **读取结构与规则**：通过浏览器 DOM、计算样式和交互状态，确认文本、链接、按钮、栅格、字体、比例、定位和响应式行为。
3. **测试可见交互**：核对搜索弹层、手机导航、视频暂停/播放和 Cookie 状态；每种状态都回到初始页面后再测试下一项。
4. **本地化素材**：在明确授权后，把源页实际使用的预览视频、模板/博客封面、图标和 Poppins 字体复制到 `public/assets`，成品不热链依赖源站。
5. **组件化重建**：分别实现导航、模板栏、预览媒体、信息表、相关推荐、博客、页脚与各个前景层；内容数据集中于 `src/data/pageData.js`。
6. **按坐标校准**：不只比较截图，而是对齐区块起点、卡片宽高、图像比例、网格规律、页脚位置和全页高度。桌面本地页最终对齐到源页 7,831px 的全页高度。
7. **交付验证**：运行单元测试、生产构建和浏览器交互测试；详细结果见 `design-qa.md` 与项目库外的复刻记录。

## 实现要点

- 三列棋盘式网格，而非普通的三列连续卡片：相关推荐和相关博客均通过空位控制排布节奏。
- 博客封面使用 4:3 比例，相关推荐媒体使用 16:9 比例，并由统一卡片尺寸控制垂直节奏。
- 桌面页脚为白色七栏导航，底部为超大 `WEBSITE TEMPLATES` 字标。
- 手机端保留横向媒体条、搜索弹层与独立手机导航，避免把桌面布局简单压缩。

## 目录说明

```text
src/
  components/       页面区块与交互组件
  data/pageData.js  采集并整理后的页面数据
  styles/app.css    栅格、断点与视觉校准规则
public/assets/      已获授权的本地图片、视频、图标和字体
tests/              单元测试与浏览器交互测试
design-qa.md        视觉与交互验收记录
```

## 素材与证据

- 素材来源与本地化依据：[`public/assets/ASSET-SOURCES.md`](./public/assets/ASSET-SOURCES.md)
- 项目库级复刻记录：[`../docs/interactive-refinement/fabrica-visual-refinement.md`](../docs/interactive-refinement/fabrica-visual-refinement.md)
- 临时的源站/本地对比截图保存在被 Git 忽略的证据目录中，不作为发布产物提交。
