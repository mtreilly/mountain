import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearStaticDataCache } from "../lib/staticData";
import { createQueryWrapper } from "../test/queryClient";
import { useCountries } from "./useCountries";

describe("useCountries", () => {
  beforeEach(() => clearStaticDataCache());

  it("loads countries on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
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

    expect(fetchMock).toHaveBeenCalledWith("/data/missing/countries.json");
    expect(result.current.error).toBeNull();
    expect(result.current.countries).toHaveLength(1);
    expect(result.current.countries[0].iso_alpha3).toBe("NGA");
  });

  it("sets error on request failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, headers: new Headers() });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useCountries(), { wrapper: createQueryWrapper() });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.countries).toEqual([]);
    expect(result.current.error).toBe("HTTP 500");
  });
});
