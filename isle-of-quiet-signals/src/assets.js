export async function waitForCriticalImages(root) {
  const images = [...root.querySelectorAll("img[data-critical]")];
  const results = await Promise.all(images.map(async (image) => {
    try {
      if (!image.complete) {
        await new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });
      }

      if (typeof image.decode === "function") {
        await image.decode();
      }

      if (!image.naturalWidth) {
        throw new Error("Image has no decoded width");
      }

      return null;
    } catch {
      image.dataset.failed = "true";
      return image;
    }
  }));

  return { failed: results.filter(Boolean) };
}
