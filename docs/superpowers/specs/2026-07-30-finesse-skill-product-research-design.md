# Finesse Skill 产品研究设计

日期：2026-07-30  
状态：已确认，等待实施计划

## 1. 项目定位

第八个子项目命名为 `finesse-skill-product-research`。本轮只建立研究文档体系，不实现可运行网页、不安装 Skill，也不把上游 `AGENTS.md` 复制到当前仓库。

研究对象：

- 上游仓库：<https://github.com/mouse-lin/finesse-skill>
- 固定研究提交：[`ba004b21e14e55385992dff6e345db7108deca78`](https://github.com/mouse-lin/finesse-skill/tree/ba004b21e14e55385992dff6e345db7108deca78)
- 对应版本：`finesse-ui` 0.12.0
- 上游许可：MIT

项目目标不是复述上游 README，而是完成三个层次的理解：

1. 说明 Finesse 已经展示和实现了哪些能力；
2. 解释这些能力如何组成一套 AI 前端设计工作流；
3. 把可扩展方向整理成可理解、可比较、可演示的产品方案。

## 2. 交付结构

```text
finesse-skill-product-research/
├── README.md
└── docs/
    ├── CAPABILITY-MAP.md
    ├── RESEARCH-PLAN.md
    ├── PRODUCT-DIRECTIONS.md
    └── SHOWCASE-PLAN.md
```

同时修改仓库根 `README.md`：

- 在演示目录中登记第 `08` 项；
- 新增“08 · Finesse Skill 产品研究”说明；
- 明确当前交付是研究文档与产品方案，不把未来网页展厅描述成已完成能力；
- 在“相关文档”中链接第八项目 README。

## 3. 各文档职责

### 3.1 `README.md`

第八项目入口，面向第一次访问仓库的人。内容包括：

- 一句话项目结论；
- 研究对象、固定提交与许可边界；
- Finesse 是什么、又不是什么；
- 当前文档目录及推荐阅读顺序；
- 本轮交付内容与明确非目标；
- 四阶段研究路线；
- 后续产品化展厅的概念摘要；
- 当前验证状态。

README 不复制四份专题文档的全部内容，只提供结论、导航和范围边界。

### 3.2 `docs/CAPABILITY-MAP.md`

回答“这个库到底实现了什么”。按能力层而不是按文件名组织：

1. 输入理解与页面 register 路由；
2. SOUL、SPECTACLE、DENSITY 三旋钮；
3. brand、product、commerce 三条设计路线；
4. hero engine、3D、动效与降级策略；
5. dashboard、workflow、commerce 的组件与信息结构；
6. `craft`、`audit`、`redesign` 等命令式迭代；
7. `PRODUCT.md` 与 `design-model.yaml` 的多页一致性；
8. anti-cheap、preflight、静态 detector 与浏览器验证；
9. 多 Agent 工具适配方式。

每项能力必须同时写清：

- 用户问题；
- Finesse 的机制；
- 产出或行为；
- 可验证证据；
- 限制。

文档必须明确：Finesse 是设计决策与执行指导 Skill，不是浏览器运行时组件库，也不会仅靠安装自动生成产品。

### 3.3 `docs/RESEARCH-PLAN.md`

回答“我们如何研究并验证它”。采用四阶段路线：

1. **能力审计**：固定版本，阅读主 Skill、关键 references、示例和 detector；
2. **受控实验**：对同一组 brief 分别测试 brand、dashboard、workflow、commerce；
3. **对照验证**：比较无 Skill、原版 Finesse、调整后策略三组输出；
4. **产品归纳**：把有效机制沉淀为能力模型、机会地图和展厅叙事。

计划定义五组实验 brief：

- 高辨识度品牌落地页；
- 数据密集型运营仪表盘；
- 有真实提交后果的发布工作流；
- 单品 PDP；
- 多商品 PLP。

每组实验记录：

- Design Read 与三旋钮；
- 使用的 reference；
- 生成产物；
- detector 结果；
- 浏览器截图和交互证据；
- 无障碍、响应式、性能结果；
- 人工审美评审；
- 失败模式及修正命令。

评价维度固定为：方向匹配、差异化、任务可完成性、一致性、无障碍、性能、可解释性和迭代成本。没有浏览器证据时，不得把静态检查写成运行时通过。

### 3.4 `docs/PRODUCT-DIRECTIONS.md`

回答“基于现有能力，可以扩展成什么产品”。使用产品机会卡，而不是功能愿望清单。每张卡包含：

- 目标用户；
- 核心场景；
- 基于 Finesse 的现有能力；
- 需要新增的能力；
- 最小可演示闭环；
- 关键风险；
- 价值与实现成本；
- 推荐优先级。

首批方向固定为：

1. **Design Brief Router**：把自然语言需求转成 register、三旋钮和 Design Read；
2. **AI Design Review Console**：结合 detector、截图和人工规则输出分级审计；
3. **Design Model Studio**：可视化生成、比较和锁定 `PRODUCT.md` / `design-model.yaml`；
4. **Multi-Register Prototype Lab**：同一业务 brief 对照生成 brand、product、commerce 方案；
5. **Pattern Knowledge Base**：把 persona、palette、hero、workflow 与反例组织成可检索知识库；
6. **Team Governance Layer**：把强审美规则改造成团队可配置策略、例外和 CI 门禁。

推荐产品主线为“设计决策与审计工作台”，因为它能把路由、生成前决策、输出审计和设计模型串成一个可验证闭环；其他方向作为该主线的模块或后续扩展。

### 3.5 `docs/SHOWCASE-PLAN.md`

回答“未来如何用产品方式展示”。规划一个中文研究展厅，但不在本轮实现。

展厅包含五段：

1. **能力总览**：用 register 与三旋钮解释 Finesse 的决策入口；
2. **决策实验室**：输入 brief，展示 Design Read、路线和 reference 选择；
3. **三路线对照**：同一业务在 brand、product、commerce 下的不同产物；
4. **审计台**：展示 detector、浏览器证据、人工审美判断及修正命令；
5. **机会地图**：以产品卡展示六个扩展方向和推荐路线。

展厅必须区分三种状态：

- 上游已实现能力；
- 本项目已验证结论；
- 尚未实现的产品构想。

禁止用静态假界面暗示真实生成、真实审计或真实性能数据。未来若实现展厅，每个互动结果都需要真实数据或明确标注“示例”。

## 4. 研究信息流

```text
上游固定提交
  → 源码与文档证据
  → 能力地图
  → 受控实验与验证证据
  → 失败模式和边界
  → 产品机会卡
  → 产品化展厅叙事
```

`CAPABILITY-MAP.md` 只记录能力事实；`RESEARCH-PLAN.md` 定义如何验证；`PRODUCT-DIRECTIONS.md` 基于前两者提出机会；`SHOWCASE-PLAN.md` 只负责把事实、验证和构想组织成可演示产品。

## 5. 来源、原创性与更新边界

- 上游代码、文档、示例与品牌归原作者及相应权利人所有；
- 本项目是独立研究记录，不是 Finesse 官方版本、分支或续作；
- 文档会链接上游来源并固定研究提交，避免后续上游更新改变当前结论；
- 本轮不复制上游源码、示例图片或第三方素材；
- 后续如需运行实验，应在项目内记录独立的来源目录、提交 SHA、安装方式和输出证据；
- 不把 Finesse 的强审美禁令当作普适设计真理，研究时必须区分“可测工程约束”“经验性启发规则”和“主观风格偏好”。

## 6. 验证与完成标准

本轮文档交付完成需满足：

- 第八项目目录及五份 Markdown 文档存在；
- 根 README 正确登记第 `08` 项；
- 所有内部相对链接可解析；
- 上游仓库、固定提交、版本和许可记录一致；
- 文档清楚区分已实现、待验证和未来构想；
- 六个扩展方向均以产品机会卡描述；
- 展厅方案包含能力、实验、对照、审计和机会地图五段；
- 不出现 `TBD`、`TODO`、空章节或把未来功能写成已完成的表述；
- README 能让读者在不阅读上游全部文件的情况下理解研究价值与后续路线。

## 7. 非目标

- 本轮不安装或修改本机 Codex Skill；
- 不复制上游 `AGENTS.md` 到仓库根目录；
- 不克隆或 vendor 上游源码；
- 不实现网页、交互原型、API、生成器或审计服务；
- 不运行五组对照实验；
- 不生成声称来自实验的截图、评分或性能数据；
- 不替上游项目作质量背书。

## 8. 实施顺序

1. 创建第八项目目录和四份专题文档；
2. 编写项目 README，建立阅读顺序与范围边界；
3. 更新根 README 的第 `08` 项索引、说明和文档入口；
4. 扫描内部链接、固定提交、状态表述与占位符；
5. 检查 Git 差异，确保未改动其他七个项目。

