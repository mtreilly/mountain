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
  const paramsWithDimensions = useMemo(
    () => ({ ...params, dimensions }),
    [params, dimensions]
  );

  const svgString = useMemo(
    () => generateShareCardSvg(paramsWithDimensions),
    [paramsWithDimensions]
  );

  const scaledWidth = dimensions.width * scale;
  const scaledHeight = dimensions.height * scale;

  return (
    <div
      className={`overflow-hidden rounded-lg shadow-md ${className}`}
      style={{
        width: scaledWidth,
        height: scaledHeight,
      }}
    >
      <div
        style={{
          width: dimensions.width,
          height: dimensions.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is generated internally
        dangerouslySetInnerHTML={{ __html: svgString }}
      />
    </div>
  );
}
