import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStaticDataCache } from "../lib/staticData";
import { createQueryWrapper } from "../test/queryClient";
import { useCountryData } from "./useCountryData";

describe("useCountryData", () => {
  beforeEach(() => clearStaticDataCache());

  it("loads the indicator's static series and returns data", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        indicator: { code: "GDP_PCAP_PPP", name: "GDP per capita", unit: "int$" },
        vintages: [],
        data: {
          NGA: [[2023, 5400]],
          USA: [[2023, 68000]],
          GBR: [[2023, 54000]],
        },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(
      () => useCountryData({ countries: ["NGA", "USA"], indicator: "GDP_PCAP_PPP" }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.hasLoaded).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/data/missing/series/GDP_PCAP_PPP.json");
    expect(Object.keys(result.current.data)).toEqual(["NGA", "USA"]);

    expect(result.current.error).toBeNull();
    expect(result.current.getLatestValue("NGA")).toBe(5400);
    expect(result.current.indicator?.code).toBe("GDP_PCAP_PPP");
  });

  it("treats the SPA's HTML fallback as a missing indicator", async () => {
    // Pages serves index.html (200) for paths that don't exist.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html" }),
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }),
    );

    const { result } = renderHook(
      () => useCountryData({ countries: ["NGA"], indicator: "NOT_A_METRIC" }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.error).toBe("HTTP 404"));
    expect(result.current.data).toEqual({});
  });

  it("respects enabled=false and invalidIndicator", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(
      () =>
        useCountryData({
          countries: ["NGA", "USA"],
          indicator: "BAD_CODE",
          enabled: false,
          invalidIndicator: true,
        }),
      { wrapper: createQueryWrapper() },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.hasLoaded).toBe(false);
    expect(result.current.data).toEqual({});
    expect(result.current.error).toBe("INDICATOR_NOT_FOUND");
  });
});
