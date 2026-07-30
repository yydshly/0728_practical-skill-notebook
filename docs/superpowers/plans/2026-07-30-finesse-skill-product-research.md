# Finesse Skill Product Research Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the eighth subproject as a Chinese-first research package that explains Finesse's demonstrated capabilities, defines a reproducible study method, maps product opportunities, and specifies a truthful future showcase.

**Architecture:** Keep the deliverable documentation-only. A project README provides the entry point, while four focused documents separately own capability facts, research methodology, product opportunities, and showcase design; the repository README only indexes and summarizes the eighth project.

**Tech Stack:** Markdown, Git, PowerShell verification, GitHub source links

## Global Constraints

- Create the subproject at `finesse-skill-product-research/`.
- Research `mouse-lin/finesse-skill` at commit `ba004b21e14e55385992dff6e345db7108deca78`, corresponding to `finesse-ui` 0.12.0.
- Write human-facing documentation in Chinese; keep repository names, paths, commands, identifiers, and URLs in their canonical form.
- This phase is documentation-only: do not install a Skill, clone or vendor upstream source, copy upstream `AGENTS.md`, or implement a runnable web product.
- Distinguish upstream-implemented capability, locally verified conclusion, planned experiment, and future product concept.
- Do not invent experiment scores, screenshots, runtime results, performance numbers, or product behavior.
- Preserve all seven existing subprojects and unrelated untracked files.
- Cite upstream sources and state the MIT license and unofficial-research boundary.

---

## File Map

| File | Responsibility |
| --- | --- |
| `finesse-skill-product-research/README.md` | Project conclusion, scope, reading order, research phases, current status |
| `finesse-skill-product-research/docs/CAPABILITY-MAP.md` | Evidence-backed map of what Finesse implements and its limits |
| `finesse-skill-product-research/docs/RESEARCH-PLAN.md` | Controlled experiments, evidence schema, evaluation rubric, phase gates |
| `finesse-skill-product-research/docs/PRODUCT-DIRECTIONS.md` | Six product opportunity cards and the recommended product spine |
| `finesse-skill-product-research/docs/SHOWCASE-PLAN.md` | Future Chinese showcase information architecture and truthful state model |
| `README.md` | Repository-level item 08 index, summary, and project links |

### Task 1: Establish the project entry point and capability evidence

**Files:**
- Create: `finesse-skill-product-research/README.md`
- Create: `finesse-skill-product-research/docs/CAPABILITY-MAP.md`

**Interfaces:**
- Consumes: approved design at `docs/superpowers/specs/2026-07-30-finesse-skill-product-research-design.md`
- Produces: canonical terminology and capability categories used by the other three project documents

- [ ] **Step 1: Verify the deliverable does not already exist**

Run:

```powershell
Test-Path -LiteralPath 'finesse-skill-product-research\README.md'
Test-Path -LiteralPath 'finesse-skill-product-research\docs\CAPABILITY-MAP.md'
```

Expected: both commands return `False`.

- [ ] **Step 2: Create the project README**

Write the following sections with complete Chinese prose:

```text
# Finesse Skill 产品研究
项目结论
研究对象与固定版本
Finesse 是什么 / 不是什么
研究问题
文档目录与推荐阅读顺序
四阶段研究路线
推荐产品主线
当前交付状态
范围与权利边界
```

The README must link all four `docs/*.md` documents and the exact upstream commit. It must label the future showcase as planned, not delivered.

- [ ] **Step 3: Create the capability map**

For each of these nine capability groups, add a table row or focused subsection with `用户问题 / 机制 / 输出 / 证据 / 限制`:

```text
register 路由
SOUL / SPECTACLE / DENSITY
brand 路线
product 路线
commerce 路线
命令式迭代
多页设计模型
质量门禁
多 Agent 适配
```

Use direct links to the upstream `README.md`, `skills/finesse-ui/SKILL.md`, `references/preflight.md`, and `scripts/detect.mjs` at the pinned commit.

- [ ] **Step 4: Verify Task 1**

