import type {
  ChoiceQuestion,
  ChoiceResponse,
  JsonValue,
  NoulQuestion,
  NoulResponse,
  Questions,
  ScoreQuestion,
  ScoreResponse,
  SystemOneRequest,
  SystemOneResult,
  Usage,
} from "@typesafe-ai/sdk";
import type { RequestOptions } from "@typesafe-ai/sdk";

export type {
  ChoiceQuestion,
  ChoiceResponse,
  JsonValue,
  NoulQuestion,
  NoulResponse,
  Questions,
  RequestOptions,
  ScoreQuestion,
  ScoreResponse,
  SystemOneRequest,
  SystemOneResult,
  Usage,
};

export type JsonObject = { [key: string]: JsonValue };

/** Jev model alias used by this harness. See https://docs.typesafe.ai/models */
export const JEV_MODEL = "jev-latest";

export const TYPESAFE_SYSTEMONE_URL = "https://api.typesafe.ai/v1/systemone";

export interface JevClient {
  readonly kind: "live" | "mock";
  systemOne<Q extends Questions>(
    request: SystemOneRequest<Q>,
    options?: RequestOptions,
  ): Promise<SystemOneResult<Q>>;
}

export type RagPassage = {
  id: string;
  title: string;
  text: string;
  source?: string;
};

export type RagGateInput = {
  query: string;
  passages: readonly RagPassage[];
  extraState?: JsonObject;
};

export type RagPassageVerdict = {
  passage: RagPassage;
  /** P(passage is relevant). Noul answers have no separate `confidence` field. */
  noul: number;
  keep: boolean;
};

export type RagGateResult = {
  kept: RagPassageVerdict[];
  dropped: RagPassageVerdict[];
  verdicts: RagPassageVerdict[];
  model: string;
  usage: Usage;
};

export type ToolDisposition = "allow" | "escalate" | "block";

export type ToolProposal = {
  id: string;
  tool: string;
  arguments: JsonObject;
  actor: string;
  ticketId?: string;
  rationale: string;
};

export type ToolPolicy = {
  name: string;
  text: string;
};

export type ToolGateInput = {
  proposal: ToolProposal;
  policy: ToolPolicy;
  extraState?: JsonObject;
};

export type ToolGateAnswers = {
  disposition: ChoiceResponse<ToolDispositionCriteria>;
  risk: ScoreResponse<ToolRiskCriteria>;
  policyFit: NoulResponse;
};

export type ToolDispositionCriteria = {
  allow: string;
  escalate: string;
  block: string;
};

export type ToolRiskCriteria = readonly [string, string, string, string];

export type ToolGateResult = {
  decision: ToolDisposition;
  reasons: string[];
  answers: ToolGateAnswers;
  proposal: ToolProposal;
  model: string;
  usage: Usage;
};

export type RagThresholds = {
  /**
   * Keep a passage when its Noul (P(relevant)) is at least this value.
   * TypeSafe Noul answers do not include a separate confidence field.
   */
  keepMinNoul: number;
};

export type ToolThresholds = {
  /** Minimum Choice confidence to auto-allow. */
  allowMinConfidence: number;
  /** Below this Choice confidence, do not auto-act (escalate). */
  escalateBelowConfidence: number;
  /** Minimum Choice confidence to honour a Jev `block` without a human. */
  blockMinConfidence: number;
  /** Minimum policy-fit Noul to auto-allow. */
  policyFitAllowMin: number;
  /** At or below this policy-fit Noul, block. */
  policyFitBlockBelow: number;
  /** Maximum risk Score (0–3 rubric) still eligible for auto-allow. */
  maxAllowRisk: number;
  /** Risk Score at or above this value is treated as critical. */
  criticalRisk: number;
};

export type CreateJevClientOptions = {
  mock?: boolean;
  apiKey?: string;
  model?: string;
  baseURL?: string;
};
