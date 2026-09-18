import { describe, expect, it } from "vitest";
import { createJevClient, runRagGate, runToolGate } from "../src/index.js";
import { KB_PASSAGES, RAG_QUERY } from "../examples/fixtures/au-support.js";
import { TOOL_POLICY, TOOL_PROPOSALS } from "../examples/fixtures/tool-proposals.js";

describe("AU fixtures with mock Jev", () => {
  const client = createJevClient({ mock: true });

  it("keeps billing passages and drops coffee / NBN noise", async () => {
    const result = await runRagGate(client, {
      query: RAG_QUERY,
      passages: KB_PASSAGES,
    });
    const kept = new Set(result.kept.map((row) => row.passage.id));
    expect(kept.has("kb-duplicate-charge")).toBe(true);
    expect(kept.has("kb-loyalty-coffee")).toBe(false);
    expect(kept.has("kb-nbn-status")).toBe(false);
    expect(result.kept.length).toBeGreaterThan(0);
    expect(result.dropped.length).toBeGreaterThan(0);
  });

  it("allows lookup, escalates mid-size refund, blocks delete and large refund", async () => {
    const decisions: Record<string, string> = {};
    for (const proposal of TOOL_PROPOSALS) {
      const result = await runToolGate(client, { proposal, policy: TOOL_POLICY });
      decisions[proposal.id] = result.decision;
    }
    expect(decisions["tool-lookup"]).toBe("allow");
    expect(decisions["tool-email"]).toBe("allow");
    expect(decisions["tool-refund-duplicate"]).toBe("escalate");
    expect(decisions["tool-refund-large"]).toBe("block");
    expect(decisions["tool-delete"]).toBe("block");
  });
});
