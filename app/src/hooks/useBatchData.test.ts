import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStaticDataCache } from "../lib/staticData";
import { createQueryWrapper } from "../test/queryClient";
import { useBatchData } from "./useBatchData";

describe("useBatchData", () => {
  beforeEach(() => clearStaticDataCache());

  it("loads the indicator's static series and exposes latest value", async () => {
    const countries = ["NGA"];
    const indicators = ["GDP_PCAP_PPP"];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        indicator: {
          code: "GDP_PCAP_PPP",
          name: "GDP per capita (PPP)",
          description: null,
          unit: "int$",
          source: "World Bank",
          source_code: null,
          category: "economic",
        },
        vintages: [],
        data: {
          NGA: [
            [1995, 3000],
            [2022, 5250],
            [2023, 5400],
          ],
          USA: [[2023, 68000]],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBatchData({ countries, indicators, startYear: 2000 }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => {
      expect(result.current.getLatestValue("GDP_PCAP_PPP", "NGA")).toBe(5400);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/data/missing/series/GDP_PCAP_PPP.json");
    // Filtered to the requested countries and years
    expect(result.current.data.GDP_PCAP_PPP).toEqual({
      NGA: [
        { year: 2022, value: 5250 },
        { year: 2023, value: 5400 },
      ],
    });

    expect(result.current.error).toBeNull();
    expect(result.current.indicatorByCode.GDP_PCAP_PPP?.name).toBe("GDP per capita (PPP)");
  });

  it("does not fetch when disabled", () => {
    const countries = ["NGA"];
    const indicators = ["GDP_PCAP_PPP"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(
      () =>
        useBatchData({
          countries,
          indicators,
          enabled: false,
        }),
      { wrapper: createQueryWrapper() },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({});
    expect(result.current.error).toBeNull();
  });
});
