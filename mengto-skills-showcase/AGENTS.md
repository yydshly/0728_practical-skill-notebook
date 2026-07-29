# MengTo Skills Showcase 路由规则

本文件只定义本套件的开发路由。面向项目所有者的解释以 [README.md](README.md) 和 [Skill 安装与影响说明](docs/skill-installation.md) 为准。

## 通用规则

1. **Read the narrowest matching SKILL.md before acting.** 先读与当前修改最贴近、且已安装的 Skill，再开始设计、实现、测试或验证；不要一次性读取或套用所有 Skill。
2. 共享资产、来源记录、程序化/导入资源和跨产品资产适配，使用 `build-hybrid-game-assets`。
3. 根据真实任务再叠加更窄的 Skill；Skill 是开发指导，不是产品运行时模块。禁止产品从 `.codex`、`skills-source` 或其他应用的私有模块导入。
4. `skills-source/MengTo-Skills` 是固定版本的只读上游来源，**不得修改**、格式化、重命名或把项目代码写入其中。项目适配应写在 `apps/`、`packages/` 或项目文档中。
5. 仅可使用 [`config/selected-skills.json`](config/selected-skills.json) 中已批准安装的 Skill。未批准的 web-design Skill 不得因为“看起来合适”而自行接入。

## 共享包

- `packages/game-assets`、`packages/content-schema`：先读 `build-hybrid-game-assets`；涉及审阅图、来源或资产证据时再读 `build-vesperfall-review-assets`。
- `packages/three-runtime`：只在需要时读取与相机、性能或 Three.js 生命周期直接匹配的已安装 Skill；不要把产品状态放进这个包。
- `packages/input-system`、`packages/ui-system`：保持产品无关；移动端输入或性能任务分别路由到 `build-mobile-threejs-games`、`optimize-threejs-games`。

## 产品路由

### `apps/monster-forge`

- 审阅表面、资产事实、预览与证据：`build-vesperfall-review-assets`。
- 怪物结构、动作、骨架、碰撞体和插槽：`build-game-monster-system`。
- 共享资产来源或管线：`build-hybrid-game-assets`。
- 相机、关卡、敌人、AI、背包、特效、音效、移动端或性能变化，只读取当前改动真正匹配的窄范围已安装 Skill。

### `apps/ashfall-arena`

1. Arena 的基础循环先读取 `build-isometric-arpg`。
2. 然后按当前问题只读取一个或多个必要的窄范围 Skill：关卡为 `author-game-levels`；相机为 `build-game-camera-controls`；战斗为 `design-action-combat`；敌人为 `build-threejs-enemy-systems`；AI 为 `tune-enemy-ai`；背包为 `build-game-inventory`；视觉/声音反馈为 `create-game-vfx` / `build-game-audio-feedback`。
3. 移动端改动使用 `build-mobile-threejs-games`；性能问题使用 `optimize-threejs-games`。两者不能用泛化的游戏 Skill 代替。

### `apps/mech-atelier`

- 共享模型、模块、来源和材质管线遵守 `build-hybrid-game-assets`。
- Mech Atelier 当前没有批准任何 web-design Skill。只有产品需求获得明确批准、对应 Skill 被安装并记录到 `config/selected-skills.json` 后，才可以读取与这次改动最匹配的那个 web-design `SKILL.md`。
- 不得把 Ashfall Arena 的战斗、敌人、AI、存档状态带入本应用；它只拥有配置兼容性、商业属性、价格和分享状态。

## 验证与发布

- 所有三个新产品的浏览器试玩旅程、输入、降级状态和回归验证：先读 `test-playable-web-games`。
- 任何发布、部署、产物检查或交付证据：先读 `ship-web-games`。
- 任何移动端或性能改动仍需同时遵守其专用 Skill；验证 Skill 不会替代实现阶段的专用规则。
