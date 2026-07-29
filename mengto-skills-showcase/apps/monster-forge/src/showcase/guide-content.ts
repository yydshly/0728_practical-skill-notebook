export const MONSTER_FORGE_GUIDE = {
  productId: "monster-forge",
  guideVersion: 1,
  title: "怪物锻造所｜三步体验",
  purpose: "在同一个工作台检查怪物模型、动作和技术叠加。",
  steps: [
    "在左侧目录选择另一个怪物。",
    "切换动作，并打开骨架、碰撞体或挂点。",
    "查看来源、尺寸和模型技术信息。",
  ],
  capability: "把模型来源、动作、骨架、碰撞体和挂点放在同一个可审阅表面。",
  business: "适合游戏资产库、角色编辑器和数字资产验收，减少沟通与返工。",
  duration: "预计 2–3 分钟",
  desktopControls: [
    "点击目录卡切换怪物",
    "点击动作按钮切换动作",
    "勾选技术叠加",
  ],
  touchControls: [
    "轻触目录卡切换怪物",
    "轻触动作和技术叠加",
    "在模型上拖动旋转、双指缩放",
  ],
} as const;
