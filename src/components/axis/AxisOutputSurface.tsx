"use client";

import { useEffect, useState } from "react";
import {
  buildAxisRunAdapterDryRunPreview,
  buildAxisRunAdapterPreview,
  buildAxisRunDryRunRequest,
  createAxisRunContractPreview,
  fetchRecentAxisOutputs,
  getFallbackAxisOutputs,
  getAxisRunCompatibilityState,
  getAxisRunDryRunGuard,
  getAxisRunSubmitGuard,
  getAxisRunSubmitReadinessSummary,
  getAxisRunWiringChecklist,
  mapAxisRunDryRunToAdapterStatus,
  testAxisRunDryRun,
  validateAxisRunContractPreview,
  type AxisRecentOutputsResult,
} from "../../lib/axis/client";
import type {
  AxisOutput,
  AxisRunAdapterStatusPreview,
  AxisRunDryRunResult,
  AxisRunRequestPreview,
  AxisRunSubmitReadinessSummary,
} from "../../lib/axis/types";

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
  onRouteDryRunResult,
  retryableOutputIds = [],
}: {
  localRunPreviews?: AxisRunRequestPreview[];
  localOutputs?: AxisOutput[];
  onClearLocalOutputs?: () => void;
  onRetryOutput?: (outputId: string) => void;
  onRouteDryRunResult?: (outputId: string, result: AxisRunDryRunResult) => void;
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
  const visibleOutputs = outputs.slice(0, 3);
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
      </p>

      <div className="axis-output-surface__list" aria-live="polite">
        {outputState.status === "loading" ? (
          <OutputSkeleton />
        ) : outputs.length > 0 ? (
          visibleOutputs.map((output) => {
            return (
              <OutputCard
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
          onRouteDryRunResult={onRouteDryRunResult}
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

        .axis-output-detail__wiring-summary {
          align-items: center;
          background: rgba(255, 255, 255, 0.028);
          border: 1px solid rgba(255, 255, 255, 0.075);
          border-radius: 0.72rem;
          display: flex;
          gap: 0.6rem;
          justify-content: space-between;
          padding: 0.58rem;
        }

        .axis-output-detail__wiring-summary div {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .axis-output-detail__wiring-summary span {
          border: 1px solid rgba(121, 226, 145, 0.18);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          padding: 0.18rem 0.44rem;
          text-transform: uppercase;
        }

        .axis-output-detail__wiring-summary button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.68);
          cursor: pointer;
          flex: 0 0 auto;
          font: inherit;
          font-size: 0.68rem;
          min-height: 1.9rem;
          padding: 0 0.62rem;
        }

        .axis-output-detail__wiring-summary button:hover,
        .axis-output-detail__wiring-summary button:focus-visible {
          border-color: rgba(141, 66, 255, 0.42);
          outline: none;
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

        .axis-output-detail__adapter {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 2px solid rgba(141, 66, 255, 0.42);
          border-radius: 0.72rem;
          display: grid;
          gap: 0.55rem;
          padding: 0.65rem;
        }

        .axis-output-detail__adapter > p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__adapter dl {
          gap: 0.45rem;
        }

        .axis-output-detail__adapter dl div {
          background: rgba(255, 255, 255, 0.035);
          padding: 0.52rem;
        }

        .axis-output-detail__adapter small {
          color: rgba(244, 241, 234, 0.48);
          font-size: 0.7rem;
          line-height: 1.35;
        }

        .axis-output-detail__adapter ul {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-output-detail__adapter li {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.52);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0.18rem 0.4rem;
          text-transform: uppercase;
        }

        .axis-output-detail__dry-run {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 2px solid rgba(121, 226, 145, 0.38);
          border-radius: 0.72rem;
          display: grid;
          gap: 0.55rem;
          padding: 0.65rem;
        }

        .axis-output-detail__dry-run > p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__dry-run span {
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .axis-output-detail__dry-run small {
          color: rgba(244, 241, 234, 0.48);
          font-size: 0.7rem;
          line-height: 1.35;
        }

        .axis-output-detail__dry-run-button {
          background: rgba(121, 226, 145, 0.12);
          border: 1px solid rgba(121, 226, 145, 0.28);
          border-radius: 999px;
          color: #f4f1ea;
          cursor: pointer;
          font: inherit;
          font-size: 0.76rem;
          min-height: 2rem;
          padding: 0 0.72rem;
          width: fit-content;
        }

        .axis-output-detail__dry-run-button:disabled {
          cursor: default;
          opacity: 0.55;
        }

        .axis-output-detail__route-result {
          background: rgba(121, 226, 145, 0.055);
          border: 1px solid rgba(121, 226, 145, 0.14);
          border-radius: 0.65rem;
          display: grid;
          gap: 0.42rem;
          padding: 0.55rem;
        }

        .axis-output-detail__route-result p {
          color: rgba(244, 241, 234, 0.68);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__route-result ul {
          display: flex;
          flex-wrap: wrap;
          gap: 0.32rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-output-detail__route-result li {
          border: 1px solid rgba(121, 226, 145, 0.18);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.56);
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0.16rem 0.36rem;
          text-transform: uppercase;
        }

        .axis-output-detail__adapter-status {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 2px solid rgba(121, 226, 145, 0.38);
          border-radius: 0.65rem;
          display: grid;
          gap: 0.5rem;
          padding: 0.55rem;
        }

        .axis-output-detail__adapter-status[data-accepted="false"] {
          border-left-color: rgba(255, 107, 87, 0.58);
        }

        .axis-output-detail__adapter-status p {
          color: rgba(244, 241, 234, 0.68);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__adapter-status span {
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .axis-output-detail__adapter-status dl {
          gap: 0.42rem;
        }

        .axis-output-detail__adapter-status dl div {
          background: rgba(255, 255, 255, 0.035);
          padding: 0.5rem;
        }

        .axis-output-detail__adapter-status ul {
          display: flex;
          flex-wrap: wrap;
          gap: 0.32rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-output-detail__adapter-status li {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          padding: 0.16rem 0.36rem;
          text-transform: uppercase;
        }

        .axis-output-detail__adapter-status li[data-ready="true"] {
          border-color: rgba(121, 226, 145, 0.2);
          color: rgba(121, 226, 145, 0.68);
        }

        .axis-output-detail__submit-readiness {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-left: 2px solid rgba(255, 180, 168, 0.5);
          border-radius: 0.65rem;
          display: grid;
          gap: 0.55rem;
          padding: 0.55rem;
        }

        .axis-output-detail__submit-readiness > p {
          color: rgba(244, 241, 234, 0.68);
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__submit-readiness > span {
          color: rgba(244, 241, 234, 0.58);
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .axis-output-detail__submit-readiness-grid {
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .axis-output-detail__submit-readiness-grid div {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .axis-output-detail__submit-readiness-grid strong {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .axis-output-detail__submit-readiness-grid ul {
          display: grid;
          gap: 0.24rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .axis-output-detail__submit-readiness-grid li {
          color: rgba(244, 241, 234, 0.56);
          font-size: 0.68rem;
          line-height: 1.3;
        }

        .axis-output-detail__submit-readiness-grid li::before {
          color: rgba(121, 226, 145, 0.62);
          content: "- ";
        }

        .axis-output-detail__submit-readiness-grid div:last-child li::before {
          color: rgba(255, 180, 168, 0.72);
        }

        .axis-output-detail__payload-inspector {
          display: grid;
          gap: 0.5rem;
        }

        .axis-output-detail__payload-inspector > button {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          color: rgba(244, 241, 234, 0.72);
          cursor: pointer;
          font: inherit;
          font-size: 0.72rem;
          min-height: 1.9rem;
          padding: 0 0.65rem;
          width: fit-content;
        }

        .axis-output-detail__payload-inspector > button:hover,
        .axis-output-detail__payload-inspector > button:focus-visible {
          border-color: rgba(141, 66, 255, 0.48);
          outline: none;
        }

        .axis-output-detail__payload-json {
          display: grid;
          gap: 0.5rem;
        }

        .axis-output-detail__payload-json div {
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 0.65rem;
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.55rem;
        }

        .axis-output-detail__payload-json p {
          color: rgba(244, 241, 234, 0.5);
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          margin: 0;
          text-transform: uppercase;
        }

        .axis-output-detail__payload-json pre {
          color: rgba(244, 241, 234, 0.68);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size: 0.66rem;
          line-height: 1.35;
          margin: 0;
          max-height: 11rem;
          overflow: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .axis-output-detail__dry-run dl {
          gap: 0.45rem;
        }

        .axis-output-detail__dry-run dl div {
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

          .axis-output-detail__submit-readiness-grid {
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

function AdapterStatusPreview({ status }: { status: AxisRunAdapterStatusPreview }) {
  return (
    <div className="axis-output-detail__adapter-status" data-accepted={status.accepted ? "true" : "false"}>
      <p>{status.label}</p>
      <span>{status.message}</span>
      <dl>
        <div>
          <dt>Route</dt>
          <dd>{status.route}</dd>
        </div>
        <div>
          <dt>Next</dt>
          <dd>{status.nextAgent ?? "not selected"}</dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>{status.outputType ? formatOutputType(status.outputType) : "none"}</dd>
        </div>
        <div>
          <dt>Submit</dt>
          <dd>{status.submitLocked ? "locked" : "ready"}</dd>
        </div>
      </dl>
      <ul>
        <li data-ready={status.noWrite ? "true" : "false"}>No write</li>
        <li data-ready={status.noJob ? "true" : "false"}>No job</li>
        <li data-ready={status.noModelCall ? "true" : "false"}>No model call</li>
        <li data-ready={status.noUpload ? "true" : "false"}>No upload</li>
      </ul>
    </div>
  );
}

function SubmitReadinessDetail({ summary }: { summary: AxisRunSubmitReadinessSummary }) {
  return (
    <div className="axis-output-detail__submit-readiness">
      <p>{summary.label}</p>
      <span>{summary.message}</span>
      <div className="axis-output-detail__submit-readiness-grid">
        <div>
          <strong>Done locally</strong>
          <ul>
            {summary.completed.slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong>Still required</strong>
          <ul>
            {summary.remaining.slice(0, 5).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function OutputDetailPreview({
  canRetry,
  onClose,
  onRetry,
  onRouteDryRunResult,
  output,
  runTrace,
}: {
  canRetry: boolean;
  onClose: () => void;
  onRetry?: () => void;
  onRouteDryRunResult?: (outputId: string, result: AxisRunDryRunResult) => void;
  output: AxisOutput;
  runTrace?: AxisRunRequestPreview;
}) {
  const [routeDryRunResult, setRouteDryRunResult] = useState<AxisRunDryRunResult | null>(null);
  const [isTestingRouteDryRun, setIsTestingRouteDryRun] = useState(false);
  const [showWiringDetails, setShowWiringDetails] = useState(false);
  const [showDryRunPayloads, setShowDryRunPayloads] = useState(false);
  const sourceLabel = output.sourceLabel || formatOutputType(output.type);
  const runContract = runTrace ? createAxisRunContractPreview(output, runTrace) : null;
  const runPayload = runContract?.payload;
  const runResult = runContract?.result;
  const runExecutionState = runContract?.execution;
  const contractValidation = runContract ? validateAxisRunContractPreview(runContract) : null;
  const compatibility = runContract ? getAxisRunCompatibilityState() : null;
  const submitGuard = runContract ? getAxisRunSubmitGuard(runContract) : null;
  const wiringChecklist = runContract ? getAxisRunWiringChecklist() : [];
  const adapterPreview = runContract ? buildAxisRunAdapterPreview(runContract) : null;
  const dryRunPreview = runContract ? buildAxisRunAdapterDryRunPreview(runContract) : null;
  const dryRunGuard = runContract ? getAxisRunDryRunGuard(runContract) : null;
  const adapterStatus = mapAxisRunDryRunToAdapterStatus(routeDryRunResult);
  const dryRunRequestPreview = runContract ? buildAxisRunDryRunRequest(runContract) : null;
  const submitReadiness = runContract ? getAxisRunSubmitReadinessSummary(runContract, routeDryRunResult) : null;

  useEffect(() => {
    setRouteDryRunResult(null);
    setIsTestingRouteDryRun(false);
    setShowWiringDetails(false);
    setShowDryRunPayloads(false);
  }, [output.id]);

  async function testRouteDryRun() {
    if (!runContract || !dryRunGuard?.canDryRun || isTestingRouteDryRun) return;

    setIsTestingRouteDryRun(true);
    try {
      const result = await testAxisRunDryRun(runContract);
      setRouteDryRunResult(result);
      onRouteDryRunResult?.(output.id, result);
    } catch {
      const result: AxisRunDryRunResult = {
        ok: false,
        message: "Route dry-run did not finish. Try again.",
      };
      setRouteDryRunResult(result);
      onRouteDryRunResult?.(output.id, result);
    } finally {
      setIsTestingRouteDryRun(false);
    }
  }

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
      {runContract && (
        <div className="axis-output-detail__wiring-summary" aria-label="Run readiness summary">
          <div>
            <span>Prepared</span>
            <span>Dry-run only</span>
            <span>No write</span>
            <span>Real submit locked</span>
          </div>
          <button
            aria-expanded={showWiringDetails}
            onClick={() => setShowWiringDetails((isVisible) => !isVisible)}
            type="button"
          >
            {showWiringDetails ? "Hide wiring details" : "Show wiring details"}
          </button>
        </div>
      )}
      {showWiringDetails && (
        <>
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
      {adapterPreview && (
        <div className="axis-output-detail__adapter" aria-label="Axis run adapter contract preview">
          <p>Adapter contract</p>
          <dl>
            <div>
              <dt>Route</dt>
              <dd>{adapterPreview.route}</dd>
            </div>
            <div>
              <dt>Method</dt>
              <dd>{adapterPreview.method}</dd>
            </div>
            <div>
              <dt>Compatible</dt>
              <dd>{adapterPreview.compatible ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt>Dry Run</dt>
              <dd>{adapterPreview.dryRunOnly ? "only" : "no"}</dd>
            </div>
            <div>
              <dt>Submit</dt>
              <dd>{adapterPreview.submitLocked ? "locked" : "ready"}</dd>
            </div>
            <div>
              <dt>Output</dt>
              <dd>
                {adapterPreview.outputAdapterPreview.willMapToAxisOutput
                  ? `${formatOutputType(adapterPreview.outputAdapterPreview.outputType)} ${adapterPreview.outputAdapterPreview.status}`
                  : "not mapped"}
              </dd>
            </div>
          </dl>
          <small>Expected response: threadId, understanding, cards, comparison, operatingSystem, sidebarThreads.</small>
          <ul>
            {adapterPreview.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {dryRunPreview && (
        <div className="axis-output-detail__dry-run" aria-label="Local adapter dry-run preview">
          <p>Dry-run simulation</p>
          <span>{dryRunPreview.message}</span>
          {dryRunGuard && <small>{dryRunGuard.label}: {dryRunGuard.message}</small>}
          <dl>
            <div>
              <dt>Route Called</dt>
              <dd>{dryRunPreview.routeCalled ? "yes" : "no"}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{dryRunPreview.status.replaceAll("_", " ")}</dd>
            </div>
            <div>
              <dt>Would Create</dt>
              <dd>
                {formatOutputType(dryRunPreview.wouldCreateOutput.type)} {dryRunPreview.wouldCreateOutput.status}
              </dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{dryRunPreview.wouldCreateOutput.sourceLabel}</dd>
            </div>
          </dl>
          {dryRunGuard?.canDryRun && (
            <button
              className="axis-output-detail__dry-run-button"
              disabled={isTestingRouteDryRun}
              onClick={testRouteDryRun}
              type="button"
            >
              {isTestingRouteDryRun ? "Testing dry-run..." : "Test route dry-run"}
            </button>
          )}
          {routeDryRunResult && (
            <div className="axis-output-detail__route-result" aria-live="polite">
              <p>{routeDryRunResult.ok ? "Route dry-run ready" : "Route dry-run needs review"}</p>
              {routeDryRunResult.ok ? (
                <>
                  <span>
                    {routeDryRunResult.response.accepted.mode} accepted -{" "}
                    {formatOutputType(routeDryRunResult.response.executionPlanPreview.outputType)} preview.
                  </span>
                  <ul>
                    <li>No write</li>
                    <li>No job</li>
                    <li>No model call</li>
                    <li>No upload</li>
                    <li>Real submit still locked</li>
                  </ul>
                </>
              ) : (
                <span>{routeDryRunResult.message}</span>
              )}
            </div>
          )}
          {adapterStatus && <AdapterStatusPreview status={adapterStatus} />}
          {submitReadiness && <SubmitReadinessDetail summary={submitReadiness} />}
          {routeDryRunResult && dryRunRequestPreview && (
            <div className="axis-output-detail__payload-inspector">
              <button
                aria-expanded={showDryRunPayloads}
                onClick={() => setShowDryRunPayloads((isVisible) => !isVisible)}
                type="button"
              >
                {showDryRunPayloads ? "Hide payloads" : "Show payloads"}
              </button>
              {showDryRunPayloads && (
                <div className="axis-output-detail__payload-json" aria-label="Dry-run payload inspector">
                  <div>
                    <p>Dry-run request</p>
                    <pre>{formatJson(dryRunRequestPreview)}</pre>
                  </div>
                  <div>
                    <p>Dry-run response</p>
                    <pre>{formatJson(routeDryRunResult)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
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
          {compatibility && <small>{compatibility.label}: {compatibility.message}</small>}
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
        </>
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

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

