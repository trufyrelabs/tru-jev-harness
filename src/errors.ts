export class MissingApiKeyError extends Error {
  readonly code = "MISSING_TYPESAFE_API_KEY";

  constructor() {
    super(
      [
        "Missing TYPESAFE_API_KEY.",
        "Set it in the environment (see .env.example) or re-run with --mock for deterministic fake Jev answers.",
        "Create a key at https://console.typesafe.ai/settings/keys",
      ].join(" "),
    );
    this.name = "MissingApiKeyError";
  }
}

export class JevHarnessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JevHarnessError";
  }
}
