# 《雾村：逃离》

一个以黄昏农村、居民躲藏和突发变异为背景的桌面浏览器逃生序章原型；默认第三人称、可切换第一人称。当前版本可完成一条四步线性调查路线，但还不是包含失败与重试的完整游戏。

## 当前状态

项目用于研究“从地图定义、场景搭建、角色与碰撞，到任务、追逐、引导和动态音乐”的可复现 Web 游戏开发流程。运行时使用 Three.js 和原生 JavaScript，角色、建筑、道路、植被、道具与灯光均由项目代码程序化构建。

当前固定版本可以从主角家出发，调查收音机、寻找躲藏的邻居、取得粮仓旁的手电，并在取得手电后进入南门中心半径 4.5 米的出口触发区完成序章。南门目前是开放式静态景物；章节完成后主循环仍继续运行，追逐也继续运行。

## 当前可玩内容与尚未实现范围

| 领域 | 当前已经实现 | 当前未实现或本轮不包含 |
| --- | --- | --- |
| 故事流程 | 收音机 → 邻居 → 手电 → 南门中心半径 4.5 米的出口触发区的四步线性目标与字幕 | 核心闭环已规划正式变异揭示、失败恢复和重复游玩；分支叙事不在本轮范围 |
| 玩家 | WASD 移动、冲刺、交互、第一/第三人称切换、程序化步行动画 | 战斗、武器、血量和背包不在本轮范围；手柄和移动端触控尚未支持 |
| 敌人 | 单个变异体沿导航点巡逻；`patrol/chase/threaten/lost` 距离阈值状态机；`threaten` 只保持近距间隔，不造成攻击或捕获 | 核心闭环已规划视野/听觉、遮挡、记忆、攻击前摇和捕获；不规划敌人死亡系统 |
| 地图与碰撞 | 数据驱动的村庄边界、建筑、院墙、路障和路灯杆；玩家与追逐者各自与同一组静态 world collider 做 box/circle 碰撞 | 导航图寻路、动态门碰撞、玩家与敌人的实体互斥 |
| 南门 | 目标锚点、开放式静态景物和进入中心半径 4.5 米出口触发区后的章节完成 | 需要持续交互开启的南门、开门动画、门外单向结算线和最终追逐 |
| UI 与引导 | 任务卡、罗盘与距离、世界/屏幕标记、靠近提示、顺序教程、危险反馈、声音按钮 | 核心闭环已规划失败层、确定性检查点重试、常驻结算层和重新游玩；开始/暂停菜单与检查点选择器不在本轮范围 |
| 音频 | 探索循环、危险层、揭示/逃离短句、交互提示和心跳；手势解锁、静音与页面生命周期 | 捕获、重试和动态开门流程对应的新语义音频 |

核心闭环规划中的失败/重试、三个检查点、视野与听觉感知 AI、真实捕获流程、持续交互开启的南门、动态门碰撞、穿门结算和完成后停机，当前版本尚未实现。设计与实施计划存在不代表运行时代码已经完成。

## 桌面操作

| 输入 | 作用 |
| --- | --- |
| `W/A/S/D` | 按镜头方向移动 |
| `Shift` | 冲刺 |
| 左键点击游戏画面 | 请求指针锁定 |
| 指针锁定成功后移动鼠标 | 环顾；按 `Esc` 由浏览器释放指针锁定 |
| 若指针锁定失败 | 按住左键拖动环顾 |
| `C` | 切换第一/第三人称镜头 |
| 靠近当前目标后按 `E` | 调查收音机、询问邻居或拾取手电 |
| 右上角声音按钮 | 解锁、开启或静音游戏声音 |

鼠标左键点击游戏画面请求指针锁定。锁定成功后移动鼠标即可环顾；若锁定失败，则按住左键拖动环顾。

当前游戏没有暂停菜单。`Esc` 只用于浏览器释放指针锁定，不会暂停游戏。

## 安装与运行

需要近期 Node.js/npm 和支持 WebGL、Web Audio 的桌面浏览器。

```powershell
cd rural-mutation-escape
npm.cmd install
npm.cmd run dev
```

打开 Vite 输出的本地地址。声音受浏览器自动播放策略限制，首次进入后按任意游戏键、点击画面或点击声音按钮完成可信手势解锁。

