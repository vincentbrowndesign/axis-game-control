import {
  buildAxisRunAdapterPreview,
  createAxisRunContractPreview,
  getAxisRunAdapterContract,
  getAxisRunCompatibilityState,
  getAxisRunDryRunGuard,
  getAxisRunRouteCompatibility,
  getAxisRunSubmitGuard,
  getAxisRunSubmitReadinessSummary,
  getAxisRunWiringChecklist,
  mapAxisRunDryRunToAdapterStatus,
  validateAxisRunContractPreview,
} from "../../lib/axis/client";
import type {
  AxisOutput,
  AxisRunDryRunHistoryItem,
  AxisRunDryRunResult,
  AxisRunRequestPreview,
  AxisRunSubmitReadinessSummary,
} from "../../lib/axis/types";

export function AxisStatus({
  activeOutput,
  routeDryRunHistory = [],
  routeDryRunResult,
  runPreview,
  runPreviewHistory = [],
}: {
  activeOutput?: AxisOutput;
  routeDryRunHistory?: AxisRunDryRunHistoryItem[];
  routeDryRunResult?: AxisRunDryRunResult;
  runPreview?: AxisRunRequestPreview | null;
  runPreviewHistory?: AxisRunRequestPreview[];
}) {
  if (!activeOutput) return null;

  const stages = getRunStages(activeOutput);
  const previousPreviews = runPreviewHistory.filter((preview) => preview.id !== runPreview?.id).slice(0, 3);
  const runContract = runPreview ? createAxisRunContractPreview(activeOutput, runPreview) : null;
  const contractValidation = runContract ? validateAxisRunContractPreview(runContract) : null;
  const submitGuard = runContract ? getAxisRunSubmitGuard(runContract) : null;
  const compatibility = runContract ? getAxisRunCompatibilityState() : null;
  const adapterContract = runContract ? getAxisRunAdapterContract() : null;
  const routeCompatibility = runContract ? getAxisRunRouteCompatibility(runContract) : null;
  const adapterPreview = runContract ? buildAxisRunAdapterPreview(runContract) : null;
  const dryRunGuard = runContract ? getAxisRunDryRunGuard(runContract) : null;
  const wiringChecklist = runContract ? getAxisRunWiringChecklist() : [];
  const adapterStatus = mapAxisRunDryRunToAdapterStatus(routeDryRunResult ?? null);
  const submitReadiness = runContract ? getAxisRunSubmitReadinessSummary(runContract, routeDryRunResult) : null;
  const recentRouteDryRuns = routeDryRunHistory.slice(0, 3);

  return (
    <aside className="axis-status-card" aria-label="Active run progress">
      <div className="axis-status-card__header">
        <p>Active run</p>
        <span>{formatOutputStatus(activeOutput.status)}</span>
      </div>
      <h2>{activeOutput.title}</h2>
      <ol>
        {stages.map((stage) => (
          <li data-state={stage.state} key={stage.label}>
            <span />
            {stage.label}
          </li>
        ))}
      </ol>
      {activeOutput.summary && activeOutput.status !== "processing" && (
        <p className="axis-status-card__completion" data-state={activeOutput.status}>
          {activeOutput.summary}
        </p>
      )}
      {runPreview && (
        <dl className="axis-status-card__preview" aria-label="Local run request preview">
          <div>
            <dt>Route</dt>
            <dd>{runPreview.targetRoute}</dd>
          </div>
          <div>
            <dt>Mode</dt>
            <dd>{formatOutputType(runPreview.selectedOutputType)}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>{runPreview.sessionId ? "attached" : "none"}</dd>
          </div>
          <div>
            <dt>Media</dt>
            <dd>{runPreview.localAttachment?.name || (runPreview.mediaSourceId ? "attached" : "none")}</dd>
          </div>
          <div>
            <dt>Payload</dt>
            <dd>{runContract?.payload?.targetRoute ? "ready" : "none"}</dd>
          </div>
          <div>
            <dt>Execution</dt>
            <dd>{runContract?.execution.enabled ? "ready" : "locked"}</dd>
          </div>
          <div>
            <dt>Link</dt>
            <dd>{runContract?.isLinkedToOutput ? "matched" : "preview"}</dd>
          </div>
          <div>
            <dt>Check</dt>
            <dd>{contractValidation?.ok ? "ready" : "review"}</dd>
          </div>
          <div>
            <dt>Submit</dt>
            <dd>{submitGuard?.canSubmit ? "ready" : "blocked"}</dd>
          </div>
          <div>
            <dt>Route</dt>
            <dd>{adapterPreview ? `${adapterPreview.method} ${adapterPreview.route}` : "none"}</dd>
          </div>
          <div>
            <dt>Adapter</dt>
            <dd>{routeCompatibility?.compatible ? "contract ready" : adapterContract?.status}</dd>
          </div>
          <div>
            <dt>Dry Run</dt>
            <dd>{dryRunGuard?.canDryRun ? "ready" : "locked"}</dd>
          </div>
          <div>
            <dt>Mapping</dt>
            <dd>{adapterPreview?.outputAdapterPreview.willMapToAxisOutput ? "AxisOutput" : "none"}</dd>
          </div>
        </dl>
      )}
      {previousPreviews.length > 0 && (
        <section className="axis-status-card__history" aria-label="Recent local run requests">
          <p>Recent local requests</p>
          <ol>
            {previousPreviews.map((preview) => (
              <li key={preview.id}>
                <span>{formatOutputType(preview.selectedOutputType)}</span>
                <strong>{preview.inputText}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
      {adapterStatus && (
        <section className="axis-status-card__adapter-status" data-accepted={adapterStatus.accepted ? "true" : "false"}>
          <p>{adapterStatus.label}</p>
          <span>{adapterStatus.nextAgent ?? "Route dry-run checked"}</span>
          <ul>
            <li data-ready={adapterStatus.noWrite ? "true" : "false"}>No write</li>
            <li data-ready={adapterStatus.noJob ? "true" : "false"}>No job</li>
            <li data-ready={adapterStatus.noModelCall ? "true" : "false"}>No model</li>
            <li data-ready={adapterStatus.submitLocked ? "true" : "false"}>Submit locked</li>
          </ul>
        </section>
      )}
      {recentRouteDryRuns.length > 0 && (
        <section className="axis-status-card__dry-run-history" aria-label="Recent route dry-runs">
          <p>Route dry-runs</p>
          <ol>
            {recentRouteDryRuns.map((item) => (
              <li data-ok={item.result.ok ? "true" : "false"} key={item.id}>
                <span>{item.result.ok ? "Ready" : "Review"}</span>
                <strong>{item.outputTitle}</strong>
              </li>
            ))}
          </ol>
        </section>
      )}
      {submitReadiness && <SubmitReadinessSummary summary={submitReadiness} />}
      {wiringChecklist.length > 0 && (
        <section className="axis-status-card__wiring" aria-label="Local run wiring checklist">
          <p>Run wiring</p>
          <ul>
            {wiringChecklist.map((item) => (
              <li data-ready={item.ready ? "true" : "false"} key={item.label}>
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="axis-status-card__note">
        {routeCompatibility?.reason ||
          compatibility?.message ||
          contractValidation?.message ||
          runContract?.execution.message ||
          "Local progress preview. No backend run yet."}
      </p>

      <style>{`
        .axis-status-card,
        .axis-status-card * {
          box-sizing: border-box;
        }

        .axis-status-card {
          background: rgba(12, 14, 20, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.1rem;
          box-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.28);
          display: grid;
          gap: 0.75rem;
          padding: 0.95rem;
          position: fixed;
          right: max(1rem, env(safe-area-inset-right));
          top: max(1rem, env(safe-area-inset-top));
          width: min(20rem, calc(100vw - 2rem));
          z-index: 2;
        }

        .axis-status-card__header {
          align-items: center;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .axis-status-card__header p,
        .axis-status-card__header span {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-status-card h2 {
          color: #f4f1ea;
          font-size: 0.95rem;
          line-height: 1.2;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-status-card ol {
          display: grid;
          gap: 0.45rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-status-card > ol li {
          align-items: center;
          color: rgba(244, 241, 234, 0.58);
          display: flex;
          font-size: 0.78rem;
          gap: 0.45rem;
        }

        .axis-status-card > ol li span {
          background: rgba(244, 241, 234, 0.22);
          border-radius: 999px;
          height: 0.45rem;
          width: 0.45rem;
        }

        .axis-status-card > ol li[data-state="current"] {
          color: #f4f1ea;
        }

        .axis-status-card > ol li[data-state="current"] span {
          background: #8d42ff;
          box-shadow: 0 0 0 0.25rem rgba(141, 66, 255, 0.14);
        }

        .axis-status-card > ol li[data-state="done"] span {
          background: rgba(244, 241, 234, 0.72);
        }

        .axis-status-card > ol li[data-state="failed"] {
          color: #ffb4a8;
        }

        .axis-status-card > ol li[data-state="failed"] span {
          background: #ff6b57;
          box-shadow: 0 0 0 0.25rem rgba(255, 107, 87, 0.13);
        }

        .axis-status-card__preview {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 0.45rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0;
          padding-top: 0.7rem;
        }

        .axis-status-card__completion {
          border-left: 2px solid rgba(121, 226, 145, 0.56);
          color: rgba(244, 241, 234, 0.72);
          font-size: 0.78rem;
          line-height: 1.38;
          margin: -0.1rem 0 0;
          padding-left: 0.65rem;
        }

        .axis-status-card__completion[data-state="failed"] {
          border-left-color: rgba(255, 107, 87, 0.72);
          color: #ffb4a8;
        }

        .axis-status-card__preview div {
          min-width: 0;
        }

        .axis-status-card__preview dt,
        .axis-status-card__preview dd {
          margin: 0;
        }

        .axis-status-card__preview dt {
          color: rgba(244, 241, 234, 0.42);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .axis-status-card__preview dd {
          color: rgba(244, 241, 234, 0.72);
          font-size: 0.76rem;
          margin-top: 0.2rem;
          overflow-wrap: anywhere;
        }

        .axis-status-card__history {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 0.48rem;
          padding-top: 0.7rem;
        }

        .axis-status-card__wiring {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 0.45rem;
          padding-top: 0.7rem;
        }

        .axis-status-card__adapter-status {
          border-left: 2px solid rgba(121, 226, 145, 0.42);
          border-radius: 0.65rem;
          background: rgba(121, 226, 145, 0.055);
          display: grid;
          gap: 0.42rem;
          padding: 0.58rem 0.62rem;
        }

        .axis-status-card__adapter-status[data-accepted="false"] {
          background: rgba(255, 107, 87, 0.055);
          border-left-color: rgba(255, 107, 87, 0.58);
        }

        .axis-status-card__adapter-status p {
          color: rgba(244, 241, 234, 0.72);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-status-card__adapter-status span {
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .axis-status-card__adapter-status ul {
          display: flex;
          flex-wrap: wrap;
          gap: 0.32rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-status-card__adapter-status li {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0.14rem 0.34rem;
          text-transform: uppercase;
        }

        .axis-status-card__adapter-status li[data-ready="true"] {
          border-color: rgba(121, 226, 145, 0.22);
          color: rgba(121, 226, 145, 0.7);
        }

        .axis-status-card__dry-run-history {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 0.45rem;
          padding-top: 0.7rem;
        }

        .axis-status-card__dry-run-history p {
          color: rgba(244, 241, 234, 0.42);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-status-card__dry-run-history ol {
          display: grid;
          gap: 0.38rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-status-card__dry-run-history li {
          align-items: center;
          display: grid;
          gap: 0.42rem;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .axis-status-card__dry-run-history li span {
          border: 1px solid rgba(121, 226, 145, 0.24);
          border-radius: 999px;
          color: rgba(121, 226, 145, 0.68);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0.14rem 0.34rem;
          text-transform: uppercase;
        }

        .axis-status-card__dry-run-history li[data-ok="false"] span {
          border-color: rgba(255, 107, 87, 0.24);
          color: #ffb4a8;
        }

        .axis-status-card__dry-run-history li strong {
          color: rgba(244, 241, 234, 0.66);
          font-size: 0.72rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .axis-status-card__submit-readiness {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: grid;
          gap: 0.45rem;
          padding-top: 0.7rem;
        }

        .axis-status-card__submit-readiness p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.64rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-status-card__submit-readiness span {
          color: rgba(244, 241, 234, 0.56);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .axis-status-card__submit-readiness ul {
          display: grid;
          gap: 0.26rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-status-card__submit-readiness li {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.7rem;
          line-height: 1.3;
        }

        .axis-status-card__submit-readiness li::before {
          color: rgba(255, 180, 168, 0.72);
          content: "- ";
        }

        .axis-status-card__wiring p {
          color: rgba(244, 241, 234, 0.42);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-status-card__wiring ul {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-status-card__wiring li {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0.18rem 0.4rem;
          text-transform: uppercase;
        }

        .axis-status-card__wiring li[data-ready="true"] {
          border-color: rgba(121, 226, 145, 0.24);
          color: rgba(121, 226, 145, 0.72);
        }

        .axis-status-card__history p {
          color: rgba(244, 241, 234, 0.42);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-status-card__history ol {
          display: grid;
          gap: 0.4rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-status-card__history li {
          align-items: center;
          display: grid;
          gap: 0.4rem;
          grid-template-columns: auto minmax(0, 1fr);
        }

        .axis-status-card__history li span {
          border: 1px solid rgba(141, 66, 255, 0.32);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.58rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 0.16rem 0.35rem;
          text-transform: uppercase;
        }

        .axis-status-card__history li strong {
          color: rgba(244, 241, 234, 0.68);
          font-size: 0.72rem;
          font-weight: 600;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .axis-status-card__note {
          color: rgba(244, 241, 234, 0.42);
          font-size: 0.74rem;
          line-height: 1.35;
          margin: 0;
        }

        @media (max-width: 720px) {
          .axis-status-card {
            bottom: calc(6.2rem + env(safe-area-inset-bottom));
            left: 1rem;
            right: 1rem;
            top: auto;
            width: auto;
          }
        }
      `}</style>
    </aside>
  );
}

function SubmitReadinessSummary({ summary }: { summary: AxisRunSubmitReadinessSummary }) {
  return (
    <section className="axis-status-card__submit-readiness" aria-label="Submit readiness summary">
      <p>{summary.label}</p>
      <span>{summary.message}</span>
      <ul>
        {summary.remaining.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function getRunStages(output: AxisOutput) {
  const isProcessing = output.status === "processing";
  const hasFailed = output.status === "failed";

  return [
    { label: "Queued", state: "done" },
    { label: "Routing", state: isProcessing ? "current" : "done" },
    {
      label: hasFailed ? "Failed preview" : `Drafting ${formatOutputType(output.type)}`,
      state: hasFailed ? "failed" : isProcessing ? "waiting" : "done",
    },
  ];
}

function formatOutputType(value: AxisOutput["type"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatOutputStatus(value: AxisOutput["status"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
