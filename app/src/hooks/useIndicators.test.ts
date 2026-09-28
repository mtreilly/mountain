import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStaticDataCache } from "../lib/staticData";
import { createQueryWrapper } from "../test/queryClient";
import { useIndicators } from "./useIndicators";

describe("useIndicators", () => {
  beforeEach(() => clearStaticDataCache());

  it("loads indicators on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        data: [
          {
            code: "GDP_PCAP_PPP",
            name: "GDP per capita (PPP)",
            description: null,
            unit: "int$",
            source: "World Bank",
            category: "economic",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useIndicators(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith("/data/missing/indicators.json");
    expect(result.current.error).toBeNull();
    expect(result.current.indicators).toHaveLength(1);
    expect(result.current.indicators[0].code).toBe("GDP_PCAP_PPP");
  });

  it("sets error on HTTP failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() }),
    );

    const { result } = renderHook(() => useIndicators(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.indicators).toEqual([]);
    expect(result.current.error).toBe("HTTP 500");
  });
});
