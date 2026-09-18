import type {
  ChoiceQuestion,
  ChoiceResponse,
  NoulQuestion,
  NoulResponse,
  Question,
  Questions,
  RequestOptions,
  ScoreQuestion,
  ScoreResponse,
  SystemOneRequest,
  SystemOneResult,
} from "@typesafe-ai/sdk";
import { assertNever } from "./assertNever.js";
import { JEV_MODEL, type JevClient, type ToolDisposition } from "./types.js";

export type MockJevClientOptions = {
  model?: string;
};

type JsonRecord = { [key: string]: unknown };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp01(value: number): number {
  return Math.min(0.99, Math.max(0.01, value));
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2),
  );
}

function overlapRatio(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 || right.size === 0) {
    return 0.04;
  }
  let inter = 0;
  for (const token of left) {
    if (right.has(token)) {
      inter += 1;
    }
  }
  return inter / Math.min(left.size, right.size);
}

function stringifyState(state: unknown): string {
  if (typeof state === "string") {
    return state;
  }
  if (state === null || state === undefined) {
    return "";
  }
  return JSON.stringify(state);
}

function passageTextForKey(state: unknown, key: string): string | undefined {
  if (!isRecord(state)) {
    return undefined;
  }
  const passages = state.passages;
  if (Array.isArray(passages)) {
    const match = passages.find(
      (item) => isRecord(item) && item.id === key,
    );
    if (isRecord(match)) {
      return `${String(match.title ?? "")} ${String(match.text ?? "")}`;
    }
  }
  if (isRecord(passages) && isRecord(passages[key])) {
    const match = passages[key];
    return `${String(match.title ?? "")} ${String(match.text ?? "")}`;
  }
  return undefined;
}

function queryFromState(state: unknown): string {
  if (typeof state === "string") {
    return state;
  }
  if (isRecord(state) && typeof state.query === "string") {
    return state.query;
  }
  return stringifyState(state);
}

function proposalFromState(state: unknown): JsonRecord | undefined {
  if (!isRecord(state)) {
    return undefined;
  }
  return isRecord(state.proposal) ? state.proposal : undefined;
}

function amountFromProposal(proposal: JsonRecord | undefined): number {
  if (!proposal) {
    return 0;
  }
  const args = isRecord(proposal.arguments) ? proposal.arguments : {};
  const raw = args.amountAud ?? args.amount_aud ?? args.amount;
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : 0;
}

const FIXTURE_NOUL: Record<string, number> = {
  "kb-duplicate-charge": 0.96,
  "kb-acl-major-failure": 0.91,
  "kb-change-of-mind": 0.41,
  "kb-gst-refunds": 0.84,
  "kb-nsw-shipping": 0.12,
  "kb-loyalty-coffee": 0.07,
  "kb-nbn-status": 0.05,
};

function mockNoul(question: NoulQuestion, key: string, state: unknown): NoulResponse {
  const proposal = proposalFromState(state);
  const tool = typeof proposal?.tool === "string" ? proposal.tool : "";
  const amount = amountFromProposal(proposal);

  if (key === "policyFit" || /compl(y|ies) with the stated/i.test(String(question.instructions ?? ""))) {
    let noul = 0.9;
    if (tool === "delete_record") {
      noul = 0.08;
    } else if (tool === "refund" && amount >= 2000) {
      noul = 0.18;
    } else if (tool === "refund") {
      noul = 0.72;
    } else if (tool === "send_email" || tool === "lookup_order") {
      noul = 0.95;
    }
    return { type: "noul", noul: round2(noul) };
  }

  const query = queryFromState(state);
  const passage = passageTextForKey(state, key);
  const target = passage ?? `${String(question.instructions ?? "")} ${stringifyState(state)}`;
  const noul = FIXTURE_NOUL[key] ?? clamp01(0.08 + overlapRatio(query, target) * 0.9);
  return { type: "noul", noul: round2(noul) };
}

function peakedDistribution(
  labels: string[],
  winner: string,
  peak: number,
): Record<string, number> {
  if (labels.length === 0) {
    return {};
  }
  const rest = Math.max(0, 1 - peak);
  const others = labels.filter((label) => label !== winner);
  const each = others.length === 0 ? 0 : rest / others.length;
  const probabilities: Record<string, number> = {};
  for (const label of labels) {
    probabilities[label] = round2(label === winner ? peak : each);
  }
  const sum = Object.values(probabilities).reduce((acc, value) => acc + value, 0);
  const first = labels[0];
  if (first !== undefined && sum !== 1) {
    probabilities[first] = round2((probabilities[first] ?? 0) + (1 - sum));
  }
  return probabilities;
}

