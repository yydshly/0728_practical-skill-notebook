export const CAPABILITIES = [
  {
    id: "immersive-storytelling",
    railLabel: "沉浸式叙事",
    title: "让产品故事可以被亲手探索",
    discipline: "滚动叙事与空间体验",
    scenario: "品牌官网、目的地介绍与高价值方案提案",
    outcome: "把复杂价值组织为可感知、可停留、可分享的体验。",
    proof: "雾岛灯塔：滚动驱动的 2.5D 场景与可操作的航线档案。",
    caseHref: "../isle-of-quiet-signals/",
    accent: "#c9964f",
    artifact: "lighthouse",
  },
  {
    id: "interactive-campaign",
    railLabel: "互动活动",
    title: "让访客参与，而不只是观看",
    discipline: "可触发的动态与指针交互",
    scenario: "活动页、发布节点与社交传播场景",
    outcome: "用即时反馈把品牌信息变成愿意停留和分享的参与时刻。",
    proof: "World Cup Letter Flags：由球员姓名组成、可被指针带动的物理旗帜。",
    caseHref: "../world-cup-letter-flags-demo/",
    accent: "#a63e2d",
    artifact: "flags",
  },
  {
    id: "product-prototype",
    railLabel: "产品原型",
    title: "让决策在真实界面中发生",
    discipline: "高保真页面重建与交互验证",
    scenario: "产品方向验证、营销页迭代与设计还原评审",
    outcome: "将静态想法变成可操作的页面，在开发前确认信息层级与互动。",
    proof: "Fabrica Template Detail Clone：以本地 React 页面重建并验证完整模板详情体验。",
    caseHref: "../fabrica-template-detail-clone/",
    accent: "#5f7694",
    artifact: "prototype",
  },
];

export const SHOWCASE_CAMERAS = {
  overview: { label: "概览", position: [0, 1.24, 3.5], target: [0, 0.82, -0.5] },
  interaction: { label: "交互", position: [0.35, 0.58, 1.65], target: [0, 0.48, -0.5] },
  case: { label: "案例", position: [0.15, 2.25, 0.75], target: [0, 0.2, -0.5] },
};
