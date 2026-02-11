import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useBatchData } from "./useBatchData";

describe("useBatchData", () => {
  it("fetches batch endpoint and exposes latest value", async () => {
    const countries = ["NGA"];
    const indicators = ["GDP_PCAP_PPP"];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          GDP_PCAP_PPP: {
            NGA: [
              { year: 2022, value: 5250 },
              { year: 2023, value: 5400 },
            ],
          },
        },
        indicators: {
          GDP_PCAP_PPP: {
            code: "GDP_PCAP_PPP",
            name: "GDP per capita (PPP)",
            description: null,
            unit: "int$",
            source: "World Bank",
            category: "economic",
          },
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useBatchData({ countries, indicators, startYear: 2000 }));

    await waitFor(() => {
      expect(result.current.getLatestValue("GDP_PCAP_PPP", "NGA")).toBe(5400);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/batch-data?");
    expect(fetchMock.mock.calls[0][0]).toContain("countries=NGA");
    expect(fetchMock.mock.calls[0][0]).toContain("indicators=GDP_PCAP_PPP");

    expect(result.current.error).toBeNull();
    expect(result.current.indicatorByCode.GDP_PCAP_PPP?.name).toBe("GDP per capita (PPP)");
  });

  it("does not fetch when disabled", () => {
    const countries = ["NGA"];
    const indicators = ["GDP_PCAP_PPP"];
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useBatchData({
        countries,
        indicators,
        enabled: false,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual({});
    expect(result.current.error).toBeNull();
  });
});