function mockChoice(question: ChoiceQuestion, state: unknown): ChoiceResponse {
  const labels = Object.keys(question.criteria);
  const dispositionLabels = new Set(["allow", "escalate", "block"]);
  const isDisposition =
    labels.length === 3 && labels.every((label) => dispositionLabels.has(label));

  let winner = labels[0] ?? "unknown";
  let peak = 0.7;
  let confidence = 0.55;

  if (isDisposition) {
    const proposal = proposalFromState(state);
    const tool = typeof proposal?.tool === "string" ? proposal.tool : "";
    const amount = amountFromProposal(proposal);
    let disposition: ToolDisposition = "escalate";
    if (tool === "delete_record" || (tool === "refund" && amount >= 2000)) {
      disposition = "block";
      peak = 0.91;
      confidence = 0.88;
    } else if (tool === "refund") {
      disposition = "escalate";
      peak = 0.78;
      confidence = 0.72;
    } else if (tool === "send_email" || tool === "lookup_order") {
      disposition = "allow";
      peak = 0.93;
      confidence = 0.9;
    } else {
      disposition = "escalate";
      peak = 0.62;
      confidence = 0.48;
    }
    winner = disposition;
  } else if (labels[0] !== undefined) {
    winner = labels[0];
  }

  return {
    type: "choice",
    choice: winner,
    confidence: round2(confidence),
    probabilities: peakedDistribution(labels, winner, peak),
  };
}

function mockScore(question: ScoreQuestion, state: unknown): ScoreResponse {
  const levels = question.criteria;
  const maxIndex = Math.max(1, levels.length - 1);
  const proposal = proposalFromState(state);
  const tool = typeof proposal?.tool === "string" ? proposal.tool : "";
  const amount = amountFromProposal(proposal);

  let score = maxIndex * 0.35;
  let confidence = 0.7;
  if (tool === "lookup_order") {
    score = 0.12;
    confidence = 0.94;
  } else if (tool === "send_email") {
    score = 0.55;
    confidence = 0.86;
  } else if (tool === "refund" && amount >= 2000) {
    score = 2.72;
    confidence = 0.9;
  } else if (tool === "refund") {
    score = 1.62;
    confidence = 0.81;
  } else if (tool === "delete_record") {
    score = 2.91;
    confidence = 0.93;
  }

  score = Math.min(maxIndex, Math.max(0, score));
  const winnerIndex = Math.min(maxIndex, Math.max(0, Math.round(score)));
  const probabilities: Record<number, number> = peakedDistribution(
    levels.map((_, index) => String(index)),
    String(winnerIndex),
    0.82,
  );
  const legend: Record<number, (typeof levels)[number]> = {};
  for (const [index, description] of levels.entries()) {
    legend[index] = description;
  }

  return {
    type: "score",
    score: round2(score),
    confidence: round2(confidence),
    legend,
    probabilities,
  };
}

function answerQuestion(question: Question, key: string, state: unknown) {
  switch (question.type) {
    case "noul":
      return mockNoul(question, key, state);
    case "choice":
      return mockChoice(question, state);
    case "score":
      return mockScore(question, state);
    default: {
      return assertNever(question, "Unhandled Jev question type in mock client");
    }
  }
}

/**
 * Deterministic stand-in for Jev. Used by `--mock` / `JEV_MOCK=1` and by tests.
 * Answers are stable for a given request; they are not live model output.
 */
export class MockJevClient implements JevClient {
  readonly kind = "mock" as const;
  private readonly model: string;

  constructor(options: MockJevClientOptions = {}) {
    this.model = options.model ?? `${JEV_MODEL}-mock`;
  }

  async systemOne<Q extends Questions>(
    request: SystemOneRequest<Q>,
    _options?: RequestOptions,
  ): Promise<SystemOneResult<Q>> {
    const answers = {} as SystemOneResult<Q>["answers"];
    for (const [key, question] of Object.entries(request.questions)) {
      (answers as Record<string, unknown>)[key] = answerQuestion(
        question,
        key,
        request.state,
      );
    }

    const tokenEstimate = Math.max(32, Math.ceil(stringifyState(request.state).length / 4));
    return {
      model: this.model,
      answers,
      usage: {
        input_tokens: tokenEstimate,
        output_tokens: Object.keys(request.questions).length * 8,
      },
    };
  }
}
