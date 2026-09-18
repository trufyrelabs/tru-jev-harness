import { choice, noul, score } from "@typesafe-ai/sdk";
import type {
  ChoiceResponse,
  NoulResponse,
  Questions,
  ScoreResponse,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import { assertNever } from "./assertNever.js";
import { JevHarnessError } from "./errors.js";
import { mergeToolThresholds } from "./thresholds.js";
import type {
  JevClient,
  ToolDisposition,
  ToolDispositionCriteria,
  ToolGateAnswers,
  ToolGateInput,
  ToolGateResult,
  ToolRiskCriteria,
  ToolThresholds,
} from "./types.js";
import { JEV_MODEL } from "./types.js";

export const TOOL_DISPOSITION_CRITERIA = {
  allow: "Safe to execute automatically; policy fit is clear and risk is acceptable",
  escalate: "A human should review before execution; stakes or uncertainty are material",
  block: "Do not execute; policy violation, unsafe, or clearly out of scope",
} as const satisfies ToolDispositionCriteria;

export const TOOL_RISK_CRITERIA = [
  "Low: read-only or easily reversible, limited blast radius",
  "Moderate: customer-visible but reversible (email, small refund within policy)",
  "High: money movement, irreversible comms, or policy-sensitive PII",
  "Critical: destructive, large-value, or likely non-compliant",
] as const satisfies ToolRiskCriteria;

export type RunToolGateOptions = {
  thresholds?: Partial<ToolThresholds>;
  model?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asChoice(answer: unknown): ChoiceResponse<ToolDispositionCriteria> {
  if (
    isObject(answer) &&
    answer.type === "choice" &&
    typeof answer.choice === "string" &&
    typeof answer.confidence === "number" &&
    isObject(answer.probabilities)
  ) {
    return answer as unknown as ChoiceResponse<ToolDispositionCriteria>;
  }
  throw new JevHarnessError("Expected a Choice answer for disposition");
}

function asScore(answer: unknown): ScoreResponse<ToolRiskCriteria> {
  if (
    isObject(answer) &&
    answer.type === "score" &&
    typeof answer.score === "number" &&
    typeof answer.confidence === "number"
  ) {
    return answer as unknown as ScoreResponse<ToolRiskCriteria>;
  }
  throw new JevHarnessError("Expected a Score answer for risk");
}

function asNoul(answer: unknown): NoulResponse {
  if (isObject(answer) && answer.type === "noul" && typeof answer.noul === "number") {
    return answer as unknown as NoulResponse;
  }
  throw new JevHarnessError("Expected a Noul answer for policyFit");
}

function parseDisposition(choiceLabel: string): ToolDisposition | undefined {
  if (choiceLabel === "allow" || choiceLabel === "escalate" || choiceLabel === "block") {
    return choiceLabel;
  }
  return undefined;
}

/**
 * Combine Jev Choice / Score / Noul answers with deterministic policy.
 * Jev does not execute the tool; this function returns allow / escalate / block.
 */
export function decideToolAction(
  answers: ToolGateAnswers,
  thresholds: ToolThresholds,
): { decision: ToolDisposition; reasons: string[] } {
  const { disposition, risk, policyFit } = answers;
  const parsed = parseDisposition(disposition.choice);

  if (
    risk.score >= thresholds.criticalRisk &&
    risk.confidence >= thresholds.escalateBelowConfidence
  ) {
    return {
      decision: "block",
      reasons: [
        `risk score ${risk.score.toFixed(2)} ≥ ${thresholds.criticalRisk} with confidence ${risk.confidence.toFixed(2)}`,
      ],
    };
  }

  if (!parsed) {
    return {
      decision: "escalate",
      reasons: [`unexpected disposition "${disposition.choice}"; refusing to auto-act`],
    };
  }

  const policyTooWeak = policyFit.noul <= thresholds.policyFitBlockBelow;

  switch (parsed) {
    case "block": {
      if (disposition.confidence >= thresholds.blockMinConfidence) {
        return {
          decision: "block",
          reasons: [
            `Jev disposition=block at confidence ${disposition.confidence.toFixed(2)}`,
          ],
        };
      }
      return {
        decision: "escalate",
        reasons: [
          `Jev disposition=block but confidence ${disposition.confidence.toFixed(2)} < ${thresholds.blockMinConfidence}; human review`,
        ],
      };
    }
    case "escalate": {
      return {
        decision: "escalate",
        reasons: [
          `Jev disposition=escalate (confidence ${disposition.confidence.toFixed(2)})`,
        ],
      };
    }
    case "allow": {
      if (policyTooWeak) {
        return {
          decision: "escalate",
          reasons: [
            `policyFit noul ${policyFit.noul.toFixed(2)} ≤ ${thresholds.policyFitBlockBelow}; not auto-executing`,
          ],
        };
      }
      if (disposition.confidence < thresholds.escalateBelowConfidence) {
        return {
          decision: "escalate",
          reasons: [
            `disposition confidence ${disposition.confidence.toFixed(2)} < ${thresholds.escalateBelowConfidence} floor`,
          ],
        };
      }
      if (disposition.confidence < thresholds.allowMinConfidence) {
        return {
          decision: "escalate",
          reasons: [
            `allow confidence ${disposition.confidence.toFixed(2)} < ${thresholds.allowMinConfidence}; confirm with a human`,
          ],
        };
      }
      if (policyFit.noul < thresholds.policyFitAllowMin) {
        return {
          decision: "escalate",
          reasons: [
            `policyFit noul ${policyFit.noul.toFixed(2)} < ${thresholds.policyFitAllowMin} allow bar`,
          ],
        };
      }
      if (risk.score > thresholds.maxAllowRisk) {
        return {
          decision: "escalate",
          reasons: [
            `risk score ${risk.score.toFixed(2)} > ${thresholds.maxAllowRisk} allow cap`,
          ],
        };
      }
      return {
        decision: "allow",
        reasons: [
          "high-confidence allow, policy fit, and risk within configured caps",
        ],
      };
    }
    default: {
      return assertNever(parsed, "Unhandled tool disposition");
    }
  }
}

/**
 * Before an agent executes a tool, Jev scores risk + policy fit in one call.
 * Code then returns allow / escalate / block. No LLM generation happens here.
 */
export async function runToolGate(
  client: JevClient,
  input: ToolGateInput,
  options: RunToolGateOptions = {},
): Promise<ToolGateResult> {
  const thresholds = mergeToolThresholds(options.thresholds);
  const model = options.model ?? JEV_MODEL;

  const questions = {
    disposition: choice(
      "Given the tool-call proposal and policy, what should the agent do before executing the tool?",
      TOOL_DISPOSITION_CRITERIA,
    ),
    risk: score(
      "How operationally risky is executing this tool call as proposed?",
      TOOL_RISK_CRITERIA,
    ),
    policyFit: noul(
      "Does this proposed tool call comply with the stated business policy?",
      {
        true: "The proposal is within policy, including Australian Consumer Law refund duties where relevant",
        false: "The proposal would violate policy, exceed authority, or lacks required evidence",
      },
    ),
  } satisfies Questions;

  const result: SystemOneResult<typeof questions> = await client.systemOne({
    model,
    state: {
      proposal: {
        id: input.proposal.id,
        tool: input.proposal.tool,
        arguments: input.proposal.arguments,
        actor: input.proposal.actor,
        ticketId: input.proposal.ticketId ?? null,
        rationale: input.proposal.rationale,
      },
      policy: {
        name: input.policy.name,
        text: input.policy.text,
      },
      ...(input.extraState ?? {}),
    },
    questions,
  });

  const answers: ToolGateAnswers = {
    disposition: asChoice(result.answers.disposition),
    risk: asScore(result.answers.risk),
    policyFit: asNoul(result.answers.policyFit),
  };
  const decided = decideToolAction(answers, thresholds);

  return {
    decision: decided.decision,
    reasons: decided.reasons,
    answers,
    proposal: input.proposal,
    model: result.model,
    usage: result.usage,
  };
}
