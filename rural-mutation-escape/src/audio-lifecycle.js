export function bindAudioLifecycle({
  audio,
  unsubscribe = () => {},
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  hot = null,
}) {
  let disposed = false;

  function onVisibilityChange() {
    void (documentRef.hidden ? audio.suspend() : audio.resume());
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    documentRef.removeEventListener('visibilitychange', onVisibilityChange);
    windowRef.removeEventListener('pagehide', dispose);
    unsubscribe();
    audio.dispose();
  }

  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  windowRef.addEventListener('pagehide', dispose, { once: true });
  hot?.dispose(dispose);
  return dispose;
}
