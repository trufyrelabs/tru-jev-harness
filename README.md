# tru-jev-harness

A small, production-shaped TypeScript harness from [TruFyre Technologies](https://trufyre.ai/) ([TruFyre Labs](https://github.com/trufyrelabs)) that puts [TypeSafe AI **Jev**](https://typesafe.ai) in front of two expensive agent steps:

1. **RAG relevance gate** — user query + candidate passages → one batched Jev **Noul** (“is this relevant?”) per passage → keep only high-noul passages **before** any LLM generation.
2. **Tool risk gate** — before an agent runs `refund`, `send_email`, `delete_record`, etc., Jev scores **Choice** (allow / escalate / block) + **Score** (risk) + **Noul** (policy fit) → code returns `allow` | `escalate` | `block`.

Jev does **not** generate text. The cascade is:

```
state + typed questions
        ↓
   Jev (System One)     ~100ms, ~$0.042 / million input tokens, output tokens free
        ↓
 typed answers (Choice / Score / Noul + probabilities)
        ↓
 your code branches on thresholds
        ↓
 optional LLM only if you still need prose
```

Package name: `tru-jev-harness` (also conceptually `@trufyre/jev-harness`). Author: **TruFyre Technologies Pty Ltd**.

## What Jev is

[Jev](https://typesafe.ai) is TypeSafe’s flagship **System One** model: it evaluates a `state` against named questions and returns structured answers your code can branch on. There is no chat completion and nothing to parse.

| Primitive | Question | Returns |
| --- | --- | --- |
| **Noul** | Is this statement true? | `noul` in `[0, 1]` (P(yes)). No separate `confidence` field. |
| **Choice** | Which option? | `choice`, `probabilities`, `confidence` |
| **Score** | Where on this rubric? | `score`, `legend`, `probabilities`, `confidence` |

All three can be mixed in a **single** `POST https://api.typesafe.ai/v1/systemone` call. Questions are evaluated in parallel against the same state. Model alias: `jev-latest` (currently `jev-1.13.0`). Docs: [docs.typesafe.ai](https://docs.typesafe.ai/).

Public figures from TypeSafe ([models](https://docs.typesafe.ai/models), [launch post](https://typesafe.ai/blog/introducing-system-one-models-and-jev)):

- **Price:** about **$0.042 / million input tokens** ($42 / billion). Output tokens are free.
- **Latency:** on the order of **~100ms**.
- **Context:** 64k tokens per request (32k for `state` plus the longest question).

## Why these gates

Retrieval and tool-use are where agents waste money and take irreversible actions.

- **RAG:** embedding search is cheap but noisy. Generating an answer over irrelevant chunks is slow and expensive. Jev’s Noul is a gut-check per passage, batched, before you pay for a frontier LLM.
- **Tools:** an LLM proposing `delete_record` is not a permission. Jev returns calibrated probabilities; **this repo’s code** decides allow / escalate / block from configurable confidence thresholds ([TypeSafe confidence routing](https://docs.typesafe.ai/patterns/confidence-routing)).

This harness is fixtures + gates only. No chatbot, no vector database, no LangChain.

## Install

Node **20+**, ESM.

```bash
git clone https://github.com/trufyrelabs/tru-jev-harness.git
cd tru-jev-harness
npm install
```

Library import:

```ts
import { createJevClient, runRagGate, runToolGate } from "tru-jev-harness";
```

Depends on the published TypeScript SDK [`@typesafe-ai/sdk`](https://www.npmjs.com/package/@typesafe-ai/sdk) (`TypeSafeClient.systemOne`, helpers `noul` / `choice` / `score`).

## Run the demos (copy-paste)

### Mock mode (no API key)

Reviewers can run everything without TypeSafe credentials. `--mock` uses a deterministic fake Jev client.

```bash
npm test
npm run demo:rag -- --mock
npm run demo:tool -- --mock
```

Equivalent: `JEV_MOCK=1 npm run demo:rag`.

### Live Jev

```bash
cp .env.example .env
# paste TYPESAFE_API_KEY=...  (https://console.typesafe.ai/settings/keys)
npm run demo:rag
npm run demo:tool
```

If `TYPESAFE_API_KEY` is missing and you did not pass `--mock`, the CLI exits with a clear error telling you to set the key or use `--mock`. **Never commit `.env`.**

Fixtures are a fictional AU retailer (**Bluegum Outfitters Pty Ltd**, Sydney): a Brunswick VIC duplicate-GST ticket, ACL/GST knowledge-base passages, and tool proposals (`lookup_order`, `send_email`, `refund`, `delete_record`).

## Configurable thresholds

Defaults live in `src/thresholds.ts` and can be overridden per call:

```ts
await runRagGate(client, { query, passages }, { thresholds: { keepMinNoul: 0.8 } });

await runToolGate(client, { proposal, policy }, {
  thresholds: { allowMinConfidence: 0.9, maxAllowRisk: 1.0 },
});
```

Noul answers have **no** `confidence` field ([TypeSafe docs](https://docs.typesafe.ai/confidence)); the RAG gate thresholds on `noul` (P(relevant)). The tool gate uses Choice `confidence`, Score `confidence` / `score`, and policy-fit `noul` together — Jev proposes, code decides.

## Alternate path: Vercel AI Gateway / AI SDK

This repo talks to TypeSafe’s native endpoint via `@typesafe-ai/sdk` (`TYPESAFE_API_KEY`, `POST /v1/systemone`, model `jev-latest`).

You can instead call Jev through [Vercel AI Gateway](https://vercel.com/docs/ai-gateway/modalities/evaluation) with the AI SDK 7+ `experimental_evaluate` API. Gateway model id is `typesafe-ai/jev`. The SDK maps TypeSafe **Noul** to a `boolean` question (`probability` in the answer):

```ts
import { experimental_evaluate as evaluate } from "ai";

const result = await evaluate({
  model: "typesafe-ai/jev",
  state: { query: "...", passage: "..." },
  questions: {
    relevant: {
      type: "boolean",
      instructions: "Is this passage relevant to the query?",
    },
    disposition: {
      type: "choice",
      instructions: "What should the agent do?",
      criteria: {
        allow: "Execute automatically",
        escalate: "Human review",
        block: "Do not execute",
      },
    },
  },
});
```

Direct TypeSafe provider: [`@ai-sdk/typesafe-ai`](https://ai-sdk.dev/providers/ai-sdk-providers/typesafe-ai) (`TYPESAFE_AI_API_KEY`, `typeSafeAi.evaluationModel("jev-latest")`). Same primitives; different packaging. Prefer the native SDK in this harness so CI never depends on a Gateway token.

## Library API

```ts
import {
  createJevClient,
  runRagGate,
  runToolGate,
  DEFAULT_RAG_THRESHOLDS,
  DEFAULT_TOOL_THRESHOLDS,
} from "tru-jev-harness";

const client = createJevClient({ mock: true }); // or live, reading TYPESAFE_API_KEY

const rag = await runRagGate(client, { query, passages });
// rag.kept → only passages with noul >= keepMinNoul

const tool = await runToolGate(client, { proposal, policy });
// tool.decision → "allow" | "escalate" | "block"
```

`JevClient` is a thin wrapper around `TypeSafeClient.systemOne`. Unit tests inject a mock; they never call the live API.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm test` | Vitest, mocked Jev only |
| `npm run demo:rag` | RAG gate CLI (`--mock` supported) |
| `npm run demo:tool` | Tool gate CLI (`--mock` supported) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Emit `dist/` |

## Layout

```
src/           client wrapper, ragGate, toolGate, types, thresholds
examples/      rag-demo, tool-demo, AU fixtures
tests/         gate logic with a scripted/mock Jev client
```

## License

MIT © TruFyre Technologies Pty Ltd

- Homepage: https://trufyre.ai/
- Repository: https://github.com/trufyrelabs/tru-jev-harness
- Jev / TypeSafe: https://typesafe.ai · https://docs.typesafe.ai
