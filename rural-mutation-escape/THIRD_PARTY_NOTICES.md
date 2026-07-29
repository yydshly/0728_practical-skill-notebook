# Third-Party Notices

本文件记录《雾村：逃离》当前已核实的研究参考、运行依赖、开发工具和可选离线工具。它不替代各项目自己的许可证文本，也不决定《雾村：逃离》的整体许可证。

## mshumer/Claude-of-Duty

- 用途：工程方法研究参考，不作为运行时依赖。
- 仓库：<https://github.com/mshumer/Claude-of-Duty>
- 固定参考提交：`d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853`
- 许可证：MIT
- 边界：未复制上游 FPS 的武器、角色、关卡、纹理、音频或商业素材；详细说明见 `docs/REFERENCES.md`。

## Three.js 0.180.0

- 用途：WebGL 场景、几何、材质、灯光、相机和数学运行时。
- 项目：<https://github.com/mrdoob/three.js>
- 许可证：MIT

## Vite 7.3.6

- 用途：本地开发服务器和生产构建。
- 项目：<https://github.com/vitejs/vite>
- 许可证：MIT

## Playwright 1.62.0

- 用途：开发环境中的 Chromium 浏览器 smoke 和视觉/交互验收。
- 项目：<https://github.com/microsoft/playwright>
- 许可证：Apache-2.0

`package.json` 的范围为 `^1.61.1`，当前锁文件解析到 1.62.0；以 `package-lock.json` 为本次迁移的可复现版本依据。

## FFmpeg/FFprobe

- 用途：可选的离线 WAV 编码、OGG/MP3 生成、响度和媒体参数测量。
- 分发状态：本仓库不分发 FFmpeg 或 FFprobe 二进制文件。
- 许可证：取决于用户自行安装的具体构建及其启用组件；用户应查阅该构建随附的许可证信息。

## Overall project license

以上声明仅用于归属和合规追踪，不决定《雾村：逃离》的整体许可证。本次 Git 迁移不新增或推定项目级许可证。
