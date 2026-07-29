# MengTo Skills 三产品能力展归档与 README 展示设计

**日期：** 2026-07-30
**状态：** 已获用户口头确认，等待文档审阅
**适用目录：** `mengto-skills-showcase/` 与总项目根 `README.md`

## 1. 目标

本轮把 `mengto-skills-showcase` 整理为可独立理解、可重复演示、可验证的第 07 个子项目，并为后续归档建立稳定证据。

交付结果必须让没有阅读开发记录的人从两层 README 中理解：

1. 项目参考了什么；
2. MengTo Skills 在项目中扮演什么角色；
3. 四个应用与三款产品分别做什么；
4. 项目如何从 Skill 固定、共享契约、产品实现走到自动化验收；
5. 当前效果如何直接观看；
6. 哪些内容已经验证，哪些仍未部署或需要真人、真机验证。

本轮采用“README 内置 GIF + 可部署构建”的双层交付：即使没有在线地址，GitHub README 也能直接展示当前效果；组合生产构建继续作为未来部署基础。

## 2. 非目标

- 不在本轮公开部署网站。
- 不创建 GitHub Pages、Sites 项目或其他托管资源。
- 不下载、录制或重新托管 Vesperfall 的截图、GIF、视频或源码。
- 不把 Vesperfall 描述为本项目源码来源或可复刻模板。
- 不声称 MengTo Skills 自动生成了项目。
- 不把 Showcase Hub 描述为第四款产品。
- 不关闭真人首次理解、Ashfall 首次试玩、实体设备、实体 GPU、真实浏览器 200% 缩放或公网部署等既有 `defer`。
- 不整理、提交或发布仍在独立进行的 `claude-of-duty-research/` 第 06 项内容。
- 不归档整个 GitHub 仓库；本轮归档对象只是一个子项目候选。

## 3. 来源与关系模型

README 必须把三个对象分开说明：

| 对象 | 链接 | 本项目中的角色 |
| --- | --- | --- |
| MengTo Skills | `https://github.com/MengTo/Skills` | 方法与工作流来源；Skill 是代理读取的开发操作规程 |
| 固定的 Skill 来源版本 | `https://github.com/MengTo/Skills/tree/93da48f13fb1b91bdbf4718d0f49df1a469edb45` | 本项目实际审查和安装的可复现上游版本 |
| Vesperfall | `https://vesperfall.mengto.chatgpt.site/` | 与部分游戏开发 Skill 相关的效果参考和命名背景 |
| MengTo Skills 三产品能力展 | 本仓库 `mengto-skills-showcase/` | 本项目独立设计和实现的资产审阅、动作游戏、商品配置三产品组合 |

两层 README 都要明确：

> Vesperfall 仅作为关联效果参考。本项目没有复制或重新托管其源码、模型、贴图、动画或页面素材，也不存在官方关联。

同时明确 Skill 的运行边界：

> Skill 指导 Codex 如何规划、实现、测试和交付；浏览器运行时不会加载 Skill，最终产物仍是普通的 Vite/Three.js 网页。

## 4. 产品口径

项目包含四个可运行应用，但只有三款展示产品：

| 应用 | 角色 | 主要证明 |
| --- | --- | --- |
| Showcase Hub | 统一中文入口，不是第四款产品 | 三产品关系、说明、导航、一键启动和同源组合 |
| Monster Forge | 资产审阅产品 | 程序化怪物、动作、骨架、碰撞体、插槽与来源审阅 |
| Ashfall Arena | 可玩动作游戏 | 等距 ARPG、战斗、敌人 AI、成长、存档、音画和移动端输入 |
| Mech Atelier | 复杂商品配置器 | 模块化部件、兼容性、参数摘要、分享状态和 3D 展示 |

README 不得使用“四款产品”“同一游戏的三个关卡”或“完整验证全部 MengTo Skills”等表述。

## 5. 综合 GIF

### 5.1 产物

新增唯一归档演示：

```text
docs/demos/07-mengto-skills-showcase.gif
```

总 README 和项目 README 共用该文件，避免重复媒体。

### 5.2 内容顺序

GIF 时长目标为 12–16 秒，按以下顺序展示真实产品状态：

1. Showcase Hub：首页和三产品关系；
2. Monster Forge：选择怪物并显示骨架等审阅信息；
3. Ashfall Arena：进入正常游戏后展示移动和攻击反馈；
4. Mech Atelier：更换部件并显示参数或配置摘要变化。

GIF 不包含 Vesperfall 画面，也不把外部网页嵌入录制过程。

### 5.3 捕获方式

捕获脚本遵循仓库既有 Fungarium 录制模式，但只读取当前项目：

```text
scripts/record-mengto-showcase-demo.mjs
scripts/lib/mengto-showcase-recording.mjs
```

脚本职责：

1. 从 `mengto-skills-showcase` 执行 `npm run build:showcase`；
2. 用本地 Vite preview 或等价的受控静态预览启动 `dist/showcase/`；
3. 使用仓库现有 Playwright Chromium；
4. 以固定视口、固定产品状态和真实控件交互捕获 PNG 帧；
5. 使用 FFmpeg 转换为循环 GIF；
6. 在成功或失败时关闭浏览器、预览服务并删除临时帧目录。

不得依赖已手工启动的 4172–4175 服务，也不得把开发端口写入最终 GIF 或 README 的在线链接。

### 5.4 视觉与体积预算

- 输出宽度：约 720 CSS 像素；
- 帧率：4–5 FPS；
- 循环：无限循环；
- 调色板：优先使用 FFmpeg `palettegen` / `paletteuse`，控制 Three.js 场景的颜色抖动；
- 文件体积目标：不超过 5 MiB；
- 画面必须来自真实组合构建，不使用生成式概念图；
- GIF 必须以 `GIF87a` 或 `GIF89a` 签名开头。

