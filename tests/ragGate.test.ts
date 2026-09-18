import { describe, expect, it } from "vitest";
import type {
  JevClient,
  Questions,
  RequestOptions,
  SystemOneRequest,
  SystemOneResult,
} from "../src/index.js";
import { runRagGate } from "../src/index.js";
import type { RagPassage } from "../src/index.js";

class ScriptedClient implements JevClient {
  readonly kind = "mock" as const;
  calls: SystemOneRequest<Questions>[] = [];

  constructor(
    private readonly handler: (
      request: SystemOneRequest<Questions>,
    ) => SystemOneResult<Questions>,
  ) {}

  async systemOne<Q extends Questions>(
    request: SystemOneRequest<Q>,
    _options?: RequestOptions,
  ): Promise<SystemOneResult<Q>> {
    this.calls.push(request);
    return this.handler(request) as SystemOneResult<Q>;
  }
}

const passages: RagPassage[] = [
  { id: "keep-me", title: "Refunds", text: "Duplicate charges are refunded in full." },
  { id: "drop-me", title: "Coffee", text: "Free beans for loyalty members." },
];

describe("runRagGate", () => {
  it("issues one batched Noul question per passage and keeps high-noul hits", async () => {
    const client = new ScriptedClient((request) => {
      expect(Object.keys(request.questions)).toEqual(["keep-me", "drop-me"]);
      for (const question of Object.values(request.questions)) {
        expect(question.type).toBe("noul");
      }
      return {
        model: "jev-latest",
        answers: {
          "keep-me": { type: "noul", noul: 0.94 },
          "drop-me": { type: "noul", noul: 0.11 },
        },
        usage: { input_tokens: 120, output_tokens: 16 },
      };
    });

    const result = await runRagGate(client, {
      query: "I was charged twice for order BG-10482",
      passages,
    });

    expect(client.calls).toHaveLength(1);
    expect(result.kept.map((row) => row.passage.id)).toEqual(["keep-me"]);
    expect(result.dropped.map((row) => row.passage.id)).toEqual(["drop-me"]);
    expect(result.usage.input_tokens).toBe(120);
  });

  it("honours a custom keepMinNoul threshold", async () => {
    const client = new ScriptedClient(() => ({
      model: "jev-latest",
      answers: {
        "keep-me": { type: "noul", noul: 0.8 },
        "drop-me": { type: "noul", noul: 0.79 },
      },
      usage: { input_tokens: 10, output_tokens: 2 },
    }));

    const result = await runRagGate(
      client,
      { query: "duplicate charge", passages },
      { thresholds: { keepMinNoul: 0.8 } },
    );

    expect(result.kept).toHaveLength(1);
    expect(result.dropped).toHaveLength(1);
  });

  it("skips the Jev call when there are no passages", async () => {
    const client = new ScriptedClient(() => {
      throw new Error("should not be called");
    });

    const result = await runRagGate(client, { query: "anything", passages: [] });
    expect(result.verdicts).toEqual([]);
    expect(client.calls).toHaveLength(0);
  });
});
