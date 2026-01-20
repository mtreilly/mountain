import { downloadBlob } from "./download";

function getViewBoxSize(svg: SVGSVGElement) {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width && vb.height) return { width: vb.width, height: vb.height };
  return { width: 600, height: 300 };
}

function serializeSvg(svg: SVGSVGElement) {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const { width, height } = getViewBoxSize(svg);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  return new XMLSerializer().serializeToString(clone);
}

async function renderChartPngBlob(
  svg: SVGSVGElement,
  options?: {
    width?: number;
    height?: number;
    background?: string;
    pixelRatio?: number;
    padding?: number;
    fit?: "contain" | "cover" | "stretch";
  }
) {
  const { width: vbW, height: vbH } = getViewBoxSize(svg);
  const width = options?.width ?? vbW;
  const height = options?.height ?? vbH;
  const pixelRatio = options?.pixelRatio ?? 2;
  const background = options?.background ?? "white";
  const fit = options?.fit ?? "contain";
  const padding = Math.max(0, options?.padding ?? 0);

  const svgText = serializeSvg(svg);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
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
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const availW = Math.max(1, width - padding * 2);
    const availH = Math.max(1, height - padding * 2);

    const srcW = vbW;
    const srcH = vbH;
    const scaleX = availW / srcW;
    const scaleY = availH / srcH;
    const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    const drawW = fit === "stretch" ? availW : srcW * scale;
    const drawH = fit === "stretch" ? availH : srcH * scale;
    const dx = padding + (availW - drawW) / 2;
    const dy = padding + (availH - drawH) / 2;

    ctx.drawImage(img, dx, dy, drawW, drawH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
        "image/png",
        1
      );
    });

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadChartSvg(svg: SVGSVGElement, filename: string) {
  const svgText = serializeSvg(svg);
  downloadBlob(filename, new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
}

export async function downloadChartPng(
  svg: SVGSVGElement,
  filename: string,
  options?: {
    width?: number;
    height?: number;
    background?: string;
    pixelRatio?: number;
    padding?: number;
    fit?: "contain" | "cover" | "stretch";
  }
) {
  const blob = await renderChartPngBlob(svg, options);
  downloadBlob(filename, blob);
}

export async function copyChartPngToClipboard(
  svg: SVGSVGElement,
  options?: {
    width?: number;
    height?: number;
    background?: string;
    pixelRatio?: number;
    padding?: number;
    fit?: "contain" | "cover" | "stretch";
  }
) {
  const blob = await renderChartPngBlob(svg, options);
  const item = new ClipboardItem({ "image/png": blob });
  await navigator.clipboard.write([item]);
}
