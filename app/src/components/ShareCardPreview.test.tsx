import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ShareCardParams } from "../lib/shareCardSvg";
import { ShareCardPreview } from "./ShareCardPreview";

const params: ShareCardParams = {
  chaserName: "Poland",
  targetName: "United Kingdom",
  chaserCode: "POL",
  targetCode: "GBR",
  metricLabel: "GDP per capita",
  metricUnit: "USD",
  observed: [
    { year: 2020, chaser: 34_000, target: 46_000 },
    { year: 2021, chaser: 35_500, target: 46_800 },
  ],
  projection: [
    { year: 2022, chaser: 37_000, target: 47_500 },
    { year: 2027, chaser: 48_500, target: 49_000 },
  ],
  convergenceYear: 2028,
  yearsToConvergence: 5,
  currentGap: 1.3,
  chaserGrowth: 0.045,
  targetGrowth: 0.01,
  targetMode: "growing",
  theme: "light",
};

describe("ShareCardPreview", () => {
  it("sizes the preview frame without transform-scaling the image", () => {
    render(<ShareCardPreview params={params} scale={0.4} size="twitter" />);

    const preview = screen.getByRole("img", { name: "Share card preview" });
    const image = preview.querySelector("img");

    expect(preview).toHaveStyle({
      width: "480px",
      maxWidth: "100%",
      aspectRatio: "1200 / 675",
    });
    expect(image).not.toBeNull();
    expect(image).toHaveStyle({
      width: "100%",
      height: "100%",
      maxWidth: "none",
      objectFit: "contain",
    });
    expect(image?.style.transform).toBe("");
    expect(image?.getAttribute("src")).toContain(encodeURIComponent('width="1200"'));
  });

  it("uses the selected card dimensions for square previews", () => {
    render(<ShareCardPreview params={params} scale={0.35} size="square" />);

    expect(screen.getByRole("img", { name: "Share card preview" })).toHaveStyle({
      width: "378px",
      aspectRatio: "1080 / 1080",
    });
  });
});
