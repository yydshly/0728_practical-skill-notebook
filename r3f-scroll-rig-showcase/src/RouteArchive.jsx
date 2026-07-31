import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ROUTES } from './route-data.js'

const wrapIndex = (index) => (index % ROUTES.length + ROUTES.length) % ROUTES.length

export function RouteArchive({ activeIndex, interactive = true, onActiveIndexChange }) {
  const trackRef = useRef(null)
  const dragRef = useRef({ start: null, distance: 0 })
  const [expandedIndex, setExpandedIndex] = useState(null)
  const [routeStep, setRouteStep] = useState(0)
  const activeRoute = ROUTES[activeIndex]

  useEffect(() => {
    if (expandedIndex !== activeIndex) setExpandedIndex(null)
  }, [activeIndex, expandedIndex])

  useLayoutEffect(() => {
    const updateRouteStep = () => {
      const track = trackRef.current
      const firstCard = track?.querySelector('.route-card')
      if (!track || !firstCard) return
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0
      setRouteStep(firstCard.getBoundingClientRect().width + gap)
    }

    updateRouteStep()
    addEventListener('resize', updateRouteStep)
    return () => removeEventListener('resize', updateRouteStep)
  }, [])

  const goTo = (index) => {
    if (!interactive) return
    onActiveIndexChange(wrapIndex(index))
  }

  const onKeyDown = (event) => {
    if (!interactive) return
    const actions = {
      ArrowRight: () => goTo(activeIndex + 1),
      ArrowLeft: () => goTo(activeIndex - 1),
      Home: () => goTo(0),
      End: () => goTo(ROUTES.length - 1),
    }
    if (!actions[event.key]) return
    event.preventDefault()
    actions[event.key]()
  }

  const onPointerDown = (event) => {
    if (!interactive || event.button !== 0) return
    dragRef.current = { start: event.clientX, distance: 0 }
    trackRef.current?.setPointerCapture?.(event.pointerId)
  }

  const onPointerMove = (event) => {
    if (dragRef.current.start === null) return
    dragRef.current.distance = event.clientX - dragRef.current.start
    trackRef.current?.style.setProperty('--route-drag-x', `${dragRef.current.distance}px`)
  }

  const onPointerEnd = (event) => {
    const { start, distance } = dragRef.current
    if (start === null) return
    if (distance <= -72) goTo(activeIndex + 1)
    if (distance >= 72) goTo(activeIndex - 1)
    trackRef.current?.releasePointerCapture?.(event.pointerId)
    trackRef.current?.style.setProperty('--route-drag-x', '0px')
    dragRef.current = { start: null, distance: 0 }
  }

  return (
    <section
      id="route-archive"
      className="route-archive"
      aria-labelledby="route-title"
      aria-hidden={!interactive}
      data-interactive={interactive}
      inert={interactive ? undefined : ''}
      tabIndex="-1"
      onKeyDown={onKeyDown}
      style={{
        '--route-index': activeIndex,
        '--route-offset': `${-activeIndex * routeStep}px`,
      }}
    >
      <header className="archive-heading">
        <p className="eyebrow">航线档案 / 04</p>
        <h2 id="route-title">沿着光，认识这座岛。</h2>
        <p>四条短途航线，从潮汐、回声、日常与风开始。</p>
      </header>

      <div className="archive-viewport">
        <div
          ref={trackRef}
          className="route-track"
          role="list"
          aria-label="岛屿航线"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          {ROUTES.map((route, index) => {
            const active = index === activeIndex
            const expanded = expandedIndex === index
            return (
              <article
                key={route.id}
                className="route-card"
                role="listitem"
                aria-current={active ? 'true' : undefined}
                data-active={active}
              >
                <img src={route.image} alt={`${route.title}的岛屿场景`} loading="lazy" />
                <div className="route-card-copy">
                  <p className="eyebrow">{route.index} / 航线</p>
                  <h3>{route.title}</h3>
                  <p>{route.subtitle}</p>
                  <button
                    type="button"
                    tabIndex={interactive && active ? 0 : -1}
                    aria-expanded={expanded}
                    aria-controls={`route-detail-${index}`}
                    onClick={() => {
                      if (!interactive) return
                      goTo(index)
                      setExpandedIndex(expanded ? null : index)
                    }}
                  >
                    了解「{route.title}」
                  </button>
                  <p id={`route-detail-${index}`} className="route-detail" hidden={!expanded}>
                    {route.detail}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <div className="archive-controls" aria-label="航线控制">
        <button type="button" aria-label="查看上一条航线" onClick={() => goTo(activeIndex - 1)}>←</button>
        <p className="sr-only" aria-live="polite">
          路线 {activeIndex + 1}，共 {ROUTES.length} 条：{activeRoute.title}
        </p>
        <p className="route-count" aria-hidden="true"><span>{activeRoute.index}</span> / 04</p>
        <button type="button" aria-label="查看下一条航线" onClick={() => goTo(activeIndex + 1)}>→</button>
      </div>
    </section>
  )
}
