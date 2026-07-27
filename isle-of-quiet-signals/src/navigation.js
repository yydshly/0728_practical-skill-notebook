export function createTimelineNavigation({ nav, points, stage, reducedMotion }) {
  function onClick(event) {
    const trigger = event.target.closest("[data-progress]");
    if (!trigger || !nav.contains(trigger)) return;

    const progress = Number(trigger.dataset.progress);
    if (!points.some((point) => point.progress === progress)) return;

    stage.scrollToProgress(progress, reducedMotion ? "auto" : "smooth");
  }

  nav.addEventListener("click", onClick);

  return {
    destroy() {
      nav.removeEventListener("click", onClick);
    },
  };
}
