import { useEffect, useRef, useState } from 'react'
import { LighthouseExperience } from './LighthouseExperience.jsx'
import { RouteArchive } from './RouteArchive.jsx'
import { StaticLayerStack } from './StaticLayerStack.jsx'
import { StoryContent } from './StoryContent.jsx'
import {
  LEGACY_COMPOSITION,
  LOCKED_COMPOSITION,
  readCompositionMode,
  withCompositionMode,
} from './composition-mode.js'
import {
  deriveSceneFrame,
  isArchiveFrameInteractive,
  progressToScrollTop,
} from './story.js'

const readReducedMotion = () =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

export function App() {
  const storyRef = useRef(null)
  const stageRef = useRef(null)
  const phaseRef = useRef('establish')
  const [activePhase, setActivePhase] = useState('establish')
  const [routeIndex, setRouteIndex] = useState(0)
  const [archiveInteractive, setArchiveInteractive] = useState(false)
  const [archiveFocusRequested, setArchiveFocusRequested] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(readReducedMotion)
  const [compositionMode, setCompositionMode] = useState(
    () => readCompositionMode(window.location.search)
  )
  const [canvasFailed, setCanvasFailed] = useState(false)
  const params = new URLSearchParams(window.location.search)
  const forceFallback = params.has('fallback')
  const forceTextureFailure = params.has('texture-fail')
  const effectiveReducedMotion = params.has('reduced') || reducedMotion
  const effectiveCompositionMode = effectiveReducedMotion
    ? LOCKED_COMPOSITION
    : compositionMode
  const sceneMode = forceFallback || canvasFailed ? 'fallback' : 'enhanced'

  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const update = (event) => setReducedMotion(event.matches)
    query?.addEventListener?.('change', update)
    return () => query?.removeEventListener?.('change', update)
  }, [])

  useEffect(
    () => () => document.documentElement.classList.remove('webgl-ready', 'webgl-degraded'),
    []
  )

  const handleSceneReady = ({ degraded = false } = {}) => {
    document.documentElement.classList.toggle('webgl-ready', !degraded)
    document.documentElement.classList.toggle('webgl-degraded', degraded)
  }

  const handleSceneLoading = () => {
    document.documentElement.classList.remove('webgl-ready', 'webgl-degraded')
  }

  const handleSceneError = () => {
    document.documentElement.classList.remove('webgl-ready', 'webgl-degraded')
    setCanvasFailed(true)
  }

  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const story = storyRef.current
      if (!story) return
      const travel = Math.max(1, story.offsetHeight - window.innerHeight)
      const nextProgress = Math.min(
        1,
        Math.max(0, (window.scrollY - story.offsetTop) / travel)
      )
      const frame = deriveSceneFrame(nextProgress, {
        compositionMode: effectiveCompositionMode,
        reducedMotion: effectiveReducedMotion,
        routeIndex,
        viewportWidth: window.innerWidth,
      })
      story.style.setProperty('--story-progress', String(nextProgress))
      story.style.setProperty('--intro-opacity', String(frame.copy.intro))
      story.style.setProperty('--keeper-opacity', String(frame.copy.keeper))
      story.style.setProperty('--signal-opacity', String(frame.copy.signal))
      story.style.setProperty('--archive-progress', String(frame.copy.routes))
      setArchiveInteractive(isArchiveFrameInteractive(frame))
      if (frame.phase !== phaseRef.current) {
        phaseRef.current = frame.phase
        setActivePhase(frame.phase)
      }
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    addEventListener('scroll', schedule, { passive: true })
    addEventListener('resize', schedule)
    return () => {
      removeEventListener('scroll', schedule)
      removeEventListener('resize', schedule)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [effectiveCompositionMode, effectiveReducedMotion, routeIndex])

  const handleCompositionModeChange = (nextMode) => {
    if (effectiveReducedMotion && nextMode === LEGACY_COMPOSITION) return

    setCompositionMode(nextMode)
    try {
      window.history.replaceState(
        window.history.state,
        '',
        withCompositionMode(window.location.href, nextMode)
      )
    } catch {
      // The in-memory mode remains usable if URL replacement is unavailable.
    }
  }

  const navigate = (nextProgress, { preserveArchiveFocus = false } = {}) => {
    if (!preserveArchiveFocus) setArchiveFocusRequested(false)
    const story = storyRef.current
    if (!story) return
    const travel = Math.max(1, story.offsetHeight - window.innerHeight)
    window.scrollTo({
      top: progressToScrollTop(nextProgress, story.offsetTop, travel),
      behavior: effectiveReducedMotion ? 'auto' : 'smooth',
    })
  }

  const skipToRoutes = () => {
    setArchiveFocusRequested(true)
    navigate(1, { preserveArchiveFocus: true })
  }

  useEffect(() => {
    if (!archiveFocusRequested || !archiveInteractive) return
    document.getElementById('route-archive')?.focus()
    setArchiveFocusRequested(false)
  }, [archiveFocusRequested, archiveInteractive])

  return (
    <>
      <LighthouseExperience
        stageRef={stageRef}
        routeIndex={routeIndex}
        compositionMode={effectiveCompositionMode}
        reducedMotion={effectiveReducedMotion}
        forceFallback={forceFallback || canvasFailed}
        forceTextureFailure={forceTextureFailure}
        onCanvasError={handleSceneError}
        onLoading={handleSceneLoading}
        onReady={handleSceneReady}
      />
      <main
        ref={storyRef}
        className="story"
        data-active-phase={activePhase}
        data-composition-mode={effectiveCompositionMode}
        data-reduced-motion={effectiveReducedMotion}
        data-static-beacon-active={!effectiveReducedMotion}
        data-scene-mode={sceneMode}
      >
        <div ref={stageRef} className="visual-stage" aria-hidden="true">
          <StaticLayerStack reducedMotion={effectiveReducedMotion} />
        </div>
        <StoryContent
          activePhase={activePhase}
          compositionMode={effectiveCompositionMode}
          reducedMotion={effectiveReducedMotion}
          onCompositionModeChange={handleCompositionModeChange}
          onNavigate={navigate}
          onSkipToRoutes={skipToRoutes}
        >
          <RouteArchive
            activeIndex={routeIndex}
            interactive={archiveInteractive}
            onActiveIndexChange={setRouteIndex}
          />
        </StoryContent>
      </main>
    </>
  )
}