自动化或发布验收需要严格使用锁文件时，使用 `npm.cmd ci` 代替 `npm.cmd install`。

## 测试、音频与构建

```powershell
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd test
npm.cmd run build
```

- `test:unit`：碰撞、相机、目标、引导、敌人状态、音频状态等 Node 单元测试。
- `test:audio`：校验音频 manifest、文件元数据和内容哈希。
- `test`：依次运行单元测试、音频测试和 Playwright 浏览器 smoke。首次运行浏览器测试的环境若没有 Chromium，可执行 `npx.cmd playwright install chromium`。
- `build`：生成 Vite 生产构建到本地 `dist/`；该目录不提交。

动态音乐的离线流水线：

```powershell
npm.cmd run audio:render
npm.cmd run audio:encode
npm.cmd run audio:build
npm.cmd run audio:verify
```

`audio:render` 使用确定性脚本生成 WAV 母带和 manifest；编码与验证需要用户自行安装的 FFmpeg/FFprobe。可通过 `RURAL_SCORE_FFMPEG` 和 `RURAL_SCORE_FFPROBE` 指向可执行文件。项目不分发 FFmpeg。

## 目录结构

```text
rural-mutation-escape/
├─ index.html                     # 游戏页面和 HUD 容器
├─ package.json                   # 运行、测试、音频与构建脚本
├─ src/
│  ├─ main.js                     # 浏览器装配、输入与逐帧循环
│  ├─ level-data.js               # 地图边界、锚点、区域、碰撞体和导航点
│  ├─ level.js                    # 场景构建与地图对象汇总
│  ├─ world/                      # 建筑、材质和农村道具
│  ├─ player.js                   # 玩家移动
│  ├─ characters.js               # 程序化拟人角色与变异体
│  ├─ collision.js                # box/circle 共享碰撞求解
│  ├─ camera*.js                  # 第一/第三人称、遮挡和指针输入
│  ├─ story.js / objectives.js    # 线性故事状态与目标定义
│  ├─ guidance.js / ui.js         # 导航、提示、HUD 与声音控件
│  ├─ pursuer.js / danger.js      # 距离追逐和危险反馈
│  ├─ audio-*.js                  # Web Audio 反馈与生命周期
│  ├─ music-director.js           # 动态音乐层和叙事短句调度
│  └─ assets/audio/               # 运行时 OGG/MP3
├─ scripts/                       # 原创配乐生成、编码和验证
├─ audio-source/                  # WAV 母带和可追溯 manifest
├─ tests/                         # Node、音频和 Playwright 验证
├─ artifacts/                     # 选定提交的浏览器视觉证据
└─ docs/                          # 设计、计划、来源和验证记录
```

## 技术方案

### 数据驱动村庄

`src/level-data.js` 集中定义地图边界、故事锚点、区域、建筑、道路、灯光、道具碰撞体和巡逻节点；`src/level.js` 与 `src/world/` 将这些数据构造成 Three.js 场景。地图布局和渲染生成分离，便于以后替换地图而不重写任务和碰撞入口。

### 共享角色碰撞

`src/collision.js` 提供 box/circle 碰撞和滑动求解，`src/player.js` 与 `src/pursuer.js` 分别使用同一组由关卡数据生成的静态 world collider。建筑、院墙、路障和路灯杆会阻挡人物；玩家与追逐者之间没有通用实体互撞或推挤系统，南门景物也没有动态 gate collider。

### 第一/第三人称镜头

`src/camera.js`、`src/camera-math.js` 和 `src/camera-pointer-input.js` 负责跟随、视角切换、俯仰/偏航限制和 pointer-lock/拖动回退。第三人称镜头对 `buildStructure()` 暴露的可见建筑遮挡 mesh 做 raycast 收缩；它不读取静态角色碰撞体的 `blocksCamera` 标记。

### 目标、故事与引导

`src/objectives.js` 定义四个目标及锚点，`src/story.js` 只处理顺序 flag 和目标转换；`src/guidance.js`、`src/world-marker.js`、`src/tutorial.js` 与 `src/ui.js` 派生任务卡、罗盘、距离、世界标记、交互提示和教程。

### 追逐与危险反馈

