"use client";

import { useEffect, useState } from "react";
import {
  createAxisRunContractPreview,
  fetchRecentAxisOutputs,
  getFallbackAxisOutputs,
  getAxisRunSubmitGuard,
  getAxisRunWiringChecklist,
  validateAxisRunContractPreview,
  type AxisRecentOutputsResult,
} from "../../lib/axis/client";
import type { AxisOutput, AxisRunRequestPreview } from "../../lib/axis/types";

type OutputState =
  | {
      result: AxisRecentOutputsResult;
      status: "ready";
    }
  | {
      status: "loading";
    };

export function AxisOutputSurface({
  localRunPreviews = [],
  localOutputs = [],
  onClearLocalOutputs,
  onRetryOutput,
  retryableOutputIds = [],
}: {
  localRunPreviews?: AxisRunRequestPreview[];
  localOutputs?: AxisOutput[];
  onClearLocalOutputs?: () => void;
  onRetryOutput?: (outputId: string) => void;
  retryableOutputIds?: string[];
}) {
  const [outputState, setOutputState] = useState<OutputState>({ status: "loading" });
  const [selectedOutput, setSelectedOutput] = useState<AxisOutput | null>(null);

  useEffect(() => {
    let isActive = true;

    fetchRecentAxisOutputs()
      .then((result) => {
        if (isActive) setOutputState({ result, status: "ready" });
      })
      .catch(() => {
        if (!isActive) return;
        setOutputState({
          result: {
            message: "Recent outputs are unavailable. Showing local examples.",
            outputs: getFallbackAxisOutputs(),
            source: "fallback",
            status: "error",
          },
          status: "ready",
        });
      });

    return () => {
      isActive = false;
    };
  }, []);

  const backendOutputs = outputState.status === "ready" ? outputState.result.outputs : [];
  const outputs = [...localOutputs, ...backendOutputs];
  const message = outputState.status === "ready" ? outputState.result.message : "Checking saved output history...";
  const isFallback = outputState.status === "ready" && outputState.result.source === "fallback";
  const historyLabel =
    outputState.status === "ready" && outputState.result.source === "fallback" ? "example" : "saved";
  const surfaceLabel =
    localOutputs.length > 0 ? "Local + history" : isFallback ? "Example history" : "Saved history";
  const outputCountSummary =
    outputState.status === "loading"
      ? "Checking local previews and saved outputs."
      : `${formatCount(localOutputs.length, "local preview")} - ${formatCount(
          backendOutputs.length,
          `${historyLabel} output`,
        )}`;
  const selectedOutputDetails = selectedOutput
    ? outputs.find((output) => output.id === selectedOutput.id) ?? selectedOutput
    : null;
  const selectedRunTrace = selectedOutputDetails
    ? localRunPreviews.find((preview) => preview.expectedOutputId === selectedOutputDetails.id)
    : undefined;
  const localContractSummary = getLocalContractSummary(localOutputs, localRunPreviews);
  const localSubmitSummary = getLocalSubmitSummary(localOutputs, localRunPreviews);

  function clearLocalOutputPreviews() {
    if (selectedOutput && localOutputs.some((output) => output.id === selectedOutput.id)) {
      setSelectedOutput(null);
    }
    onClearLocalOutputs?.();
  }

  return (
    <section className="axis-output-surface" aria-labelledby="axis-recent-outputs-title">
      <div className="axis-output-surface__header">
        <div>
          <p>{surfaceLabel}</p>
          <h2 id="axis-recent-outputs-title">Recent Outputs</h2>
        </div>
        <div className="axis-output-surface__header-actions">
          {localOutputs.length > 0 && onClearLocalOutputs && (
            <button onClick={clearLocalOutputPreviews} type="button">
              Clear local
            </button>
          )}
          <span>{outputState.status === "loading" ? "Loading" : outputState.result.status}</span>
        </div>
      </div>

      {message && localOutputs.length === 0 && <p className="axis-output-surface__message">{message}</p>}
      <p className="axis-output-surface__counts" aria-live="polite">
        {outputCountSummary}
        {localContractSummary && <> - {localContractSummary}</>}
        {localSubmitSummary && <> - {localSubmitSummary}</>}
      </p>

      <div className="axis-output-surface__list" aria-live="polite">
        {outputState.status === "loading" ? (
          <OutputSkeleton />
        ) : outputs.length > 0 ? (
          outputs.map((output) => {
            const runTrace = localRunPreviews.find((preview) => preview.expectedOutputId === output.id);
            const runContract = runTrace ? createAxisRunContractPreview(output, runTrace) : null;
            const contractValidation = runContract ? validateAxisRunContractPreview(runContract) : null;
            const submitGuard = runContract ? getAxisRunSubmitGuard(runContract) : null;

            return (
              <OutputCard
                contractStatus={
                  contractValidation
                    ? `${contractValidation.ok ? "Contract ready" : contractValidation.label}${
                        submitGuard ? ` - ${submitGuard.label}` : ""
                      }`
                    : undefined
                }
                key={output.id}
                output={output}
                onSelect={() => setSelectedOutput(output)}
              />
            );
          })
        ) : (
          <p className="axis-output-surface__empty">No recent outputs found.</p>
        )}
      </div>

      {selectedOutputDetails && (
        <OutputDetailPreview
          canRetry={retryableOutputIds.includes(selectedOutputDetails.id)}
          onClose={() => setSelectedOutput(null)}
          onRetry={onRetryOutput ? () => onRetryOutput(selectedOutputDetails.id) : undefined}
          output={selectedOutputDetails}
          runTrace={selectedRunTrace}
        />
      )}

      <style>{`
        .axis-output-surface,
        .axis-output-surface * {
          box-sizing: border-box;
        }

        .axis-output-surface {
          background: rgba(12, 14, 20, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 1.1rem;
          box-shadow: 0 1.2rem 4rem rgba(0, 0, 0, 0.28);
          display: grid;
          gap: 0.8rem;
          left: max(1rem, env(safe-area-inset-left));
          max-height: calc(100dvh - 2rem);
          overflow-y: auto;
          padding: 0.95rem;
          position: fixed;
          top: max(1rem, env(safe-area-inset-top));
          width: min(24rem, calc(100vw - 2rem));
          z-index: 2;
        }

        .axis-output-surface__header {
          align-items: start;
          display: flex;
          gap: 1rem;
          justify-content: space-between;
        }

        .axis-output-surface__header-actions {
          align-items: end;
          display: grid;
          gap: 0.35rem;
          justify-items: end;
        }

        .axis-output-surface__header p,
        .axis-output-surface__header span {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0 0 0.28rem;
          text-transform: uppercase;
        }

        .axis-output-surface__header h2 {
          color: #f4f1ea;
          font-size: 1rem;
          line-height: 1.15;
          margin: 0;
        }

        .axis-output-surface__header-actions button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.72);
          cursor: pointer;
          font: inherit;
          font-size: 0.68rem;
          min-height: 1.8rem;
          padding: 0 0.6rem;
        }

        .axis-output-surface__header-actions button:hover,
        .axis-output-surface__header-actions button:focus-visible {
          border-color: rgba(141, 66, 255, 0.48);
          outline: none;
        }

        .axis-output-surface__message,
        .axis-output-surface__empty,
        .axis-output-surface__counts {
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.78rem;
          line-height: 1.35;
          margin: 0;
        }

        .axis-output-surface__counts {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(244, 241, 234, 0.46);
          font-size: 0.7rem;
          letter-spacing: 0.04em;
          padding-top: 0.58rem;
          text-transform: uppercase;
        }

        .axis-output-surface__list {
          display: grid;
          gap: 0.58rem;
        }

        .axis-output-card,
        .axis-output-skeleton {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.85rem;
          padding: 0.75rem;
        }

        .axis-output-card {
          color: inherit;
          cursor: pointer;
          display: grid;
          gap: 0.45rem;
          text-align: left;
          width: 100%;
        }

        .axis-output-card:hover,
        .axis-output-card:focus-visible {
          border-color: rgba(141, 66, 255, 0.48);
          outline: none;
        }

        .axis-output-card__top {
          align-items: start;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .axis-output-card h3 {
          color: #f4f1ea;
          font-size: 0.88rem;
          line-height: 1.18;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-output-card p {
          color: rgba(244, 241, 234, 0.62);
          font-size: 0.76rem;
          line-height: 1.35;
          margin: 0;
        }

        .axis-output-card__meta {
          align-items: center;
          color: rgba(244, 241, 234, 0.48);
          display: flex;
          flex-wrap: wrap;
          font-size: 0.68rem;
          gap: 0.4rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .axis-output-card__status {
          border: 1px solid rgba(141, 66, 255, 0.35);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.72);
          font-size: 0.66rem;
          padding: 0.18rem 0.42rem;
          text-transform: uppercase;
        }

        .axis-output-card__contract {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          color: rgba(244, 241, 234, 0.46);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding-top: 0.45rem;
          text-transform: uppercase;
        }

        .axis-output-detail {
          background: rgba(8, 10, 15, 0.98);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 1rem;
          box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4);
          display: grid;
          gap: 0.8rem;
          inset: 0.6rem;
          padding: 0.9rem;
          position: absolute;
          z-index: 3;
        }

        .axis-output-detail__header {
          align-items: start;
          display: flex;
          gap: 0.75rem;
          justify-content: space-between;
        }

        .axis-output-detail__header p,
        .axis-output-detail dt {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          margin: 0 0 0.3rem;
          text-transform: uppercase;
        }

        .axis-output-detail h3 {
          color: #f4f1ea;
          font-size: 1.05rem;
          line-height: 1.16;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-output-detail__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .axis-output-detail__close,
        .axis-output-detail__link,
        .axis-output-detail__locked,
        .axis-output-detail__retry {
          justify-content: center;
        }

        .axis-output-detail__close,
        .axis-output-detail__link,
        .axis-output-detail__locked {
          align-items: center;
          border-radius: 999px;
          color: #f4f1ea;
          display: inline-flex;
          font: inherit;
          font-size: 0.78rem;
          min-height: 2rem;
          padding: 0 0.72rem;
          text-decoration: none;
        }

        .axis-output-detail__locked {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: rgba(244, 241, 234, 0.46);
          cursor: not-allowed;
        }

        .axis-output-detail__close {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.16);
          cursor: pointer;
        }

        .axis-output-detail__retry {
          align-items: center;
          background: #8d42ff;
          border: 1px solid rgba(141, 66, 255, 0.7);
          border-radius: 999px;
          color: #f4f1ea;
          cursor: pointer;
          display: inline-flex;
          font: inherit;
          font-size: 0.78rem;
          min-height: 2rem;
          padding: 0 0.72rem;
        }

        .axis-output-detail__link {
          border: 1px solid rgba(141, 66, 255, 0.46);
          justify-content: center;
        }

        .axis-output-detail__thumbnail {
          aspect-ratio: 16 / 9;
          background:
            linear-gradient(135deg, rgba(141, 66, 255, 0.18), rgba(255, 255, 255, 0.04)),
            #0c0e14;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.8rem;
          object-fit: cover;
          width: 100%;
        }

        .axis-output-detail dl {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          margin: 0;
        }

        .axis-output-detail dl div {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.72rem;
          padding: 0.65rem;
        }

        .axis-output-detail dd {
          color: #f4f1ea;
          font-size: 0.82rem;
          line-height: 1.25;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-output-detail__summary,
        .axis-output-detail__empty-file {
          color: rgba(244, 241, 234, 0.66);
          font-size: 0.8rem;
          line-height: 1.38;
          margin: 0;
        }

        .axis-output-detail__attachment {
          background: rgba(255, 255, 255, 0.045);
          border: 1px solid rgba(141, 66, 255, 0.18);
          border-radius: 0.72rem;
          display: grid;
          gap: 0.18rem;
          padding: 0.65rem;
        }

        .axis-output-detail__trace {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 2px solid rgba(141, 66, 255, 0.48);
          border-radius: 0.72rem;
          display: grid;
          gap: 0.5rem;
          padding: 0.65rem;
        }

        .axis-output-detail__trace p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__trace blockquote {
          color: rgba(244, 241, 234, 0.82);
          font-size: 0.82rem;
          line-height: 1.35;
          margin: 0;
          overflow-wrap: anywhere;
        }

        .axis-output-detail__trace span {
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .axis-output-detail__payload {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.72rem;
          display: grid;
          gap: 0.55rem;
          padding: 0.65rem;
        }

        .axis-output-detail__payload > p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__payload dl {
          gap: 0.45rem;
        }

        .axis-output-detail__payload dl div {
          background: rgba(255, 255, 255, 0.035);
          padding: 0.52rem;
        }

        .axis-output-detail__result {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(121, 226, 145, 0.16);
          border-left: 2px solid rgba(121, 226, 145, 0.42);
          border-radius: 0.72rem;
          display: grid;
          gap: 0.3rem;
          padding: 0.65rem;
        }

        .axis-output-detail__result p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__result span {
          color: rgba(244, 241, 234, 0.68);
          font-size: 0.76rem;
          line-height: 1.35;
        }

        .axis-output-detail__result small {
          color: rgba(244, 241, 234, 0.48);
          font-size: 0.7rem;
          line-height: 1.35;
        }

        .axis-output-detail__wiring {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          list-style: none;
          margin: 0.15rem 0 0;
          padding: 0;
        }

        .axis-output-detail__wiring li {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0.18rem 0.4rem;
          text-transform: uppercase;
        }

        .axis-output-detail__wiring li[data-ready="true"] {
          border-color: rgba(121, 226, 145, 0.24);
          color: rgba(121, 226, 145, 0.72);
        }

        .axis-output-detail__attachment p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__attachment strong {
          color: rgba(244, 241, 234, 0.82);
          font-size: 0.82rem;
          overflow-wrap: anywhere;
        }

        .axis-output-detail__attachment span {
          color: rgba(244, 241, 234, 0.56);
          font-size: 0.74rem;
        }

        .axis-output-skeleton {
          animation: axisOutputPulse 1.3s ease-in-out infinite;
          min-height: 4.8rem;
        }

        @keyframes axisOutputPulse {
          0%,
          100% {
            opacity: 0.45;
          }

          50% {
            opacity: 0.9;
          }
        }

        @media (max-width: 720px) {
          .axis-output-surface {
            left: 1rem;
            max-height: 30dvh;
            right: 1rem;
            top: 1rem;
            width: auto;
          }

          .axis-output-detail dl {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}

function OutputCard({
  contractStatus,
  onSelect,
  output,
}: {
  contractStatus?: string;
  onSelect: () => void;
  output: AxisOutput;
}) {
  return (
    <button className="axis-output-card" onClick={onSelect} type="button">
      <div className="axis-output-card__top">
        <div>
          <h3>{output.title}</h3>
          <div className="axis-output-card__meta">
            <span>{output.sourceLabel || formatOutputType(output.type)}</span>
            <time dateTime={output.createdAt}>{formatShortDate(output.createdAt)}</time>
          </div>
        </div>
        <span className="axis-output-card__status">{output.status}</span>
      </div>
      {output.summary && <p>{output.summary}</p>}
      {contractStatus && <span className="axis-output-card__contract">{contractStatus}</span>}
    </button>
  );
}

function OutputDetailPreview({
  canRetry,
  onClose,
  onRetry,
  output,
  runTrace,
}: {
  canRetry: boolean;
  onClose: () => void;
  onRetry?: () => void;
  output: AxisOutput;
  runTrace?: AxisRunRequestPreview;
}) {
  const sourceLabel = output.sourceLabel || formatOutputType(output.type);
  const runContract = runTrace ? createAxisRunContractPreview(output, runTrace) : null;
  const runPayload = runContract?.payload;
  const runResult = runContract?.result;
  const runExecutionState = runContract?.execution;
  const contractValidation = runContract ? validateAxisRunContractPreview(runContract) : null;
  const submitGuard = runContract ? getAxisRunSubmitGuard(runContract) : null;
  const wiringChecklist = runContract ? getAxisRunWiringChecklist() : [];

  return (
    <aside className="axis-output-detail" aria-label="Output detail preview">
      <div className="axis-output-detail__header">
        <div>
          <p>{sourceLabel}</p>
          <h3>{output.title || "Untitled output"}</h3>
        </div>
        <button className="axis-output-detail__close" onClick={onClose} type="button">
          Close
        </button>
      </div>

      {output.thumbnailUrl && (
        <img className="axis-output-detail__thumbnail" src={output.thumbnailUrl} alt="" />
      )}

      <dl>
        <div>
          <dt>Type</dt>
          <dd>{formatOutputType(output.type)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{formatOutputStatus(output.status)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>
            <time dateTime={output.createdAt}>{formatDetailDate(output.createdAt)}</time>
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{sourceLabel}</dd>
        </div>
      </dl>

      {output.summary && <p className="axis-output-detail__summary">{output.summary}</p>}
      {runTrace && (
        <div className="axis-output-detail__trace" aria-label="Local source trace">
          <p>Created from local command</p>
          <blockquote>{runTrace.inputText}</blockquote>
          <span>
            {formatOutputType(runTrace.selectedOutputType)} preview - {runTrace.targetRoute} -{" "}
            <time dateTime={runTrace.createdAt}>{formatDetailDate(runTrace.createdAt)}</time>
          </span>
        </div>
      )}
      {runPayload && (
        <div className="axis-output-detail__payload" aria-label="Future run payload preview">
          <p>Future run payload</p>
          <dl>
            <div>
              <dt>Route</dt>
              <dd>{runPayload.targetRoute}</dd>
            </div>
            <div>
              <dt>Mode</dt>
              <dd>{runPayload.mode}</dd>
            </div>
            <div>
              <dt>Session</dt>
              <dd>{runPayload.sessionId ? "attached" : "none"}</dd>
            </div>
            <div>
              <dt>Media</dt>
              <dd>{runPayload.localAttachment?.name || (runPayload.mediaSourceId ? "attached" : "none")}</dd>
            </div>
          </dl>
        </div>
      )}
      {runResult && (
        <div className="axis-output-detail__result" aria-label="Future run result envelope preview">
          <p>Future result envelope</p>
          <span>
            {formatOutputStatus(runResult.status)} {formatOutputType(runResult.output.type)} output from{" "}
            {runResult.source.replace("_", " ")}. Contract {runContract?.isLinkedToOutput ? "matched" : "preview only"}.
          </span>
          {runExecutionState && (
            <small>
              {runExecutionState.label}: {runExecutionState.message}
            </small>
          )}
          {contractValidation && <small>{contractValidation.label}: {contractValidation.message}</small>}
          {wiringChecklist.length > 0 && (
            <ul className="axis-output-detail__wiring">
              {wiringChecklist.map((item) => (
                <li data-ready={item.ready ? "true" : "false"} key={item.label}>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {output.localAttachment && (
        <div className="axis-output-detail__attachment" aria-label="Local attachment used">
          <p>Attached locally</p>
          <strong>{output.localAttachment.name}</strong>
          <span>
            {formatAttachmentType(output.localAttachment.type)}
            {output.localAttachment.size ? ` - ${formatAttachmentSize(output.localAttachment.size)}` : ""}
          </span>
        </div>
      )}

      <div className="axis-output-detail__actions">
        {submitGuard && !submitGuard.canSubmit && (
          <button className="axis-output-detail__locked" disabled title={submitGuard.message} type="button">
            {submitGuard.label}
          </button>
        )}
        {canRetry && onRetry && (
          <button className="axis-output-detail__retry" onClick={onRetry} type="button">
            Retry
          </button>
        )}
        {output.fileUrl ? (
          <a className="axis-output-detail__link" href={output.fileUrl} rel="noreferrer" target="_blank">
            Open Output
          </a>
        ) : (
          <p className="axis-output-detail__empty-file">No file attached yet.</p>
        )}
      </div>
    </aside>
  );
}

function OutputSkeleton() {
  return <div className="axis-output-skeleton" aria-label="Loading recent outputs" />;
}

function getLocalContractSummary(outputs: AxisOutput[], previews: AxisRunRequestPreview[]) {
  if (outputs.length === 0) return "";

  const contractStates = outputs.map((output) => {
    const runTrace = previews.find((preview) => preview.expectedOutputId === output.id);
    if (!runTrace) return false;
    return validateAxisRunContractPreview(createAxisRunContractPreview(output, runTrace)).ok;
  });
  const readyCount = contractStates.filter(Boolean).length;
  const reviewCount = contractStates.length - readyCount;
  const readyLabel = formatCount(readyCount, "contract ready");

  return reviewCount > 0 ? `${readyLabel} - ${formatCount(reviewCount, "contract to review")}` : readyLabel;
}

function getLocalSubmitSummary(outputs: AxisOutput[], previews: AxisRunRequestPreview[]) {
  if (outputs.length === 0) return "";

  const submitStates = outputs.flatMap((output) => {
      const runTrace = previews.find((preview) => preview.expectedOutputId === output.id);
      if (!runTrace) return [];
      return [getAxisRunSubmitGuard(createAxisRunContractPreview(output, runTrace))];
    });

  if (submitStates.length === 0) return "";

  const readyCount = submitStates.filter((state) => state.canSubmit).length;
  const lockedCount = submitStates.length - readyCount;

  if (readyCount > 0 && lockedCount > 0) {
    return `${formatCount(readyCount, "submit ready")} - ${formatCount(lockedCount, "run locked")}`;
  }

  return readyCount > 0 ? formatCount(readyCount, "submit ready") : formatCount(lockedCount, "run locked");
}

function formatOutputType(value: AxisOutput["type"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDetailDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatOutputStatus(value: AxisOutput["status"]) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCount(count: number, label: string) {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function formatAttachmentType(type: NonNullable<AxisOutput["localAttachment"]>["type"]) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function formatAttachmentSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

