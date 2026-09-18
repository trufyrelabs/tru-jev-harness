import type { ToolDisposition } from "../lib/api";

const LABELS: Record<ToolDisposition, string> = {
  allow: "Allow",
  escalate: "Escalate",
  block: "Block",
};

export function DecisionBadge({ decision }: { decision: ToolDisposition }) {
  return <span className={`badge badge-${decision}`}>{LABELS[decision]}</span>;
}
