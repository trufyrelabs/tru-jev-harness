import { describe, expect, it } from "vitest";
import type { ChoiceResponse, NoulResponse, ScoreResponse } from "@typesafe-ai/sdk";
import {
  decideToolAction,
  DEFAULT_TOOL_THRESHOLDS,
  runToolGate,
  type JevClient,
  type Questions,
  type RequestOptions,
  type SystemOneRequest,
  type SystemOneResult,
  type ToolDispositionCriteria,
  type ToolGateAnswers,
  type ToolPolicy,
  type ToolProposal,
  type ToolRiskCriteria,
} from "../src/index.js";

const policy: ToolPolicy = {
  name: "test-policy",
  text: "refund under $50 auto; delete_record forbidden",
};

const proposal: ToolProposal = {
  id: "p1",
  tool: "lookup_order",
  actor: "agent",
  arguments: { orderId: "BG-1" },
  rationale: "check charges",
};

function choiceAnswer(
  label: string,
  confidence: number,
): ChoiceResponse<ToolDispositionCriteria> {
  const probabilities = { allow: 0.1, escalate: 0.1, block: 0.1 };
  if (label === "allow" || label === "escalate" || label === "block") {
    probabilities[label] = 0.8;
  }
  return {
    type: "choice",
    choice: label as "allow" | "escalate" | "block",
    confidence,
    probabilities,
  };
}

function riskAnswer(scoreValue: number, confidence: number): ScoreResponse<ToolRiskCriteria> {
  return {
    type: "score",
    score: scoreValue,
    confidence,
    legend: {
      0: "Low",
      1: "Moderate",
      2: "High",
      3: "Critical",
    },
    probabilities: { 0: 0.1, 1: 0.1, 2: 0.1, 3: 0.7 },
  };
}

function noulAnswer(value: number): NoulResponse {
  return { type: "noul", noul: value };
}

function answers(partial: {
  choice: string;
  choiceConf: number;
  risk: number;
  riskConf?: number;
  policyFit: number;
}): ToolGateAnswers {
  return {
    disposition: choiceAnswer(partial.choice, partial.choiceConf),
    risk: riskAnswer(partial.risk, partial.riskConf ?? 0.9),
    policyFit: noulAnswer(partial.policyFit),
  };
}

describe("decideToolAction", () => {
  it("allows high-confidence allow with policy fit and low risk", () => {
    const result = decideToolAction(
      answers({ choice: "allow", choiceConf: 0.92, risk: 0.4, policyFit: 0.95 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("allow");
  });

  it("escalates when allow confidence is below the allow bar", () => {
    const result = decideToolAction(
      answers({ choice: "allow", choiceConf: 0.7, risk: 0.2, policyFit: 0.95 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("escalate");
  });

  it("escalates when Choice confidence is below the floor", () => {
    const result = decideToolAction(
      answers({ choice: "allow", choiceConf: 0.4, risk: 0.1, policyFit: 0.99 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("escalate");
  });

  it("blocks when policy-fit Noul is at or below the block floor", () => {
    const result = decideToolAction(
      answers({ choice: "allow", choiceConf: 0.99, risk: 0.1, policyFit: 0.2 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("block");
  });

  it("blocks critical risk even if disposition is allow", () => {
    const result = decideToolAction(
      answers({ choice: "allow", choiceConf: 0.99, risk: 2.8, policyFit: 0.9 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("block");
  });

  it("blocks a confident Jev block disposition", () => {
    const result = decideToolAction(
      answers({ choice: "block", choiceConf: 0.8, risk: 1.0, policyFit: 0.5 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("block");
  });

  it("escalates a low-confidence Jev block instead of auto-blocking", () => {
    const result = decideToolAction(
      answers({ choice: "block", choiceConf: 0.5, risk: 1.0, policyFit: 0.5 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("escalate");
  });

  it("escalates unknown disposition labels", () => {
    const result = decideToolAction(
      answers({ choice: "maybe", choiceConf: 0.99, risk: 0.1, policyFit: 0.99 }),
      DEFAULT_TOOL_THRESHOLDS,
    );
    expect(result.decision).toBe("escalate");
  });
});

class ScriptedClient implements JevClient {
  readonly kind = "mock" as const;

  constructor(private readonly body: SystemOneResult<Questions>) {}

  async systemOne<Q extends Questions>(
    _request: SystemOneRequest<Q>,
    _options?: RequestOptions,
  ): Promise<SystemOneResult<Q>> {
    return this.body as SystemOneResult<Q>;
  }
}

describe("runToolGate", () => {
  it("maps Jev answers through decideToolAction", async () => {
    const client = new ScriptedClient({
      model: "jev-latest",
      answers: {
        disposition: choiceAnswer("allow", 0.91),
        risk: riskAnswer(0.3, 0.88),
        policyFit: noulAnswer(0.93),
      },
      usage: { input_tokens: 80, output_tokens: 24 },
    });

    const result = await runToolGate(client, { proposal, policy });
    expect(result.decision).toBe("allow");
    expect(result.proposal.tool).toBe("lookup_order");
    expect(result.model).toBe("jev-latest");
  });
});
