import {
  createJevClient,
  loadDotEnv,
  MissingApiKeyError,
  runRagGate,
  wantsMock,
} from "../src/index.js";
import { BUSINESS, KB_PASSAGES, RAG_QUERY, SUPPORT_TICKET } from "./fixtures/au-support.js";

function printVerdicts(
  label: string,
  rows: { passage: { id: string; title: string }; noul: number; keep: boolean }[],
): void {
  console.log(`\n${label}`);
  for (const row of rows) {
    const mark = row.keep ? "KEEP" : "drop";
    console.log(
      `  [${mark}] ${row.passage.id.padEnd(22)} noul=${row.noul.toFixed(2)}  ${row.passage.title}`,
    );
  }
}

async function main(): Promise<void> {
  loadDotEnv();
  const mock = wantsMock();
  const client = createJevClient({ mock });

  console.log("tru-jev-harness — RAG relevance gate");
  console.log(`Business: ${BUSINESS.name} (${BUSINESS.city})`);
  console.log(`Ticket:   ${SUPPORT_TICKET.id} — ${SUPPORT_TICKET.subject}`);
  console.log(`Client:   ${client.kind === "mock" ? "mock Jev (deterministic)" : "live TypeSafe Jev"}`);
  console.log("Cascade:  Jev Noul per passage (one batched call) → code keeps high-noul passages → optional LLM later.");

  const result = await runRagGate(client, {
    query: RAG_QUERY,
    passages: KB_PASSAGES,
  });

  printVerdicts("All passages", result.verdicts);
  console.log(
    `\nKept ${result.kept.length}/${result.verdicts.length} passages for generation. ` +
      `model=${result.model}  tokens in/out=${result.usage.input_tokens}/${result.usage.output_tokens}`,
  );
  if (result.kept.length === 0) {
    console.log("No passage cleared the gate. Skip expensive generation and ask for a better query or KB hit.");
  } else {
    console.log("Next step (not in this harness): send only the kept passages to an LLM.");
  }
}

main().catch((error: unknown) => {
  if (error instanceof MissingApiKeyError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }
  console.error(error);
  process.exitCode = 1;
});
