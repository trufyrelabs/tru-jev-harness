import type { RagThresholds, ToolThresholds } from "./types.js";

/**
 * Defaults follow TypeSafe's published confidence-routing guidance:
 * a ~0.5–0.6 floor for "don't guess", and a higher bar for irreversible actions.
 * @see https://docs.typesafe.ai/confidence
 * @see https://docs.typesafe.ai/patterns/confidence-routing
 */
export const DEFAULT_RAG_THRESHOLDS: RagThresholds = {
  keepMinNoul: 0.75,
};

export const DEFAULT_TOOL_THRESHOLDS: ToolThresholds = {
  allowMinConfidence: 0.85,
  escalateBelowConfidence: 0.6,
  blockMinConfidence: 0.7,
  policyFitAllowMin: 0.8,
  policyFitBlockBelow: 0.35,
  maxAllowRisk: 1.35,
  criticalRisk: 2.5,
};

export function mergeRagThresholds(
  overrides: Partial<RagThresholds> = {},
): RagThresholds {
  return { ...DEFAULT_RAG_THRESHOLDS, ...overrides };
}

export function mergeToolThresholds(
  overrides: Partial<ToolThresholds> = {},
): ToolThresholds {
  return { ...DEFAULT_TOOL_THRESHOLDS, ...overrides };
}
