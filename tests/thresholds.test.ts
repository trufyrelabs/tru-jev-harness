import { describe, expect, it } from "vitest";
import {
  DEFAULT_RAG_THRESHOLDS,
  DEFAULT_TOOL_THRESHOLDS,
  mergeRagThresholds,
  mergeToolThresholds,
} from "../src/index.js";

describe("thresholds", () => {
  it("returns defaults when no overrides are provided", () => {
    expect(mergeRagThresholds()).toEqual(DEFAULT_RAG_THRESHOLDS);
    expect(mergeToolThresholds()).toEqual(DEFAULT_TOOL_THRESHOLDS);
  });

  it("overrides individual fields without dropping the rest", () => {
    expect(mergeRagThresholds({ keepMinNoul: 0.9 }).keepMinNoul).toBe(0.9);
    const merged = mergeToolThresholds({ allowMinConfidence: 0.99 });
    expect(merged.allowMinConfidence).toBe(0.99);
    expect(merged.escalateBelowConfidence).toBe(
      DEFAULT_TOOL_THRESHOLDS.escalateBelowConfidence,
    );
  });
});
