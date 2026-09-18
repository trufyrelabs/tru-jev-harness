import { useMemo, useState } from "react";
import { TOOL_POLICY, TOOL_PROPOSALS } from "../data/fixtures";
import {
  runToolApi,
  type ToolApiResponse,
  type ToolThresholds,
} from "../lib/api";
import { DecisionBadge } from "./DecisionBadge";
import { Meter } from "./Meter";

type ToolPanelProps = {
  mock: boolean;
  defaults: ToolThresholds;
};

export function ToolPanel({ mock, defaults }: ToolPanelProps) {
  const [proposalId, setProposalId] = useState(TOOL_PROPOSALS[0]?.id ?? "");
  const [thresholds, setThresholds] = useState<ToolThresholds>(defaults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolApiResponse | null>(null);

  const proposal = useMemo(
    () => TOOL_PROPOSALS.find((item) => item.id === proposalId) ?? TOOL_PROPOSALS[0],
    [proposalId],
  );

  async function onRun(): Promise<void> {
    if (!proposal) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await runToolApi({
        mock,
        proposal,
        policy: TOOL_POLICY,
        thresholds,
      });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tool gate failed");
    } finally {
      setLoading(false);
    }
  }

  function updateThreshold<K extends keyof ToolThresholds>(
    key: K,
    value: ToolThresholds[K],
  ): void {
    setThresholds((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Tool risk gate</h2>
            <p>Choice + Score + Noul → your code decides allow / escalate / block.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="field">
            <label htmlFor="tool-proposal">Proposed tool call</label>
            <select
              id="tool-proposal"
              value={proposal?.id}
              onChange={(event) => setProposalId(event.target.value)}
            >
              {TOOL_PROPOSALS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.tool} — {item.id}
                </option>
              ))}
            </select>
          </div>

          {proposal ? (
            <article className="tool-card">
              <header>
                <h3>{proposal.tool}</h3>
                <span className="mono muted">{proposal.id}</span>
              </header>
              <p>{proposal.rationale}</p>
              <pre
                className="mono muted"
                style={{ margin: "0.65rem 0 0", whiteSpace: "pre-wrap" }}
              >
                {JSON.stringify(proposal.arguments, null, 2)}
              </pre>
            </article>
          ) : null}

          <div className="field">
            <label>Policy</label>
            <p className="muted">{TOOL_POLICY.text}</p>
          </div>

          <div className="slider-row">
            <header>
              <span>allowMinConfidence</span>
              <strong>{thresholds.allowMinConfidence.toFixed(2)}</strong>
            </header>
            <input
              type="range"
              min={0.5}
              max={0.99}
              step={0.01}
              value={thresholds.allowMinConfidence}
              onChange={(event) =>
                updateThreshold("allowMinConfidence", Number(event.target.value))
              }
            />
          </div>

          <div className="slider-row">
            <header>
              <span>maxAllowRisk</span>
              <strong>{thresholds.maxAllowRisk.toFixed(2)}</strong>
            </header>
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={thresholds.maxAllowRisk}
              onChange={(event) =>
                updateThreshold("maxAllowRisk", Number(event.target.value))
              }
            />
          </div>

          <div className="slider-row">
            <header>
              <span>policyFitAllowMin</span>
              <strong>{thresholds.policyFitAllowMin.toFixed(2)}</strong>
            </header>
            <input
              type="range"
              min={0.1}
              max={0.99}
              step={0.01}
              value={thresholds.policyFitAllowMin}
              onChange={(event) =>
                updateThreshold("policyFitAllowMin", Number(event.target.value))
              }
            />
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onRun()}
              disabled={loading || !proposal}
            >
              {loading ? "Evaluating…" : "Run tool gate"}
            </button>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Decision</h2>
            <p>Jev proposes structured answers; thresholds enforce policy.</p>
          </div>
        </div>
        <div className="panel-body">
          {!result ? (
            <div className="empty-state">
              Pick a proposal and run the gate to see allow / escalate / block.
            </div>
          ) : (
            <>
              <article className="result-card">
                <header>
                  <h3>{result.proposal.tool}</h3>
                  <DecisionBadge decision={result.decision} />
                </header>
                <p className="muted">model {result.model}</p>
                <ul className="reasons">
                  {result.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </article>

              <div className="stat-row">
                <div className="stat">
                  <strong>{result.answers.disposition.choice}</strong>
                  <span>Disposition</span>
                </div>
                <div className="stat">
                  <strong>{result.answers.risk.score.toFixed(2)}</strong>
                  <span>Risk score</span>
                </div>
                <div className="stat">
                  <strong>{result.answers.policyFit.noul.toFixed(2)}</strong>
                  <span>Policy fit</span>
                </div>
              </div>

              <div className="result-stack">
                <article className="result-card">
                  <header>
                    <h3>Choice confidence</h3>
                  </header>
                  <Meter
                    value={result.answers.disposition.confidence}
                    label="Disposition confidence"
                    tone={
                      result.decision === "allow"
                        ? "keep"
                        : result.decision === "block"
                          ? "drop"
                          : "default"
                    }
                  />
                </article>
                <article className="result-card">
                  <header>
                    <h3>Operational risk</h3>
                  </header>
                  <Meter
                    value={result.answers.risk.score}
                    max={3}
                    label="Score 0–3"
                    tone="risk"
                    detail={`${result.answers.risk.score.toFixed(2)} · conf ${result.answers.risk.confidence.toFixed(2)}`}
                  />
                </article>
                <article className="result-card">
                  <header>
                    <h3>Policy fit</h3>
                  </header>
                  <Meter
                    value={result.answers.policyFit.noul}
                    label="Noul · P(in policy)"
                    tone={
                      result.answers.policyFit.noul >= thresholds.policyFitAllowMin
                        ? "keep"
                        : "drop"
                    }
                  />
                </article>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
