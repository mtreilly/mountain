import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "../test/queryClient";
import { useCountries } from "./useCountries";

describe("useCountries", () => {
  it("loads countries on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            iso_alpha3: "NGA",
            iso_alpha2: "NG",
            name: "Nigeria",
            region: "Sub-Saharan Africa",
            income_group: "Lower middle income",
          },
        ],
      }),
    });

    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCountries(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/countries",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.error).toBeNull();
    expect(result.current.countries).toHaveLength(1);
    expect(result.current.countries[0].iso_alpha3).toBe("NGA");
  });

  it("sets error on request failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCountries(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.countries).toEqual([]);
    expect(result.current.error).toBe("HTTP 500");
  });
});
