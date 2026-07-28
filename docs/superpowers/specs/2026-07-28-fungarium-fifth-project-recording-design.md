# Fungarium 第 05 项演示与录制设计

## 目标

将现有 `fungarium-product-showcase/` 作为本仓库 README 中新增的第 05 个演示单元。该单元用可观看的对照素材说明两件事：上游 Fungarium 原版的交互展厅效果，以及本仓库将其展示思路转化为中文业务能力展厅的独立探索。

## 范围与边界

- 根 README 保留现有 01–04 演示编号和内容，在目录表及正文末尾新增 05。
- 05 的本地项目仍是 `fungarium-product-showcase/`；不引入 Git submodule，也不提交上游 Fungarium 源码、模型或贴图。
- README 直接链接 `https://github.com/nesdesignco/fungarium`，并记录固定上游提交 `a139bd08fc64cf0be76bd1dae447da6848d89899`。
- README 的来源与权利边界说明会明确：上游作品及其权利归原作者；上游使用 MIT 许可；本仓库未复制其源码或第三方 GLB/PBR 素材；本展示是独立探索且不存在官方关联。

## README 结构

在目录表追加：

| 05 | Fungarium 原版与业务展厅改造 | `fungarium-product-showcase` | 对照原版的标本展厅交互与本仓库的中文业务能力展厅。 |

在正文中新增“05 · Fungarium 原版与业务展厅改造”一节，按以下顺序呈现：

1. 一句中文说明本次探索的目的。
2. 原版 Fungarium GIF，展示标本切换和观察视角。
3. 本仓库业务展厅 GIF，展示三类能力、视角切换和业务案例入口。
4. 上游链接、固定提交、来源与权利边界说明。
5. `fungarium-product-showcase/` 的本地启动、录制和验证命令链接或简短命令。

## GIF 录制

生成两段短 GIF，放在 `docs/demos/`：

- `05-fungarium-original.gif`：从本地临时运行的上游原版录制，包含至少一次标本切换和一次视角切换。
- `05-fungarium-product-showcase.gif`：从本仓库项目录制，包含三类能力之一的选择、一次视角切换和右侧业务信息面板。

录制由仓库内可重复执行的脚本生成。脚本会启动所需本地服务、等待页面就绪、执行固定交互并输出 GIF。临时的上游克隆和原始录制帧不提交；README 仅提交最终 GIF 与可重复录制说明。

## 验证

- 文档检查验证 README 中存在第 05 项、上游链接、固定提交与来源边界文字。
- 录制脚本验证两份 GIF 生成且非空。
- `fungarium-product-showcase` 继续通过单元测试、构建、浏览器测试与完整交互验证。
- 变更范围只包括根 README、`docs/demos/` 的两份 GIF、第五项的录制/文档检查文件，以及必要的项目说明；既有 01–04 演示代码不改动。
