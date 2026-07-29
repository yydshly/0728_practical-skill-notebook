# 《雾村：逃离》Git 迁移与来源说明设计

日期：2026-07-30
状态：用户已确认迁移方向，待书面规格复核

## 1. 背景与问题

工作区根目录 `0728_some_github/` 本身是 Git 仓库，远端为
`yydshly/0728_practical-skill-notebook`。它按“一个顶级目录对应一个可独立运行案例”
组织项目。

当前《雾村：逃离》位于另一个嵌套 Git 仓库：

```text
0728_some_github/
└─ claude-of-duty-research/              # 内层 Git 仓库
   └─ rural-mutation-escape/             # 当前游戏
```

内层仓库的 `origin` 指向 `mshumer/Claude-of-Duty`。因此游戏虽然已经形成独立目录
和 67 个项目相关提交，却没有被外层项目库跟踪，也没有推送到我们的远端。

## 2. 目标

1. 将游戏迁移为外层仓库的顶级项目 `rural-mutation-escape/`。
2. 保留现有项目提交历史，而不是压缩成一次复制提交。
3. 让外层仓库成为今后唯一的开发与推送归属。
4. 在项目 README 中准确说明参考来源、独立实现范围、技术方案、运行验证方式和当前限制。
5. 保留上游研究克隆作为本地参考，但不把嵌套 `.git` 或上游完整源码导入外层仓库。
6. 不混入外层主工作区现有的 README 修改、`.superpowers/`、`test-results/` 或其他临时内容。

## 3. 非目标

- 本次不实现核心逃生闭环计划中的玩法代码。
- 本次不删除内层研究克隆或它的工作树。
- 本次不提交 `node_modules/`、`dist/`、临时测试输出或本机工具路径。
- 本次不声明《雾村：逃离》是上游项目的官方版本、续作或授权改编。
- 本次不自行选择新的整体开源许可证；来源与许可证说明只记录已验证事实。
- 本次不提交尚未完成真人试听的动态音乐人工验收草稿。

## 4. 方案比较

### 方案 A：Git subtree 历史提取（采用）

从内层分支按 `rural-mutation-escape/` 路径生成过滤历史，再以非 squash subtree
导入外层仓库。

优点：

- 保留 67 个与游戏直接相关的设计、实现、测试和修复提交。
- 外层仓库得到普通目录，克隆后不需要初始化子模块。
- 不导入上游仓库根目录的 FPS 源码。
- 以后可以直接在外层仓库分支、提交和推送。

代价：

- 首次导入会产生一条 subtree 合并提交。
- Git 历史包含过滤后的旧提交哈希，不再等同于内层仓库原哈希。

### 方案 B：复制当前快照

只复制当前文件并创建一个迁移提交。

优点是简单；缺点是丢失设计决策、测试演进和修复历史，不符合本项目的 Git 研发要求。

### 方案 C：保留为子模块

把内层仓库注册为子模块。

优点是仓库边界明确；缺点是仍依赖原作者远端或额外 Fork，克隆和部署步骤复杂，
而且不能把我们的游戏自然呈现为外层案例。因此不采用。

## 5. 迁移来源与边界

迁移源固定为：

```text
内层仓库：claude-of-duty-research
源分支：codex/rural-dynamic-bgm
源提交：3f7041737d1d6ba09435e622a14482de7b5c7818
提取前缀：rural-mutation-escape/
目标仓库：yydshly/0728_practical-skill-notebook
目标分支：codex/rural-mutation-escape-migration
目标前缀：rural-mutation-escape/
```

上游研究对象固定记录为：

```text
仓库：https://github.com/mshumer/Claude-of-Duty
基准提交：d9b237b75c9304ab8d9ef4cfa0c3568c7c11a853
上游许可证：MIT
```

上游仓库只作为以下方法参考：

- Three.js/WebGL 浏览器游戏的模块化拆分；
- 程序化几何与材质的可行性；
- 可重复浏览器证据、截图回归和性能基线思路；
- 用设计契约、测试与提交历史驱动代理协作。

《雾村：逃离》具有不同的玩法、地图、叙事、镜头、角色、UI、碰撞和音频实现。
项目不导入上游 FPS 的武器、角色、关卡、纹理、音频或商业游戏素材。

## 6. 目标仓库结构

```text
0728_some_github/
├─ README.md
├─ .gitignore
├─ docs/
│  └─ superpowers/
│     ├─ specs/
│     └─ plans/
└─ rural-mutation-escape/
   ├─ README.md
   ├─ THIRD_PARTY_NOTICES.md
   ├─ .gitignore
   ├─ package.json
   ├─ package-lock.json
   ├─ index.html
   ├─ src/
   ├─ tests/
   ├─ scripts/
   ├─ audio-source/
   ├─ artifacts/
   └─ docs/
      ├─ REFERENCES.md
      └─ superpowers/
```

顶级项目目录中不得出现 `.git/` 或指向内层仓库的 gitfile。

## 7. README 与来源文档

### 7.1 外层 README

新增或修正第 06 个案例：

- 名称：《雾村：逃离》
- 路径：`./rural-mutation-escape/`
- 定位：第三人称农村变异逃生原型与 AI 辅助游戏开发研究
- 链接：项目 README、参考来源说明和可运行命令

外层 README 不再链接未被外层 Git 跟踪的 `claude-of-duty-research/`。

### 7.2 项目 README

`rural-mutation-escape/README.md` 必须包含：

