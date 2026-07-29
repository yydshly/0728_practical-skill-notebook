import type { ProductId } from "./types";

export function resolveProductHubHref(
  base: string,
  productId: ProductId,
  currentHref: string,
): string {
  const url = new URL(base, currentHref);
  url.hash = `product-${productId}`;
  return url.href;
}
