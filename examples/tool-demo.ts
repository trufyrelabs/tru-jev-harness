import {
  createJevClient,
  loadDotEnv,
  MissingApiKeyError,
  runToolGate,
  wantsMock,
} from "../src/index.js";
import { BUSINESS, SUPPORT_TICKET } from "./fixtures/au-support.js";
import { TOOL_POLICY, TOOL_PROPOSALS } from "./fixtures/tool-proposals.js";

async function main(): Promise<void> {
  loadDotEnv();
  const mock = wantsMock();
  const client = createJevClient({ mock });

  console.log("tru-jev-harness — tool risk gate");
  console.log(`Business: ${BUSINESS.name}`);
  console.log(`Ticket:   ${SUPPORT_TICKET.id}`);
  console.log(`Client:   ${client.kind === "mock" ? "mock Jev (deterministic)" : "live TypeSafe Jev"}`);
  console.log("Cascade:  Jev Choice + Score + Noul → code returns allow / escalate / block → LLM only if you still need prose.");

  for (const proposal of TOOL_PROPOSALS) {
    const result = await runToolGate(client, {
      proposal,
      policy: TOOL_POLICY,
    });
    const args = JSON.stringify(proposal.arguments);
    console.log(`\n${proposal.tool}  (${proposal.id})`);
    console.log(`  args:         ${args}`);
    console.log(`  decision:     ${result.decision.toUpperCase()}`);
    console.log(
      `  disposition:  ${result.answers.disposition.choice}  conf=${result.answers.disposition.confidence.toFixed(2)}`,
    );
    console.log(
      `  risk:         score=${result.answers.risk.score.toFixed(2)}  conf=${result.answers.risk.confidence.toFixed(2)}`,
    );
    console.log(`  policyFit:    noul=${result.answers.policyFit.noul.toFixed(2)}`);
    for (const reason of result.reasons) {
      console.log(`  reason:       ${reason}`);
    }
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
