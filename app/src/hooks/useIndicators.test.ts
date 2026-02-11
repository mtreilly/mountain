import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useIndicators } from "./useIndicators";

describe("useIndicators", () => {
  it("loads indicators on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
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
    const { result } = renderHook(() => useIndicators());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/indicators");
    expect(result.current.error).toBeNull();
    expect(result.current.indicators).toHaveLength(1);
    expect(result.current.indicators[0].code).toBe("GDP_PCAP_PPP");
  });

  it("sets error on HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { result } = renderHook(() => useIndicators());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.indicators).toEqual([]);
    expect(result.current.error).toBe("HTTP 404");
  });
});
