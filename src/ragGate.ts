import { noul } from "@typesafe-ai/sdk";
import type { NoulResponse, Questions, SystemOneResult } from "@typesafe-ai/sdk";
import { JevHarnessError } from "./errors.js";
import { mergeRagThresholds } from "./thresholds.js";
import type {
  JevClient,
  RagGateInput,
  RagGateResult,
  RagPassageVerdict,
  RagThresholds,
} from "./types.js";
import { JEV_MODEL } from "./types.js";

export type RunRagGateOptions = {
  thresholds?: Partial<RagThresholds>;
  model?: string;
};

function asNoul(answer: unknown, id: string): NoulResponse {
  if (
    typeof answer === "object" &&
    answer !== null &&
    "type" in answer &&
    answer.type === "noul" &&
    "noul" in answer &&
    typeof answer.noul === "number"
  ) {
    return answer as NoulResponse;
  }
  throw new JevHarnessError(`Expected a Noul answer for passage "${id}"`);
}

/**
 * One batched Jev call: each candidate passage is a Noul ("is this relevant?")
 * against the same state. Code then keeps only high-noul passages before any
 * expensive LLM generation.
 */
export async function runRagGate(
  client: JevClient,
  input: RagGateInput,
  options: RunRagGateOptions = {},
): Promise<RagGateResult> {
  const thresholds = mergeRagThresholds(options.thresholds);
  const model = options.model ?? JEV_MODEL;

  if (input.passages.length === 0) {
    return {
      kept: [],
      dropped: [],
      verdicts: [],
      model,
      usage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  const questions: Questions = {};
  for (const passage of input.passages) {
    questions[passage.id] = noul(
      `Does the knowledge-base passage with id "${passage.id}" contain information that would help answer the user query? Evaluate only that passage in state.passages. Question keys are not sent to Jev, so the id is restated here.`,
      {
        true: "The passage is on-topic and would improve a grounded answer to the query",
        false: "The passage is off-topic, promotional noise, or would not help answer the query",
      },
    );
  }

  const result: SystemOneResult<Questions> = await client.systemOne({
    model,
    state: {
      query: input.query,
      passages: input.passages.map((passage) => ({
        id: passage.id,
        title: passage.title,
        text: passage.text,
        source: passage.source ?? null,
      })),
      ...(input.extraState ?? {}),
    },
    questions,
  });

  const verdicts: RagPassageVerdict[] = input.passages.map((passage) => {
    const answer = asNoul(result.answers[passage.id], passage.id);
    return {
      passage,
      noul: answer.noul,
      keep: answer.noul >= thresholds.keepMinNoul,
    };
  });

  return {
    kept: verdicts.filter((verdict) => verdict.keep),
    dropped: verdicts.filter((verdict) => !verdict.keep),
    verdicts,
    model: result.model,
    usage: result.usage,
  };
}
