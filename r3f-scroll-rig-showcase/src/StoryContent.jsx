import { CompositionControl } from './CompositionControl.jsx'
import { NAV_POINTS } from './route-data.js'

const PHASE_META = {
  establish: { index: '01', label: '灯塔' },
  'open-coast': { index: '02', label: '守灯人' },
  approach: { index: '03', label: '信号' },
  routes: { index: '04', label: '航线' },
}

export function StoryContent({
  activePhase,
  compositionMode,
  reducedMotion,
  onCompositionModeChange,
  onNavigate,
  onSkipToRoutes,
  children,
}) {
  const current = PHASE_META[activePhase] ?? PHASE_META.establish

  return (
    <>
      <a
        className="skip-link"
        href="#route-archive"
        onClick={(event) => {
          if (!onSkipToRoutes) return
          event.preventDefault()
          onSkipToRoutes()
        }}
      >
        跳至航线档案
      </a>
      <header className="site-header">
        <button className="wordmark" type="button" onClick={() => onNavigate(0)}>
          <span>雾屿灯塔</span>
          <span>ISLE OF QUIET SIGNALS</span>
        </button>
        <nav aria-label="场景导航">
          {NAV_POINTS.map((point) => (
            <button
              key={point.id}
              type="button"
              aria-current={
                (point.id === 'lighthouse' && activePhase === 'establish') ||
                (point.id === 'signal' && activePhase === 'approach') ||
                (point.id === 'routes' && activePhase === 'routes')
                  ? 'location'
                  : undefined
              }
              onClick={() => onNavigate(point.progress)}
            >
              {point.label}
            </button>
          ))}
        </nav>
      </header>

      <CompositionControl
        mode={compositionMode}
        reducedMotion={reducedMotion}
        onChange={onCompositionModeChange}
      />

      <div className="story-copy">
        <article id="lighthouse" className="narrative-copy intro-copy copy-surface--soft">
          <p className="eyebrow">北纬 31° · 雾季航线</p>
          <h1>雾屿灯塔</h1>
          <p className="lede">有些光，不为抵达，只为让远方知道方向仍在。</p>
          <p className="scroll-cue" aria-hidden="true"><span />向雾中前行</p>
        </article>

        <article className="narrative-panel narrative-panel-keeper narrative-panel-left copy-surface--soft" data-copy-zone="left-negative-space">
          <p className="eyebrow">01 / 守灯的人</p>
          <h2>每一次点亮，<br />都是一次回答。</h2>
          <p>日落之后，守灯人沿一百二十七级石阶上行。没有掌声，也没有观众；只有海面在远处接住那束光。</p>
          <p className="fact">自 1912 年起，每晚亮起。</p>
        </article>

        <article className="narrative-panel narrative-panel-signal copy-surface--soft">
          <p className="eyebrow">02 / 雾中的信号</p>
          <h2>看不见岸时，<br />方向仍然存在。</h2>
          <p>浓雾会藏起岛屿，却藏不住光的节奏。三次短闪，一次长明，是这里写给夜航者的名字。</p>
          <p className="fact">可见距离 18 海里。</p>
        </article>

        {children}
      </div>

      <output className="chapter-indicator" aria-live="polite">
        <span>{current.index}</span><span aria-hidden="true">/</span><span>04</span>
        <strong>{current.label}</strong>
      </output>
    </>
  )
}
