import { CAPABILITIES, SHOWCASE_CAMERAS } from "../../config/showcaseConfig";
import { useShowcaseStore } from "../../state/useShowcaseStore";

export function ShowcaseHud({ canvasAvailable = true }) {
  const selectedIndex = useShowcaseStore((state) => state.selectedIndex);
  const cameraView = useShowcaseStore((state) => state.cameraView);
  const infoOpen = useShowcaseStore((state) => state.infoOpen);
  const renderer = useShowcaseStore((state) => state.renderer);
  const selectIndex = useShowcaseStore((state) => state.selectIndex);
  const setCameraView = useShowcaseStore((state) => state.setCameraView);
  const capture = useShowcaseStore((state) => state.capture);
  const openInfo = useShowcaseStore((state) => state.openInfo);
  const captureAvailable = canvasAvailable && Boolean(renderer);

  return (
    <aside className="showcase-hud" aria-label="展厅控制">
      <section aria-labelledby="capability-selector-title">
        <p className="eyebrow" id="capability-selector-title">
          能力展品
        </p>
        <div className="capability-selector">
          {CAPABILITIES.map((capability, index) => (
            <button
              className="capability-choice"
              type="button"
              aria-pressed={selectedIndex === index}
              key={capability.id}
              onClick={() => selectIndex(index)}
            >
              <span aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              {capability.railLabel}
            </button>
          ))}
        </div>
      </section>

      <div
        className="camera-selector"
        role="group"
        aria-label="展台视角"
      >
        {Object.entries(SHOWCASE_CAMERAS).map(([view, camera]) => (
          <button
            type="button"
            aria-pressed={cameraView === view}
            key={view}
            onClick={() => setCameraView(view)}
          >
            {camera.label}
          </button>
        ))}
      </div>

      <div className="showcase-actions">
        <button
          className="capture-button"
          type="button"
          disabled={!captureAvailable}
          title={captureAvailable ? undefined : "三维画面当前不可用"}
          onClick={capture}
        >
          保存当前画面
        </button>
        <button
          className="info-button"
          id="showcase-info-trigger"
          type="button"
          aria-controls="exploration-dialog"
          aria-expanded={infoOpen}
          onClick={openInfo}
        >
          了解本次探索
        </button>
      </div>
    </aside>
  );
}
