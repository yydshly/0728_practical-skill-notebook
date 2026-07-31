import {
  LEGACY_COMPOSITION,
  LOCKED_COMPOSITION,
} from './composition-mode.js'

export function CompositionControl({ mode, reducedMotion, onChange }) {
  return (
    <div
      className="composition-control"
      role="group"
      aria-label="滚动构图对照"
    >
      <span aria-hidden="true">构图</span>
      <button
        type="button"
        aria-pressed={mode === LOCKED_COMPOSITION}
        onClick={() => onChange?.(LOCKED_COMPOSITION)}
      >
        稳定构图
      </button>
      <button
        type="button"
        aria-pressed={mode === LEGACY_COMPOSITION}
        disabled={reducedMotion}
        title={reducedMotion ? '减少动态效果模式保持稳定构图' : undefined}
        onClick={() => onChange?.(LEGACY_COMPOSITION)}
      >
        原始漂移
      </button>
    </div>
  )
}
