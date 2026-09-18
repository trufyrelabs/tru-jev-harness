import { afterEach, describe, expect, it } from "vitest";
import { choice, noul, score } from "@typesafe-ai/sdk";
import { createJevClient, MissingApiKeyError, MockJevClient } from "../src/index.js";

describe("createJevClient", () => {
  const previous = process.env.TYPESAFE_API_KEY;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.TYPESAFE_API_KEY;
    } else {
      process.env.TYPESAFE_API_KEY = previous;
    }
  });

  it("throws a clear error when the API key is missing", () => {
    delete process.env.TYPESAFE_API_KEY;
    expect(() => createJevClient()).toThrow(MissingApiKeyError);
    try {
      createJevClient();
    } catch (error) {
      expect(error).toBeInstanceOf(MissingApiKeyError);
      expect((error as MissingApiKeyError).message).toContain("--mock");
    }
  });

  it("returns the mock client when mock is requested without a key", () => {
    delete process.env.TYPESAFE_API_KEY;
    const client = createJevClient({ mock: true });
    expect(client.kind).toBe("mock");
  });
});

describe("MockJevClient", () => {
  it("returns deterministic Noul scores for the same passages", async () => {
    const client = new MockJevClient();
    const request = {
      state: {
        query: "refund duplicate GST charge merino socks",
        passages: [
          {
            id: "kb-duplicate-charge",
            title: "Duplicate card captures",
            text: "If a customer's card is captured twice, refund the duplicate GST-inclusive amount.",
          },
          {
            id: "kb-loyalty-coffee",
            title: "Spring loyalty: coffee beans",
            text: "Members receive complimentary coffee beans. Offer excludes gift cards.",
          },
        ],
      },
      questions: {
        "kb-duplicate-charge": noul("relevant?"),
        "kb-loyalty-coffee": noul("relevant?"),
      },
    };

    const first = await client.systemOne(request);
    const second = await client.systemOne(request);
    expect(first.answers).toEqual(second.answers);
    expect(first.answers["kb-duplicate-charge"]?.type).toBe("noul");
    expect(first.answers["kb-loyalty-coffee"]?.type).toBe("noul");
    if (
      first.answers["kb-duplicate-charge"]?.type === "noul" &&
      first.answers["kb-loyalty-coffee"]?.type === "noul"
    ) {
      expect(first.answers["kb-duplicate-charge"].noul).toBeGreaterThan(
        first.answers["kb-loyalty-coffee"].noul,
      );
    }
  });

  it("blocks delete_record proposals in the tool heuristic", async () => {
    const client = new MockJevClient();
    const result = await client.systemOne({
      state: {
        proposal: {
          tool: "delete_record",
          arguments: { collection: "customers" },
        },
        policy: { text: "delete_record is forbidden" },
      },
      questions: {
        disposition: choice("what to do?", {
          allow: "ok",
          escalate: "review",
          block: "no",
        }),
        risk: score("risk?", ["low", "moderate", "high", "critical"]),
        policyFit: noul("complies with the stated policy?"),
      },
    });

    expect(result.answers.disposition.type).toBe("choice");
    if (result.answers.disposition.type === "choice") {
      expect(result.answers.disposition.choice).toBe("block");
    }
    expect(result.answers.policyFit.type).toBe("noul");
    if (result.answers.policyFit.type === "noul") {
      expect(result.answers.policyFit.noul).toBeLessThan(0.2);
    }
  });
});