`src/pursuer.js` 当前是单敌人的距离阈值状态机，并沿少量导航点巡逻。`lost` 是回到巡逻前的短暂过渡；`threaten` 表示近距停步、朝向玩家并保持约 2.2–2.4 米间距，不造成攻击或捕获。`src/danger.js` 只根据追逐状态和距离输出危险标签、画面强度与心跳速度。

### Web Audio 动态音乐

`src/music-director.js` 同步探索与危险循环并调度揭示/逃离短句；`src/audio-feedback.js` 合成交互提示与心跳；`src/audio-lifecycle.js` 串行协调 `visibilitychange` 引发的暂停与恢复；BFCache 的持久 `pagehide/pageshow` 会保留监听并恢复音频，非持久 `pagehide` 才执行终止清理。快速隐藏/恢复或单次音频操作失败不会让后续协调永久卡死。运行时优先 OGG、回退 MP3。

### Node 与 Playwright 验证

`tests/unit.mjs` 覆盖纯逻辑与状态，`tests/audio-assets.mjs` 校验音频资产，`tests/smoke.mjs` 在真实 Chromium 页面中验证控制、UI、镜头、碰撞、音频回退、视口和浏览器证据。

## 参考来源、原创性与许可边界

本项目研究参考了 [mshumer/Claude-of-Duty](https://github.com/mshumer/Claude-of-Duty) 在固定提交 `d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853` 的工程组织方法；上游使用 MIT 许可证。借鉴范围限于模块化 Three.js/WebGL 结构、程序化几何可行性、可重复浏览器证据/性能基线，以及用设计契约、测试和 Git 历史驱动 AI 协作。

《雾村：逃离》的玩法、农村地图、故事、镜头、拟人角色、UI、碰撞和音频流水线为本项目独立实现。项目未复制上游 FPS 的武器、角色、关卡、纹理、音频或商业游戏素材，也不是上游的官方版本或续作。详细边界见 [参考来源说明](./docs/REFERENCES.md) 和 [第三方声明](./THIRD_PARTY_NOTICES.md)。

当前角色、建筑、道路、植被和道具由 Three.js 代码程序化生成。动态音乐由 `scripts/rural-score-core.mjs` 确定性创作；`audio-source/manifest.json` 记录生成参数、编码器信息、响度、文件大小和 SHA-256。若以后引入外部模型、纹理或音效，必须先更新本 README、参考来源说明和第三方声明。

本次迁移只记录第三方事实，不为《雾村：逃离》选择整体许可证。

## 已知限制

- 当前是桌面浏览器原型；窄屏只做界面显示验证，不代表移动端可玩。
- 敌人按距离发现玩家，可能被复杂障碍卡住；没有视线、声音、记忆或攻击系统。
- 进入南门中心半径 4.5 米的出口触发区会直接完成，门本身没有交互、动画和动态碰撞。
- 没有失败状态、检查点、可靠重试、暂停菜单或完成后冻结；章节完成后主循环仍继续运行，追逐也继续运行。
- 玩家和敌人分别与静态世界碰撞，但彼此没有完整的实体碰撞响应。
- 程序化低多边形角色和场景用于验证流程，不代表最终美术品质。
- 音频需要可信用户手势；FFmpeg 只用于可选离线生成和测量。

## 核心闭环研究文档

- [核心闭环设计](./docs/superpowers/specs/2026-07-30-rural-mutation-escape-core-loop-design.md)
- [核心闭环实施计划](./docs/superpowers/plans/2026-07-30-rural-mutation-escape-core-loop.md)
- [核心闭环验证状态](./docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop-status.md)

设计与计划描述尚未落地的 2–4 分钟逃生闭环；验证状态文件明确记录当前证据边界。最终验收报告只会在计划的浏览器验收任务真正执行后生成于 `docs/superpowers/validation/2026-07-30-rural-mutation-escape-core-loop.md`，不应将计划清单或“尚未执行”状态页视为完成功能。

其他实现历史可在 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 中查看，包括初始原型、视觉升级、共享电杆碰撞、任务引导和原创动态音乐。

## 非官方声明

《雾村：逃离》是独立研究原型，与 Activision、Call of Duty 品牌、`mshumer/Claude-of-Duty` 的作者或其他商业游戏权利人没有官方关联、认可、赞助或授权关系。第三方名称和商标仅用于准确说明研究参考与权利归属，相关权利归各自所有者。
