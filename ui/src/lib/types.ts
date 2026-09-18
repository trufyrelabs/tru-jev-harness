export type RagPassage = {
  id: string;
  title: string;
  text: string;
  source?: string;
};

export type RagPassageVerdict = {
  passage: RagPassage;
  noul: number;
  keep: boolean;
};

export type RagThresholds = {
  keepMinNoul: number;
};

export type RagGateResult = {
  kept: RagPassageVerdict[];
  dropped: RagPassageVerdict[];
  verdicts: RagPassageVerdict[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export type ToolDisposition = "allow" | "escalate" | "block";

export type ToolProposal = {
  id: string;
  tool: string;
  arguments: Record<string, unknown>;
  actor: string;
  ticketId?: string;
  rationale: string;
};

export type ToolPolicy = {
  name: string;
  text: string;
};

export type ToolThresholds = {
  allowMinConfidence: number;
  escalateBelowConfidence: number;
  blockMinConfidence: number;
  policyFitAllowMin: number;
  policyFitBlockBelow: number;
  maxAllowRisk: number;
  criticalRisk: number;
};

export type ToolGateAnswers = {
  disposition: {
    type: "choice";
    choice: string;
    confidence: number;
    probabilities: Record<string, number>;
  };
  risk: {
    type: "score";
    score: number;
    confidence: number;
    legend: Record<number, string>;
    probabilities: Record<number, number>;
  };
  policyFit: {
    type: "noul";
    noul: number;
  };
};

export type ToolGateResult = {
  decision: ToolDisposition;
  reasons: string[];
  answers: ToolGateAnswers;
  proposal: ToolProposal;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export type ClientKind = "live" | "mock";

export type MetaResponse = {
  hasApiKey: boolean;
  defaults: {
    rag: RagThresholds;
    tool: ToolThresholds;
  };
};

export type RagApiResponse = RagGateResult & {
  clientKind: ClientKind;
};

export type ToolApiResponse = ToolGateResult & {
  clientKind: ClientKind;
};