1. 一句话定位和当前阶段；
2. 当前可玩内容与尚未实现的核心闭环；
3. 桌面操作说明；
4. 安装、开发、测试、音频验证和构建命令；
5. 目录结构；
6. 技术实现概览：
   - 数据驱动村庄；
   - 共享角色碰撞；
   - 第一/第三人称镜头；
   - 目标、故事和引导；
   - 追逐与危险反馈；
   - Web Audio 动态音乐；
   - Node 与 Playwright 验证；
7. 参考来源与独立实现边界；
8. 原创程序化几何和音乐来源；
9. 当前已知限制；
10. 核心闭环设计、计划和验证文档链接；
11. 非官方、非关联和商标声明。

README 不得把计划中的失败、检查点、感知 AI 和动态南门描述成已经完成的功能。

### 7.3 详细参考说明

`rural-mutation-escape/docs/REFERENCES.md` 记录：

- 上游 URL、固定提交和许可证；
- 实际借鉴的方法；
- 与上游 FPS 的结构和玩法差异；
- 未复制的资产与子系统范围；
- 本项目程序化几何、文本和音频的来源声明；
- FFmpeg 仅用于离线编码和测量，不随项目分发。

### 7.4 第三方声明

`rural-mutation-escape/THIRD_PARTY_NOTICES.md` 至少列出：

- `mshumer/Claude-of-Duty`：研究参考，MIT；
- Three.js：运行时依赖，MIT；
- Vite：开发/构建工具，MIT；
- Playwright：开发测试工具，Apache-2.0；
- FFmpeg/FFprobe：可选离线工具，许可证取决于用户安装的构建，本仓库不分发。

第三方声明不替代各项目自己的许可证文本，也不自动决定本项目整体许可证。

## 8. 原创素材与可追溯性

- 当前角色、建筑、道具和场景由本项目 Three.js 代码程序化构建。
- 当前动态音乐由 `scripts/rural-score-core.mjs` 确定性生成。
- `audio-source/manifest.json` 保存原创来源声明、生成参数、编码器版本、响度测量、
  文件大小和 SHA-256。
- 运行时 OGG/MP3 与 WAV 母带均由该流水线产生。
- 不使用《Call of Duty》或其他商业游戏的模型、纹理、音乐、音效、徽标或剧情内容。
- 后续若加入外部模型、纹理或音效，必须先更新 README、`docs/REFERENCES.md`
  和 `THIRD_PARTY_NOTICES.md`，再提交资产。

## 9. Git 与忽略规则

- 外层 `.gitignore` 的 `artifacts/` 改为 `/artifacts/`，只忽略仓库根临时输出，
  允许项目内有选择地提交浏览器证据。
- 外层 `.gitignore` 增加 `/claude-of-duty-research/`，防止误提交本地嵌套研究克隆。
- 项目 `.gitignore` 忽略 `node_modules/`、`dist/`、Playwright 临时输出和本地缓存，
  但不忽略已选择提交的 `artifacts/` 与 `audio-source/`。
- 迁移导入、来源文档与后续玩法实现分别提交，不混成一个大提交。
- 外层主工作区保持不变；所有迁移工作在隔离 worktree 和
  `codex/rural-mutation-escape-migration` 分支完成。

## 10. 验证与异常处理

### 历史和文件验证

- subtree split 前确认源提交和分支；
- 导入后确认目标目录没有嵌套 `.git`；
- 比较导入前后的已跟踪文件清单和 blob 哈希；
- 确认项目历史能看到设计、视觉、碰撞、引导和动态音乐提交；
- 确认外层仓库没有跟踪 `claude-of-duty-research/`、`node_modules/` 或 `dist/`。

### 功能验证

从新的顶级项目目录运行：

```powershell
npm.cmd install
npm.cmd run test:unit
npm.cmd run test:audio
npm.cmd run build
```

FFmpeg 可用时额外运行 `npm.cmd run audio:verify`。浏览器 smoke 在依赖安装和端口可用时运行。

从外层仓库根目录继续运行现有根级 Node 测试，确保迁移没有影响其他案例。

### 异常处理

- 如果 split 历史或文件校验不一致，删除未提交的目标 worktree 内容并重新生成，
  不修改源仓库。
- 如果 README 与主工作区已有未提交版本冲突，不在主工作区强行合并；推送隔离分支，
  通过提交或 PR 解决。
- 如果远端推送权限失败，保留本地分支和提交并报告，不改写远端地址。
- 本次不删除源克隆，因此迁移失败可无损回退。

## 11. 提交与发布

预期提交边界：

1. subtree 导入提交：保留过滤后的项目历史；
2. `docs: document rural escape provenance`：项目 README、参考说明、第三方声明；
3. `docs: register rural escape project`：外层 README 与忽略规则。

验证通过后，将 `codex/rural-mutation-escape-migration` 推送到
`yydshly/0728_practical-skill-notebook`。不直接覆盖 `main`。

## 12. 验收标准

1. 外层仓库出现可独立运行的 `rural-mutation-escape/` 普通目录。
2. 项目相关历史得到保留，且不包含上游 FPS 根目录源码。
3. 新目录中不存在嵌套 Git 元数据。
4. README 准确区分“当前已经实现”和“后续计划实现”。
5. 上游参考、固定提交、许可证、独立实现边界和原创素材来源可追溯。
6. 依赖、测试、构建和可选音频验证命令明确且可执行。
7. 外层现有测试与游戏测试通过。
8. 外层主工作区的未提交文件保持不变。
9. 迁移分支可推送到我们的远端，并可通过 Git/PR 继续开发。
