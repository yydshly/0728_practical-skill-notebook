import { useShowcaseStore } from "../../state/useShowcaseStore";

export function InitialLoadingScreen() {
  const initialSceneReady = useShowcaseStore(
    (state) => state.initialSceneReady,
  );

  if (initialSceneReady) return null;

  return (
    <div className="initial-loading" role="status" aria-live="polite">
      <span className="loading-mark" aria-hidden="true" />
      <span>正在准备能力展厅</span>
    </div>
  );
}
