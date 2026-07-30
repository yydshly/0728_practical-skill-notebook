export function bindAudioLifecycle({
  audio,
  unsubscribe = () => {},
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  hot = null,
}) {
  let disposed = false;
  let bfcacheSuspended = false;
  let reconcileRequested = false;
  let reconciling = false;

  function wantsSuspension() {
    return documentRef.hidden || bfcacheSuspended;
  }

  async function reconcile() {
    try {
      while (!disposed && reconcileRequested) {
        reconcileRequested = false;
        const shouldSuspend = wantsSuspension();
        try {
          await (shouldSuspend ? audio.suspend() : audio.resume());
        } catch {
          // A rejected transition cannot wedge future lifecycle events.
        }
        if (!disposed && shouldSuspend !== wantsSuspension()) {
          reconcileRequested = true;
        }
      }
    } finally {
      reconciling = false;
      if (!disposed && reconcileRequested) requestReconciliation();
    }
  }

  function requestReconciliation() {
    if (disposed) return;
    reconcileRequested = true;
    if (reconciling) return;
    reconciling = true;
    void reconcile();
  }

  function onVisibilityChange() {
    requestReconciliation();
  }

  function onPageHide(event) {
    if (!event.persisted) {
      dispose();
      return;
    }
    bfcacheSuspended = true;
    requestReconciliation();
  }

  function onPageShow(event) {
    if (!event.persisted) return;
    bfcacheSuspended = false;
    requestReconciliation();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    documentRef.removeEventListener('visibilitychange', onVisibilityChange);
    windowRef.removeEventListener('pagehide', onPageHide);
    windowRef.removeEventListener('pageshow', onPageShow);
    unsubscribe();
    audio.dispose();
  }

  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  windowRef.addEventListener('pagehide', onPageHide);
  windowRef.addEventListener('pageshow', onPageShow);
  hot?.dispose(dispose);
  return dispose;
}
