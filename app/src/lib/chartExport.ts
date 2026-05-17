import { downloadBlob } from "./download";
import {
  generateShareCardSvg,
  getShareCardFilename,
  SHARE_CARD_SIZES,
  type ShareCardParams,
  type ShareCardSize,
} from "./shareCardSvg";

export async function svgStringToPngBlob(
  svgString: string,
  dimensions: { width: number; height: number },
  pixelRatio = 2,
): Promise<Blob> {
  const { width, height } = dimensions;

  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");

    ctx.scale(pixelRatio, pixelRatio);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
        "image/png",
        1,
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function generateShareCardPng(
  params: ShareCardParams,
  size: ShareCardSize = "twitter",
): Promise<Blob> {
  const dimensions = SHARE_CARD_SIZES[size];
  const svgString = generateShareCardSvg({ ...params, dimensions });
  return svgStringToPngBlob(svgString, dimensions);
}

export async function downloadShareCardPng(
  params: ShareCardParams,
  size: ShareCardSize = "twitter",
): Promise<void> {
  const blob = await generateShareCardPng(params, size);
  const filename = getShareCardFilename(params, size);
  downloadBlob(filename, blob);
}

export async function copyShareCardToClipboard(
  params: ShareCardParams,
  size: ShareCardSize = "twitter",
): Promise<void> {
  const blob = await generateShareCardPng(params, size);
  const item = new ClipboardItem({ "image/png": blob });
  await navigator.clipboard.write([item]);
}
