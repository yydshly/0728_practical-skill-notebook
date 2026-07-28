export const canopyImages = {
  spain: {
    src: "./canopies/spain-canopy.webp",
    alt: "Photorealistic Spanish canopy with terracotta tiles, carved timber and azulejo details"
  },
  england: {
    src: "./canopies/england-canopy.webp",
    alt: "Photorealistic English Victorian railway canopy in iron and ribbed glass"
  },
  france: {
    src: "./canopies/france-canopy.webp",
    alt: "Photorealistic French Belle Époque canopy in patinated metal and amber glass"
  },
  argentina: {
    src: "./canopies/argentina-canopy.webp",
    alt: "Photorealistic Buenos Aires canopy with corrugated zinc and fileteado ironwork"
  }
};

export const wallImages = {
  spain: {
    src: "./walls/spain-wall-windows-v2.webp",
    alt: "Sharp Spanish lime-plaster facade with a centered pair of arched iron-grille windows"
  },
  england: {
    src: "./walls/england-wall-windows-v2.webp",
    alt: "Sharp soot-darkened English brick facade with three centered bottle-green sash windows"
  },
  france: {
    src: "./walls/france-wall-windows-v2.webp",
    alt: "Sharp Parisian limestone facade with one large centered Art Nouveau casement window"
  },
  argentina: {
    src: "./walls/argentina-wall-windows-v2.webp",
    alt: "Sharp weathered Buenos Aires facade with a centered pair of turquoise shuttered windows"
  }
};

export const skyImages = {
  spain: {
    src: "./skies/spain-sky.webp",
    alt: "Warm late-afternoon Mediterranean sky"
  },
  england: {
    src: "./skies/england-sky.webp",
    alt: "Silver English sky with layered clouds after rain"
  },
  france: {
    src: "./skies/france-sky.webp",
    alt: "Soft blue-grey Parisian evening sky"
  },
  argentina: {
    src: "./skies/argentina-sky.webp",
    alt: "Expansive late-afternoon Buenos Aires sky"
  }
};

export const plasterImages = {
  spain: { src: "./plaster/spain-plaster.webp" },
  england: { src: "./plaster/england-plaster.webp" },
  france: { src: "./plaster/france-plaster.webp" },
  argentina: { src: "./plaster/argentina-plaster.webp" }
};

[canopyImages, wallImages, skyImages, plasterImages].flatMap((collection) => Object.values(collection)).forEach(({ src }) => {
  const image = new Image();
  image.src = src;
});
