# Monster Forge 验证记录

## 已交付能力

- 四个程序化怪物各有一张从同一实时审阅模型确定性捕获的 `512×512` RGBA 透明 PNG。
- 目录卡只显示 PNG；选中后，检查器仅创建一个对应的实时 Three.js canvas。
- WebGL 不可用、渲染器初始化失败或模型创建失败时，仍显示同一 PNG、来源、尺寸、动作和具体失败原因；重试不会重复创建 canvas。
- 已检查 390×844 竖屏和 844×390 横屏：关键控制目标至少 44 CSS px、无横向溢出，画布支持拖拽与双指缩放且不会触发页面滚动。

## 可复现命令

```powershell
npm run dev:forge
npm run capture:catalog --workspace @showcase/monster-forge
npm test --workspace @showcase/monster-forge
npm run test:browser --workspace @showcase/monster-forge
```

`capture:catalog` 默认访问 `http://127.0.0.1:4173`；可用受限的本地环境变量 `MONSTER_FORGE_CAPTURE_BASE_URL` 或 `--base-url=` 指向 `localhost` / `127.0.0.1` 的隔离端口。

## 证据与边界

- 每张 PNG 都通过 `build-vesperfall-review-assets` 的 `validate_pair.py`，其真实模型来源为 `packages/game-assets/src/monsters/create-procedural-monster.ts`。
- 接触表和浏览器截图属于忽略的任务证据目录，不进入产品包；提交的产品媒体仅为四张批准 PNG。
- 未导入 GLB、FBX、贴图或任何外部 AI 图像资产，也没有执行发布。
