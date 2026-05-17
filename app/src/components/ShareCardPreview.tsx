import { useMemo } from "react";
import {
  generateShareCardSvg,
  SHARE_CARD_SIZES,
  type ShareCardParams,
  type ShareCardSize,
} from "../lib/shareCardSvg";

interface ShareCardPreviewProps {
  params: ShareCardParams;
  size?: ShareCardSize;
  scale?: number;
  className?: string;
}

export function ShareCardPreview({
  params,
  size = "twitter",
  scale = 0.4,
  className = "",
}: ShareCardPreviewProps) {
  const dimensions = SHARE_CARD_SIZES[size];
  const paramsWithDimensions = useMemo(() => ({ ...params, dimensions }), [params, dimensions]);

  const svgString = useMemo(
    () => generateShareCardSvg(paramsWithDimensions),
    [paramsWithDimensions],
  );
  const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;

  const displayWidth = dimensions.width * scale;

  return (
    <div
      className={`overflow-hidden rounded-lg shadow-md ${className}`}
      role="img"
      aria-label="Share card preview"
      style={{
        width: displayWidth,
        maxWidth: "100%",
        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
      }}
    >
      <img
        src={svgDataUrl}
        alt=""
        aria-hidden="true"
        className="block"
        style={{
          width: "100%",
          height: "100%",
          maxWidth: "none",
          objectFit: "contain",
        }}
      />
    </div>
  );
}
