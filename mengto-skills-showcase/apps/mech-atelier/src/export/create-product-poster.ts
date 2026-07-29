import type { MechConfiguration, MechSummary } from "../configuration/types";
import type { ProductCapture } from "../scene/create-configurator-scene";

export const PRODUCT_POSTER_SIZE = Object.freeze({
  width: 1600,
  height: 1200,
});

export interface ProductPosterMetadata {
  readonly chassisId: string;
  readonly configurationName: string;
  readonly moduleNames: readonly string[];
  readonly canonicalUrl: string;
}

export type ProductPosterBlob = Blob & {
  readonly debugMetadata: ProductPosterMetadata;
};

export interface ProductPosterInput {
  readonly configuration: MechConfiguration;
  readonly summary: MechSummary;
  readonly chassisName: string;
  readonly configurationName: string;
  readonly moduleNames: readonly string[];
  readonly canonicalUrl: string;
  readonly captureProduct: (
    width: number,
    height: number,
  ) => Promise<ProductCapture>;
}

export async function createProductPoster(
  input: ProductPosterInput,
): Promise<ProductPosterBlob> {
  const capture = await input.captureProduct(860, 940);
  if (
    capture.width !== 860 ||
    capture.height !== 940 ||
    capture.pixels.length !== capture.width * capture.height * 4
  ) {
    throw new Error("三维产品画面数据不完整，请保持页面开启后重试。");
  }

  const canvas = document.createElement("canvas");
  canvas.width = PRODUCT_POSTER_SIZE.width;
  canvas.height = PRODUCT_POSTER_SIZE.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("浏览器无法创建海报画布，请更换浏览器后重试。");

  drawBackground(context);
  const imagePixels = new Uint8ClampedArray(capture.pixels.length);
  imagePixels.set(capture.pixels);
  const productBitmap = await createImageBitmap(
    new ImageData(imagePixels, capture.width, capture.height),
  );
  try {
    context.save();
    context.filter = "drop-shadow(0 38px 42px rgba(0, 0, 0, 0.5))";
    context.drawImage(productBitmap, 48, 135, 900, 984);
    context.restore();
  } finally {
    productBitmap.close();
  }
  drawCopy(context, input);

  const blob = await encodePng(canvas);
  const metadata: ProductPosterMetadata = Object.freeze({
    chassisId: input.configuration.chassisId,
    configurationName: input.configurationName,
    moduleNames: Object.freeze([...input.moduleNames]),
    canonicalUrl: input.canonicalUrl,
  });
  Object.defineProperty(blob, "debugMetadata", {
    configurable: false,
    enumerable: false,
    value: metadata,
    writable: false,
  });
  return blob as ProductPosterBlob;
}

function drawBackground(context: CanvasRenderingContext2D): void {
  const gradient = context.createLinearGradient(0, 0, 1600, 1200);
  gradient.addColorStop(0, "#0a0b0c");
  gradient.addColorStop(0.5, "#161312");
  gradient.addColorStop(1, "#26120d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1600, 1200);

  const glow = context.createRadialGradient(610, 500, 60, 610, 500, 720);
  glow.addColorStop(0, "rgba(230, 105, 57, 0.24)");
  glow.addColorStop(0.48, "rgba(116, 169, 255, 0.08)");
  glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1120, 1200);

  context.strokeStyle = "rgba(255, 255, 255, 0.045)";
  context.lineWidth = 1;
  for (let x = 40; x < 1600; x += 80) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 1200);
    context.stroke();
  }
  for (let y = 40; y < 1200; y += 80) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(1600, y);
    context.stroke();
  }
  context.fillStyle = "rgba(8, 9, 10, 0.78)";
  context.fillRect(990, 0, 610, 1200);
  context.fillStyle = "#e86d3d";
  context.fillRect(990, 0, 8, 1200);
}

function drawCopy(
  context: CanvasRenderingContext2D,
  input: ProductPosterInput,
): void {
  const fontFamily =
    '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  context.textBaseline = "top";
  context.fillStyle = "#e86d3d";
  context.font = `700 18px ${fontFamily}`;
  context.fillText("MECH ATELIER / CONFIGURATION 01", 1060, 76);

  context.fillStyle = "#f3eee7";
  context.font = `700 52px ${fontFamily}`;
  wrapText(context, input.chassisName, 1060, 126, 450, 66, 2);
  context.fillStyle = "#b8b2aa";
  context.font = `500 24px ${fontFamily}`;
  wrapText(context, input.configurationName, 1060, 264, 450, 34, 2);

  context.fillStyle = "#777b77";
  context.font = `700 16px ${fontFamily}`;
  context.fillText("当前模块", 1060, 360);
  context.fillStyle = "#ddd8d0";
  context.font = `500 21px ${fontFamily}`;
  input.moduleNames.forEach((name, index) => {
    context.fillText(`${String(index + 1).padStart(2, "0")}  ${name}`, 1060, 402 + index * 42);
  });

  const statistics = [
    ["概念价格", `${input.summary.priceCredits.toLocaleString("zh-CN")} 信用点`],
    ["重量", `${input.summary.weight} kg`],
    ["战力", String(input.summary.power)],
    ["防护", String(input.summary.guard)],
    ["机动", String(input.summary.mobility)],
  ] as const;
  statistics.forEach(([label, value], index) => {
    const x = 1060 + (index % 2) * 225;
    const y = 660 + Math.floor(index / 2) * 100;
    context.fillStyle = "#777b77";
    context.font = `600 15px ${fontFamily}`;
    context.fillText(label, x, y);
    context.fillStyle = "#f2d3bd";
    context.font = `600 27px ${fontFamily}`;
    context.fillText(value, x, y + 28);
  });

  context.fillStyle = "#a8a29b";
  context.font = `500 16px ${fontFamily}`;
  wrapText(
    context,
    "概念配置，不提供结算或库存功能",
    1060,
    982,
    450,
    26,
    2,
  );
  context.fillStyle = "#777b77";
  context.font = `500 14px ui-monospace, "SFMono-Regular", Consolas, monospace`;
  wrapText(
    context,
    shortCanonicalUrl(input.canonicalUrl),
    1060,
    1060,
    450,
    22,
    3,
  );

  context.save();
  context.translate(54, 1130);
  context.rotate(-Math.PI / 2);
  context.fillStyle = "rgba(255, 255, 255, 0.38)";
  context.font = `600 14px ${fontFamily}`;
  context.fillText("项目自制程序化概念模型 · 本地渲染", 0, 0);
  context.restore();
}

function shortCanonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.host}${url.pathname}${url.search}`;
  } catch {
    return value.slice(0, 180);
  }
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  let line = "";
  let lineIndex = 0;
  for (const character of text) {
    const candidate = `${line}${character}`;
    if (line && context.measureText(candidate).width > maxWidth) {
      context.fillText(line, x, y + lineIndex * lineHeight);
      lineIndex += 1;
      if (lineIndex >= maxLines) return;
      line = character;
    } else {
      line = candidate;
    }
  }
  if (lineIndex < maxLines && line) {
    context.fillText(line, x, y + lineIndex * lineHeight);
  }
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob || blob.size === 0) {
          reject(new Error("浏览器没有生成有效 PNG，请重试或更换浏览器。"));
          return;
        }
        resolve(blob);
      }, "image/png");
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      reject(new Error(`PNG 编码失败：${detail}`));
    }
  });
}