Run:

```powershell
rg -n "ba004b21e14e55385992dff6e345db7108deca78|0\.12\.0|MIT|不是.*组件库|未来.*展厅" finesse-skill-product-research\README.md
rg -n "用户问题|机制|输出|证据|限制|register|SPECTACLE|design-model|detect\.mjs" finesse-skill-product-research\docs\CAPABILITY-MAP.md
```

Expected: every required concept appears and both commands exit `0`.

- [ ] **Step 5: Commit Task 1**

```powershell
git add finesse-skill-product-research/README.md finesse-skill-product-research/docs/CAPABILITY-MAP.md
git commit -m "docs: map finesse capabilities"
```

### Task 2: Define the research protocol and product opportunities

**Files:**
- Create: `finesse-skill-product-research/docs/RESEARCH-PLAN.md`
- Create: `finesse-skill-product-research/docs/PRODUCT-DIRECTIONS.md`

**Interfaces:**
- Consumes: capability taxonomy and terminology from `docs/CAPABILITY-MAP.md`
- Produces: experiment schema and six opportunity cards consumed by `docs/SHOWCASE-PLAN.md`

- [ ] **Step 1: Verify the two documents do not already exist**

Run:

```powershell
Test-Path -LiteralPath 'finesse-skill-product-research\docs\RESEARCH-PLAN.md'
Test-Path -LiteralPath 'finesse-skill-product-research\docs\PRODUCT-DIRECTIONS.md'
```

Expected: both commands return `False`.

- [ ] **Step 2: Write the four-phase research protocol**

Define these phases:

```text
Phase 1 能力审计
Phase 2 受控实验
Phase 3 对照验证
Phase 4 产品归纳
```

Include five fixed briefs: brand landing page, operations dashboard, consequential publish workflow, single-product PDP, and multi-product PLP.

Define one evidence record schema containing:

```text
实验 ID
上游提交
brief
Design Read
三旋钮
加载的 references
产物路径
detector 结果
浏览器证据
无障碍 / 响应式 / 性能
人工评审
失败与修正
结论状态
```

Define the eight evaluation dimensions and explicitly prohibit treating static detection as runtime proof.

- [ ] **Step 3: Write six product opportunity cards**

Create complete cards for:

```text
Design Brief Router
AI Design Review Console
Design Model Studio
Multi-Register Prototype Lab
Pattern Knowledge Base
Team Governance Layer
```

Each card must state target user, job, inherited Finesse capability, required new capability, minimal demo loop, risk, value, cost, and priority.

End with a comparison table and select `设计决策与审计工作台` as the product spine, with the other ideas positioned as modules or later phases.

- [ ] **Step 4: Verify Task 2**

Run:

```powershell
rg -n "Phase 1|Phase 2|Phase 3|Phase 4|PDP|PLP|detector|运行时证明|方向匹配|迭代成本" finesse-skill-product-research\docs\RESEARCH-PLAN.md
rg -n "Design Brief Router|AI Design Review Console|Design Model Studio|Multi-Register Prototype Lab|Pattern Knowledge Base|Team Governance Layer|设计决策与审计工作台" finesse-skill-product-research\docs\PRODUCT-DIRECTIONS.md
```

Expected: all phases, test families, evidence boundaries, six product directions, and the recommendation are present.

- [ ] **Step 5: Commit Task 2**

```powershell
git add finesse-skill-product-research/docs/RESEARCH-PLAN.md finesse-skill-product-research/docs/PRODUCT-DIRECTIONS.md
git commit -m "docs: plan finesse research and product directions"
```

### Task 3: Specify the future showcase and register item 08

