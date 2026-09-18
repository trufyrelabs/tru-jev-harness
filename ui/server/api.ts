import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createJevClient,
  DEFAULT_RAG_THRESHOLDS,
  DEFAULT_TOOL_THRESHOLDS,
  loadDotEnv,
  MissingApiKeyError,
  runRagGate,
  runToolGate,
  type RagGateResult,
  type RagPassage,
  type RagThresholds,
  type ToolGateResult,
  type ToolPolicy,
  type ToolProposal,
  type ToolThresholds,
} from "../../src/index.js";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
loadDotEnv(repoRoot);

type JsonBody = Record<string, unknown>;

export type MetaResponse = {
  hasApiKey: boolean;
  defaults: {
    rag: RagThresholds;
    tool: ToolThresholds;
  };
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Expected a JSON object body");
  }
  return parsed as JsonBody;
}

function isPassage(value: unknown): value is RagPassage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.title === "string" &&
    typeof row.text === "string"
  );
}

function isProposal(value: unknown): value is ToolProposal {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.tool === "string" &&
    typeof row.actor === "string" &&
    typeof row.rationale === "string" &&
    typeof row.arguments === "object" &&
    row.arguments !== null
  );
}

function isPolicy(value: unknown): value is ToolPolicy {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return typeof row.name === "string" && typeof row.text === "string";
}

function sendError(res: ServerResponse, error: unknown): true {
  if (error instanceof MissingApiKeyError) {
    sendJson(res, 400, { error: error.message });
    return true;
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  sendJson(res, 500, { error: message });
  return true;
}

export function createApiHandler() {
  return async function handleApi(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<boolean> {
    const url = req.url ?? "";
    const path = url.split("?")[0] ?? "";

    if (!path.startsWith("/api/")) {
      return false;
    }

    if (req.method === "GET" && path === "/api/meta") {
      sendJson(res, 200, {
        hasApiKey: Boolean(process.env.TYPESAFE_API_KEY?.trim()),
        defaults: {
          rag: DEFAULT_RAG_THRESHOLDS,
          tool: DEFAULT_TOOL_THRESHOLDS,
        },
      } satisfies MetaResponse);
      return true;
    }

    if (req.method === "POST" && path === "/api/rag") {
      try {
        const body = await readJson(req);
        const query = typeof body.query === "string" ? body.query : "";
        const passages = Array.isArray(body.passages)
          ? body.passages.filter(isPassage)
          : [];
        if (!query.trim()) {
          sendJson(res, 400, { error: "query is required" });
          return true;
        }
        if (passages.length === 0) {
          sendJson(res, 400, { error: "at least one passage is required" });
          return true;
        }

        const mock = body.mock !== false;
        const client = createJevClient({ mock });
        const result: RagGateResult = await runRagGate(
          client,
          { query, passages },
          {
            thresholds:
              typeof body.thresholds === "object" && body.thresholds !== null
                ? (body.thresholds as Partial<RagThresholds>)
                : undefined,
          },
        );
        sendJson(res, 200, { ...result, clientKind: client.kind });
        return true;
      } catch (error) {
        return sendError(res, error);
      }
    }

    if (req.method === "POST" && path === "/api/tool") {
      try {
        const body = await readJson(req);
        if (!isProposal(body.proposal) || !isPolicy(body.policy)) {
          sendJson(res, 400, { error: "proposal and policy are required" });
          return true;
        }

        const mock = body.mock !== false;
        const client = createJevClient({ mock });
        const result: ToolGateResult = await runToolGate(
          client,
          { proposal: body.proposal, policy: body.policy },
          {
            thresholds:
              typeof body.thresholds === "object" && body.thresholds !== null
                ? (body.thresholds as Partial<ToolThresholds>)
                : undefined,
          },
        );
        sendJson(res, 200, { ...result, clientKind: client.kind });
        return true;
      } catch (error) {
        return sendError(res, error);
      }
    }

    sendJson(res, 404, { error: "not found" });
    return true;
  };
}
