import { useState } from "react";
import {
  KB_PASSAGES,
  RAG_QUERY,
  RAG_QUERY_EXAMPLES,
} from "../data/fixtures";
import {
  runRagApi,
  type RagApiResponse,
  type RagPassage,
  type RagThresholds,
} from "../lib/api";
import { Meter } from "./Meter";

type RagPanelProps = {
  mock: boolean;
  defaults: RagThresholds;
};

export function RagPanel({ mock, defaults }: RagPanelProps) {
  const [query, setQuery] = useState(RAG_QUERY);
  const [activeExample, setActiveExample] = useState(
    RAG_QUERY_EXAMPLES[0]?.id ?? "duplicate-charge",
  );
  const [passages] = useState<RagPassage[]>(KB_PASSAGES);
  const [keepMinNoul, setKeepMinNoul] = useState(defaults.keepMinNoul);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RagApiResponse | null>(null);

  function applyExample(id: string): void {
    const example = RAG_QUERY_EXAMPLES.find((item) => item.id === id);
    if (!example) {
      return;
    }
    setActiveExample(example.id);
    setQuery(example.query);
    setResult(null);
    setError(null);
  }

  async function onRun(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const next = await runRagApi({
        mock,
        query,
        passages,
        thresholds: { keepMinNoul },
      });
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "RAG gate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>RAG relevance gate</h2>
            <p>Batch Noul over candidate passages before any LLM generation.</p>
          </div>
        </div>
        <div className="panel-body">
          <div className="field">
            <label htmlFor="rag-query">Support query</label>
            <div className="example-chips" role="group" aria-label="Query examples">
              {RAG_QUERY_EXAMPLES.map((example) => (
                <button
                  key={example.id}
                  type="button"
                  className={
                    activeExample === example.id
                      ? "example-chip example-chip-active"
                      : "example-chip"
                  }
                  onClick={() => applyExample(example.id)}
                >
                  {example.label}
                </button>
              ))}
            </div>
            <textarea
              id="rag-query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveExample("");
              }}
            />
          </div>

          <div className="slider-row">
            <header>
              <span>keepMinNoul</span>
              <strong>{keepMinNoul.toFixed(2)}</strong>
            </header>
            <input
              type="range"
              min={0.05}
              max={0.99}
              step={0.01}
              value={keepMinNoul}
              onChange={(event) => setKeepMinNoul(Number(event.target.value))}
            />
          </div>

          <div className="passage-list">
            {passages.map((passage) => (
              <article key={passage.id} className="passage-card">
                <header>
                  <h3>{passage.title}</h3>
                  <span className="mono muted">{passage.id}</span>
                </header>
                <p>{passage.text}</p>
              </article>
            ))}
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void onRun()}
              disabled={loading}
            >
              {loading ? "Scoring…" : "Run RAG gate"}
            </button>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Verdicts</h2>
            <p>Keep only passages with noul ≥ threshold.</p>
          </div>
        </div>
        <div className="panel-body">
          {!result ? (
            <div className="empty-state">
              Run the gate to see which KB passages clear the relevance bar.
            </div>
          ) : (
            <>
              <div className="stat-row">
                <div className="stat">
                  <strong>
                    {result.kept.length}/{result.verdicts.length}
                  </strong>
                  <span>Kept</span>
                </div>
                <div className="stat">
                  <strong>{result.usage.input_tokens}</strong>
                  <span>In tokens</span>
                </div>
                <div className="stat">
                  <strong>{result.clientKind}</strong>
                  <span>Client</span>
                </div>
              </div>

              <div className="result-stack">
                {result.verdicts.map((verdict) => (
                  <article key={verdict.passage.id} className="result-card">
                    <header>
                      <h3>{verdict.passage.title}</h3>
                      <span
                        className={`badge ${verdict.keep ? "badge-keep" : "badge-drop"}`}
                      >
                        {verdict.keep ? "Keep" : "Drop"}
                      </span>
                    </header>
                    <Meter
                      value={verdict.noul}
                      label="Noul · P(relevant)"
                      tone={verdict.keep ? "keep" : "drop"}
                    />
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
