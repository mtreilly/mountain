import { downloadBlob } from "./download";

export async function downloadFromUrl(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const blob = await res.blob();

  let outName = filename;
  if (contentType.includes("image/svg+xml") && filename.toLowerCase().endsWith(".png")) {
    outName = filename.replace(/\.png$/i, ".svg");
  }

  downloadBlob(outName, blob);
  return { contentType, filename: outName };
}

export async function copyImageFromUrl(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const item = new ClipboardItem({ [blob.type || "image/png"]: blob });
  await navigator.clipboard.write([item]);
}