### 5.5 自动检查

新增只读检查入口：

```text
scripts/check-mengto-seventh-project.mjs
```

至少检查：

- GIF 文件存在、非空且签名正确；
- 文件体积不超过预算；
- 根 README 与项目 README 都引用同一相对路径；
- 两层 README 都包含 MengTo Skills、固定提交和 Vesperfall 链接；
- README 明确“三款产品”和“不部署/未公开部署”边界；
- 没有把 Vesperfall 媒体写进仓库；
- 没有把 `claude-of-duty-research/` 纳入本轮跟踪范围。

## 6. 项目 README 信息架构

`mengto-skills-showcase/README.md` 保留现有运行、安装和验证说明，并在开头重组为以下顺序：

1. 项目名称与一句话定位；
2. 综合 GIF；
3. “来源、参考与独立实现”；
4. “四个应用、三款产品”矩阵；
5. 一条命令本地运行；
6. “项目如何实现”六阶段流程；
7. 16 项 Skill 与产品/阶段映射；
8. 测试、构建和验证入口；
9. 当前归档状态、未部署说明和既有 `defer`；
10. Skill 更新与安全卸载。

既有详细安装目录、全局影响和验证证据不能因首屏重组而丢失。

## 7. 总 README 信息架构

总项目根 `README.md` 将新增：

### 7.1 目录行

```markdown
| 07 | [MengTo Skills 三产品能力展](./mengto-skills-showcase/) | `mengto-skills-showcase` | 用固定、可审计的 MengTo Skills 工作流，完成 3D 资产审阅、等距动作游戏与复杂商品配置三款独立产品，并由统一中文展厅串联体验与验证。 |
```

### 7.2 独立章节

章节包含：

- 简短定位；
- `docs/demos/07-mengto-skills-showcase.gif`；
- 三产品一句话说明；
- MengTo Skills、固定提交和 Vesperfall 外部链接；
- 项目 README 与验证账本链接；
- 本地启动命令；
- “当前未公开部署”的状态说明。

### 7.3 第 06 项保护

当前根 README 工作树包含用户尚未提交的第 06 项详细内容，且 `claude-of-duty-research/` 正在独立整理。本轮必须：

1. 保留第 06 项编号；
2. 不提交 `claude-of-duty-research/`；
3. 不覆盖或丢失用户现有的第 06 项 README 文字；
4. 若本轮需要推送根 README，则提交到 Git 索引的版本只为第 06 项保留中性“独立整理中”位置，同时加入完整第 07 项；
5. 提交后，本地第 06 项详细内容仍作为用户工作树修改保留。

在暂存和提交前必须分别检查工作树 diff、索引 diff 和最终提交内容，防止把第 06 项目录或其详细草稿误提交。

## 8. Windows 测试稳定性

新鲜完整测试已观察到：

- `tests/showcase-build.test.mjs` 中“accepts an ordinary real directory chain with the default Windows inspector”在默认 5 秒测试上限下偶发超时；
- 单独运行该测试约 2 秒通过；
- 该测试通过完整 `buildShowcase()` 路径多次调用真实 Windows inspector，每次 inspector 都启动独立 PowerShell 进程；
- 默认全套并行负载会放大 PowerShell 冷启动时间。

本轮只调整这一真实 Windows 集成测试的明确时间边界，使它能覆盖多次真实进程启动；不得：

- 删除或 mock 掉默认 Windows inspector；
- 放宽生产目录安全检查；
- 修改生产构建默认超时；
- 给整个 Vitest 套件统一增加超时；
- 用“失败后重跑一次”代替稳定门禁。

修复必须使用已观察到的完整套件失败作为 RED 证据，并在修改后执行聚焦测试与至少两次默认并行完整测试。

## 9. 部署边界

本轮不公开部署。README 应提供：

- 本地一键运行入口；
- 组合生产构建命令；
- 当前“未公开部署”的诚实状态；
- 未来可以托管 `dist/showcase/` 的说明。

不得写入虚构在线地址、预留域名或未实际验证的托管平台结论。

未来部署应作为独立任务处理，并重新验证：

- base path；
- 四入口资源；
- 同标签返回；
- TLS 与缓存；
- 404 与刷新；
- 移动设备和公网性能。

## 10. 验证与完成条件

实现完成前必须取得以下新鲜证据：

```powershell
cd mengto-skills-showcase

npm run validate
node scripts/check-selected-skills.mjs
npm test
npm test
npm run build
npm run build:showcase
npm run test:showcase-preview

cd ..
node scripts/record-mengto-showcase-demo.mjs
node scripts/check-mengto-seventh-project.mjs
git diff --check
```

并人工检查：

- GIF 可读、顺序正确、没有空白帧或错误页；
- 两层 README 在 GitHub Markdown 中结构清晰；
- 外部链接名称和关系表述准确；
- 根 README 的第 06 项用户内容仍保留在本地；
- 暂存区和提交中不包含 `.superpowers/`、`claude-of-duty-research/`、根 `test-results/` 或其他用户未跟踪内容。

若任一默认完整测试失败，不得把项目标记为稳定归档。

## 11. 提交边界

设计文档单独提交。实施阶段按逻辑拆分：

1. Windows 集成测试稳定性；
2. GIF 捕获脚本、检查脚本与生成媒体；
3. 项目 README；
4. 总 README 第 07 项及第 06 项安全占位；
5. 最终验证证据。

只有在全部门禁通过后才推送。创建版本标签或执行任何公开部署均不属于本设计的自动授权范围。