**Files:**
- Create: `finesse-skill-product-research/docs/SHOWCASE-PLAN.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: capability facts, experiment plan, and opportunity cards from Tasks 1–2
- Produces: a future showcase narrative and repository-level entry point

- [ ] **Step 1: Verify root README has no existing item 08**

Run:

```powershell
rg -n "\| 08 \||## 08 ·" README.md
```

Expected: no matches and exit code `1`.

- [ ] **Step 2: Write the showcase product plan**

Document these five exhibition zones:

```text
能力总览
决策实验室
三路线对照
审计台
机会地图
```

For every zone, specify the user question, screen content, interaction, required data, empty/error state, truthful status label, and proof needed before implementation can claim the feature works.

Add a state model using these exact labels:

```text
上游已实现
本项目已验证
计划验证
产品构想
```

Include a recommended desktop information architecture, mobile collapse rules, planned data flow, accessibility expectations, and a phased implementation roadmap. Clearly state that no showcase code exists in this delivery.

- [ ] **Step 3: Add item 08 to the repository README**

Add:

1. one `08` row to the existing demo table;
2. one `## 08 · Finesse Skill 产品研究` section after item 07;
3. project and document links in the related-document section.

The section must summarize the capability map, research method, six product directions, and recommended design-decision-and-audit workspace. It must state that the current deliverable is documentation, while the interactive showcase remains planned.

- [ ] **Step 4: Verify Task 3**

Run:

```powershell
rg -n "\| 08 \| Finesse Skill 产品研究|## 08 · Finesse Skill 产品研究|finesse-skill-product-research" README.md
rg -n "能力总览|决策实验室|三路线对照|审计台|机会地图|上游已实现|本项目已验证|计划验证|产品构想|尚未实现" finesse-skill-product-research\docs\SHOWCASE-PLAN.md
```

Expected: root indexing and all truthful showcase states are present.

- [ ] **Step 5: Commit Task 3**

```powershell
git add README.md finesse-skill-product-research/docs/SHOWCASE-PLAN.md
git commit -m "docs: register finesse research as project eight"
```

### Task 4: Validate the complete research package

**Files:**
- Verify: `finesse-skill-product-research/**/*.md`
- Verify: `README.md`

**Interfaces:**
- Consumes: all outputs from Tasks 1–3
- Produces: evidence that the documentation package is internally consistent and isolated from the other seven projects

- [ ] **Step 1: Verify the exact file set**

Run:

```powershell
Get-ChildItem -LiteralPath 'finesse-skill-product-research' -Recurse -File | ForEach-Object {
  $_.FullName.Substring((Resolve-Path '.').Path.Length + 1)
}
```

Expected: exactly five Markdown files under the project directory.

- [ ] **Step 2: Scan for placeholders and false-completion language**

Run:

```powershell
rg -n "TBD|TODO|待补充|稍后填写|已经上线|已完成展厅|实测帧率|评分：[0-9]" finesse-skill-product-research README.md
```

Expected: no placeholder or false-completion matches. References that explicitly say these terms are prohibited must be reviewed manually and excluded from the failure count.

- [ ] **Step 3: Check local Markdown links**

From each of the five project Markdown files, resolve every relative Markdown target against that file's directory. Verify every non-anchor target exists. Verify the root README link to `finesse-skill-product-research/` resolves.

Expected: zero missing local targets.

- [ ] **Step 4: Verify provenance and scope consistency**

Run:

```powershell
rg -n "ba004b21e14e55385992dff6e345db7108deca78" finesse-skill-product-research
rg -n "MIT|非官方|独立研究|不.*运行时|不.*组件库" finesse-skill-product-research
git diff --check
git status --short
```

Expected:

- the pinned SHA is recorded in the project entry and research plan;
- the license and unofficial boundary are present;
- no whitespace errors;
- only the intended README and project documentation files are changed, aside from pre-existing `.superpowers/` and `test-results/`.

- [ ] **Step 5: Review the final diff**

Run:

```powershell
git diff -- README.md finesse-skill-product-research
```

Expected: no edits to the other seven subprojects and no claims that planned experiments or showcase functionality have already been completed.

- [ ] **Step 6: Commit validation corrections if needed**

If validation required corrections:

```powershell
git add README.md finesse-skill-product-research
git commit -m "docs: validate finesse research package"
```

If no correction was required, do not create an empty commit.

