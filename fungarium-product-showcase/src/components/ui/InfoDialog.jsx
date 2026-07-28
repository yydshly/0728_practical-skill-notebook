import { useEffect, useRef } from "react";
import { useShowcaseStore } from "../../state/useShowcaseStore";

export function InfoDialog() {
  const infoOpen = useShowcaseStore((state) => state.infoOpen);
  const closeInfo = useShowcaseStore((state) => state.closeInfo);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!infoOpen) return undefined;

    closeButtonRef.current?.focus();
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeInfo();
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [closeInfo, infoOpen]);

  if (!infoOpen) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={closeInfo}>
      <section
        className="info-dialog"
        role="dialog"
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
