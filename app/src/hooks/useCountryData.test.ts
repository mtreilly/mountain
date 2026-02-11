import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCountryData } from "./useCountryData";

describe("useCountryData", () => {
  it("fetches indicator endpoint and returns data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          NGA: [{ year: 2023, value: 5400 }],
          USA: [{ year: 2023, value: 68000 }],
        },
        indicator: { code: "GDP_PCAP_PPP", name: "GDP per capita", unit: "int$" },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCountryData({ countries: ["NGA", "USA"], indicator: "GDP_PCAP_PPP" }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain("/api/data/GDP_PCAP_PPP?");
    expect(fetchMock.mock.calls[0][0]).toContain("countries=NGA%2CUSA");

    expect(result.current.error).toBeNull();
    expect(result.current.getLatestValue("NGA")).toBe(5400);
    expect(result.current.indicator?.code).toBe("GDP_PCAP_PPP");
  });

  it("respects enabled=false and invalidIndicator", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useCountryData({
        countries: ["NGA", "USA"],
        indicator: "BAD_CODE",
        enabled: false,
        invalidIndicator: true,
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.data).toEqual({});
    expect(result.current.error).toBe("INDICATOR_NOT_FOUND");
  });
});
