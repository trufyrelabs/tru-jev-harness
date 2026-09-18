import { describe, expect, it } from "vitest";
import { wantsMock } from "../src/index.js";

describe("wantsMock", () => {
  it("detects --mock in argv or JEV_MOCK in env", () => {
    expect(wantsMock(["node", "demo.js", "--mock"], {})).toBe(true);
    expect(wantsMock(["node", "demo.js"], {})).toBe(false);
    expect(wantsMock(["node", "demo.js"], { JEV_MOCK: "1" })).toBe(true);
  });
});
