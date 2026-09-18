import { useEffect, useState } from "react";
import { HowItWorks } from "./components/HowItWorks";
import { RagPanel } from "./components/RagPanel";
import { SiteHeader } from "./components/SiteHeader";
import { ToolPanel } from "./components/ToolPanel";
import { BUSINESS, SUPPORT_TICKET } from "./data/fixtures";
import {
  fetchMeta,
  type MetaResponse,
  type RagThresholds,
  type ToolThresholds,
} from "./lib/api";

type GateTab = "rag" | "tool";

const FALLBACK_RAG: RagThresholds = { keepMinNoul: 0.75 };
const FALLBACK_TOOL: ToolThresholds = {
  allowMinConfidence: 0.85,
  escalateBelowConfidence: 0.6,
  blockMinConfidence: 0.7,
  policyFitAllowMin: 0.8,
  policyFitBlockBelow: 0.35,
  maxAllowRisk: 1.35,
  criticalRisk: 2.5,
};

export function App() {
  const [tab, setTab] = useState<GateTab>("rag");
  const [mock, setMock] = useState(true);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMeta()
      .then((value) => {
        if (!cancelled) {
          setMeta(value);
          // Live key present → use live Jev and hide the mock toggle.
          setMock(!value.hasApiKey);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setMetaError(
            error instanceof Error ? error.message : "Could not load API meta",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ragDefaults = meta?.defaults.rag ?? FALLBACK_RAG;
  const toolDefaults = meta?.defaults.tool ?? FALLBACK_TOOL;
  const hasApiKey = Boolean(meta?.hasApiKey);
  const showMockToggle = meta !== null && !hasApiKey;

  return (
    <div className="app-frame">
      <SiteHeader />

      <div className="app-shell">
        <section className="hero">
          <HowItWorks />
          <div className="ticket-chip">
            <span>{BUSINESS.name}</span>
            <span>·</span>
            <span>Ticket {SUPPORT_TICKET.id}</span>
            <span>·</span>
            <span>
              {SUPPORT_TICKET.customer.name}, {SUPPORT_TICKET.customer.suburb}
            </span>
          </div>
        </section>

        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Gate type">
            <button
              type="button"
              role="tab"
              aria-pressed={tab === "rag"}
              onClick={() => setTab("rag")}
            >
              RAG gate
            </button>
            <button
              type="button"
              role="tab"
              aria-pressed={tab === "tool"}
              onClick={() => setTab("tool")}
            >
              Tool gate
            </button>
          </div>

          <div className="mode-row">
            {showMockToggle ? (
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={mock}
                  onChange={(event) => setMock(event.target.checked)}
                />
                Mock Jev
              </label>
            ) : null}
            <span className="meta-chip">
              {metaError
                ? metaError
                : hasApiKey
                  ? "Live Jev · TYPESAFE_API_KEY loaded"
                  : meta === null
                    ? "Checking API key…"
                    : "No API key — mock only"}
            </span>
          </div>
        </div>

        {tab === "rag" ? (
          <RagPanel mock={mock} defaults={ragDefaults} />
        ) : (
          <ToolPanel mock={mock} defaults={toolDefaults} />
        )}

        <p className="footer-note">
          <img
            className="footer-mark"
            src="/trufyre-mark.png"
            width={18}
            height={18}
            alt=""
          />
          Built by{" "}
          <a href="https://trufyre.ai/" target="_blank" rel="noreferrer">
            TruFyre
          </a>{" "}
          · Powered by{" "}
          <a href="https://typesafe.ai" target="_blank" rel="noreferrer">
            TypeSafe AI Jev
          </a>
        </p>
      </div>
    </div>
  );
}
