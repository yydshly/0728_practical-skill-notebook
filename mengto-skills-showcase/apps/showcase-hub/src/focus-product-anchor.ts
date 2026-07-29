import { PRODUCT_IDS } from "@showcase/showcase-guide";

const PRODUCT_HASHES = new Set(PRODUCT_IDS.map((id) => `#product-${id}`));

export function focusProductAnchor(
  root: ParentNode,
  hash: string,
): boolean {
  if (!PRODUCT_HASHES.has(hash)) return false;
  const heading = root.querySelector<HTMLElement>(`${hash} h3`);
  if (!heading) return false;
  requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  return true;
}
