import { Component, useEffect, useState } from "react";
import { ShowcaseCanvas } from "./components/scene/ShowcaseCanvas";
import { InfoDialog } from "./components/ui/InfoDialog";
import { InitialLoadingScreen } from "./components/ui/InitialLoadingScreen";
import { OutcomePanel } from "./components/ui/OutcomePanel";
import { ShowcaseHud } from "./components/ui/ShowcaseHud";
import { StaticFallback } from "./components/ui/StaticFallback";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    );
    if (!mediaQuery) return undefined;

    const updatePreference = (event) =>
      setPrefersReducedMotion(event.matches);
    mediaQuery.addEventListener?.("change", updatePreference);
    return () => mediaQuery.removeEventListener?.("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function browserCanRender3d() {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.WebGLRenderingContext || window.WebGL2RenderingContext,
  );
}

class CanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onUnavailable();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function App() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [canvasUnavailable, setCanvasUnavailable] = useState(false);
  const canvasUsable =
    !prefersReducedMotion && !canvasUnavailable && browserCanRender3d();

  return (
    <main className="showcase-app" aria-label="产品能力展厅">
      <header className="showcase-masthead">
        <a className="showcase-wordmark" href="#showroom">
          <span aria-hidden="true">◌</span>
          交互能力实验室
        </a>
        <p>把项目能力变成可以探索的成果展厅</p>
      </header>

      <div className="showcase-layout" id="showroom">
        <OutcomePanel />

        <section className="showroom-viewport" aria-label="能力展台">
          {canvasUsable ? (
            <CanvasBoundary
              onUnavailable={() => setCanvasUnavailable(true)}
            >
              <ShowcaseCanvas />
              <InitialLoadingScreen />
            </CanvasBoundary>
          ) : (
            <StaticFallback
              reason={
                prefersReducedMotion ? "reduced-motion" : "unavailable"
              }
            />
          )}
          <p className="showroom-hint" aria-hidden={!canvasUsable}>
            拖动展品查看细节
          </p>
        </section>

        <ShowcaseHud canvasAvailable={canvasUsable} />
      </div>

      <InfoDialog />
    </main>
  );
}
