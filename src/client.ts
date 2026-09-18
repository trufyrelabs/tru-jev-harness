import { TypeSafeClient, TypeSafeError } from "@typesafe-ai/sdk";
import type { Questions, RequestOptions, SystemOneRequest, SystemOneResult } from "@typesafe-ai/sdk";
import { MissingApiKeyError } from "./errors.js";
import { MockJevClient } from "./mockClient.js";
import { JEV_MODEL, type CreateJevClientOptions, type JevClient } from "./types.js";

export class SdkJevClient implements JevClient {
  readonly kind = "live" as const;

  constructor(private readonly sdk: TypeSafeClient) {}

  systemOne<Q extends Questions>(
    request: SystemOneRequest<Q>,
    options?: RequestOptions,
  ): Promise<SystemOneResult<Q>> {
    return this.sdk.systemOne(request, options);
  }
}

export function createJevClient(options: CreateJevClientOptions = {}): JevClient {
  if (options.mock) {
    return new MockJevClient({ model: options.model });
  }

  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new MissingApiKeyError();
  }

  try {
    return new SdkJevClient(
      new TypeSafeClient({
        apiKey,
        defaultModel: options.model ?? JEV_MODEL,
        ...(options.baseURL !== undefined ? { baseURL: options.baseURL } : {}),
      }),
    );
  } catch (error) {
    if (error instanceof TypeSafeError && /api key/i.test(error.message)) {
      throw new MissingApiKeyError();
    }
    throw error;
  }
}

export { MockJevClient } from "./mockClient.js";
