# 素材清单

所有场景层以 `1672 × 941`（16:9）对齐，来自 [母场景](../public/assets/originals/lighthouse-master.png)。场景图层均为 WebP；带 Alpha 的层由已批准的生成图层经本地抠像处理后导出。

| 角色 | 文件 | 尺寸 | Alpha | 大小 | 可见内容 / 锚点 / 深度 |
| --- | --- | --- | --- | --- | --- |
| 00 | `public/assets/scene/00-sky.webp` | 1672 × 941 | 否 | 83,844 B | 暮蓝天空与海面底图；`center bottom`；background |
| 10 | `public/assets/scene/10-distant-island.webp` | 1672 × 941 | 是 | 7,438 B | 远岛辅助层；`center horizon`；distant。因蓝景上的绿色抠像残影，当前合成中保留资源记录但不绘制。 |
| 20 | `public/assets/scene/20-sea-midground.webp` | 1672 × 941 | 是 | 9,916 B | 中景海面与岛岸；`center bottom`；midground |
| 30 | `public/assets/scene/30-lighthouse.webp` | 1672 × 941 | 是 | 38,916 B | 灯塔与屋舍主体；`center bottom`；subject |
| 40 | `public/assets/scene/40-foreground-left.webp` | 1672 × 941 | 是 | 15,846 B | 左侧近岸礁石；`left bottom`；foreground |
| 41 | `public/assets/scene/41-foreground-right.webp` | 1672 × 941 | 是 | 19,652 B | 右侧近岸礁石；`right bottom`；foreground |
| 50 | `public/assets/scene/50-edge-frame.webp` | 1672 × 941 | 是 | 27,922 B | 最前景边缘与暗角框景；`center edges`；nearest |

母场景大小为 `2,039,837 B`，仅用于保留来源和后续再导出，不参与页面请求。机器可读清单在 `public/assets/asset-manifest.json`，并由 `npm run validate:assets` 校验。

## 航线图

| 航线 | 文件 | 尺寸 | 大小 | 当前来源 |
| --- | --- | --- | --- | --- |
| 潮汐花园 | `public/assets/routes/tidal-garden.webp` | 1200 × 900 | 67,844 B | 母场景裁切临时图 |
| 回声湾 | `public/assets/routes/echo-bay.webp` | 1200 × 900 | 52,464 B | 母场景裁切临时图 |
| 守灯人居所 | `public/assets/routes/keeper-house.webp` | 1200 × 900 | 71,396 B | 母场景裁切临时图 |
| 北侧风径 | `public/assets/routes/north-wind-path.webp` | 1200 × 900 | 61,002 B | 母场景裁切临时图 |

## 待替换素材

四张路线图是明确的临时裁切，而不是正式独立摄影/插画。外部图像生成服务曾两次网络失败，因此按项目简报的降级约定使用与母场景一致的裁切构图，保证上线时的视觉连续性。正式制作时应替换为四张独立场景图，保持现有文件名、`1200 × 900` 比例和 `asset-manifest.json` 条目。
