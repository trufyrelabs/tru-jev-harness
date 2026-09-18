import type {
  MetaResponse,
  RagApiResponse,
  RagPassage,
  RagThresholds,
  ToolApiResponse,
  ToolPolicy,
  ToolProposal,
  ToolThresholds,
} from "./types";

export type {
  ClientKind,
  MetaResponse,
  RagApiResponse,
  RagGateResult,
  RagPassage,
  RagPassageVerdict,
  RagThresholds,
  ToolApiResponse,
  ToolDisposition,
  ToolGateResult,
  ToolPolicy,
  ToolProposal,
  ToolThresholds,
} from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function fetchMeta(): Promise<MetaResponse> {
  const response = await fetch("/api/meta");
  return parseJson<MetaResponse>(response);
}

export async function runRagApi(input: {
  mock: boolean;
  query: string;
  passages: RagPassage[];
  thresholds: Partial<RagThresholds>;
}): Promise<RagApiResponse> {
  const response = await fetch("/api/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<RagApiResponse>(response);
}

export async function runToolApi(input: {
  mock: boolean;
  proposal: ToolProposal;
  policy: ToolPolicy;
  thresholds: Partial<ToolThresholds>;
}): Promise<ToolApiResponse> {
  const response = await fetch("/api/tool", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<ToolApiResponse>(response);
}
