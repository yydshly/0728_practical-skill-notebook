const SCENE_LAYERS = [
  ['sky', '/assets/scene/00-sky.webp'],
  ['distant', '/assets/scene/10-distant-island.webp'],
  ['midground', '/assets/scene/20-sea-midground.webp'],
  ['lighthouse', '/assets/scene/30-lighthouse.webp'],
  ['foreground-left', '/assets/scene/40-foreground-left.webp'],
  ['foreground-right', '/assets/scene/41-foreground-right.webp'],
  ['frame', '/assets/scene/50-edge-frame.webp'],
]

export function StaticLayerStack({ reducedMotion = false }) {
  const stableStyle = reducedMotion
    ? { animation: 'none', transform: 'none', transition: 'none' }
    : undefined

  return (
    <div className="fallback-stack" role="img" aria-label="暮蓝海面上的雾屿灯塔">
      {SCENE_LAYERS.map(([name, source]) => (
        <img key={name} data-layer={name} src={source} alt="" draggable="false" style={stableStyle} />
      ))}
      <div className="scene-grade" />
      <div className="scene-grain" />
      <div className="static-beacon" style={stableStyle} />
    </div>
  )
}
