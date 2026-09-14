import { describe, expect, it } from "vitest";
import { parseShareStateFromSearch, toSearchString } from "./shareState";

describe("implication share state", () => {
  it("round-trips every material implication assumption", () => {
    const state = parseShareStateFromSearch(
      "?ipv=low&isc=custom&igl=7&ini=12&iscf=.24&iwcf=.41&incf=.92&iccf=.66&inw=1.4&icw=.8&ipw=450&iwt=6.2&ihs=3.5&imix=20,30,40,10",
    );
    const reparsed = parseShareStateFromSearch(toSearchString(state));

    expect(reparsed).toMatchObject({
      ipv: "low",
      isc: "custom",
      igl: 7,
      ini: 12,
      iscf: 0.24,
      iwcf: 0.41,
      incf: 0.92,
      iccf: 0.66,
      inw: 1.4,
      icw: 0.8,
      ipw: 450,
      iwt: 6.2,
      ihs: 3.5,
      imix: "20,30,40,10",
    });
  });

  it("clamps malformed or unsafe values", () => {
    const state = parseShareStateFromSearch(
      "?ipv=guess&isc=wrong&igl=500&ini=-99&incf=0&ipw=0&imix=1,-2,nope,4",
    );
    expect(state.ipv).toBe("medium");
    expect(state.isc).toBe("baseline");
    expect(state.igl).toBe(50);
    expect(state.ini).toBe(-50);
    expect(state.incf).toBe(0.05);
    expect(state.ipw).toBe(100);
    expect(state.imix).toBe("60,30,10,0");
  });
});
