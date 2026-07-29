# 选定 MengTo Skills 的安装与影响说明

本项目只选用 16 个与三款可玩产品直接相关的技能。它们是给 Codex 的**开发操作规范**：帮助它在规划、实现、测试和交付时遵循合适的工作流，**不是运行时依赖**，不会被打包进游戏，也不会成为浏览器端代码的依赖。

## 来源与锁定记录

- 上游仓库：`https://github.com/MengTo/Skills.git`
- 上游记录分支：`main`（仅作来源说明；安装时不跟随分支头）
- 本地源代码位置：`mengto-skills-showcase/skills-source/MengTo-Skills`
- 当前锁定提交：`93da48f13fb1b91bdbf4718d0f49df1a469edb45`
- 锁定记录文件：`config/skill-source-lock.json`（字段为 `repository`、`branch`、`commit`、`recordedAt`）

全局安装根目录是 `C:\Users\yun68\.codex\skills`。全局安装会影响**所有 Codex 项目**的技能发现；新装的技能会从下一次 Codex 对话开始可用。

## 已选 16 项及产品影响

| 技能 | 上游路径 | 产品 ID | 阶段 ID | 对产品的影响 |
| --- | --- | --- | --- | --- |
| `build-isometric-arpg` | `agent-skills/game-development/build-isometric-arpg` | `ashfall-arena` | `foundation` | 为 Ashfall Arena 建立等距 ARPG 的可玩循环、角色移动和战斗骨架。 |
| `author-game-levels` | `agent-skills/game-development/author-game-levels` | `ashfall-arena` | `foundation` | 指导 Ashfall Arena 的关卡布局、目标与节奏。 |
| `build-game-camera-controls` | `agent-skills/game-development/build-game-camera-controls` | `ashfall-arena` | `foundation, mobile` | 让 Ashfall Arena 的镜头在鼠标、触控和窄屏下保持可控。 |
| `design-action-combat` | `agent-skills/game-development/design-action-combat` | `ashfall-arena` | `combat` | 约束动作战斗的攻击、受击、节奏和反馈。 |
| `build-threejs-enemy-systems` | `agent-skills/game-development/build-threejs-enemy-systems` | `ashfall-arena` | `combat` | 提供 Ashfall Arena 敌人生成、状态和交互的实现思路。 |
| `build-game-monster-system` | `agent-skills/game-development/build-game-monster-system` | `monster-forge` | `assets` | 支持怪物资产的属性、行为差异、骨架与动画审阅。 |
| `tune-enemy-ai` | `agent-skills/game-development/tune-enemy-ai` | `ashfall-arena` | `combat, validation` | 帮助调整 Ashfall Arena 的敌人决策与难度，避免不公平或无聊的遭遇。 |
| `build-game-inventory` | `agent-skills/game-development/build-game-inventory` | `ashfall-arena` | `foundation` | 支持 Ashfall Arena 的拾取、背包与装备选择，形成成长动机。 |
| `build-hybrid-game-assets` | `agent-skills/game-development/build-hybrid-game-assets` | `monster-forge, ashfall-arena, mech-atelier` | `assets` | 指导占位图、生成素材与手工资产的组合方式。 |
| `build-vesperfall-review-assets` | `agent-skills/game-development/build-vesperfall-review-assets` | `monster-forge` | `assets, validation` | 让 Monster Forge 的评审资产和证据更容易整理、复查。 |
| `create-game-vfx` | `agent-skills/game-development/create-game-vfx` | `ashfall-arena` | `feedback` | 为 Ashfall Arena 的攻击、命中和升级增加清晰而克制的视觉反馈。 |
| `build-game-audio-feedback` | `agent-skills/game-development/build-game-audio-feedback` | `ashfall-arena` | `feedback` | 用音效强化 Ashfall Arena 的攻击、命中与状态变化的确认感。 |
| `build-mobile-threejs-games` | `agent-skills/game-development/build-mobile-threejs-games` | `ashfall-arena` | `mobile` | 指导 Ashfall Arena 的触控输入、性能预算和移动端可玩性。 |
| `optimize-threejs-games` | `agent-skills/game-development/optimize-threejs-games` | `monster-forge, ashfall-arena, mech-atelier` | `performance` | 帮助控制绘制、资源和帧率，保持试玩稳定。 |
| `test-playable-web-games` | `agent-skills/game-development/test-playable-web-games` | `monster-forge, ashfall-arena, mech-atelier` | `validation` | 建立可复现的试玩检查，覆盖加载、输入与关键游戏循环。 |
| `ship-web-games` | `agent-skills/game-development/ship-web-games` | `monster-forge, ashfall-arena, mech-atelier` | `release` | 约束上线前检查、构建产物和可访问的试玩交付。 |

## 安装和只读审计

从 `mengto-skills-showcase` 目录运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-selected-skills.ps1
node scripts/check-selected-skills.mjs
```

安装包装脚本只把缺失的技能传给官方 `install-skill-from-github.py`，并以 `--ref 93da48f13fb1b91bdbf4718d0f49df1a469edb45` 安装锁定提交，绝不使用浮动的 `main` 作为安装引用。执行任何安装前，它会同时确认：

- `config/skill-source-lock.json` 的仓库与完整 40 位提交格式有效；
- 本地子模块 HEAD 等于锁定提交；
- 父仓库记录的 Git 子模块指针也等于同一锁定提交；
- 每个批准来源目录都包含 `SKILL.md`。

对已安装副本，脚本会按“相对路径 + 每个文件的 SHA-256”计算完整目录指纹，并与锁定来源逐项比较：

- 完全一致：报告已匹配，不重复安装。
- 有漂移：明确警告，保留现有目录且不覆盖，最终返回非零状态。
- 目录存在但缺少 `SKILL.md`：报告不完整并返回非零状态，不删除、不替换。
- 目录缺失：才调用官方安装器；安装完成后再次校验完整目录指纹。

第二条命令是只读存在性审计，会为每个选定技能输出 `name`、`installed` 和 `installPath`；任何一项缺失都会返回非零状态。锁定引用和漂移保护由候选提交 `b560d636eed004c7b09e88f34ad7c5e17adb44e9` 的自动化回归 `2/2` 覆盖。

## 更新流程（先审查，再替换）

1. 有意地更新本地子模块，而不是自动拉取；确认目标上游提交。
2. 将新的完整 SHA 与记录时间写入 `config/skill-source-lock.json`，并保留可审计的变更记录。
3. 审阅上游差异，尤其是每个 `SKILL.md` 的指令、工具调用和安全影响。
4. 逐项取得明确批准后，才替换对应的全局副本；先备份原目录，再验证新副本。
5. 在下一次 Codex 对话中确认技能发现和实际行为。

本地源代码更新与全局已安装副本**不会自动同步**；更新子模块并不会更新 `C:\Users\yun68\.codex\skills`，反过来也一样。任何替换都必须是明确批准后的单项操作。

## 安全移除流程

1. 确认准确的技能目录，例如 `C:\Users\yun68\.codex\skills\build-isometric-arpg`，不要对整个 `.codex\skills` 目录执行删除。
2. 先将该准确目录移动到 `.codex\skills` 之外的可恢复备份位置（例如用户指定的备份文件夹），不要立即删除。
3. 在下一次 Codex 对话中确认项目仍能按预期发现和使用其余技能。
4. 只有在用户明确批准后，才删除备份目录。

这套流程避免把全局技能变化误当作单个项目的变化，也保留了恢复窗口。
