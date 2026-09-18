import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Load `.env` into `process.env` without overwriting existing values. */
export function loadDotEnv(cwd = process.cwd()): string | undefined {
  const path = resolve(cwd, ".env");
  if (!existsSync(path)) {
    return undefined;
  }

  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const eq = line.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return path;
}

export function wantsMock(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return argv.includes("--mock") || env.JEV_MOCK === "1";
}
