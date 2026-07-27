export const SCENE = Object.freeze({
  scrollLength: 4400,
  ranges: Object.freeze({
    intro: { start: 0.03, end: 0.18 },
    opening: { start: 0.15, end: 0.25 },
    storyA: { start: 0.25, end: 0.44 },
    panorama: { start: 0.44, end: 0.48 },
    storyB: { start: 0.48, end: 0.69 },
    refocus: { start: 0.69, end: 0.76 },
    archive: { start: 0.75, end: 0.96 },
    controls: { start: 0.91, end: 1 },
  }),
});

export const NAV_POINTS = Object.freeze([
  { id: "lighthouse", label: "灯塔", progress: 0 },
  { id: "signal", label: "信号", progress: 0.5 },
  { id: "routes", label: "航线", progress: 1 },
]);

export const ROUTES = Object.freeze([
  {
    id: "tidal-garden",
    index: "01",
    title: "潮汐花园",
    subtitle: "退潮后，海面留下自己的花园。",
    image: "/assets/routes/tidal-garden.webp",
    detail: "浅水石池收集着海藻、贝壳与一整夜的星光。",
  },
  {
    id: "echo-bay",
    index: "02",
    title: "回声湾",
    subtitle: "浪声总会晚半拍归来。",
    image: "/assets/routes/echo-bay.webp",
    detail: "海蚀洞把每一次潮涌折返成更低沉的回响。",
  },
  {
    id: "keeper-house",
    index: "03",
    title: "守灯人居所",
    subtitle: "时间在盐蚀的木窗上留下刻度。",
    image: "/assets/routes/keeper-house.webp",
    detail: "工具、日志与旧制服仍按最后一次值守的顺序陈列。",
  },
  {
    id: "north-wind-path",
    index: "04",
    title: "北侧风径",
    subtitle: "沿草坡去岛上最高的地方。",
    image: "/assets/routes/north-wind-path.webp",
    detail: "风径尽头可以同时看见灯塔、外海与归港的白线。",
  },
]);
