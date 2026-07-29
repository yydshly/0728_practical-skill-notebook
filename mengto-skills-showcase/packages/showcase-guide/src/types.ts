export const PRODUCT_IDS = [
  "monster-forge",
  "ashfall-arena",
  "mech-atelier",
] as const;

export type ProductId = (typeof PRODUCT_IDS)[number];
export type ProductGuideCloseReason = "start" | "dismiss" | "escape";
export type ProductGuideAutoOpenResult = "opened" | "blocked" | "settled";

export interface ProductGuideConfig {
  readonly productId: ProductId;
  readonly guideVersion: number;
  readonly title: string;
  readonly purpose: string;
  readonly steps: readonly string[];
  readonly capability: string;
  readonly business: string;
  readonly duration: string;
  readonly desktopControls: readonly string[];
  readonly touchControls: readonly string[];
  readonly hubHref: string;
  readonly canOpen?: () => boolean;
  readonly onOpen?: () => void;
  readonly onClose?: (reason: ProductGuideCloseReason) => void;
}

export interface ProductGuideController {
  open(): boolean;
  retryAutoOpen(): ProductGuideAutoOpenResult;
  close(reason?: "dismiss" | "escape"): void;
  destroy(): void;
  isOpen(): boolean;
}
