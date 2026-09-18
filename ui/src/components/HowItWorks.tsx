import { useId, useState } from "react";

export function HowItWorks() {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={`how-panel${open ? " how-panel-open" : ""}`}>
      <button
        type="button"
        className="how-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="how-toggle-copy">
          <span className="how-kicker">What this is</span>
          <span className="how-summary">
            A simple demo of a safety check for AI agents: it filters out
            useless knowledge before answering, and stops risky actions
            (like big refunds or deleting records) until a human says yes.
          </span>
        </span>
        <span className="how-toggle-action" aria-hidden="true">
          {open ? "Hide" : "How it works"}
          <span className="how-chevron">{open ? "▴" : "▾"}</span>
        </span>
      </button>

      <div
        id={panelId}
        className="how-body"
        role="region"
        aria-label="How the harness works"
        hidden={!open}
      >
        <div className="how-body-inner">
          <p className="how-lead">
            Think of <strong>Jev</strong> as a fast gut-check, not a chatbot.
            You show it the situation and ask clear yes/no, multiple-choice, or
            rating questions. It answers with numbers your app can trust — then
            your rules decide what happens next. No long essays to parse.
          </p>

          <h3 className="how-section-title">The big picture</h3>
          <ol className="flow-chart" aria-label="Overall evaluation cascade">
            <li className="flow-node">
              <strong>The situation</strong>
              <span>A customer question, or a proposed action like “refund $94”</span>
            </li>
            <li className="flow-arrow" aria-hidden="true">
              ↓
            </li>
            <li className="flow-node flow-node-accent">
              <strong>Jev takes a quick look</strong>
              <span>Scores relevance or risk in about a tenth of a second</span>
            </li>
            <li className="flow-arrow" aria-hidden="true">
              ↓
            </li>
            <li className="flow-node">
              <strong>Your house rules</strong>
              <span>Sliders set how strict you want to be</span>
            </li>
            <li className="flow-arrow" aria-hidden="true">
              ↓
            </li>
            <li className="flow-node">
              <strong>A clear decision</strong>
              <span>Keep or drop info. Allow, escalate, or block an action.</span>
            </li>
          </ol>

          <div className="flow-split">
            <div className="flow-split-panel">
              <h3 className="how-section-title">RAG gate — “is this helpful?”</h3>
              <ol className="flow-chart flow-chart-compact" aria-label="RAG gate flow">
                <li className="flow-node">
                  <strong>Customer question</strong>
                  <span>Plus a pile of knowledge-base articles</span>
                </li>
                <li className="flow-arrow" aria-hidden="true">
                  ↓
                </li>
                <li className="flow-node">
                  <strong>Score each article</strong>
                  <span>How likely is it actually relevant?</span>
                </li>
                <li className="flow-arrow" aria-hidden="true">
                  ↓
                </li>
                <li className="flow-node">
                  <strong>Keep the useful ones</strong>
                  <span>Skip junk so you don’t waste a big AI answer on noise</span>
                </li>
              </ol>
            </div>

            <div className="flow-split-panel">
              <h3 className="how-section-title">Tool gate — “is this safe?”</h3>
              <ol className="flow-chart flow-chart-compact" aria-label="Tool gate flow">
                <li className="flow-node">
                  <strong>Proposed action</strong>
                  <span>Look up an order, send email, refund, delete a record…</span>
                </li>
                <li className="flow-arrow" aria-hidden="true">
                  ↓
                </li>
                <li className="flow-node">
                  <strong>Check risk & policy</strong>
                  <span>How risky is it? Does it match company rules?</span>
                </li>
                <li className="flow-arrow" aria-hidden="true">
                  ↓
                </li>
                <li className="flow-node">
                  <strong>Go / ask a human / stop</strong>
                  <span>Safe things run. Shaky ones escalate. Bad ones get blocked.</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
