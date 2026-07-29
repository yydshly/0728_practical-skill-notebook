export function createCameraPointerInput({
  surface,
  eventTarget = globalThis,
  documentRef = globalThis.document,
  onRotate,
}) {
  let dragPointerId = null;
  let lastClientX = 0;
  let lastClientY = 0;

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    dragPointerId = event.pointerId;
    lastClientX = event.clientX;
    lastClientY = event.clientY;
    try {
      surface.setPointerCapture?.(event.pointerId);
    } catch {
      // Fallback drag still works when capture is unavailable.
    }
    try {
      const locking = surface.requestPointerLock?.();
      locking?.catch?.(() => {});
    } catch {
      // Pointer lock is optional; fallback drag remains active.
    }
  }

  function handlePointerMove(event) {
    const locked = documentRef?.pointerLockElement === surface;
    const fallbackDrag = dragPointerId !== null
      && (event.pointerId === undefined || event.pointerId === dragPointerId);
    if (!locked && !fallbackDrag) return;

    const deltaX = locked ? event.movementX : event.clientX - lastClientX;
    const deltaY = locked ? event.movementY : event.clientY - lastClientY;
    if (!locked) {
      lastClientX = event.clientX;
      lastClientY = event.clientY;
    }
    if (deltaX || deltaY) onRotate(deltaX, deltaY);
  }

  function endFallbackDrag(event) {
    if (dragPointerId === null) return;
    if (event.type === 'pointerup' && event.button !== 0) return;
    if (event.pointerId !== undefined && event.pointerId !== dragPointerId) return;
    try {
      surface.releasePointerCapture?.(dragPointerId);
    } catch {
      // Capture may already be released by the browser.
    }
    dragPointerId = null;
  }

  surface.addEventListener('pointerdown', handlePointerDown);
  eventTarget.addEventListener('pointermove', handlePointerMove);
  eventTarget.addEventListener('pointerup', endFallbackDrag);
  eventTarget.addEventListener('pointercancel', endFallbackDrag);

  return {
    dispose() {
      surface.removeEventListener('pointerdown', handlePointerDown);
      eventTarget.removeEventListener('pointermove', handlePointerMove);
      eventTarget.removeEventListener('pointerup', endFallbackDrag);
      eventTarget.removeEventListener('pointercancel', endFallbackDrag);
      dragPointerId = null;
    },
  };
}
