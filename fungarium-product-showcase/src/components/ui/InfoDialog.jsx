import { useEffect, useRef } from "react";
import { useShowcaseStore } from "../../state/useShowcaseStore";

export function InfoDialog() {
  const infoOpen = useShowcaseStore((state) => state.infoOpen);
  const closeInfo = useShowcaseStore((state) => state.closeInfo);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!infoOpen) return undefined;

    triggerRef.current =
      document.getElementById("showcase-info-trigger") ??
      document.activeElement;
    closeButtonRef.current?.focus();
    const containFocus = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeInfo();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusableElements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      const focusIsOutside =
        !dialogRef.current?.contains(document.activeElement);

      if (
        focusableElements.length === 1 ||
        (event.shiftKey &&
          (document.activeElement === firstElement || focusIsOutside)) ||
        (!event.shiftKey &&
          (document.activeElement === lastElement || focusIsOutside))
      ) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
      }
    };
    window.addEventListener("keydown", containFocus);

    return () => {
      window.removeEventListener("keydown", containFocus);
      if (
        triggerRef.current instanceof HTMLElement &&
        document.contains(triggerRef.current)
      ) {
        triggerRef.current.focus();
      }
    };
  }, [closeInfo, infoOpen]);

  if (!infoOpen) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={closeInfo}>
      <section
        ref={dialogRef}
        className="info-dialog"
        id="exploration-dialog"
        role="dialog"
        tabIndex="-1"
        aria-modal="true"
        aria-labelledby="exploration-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">关于本次探索</p>
        <h2 id="exploration-dialog-title">从空间叙事到业务成果</h2>
        <p>
          这是一个独立实验，灵感来自 Fungarium
          的交互架构：让内容、镜头与操作在同一空间里彼此回应。
        </p>
        <p>
          本展厅的界面、中文内容与程序化展品均为独立创作，未使用上游品牌身份或资源。
        </p>
        <button
          ref={closeButtonRef}
          className="dialog-close"
          type="button"
          onClick={closeInfo}
        >
          关闭介绍
        </button>
      </section>
    </div>
  );
}
