"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  axisMeasureEvidenceStorageEvent,
  axisMeasureEvidenceQualityLabels,
  deleteAxisMeasureEvidenceFrame,
  getAxisMeasureEvidenceFrameSnapshot,
  updateAxisMeasureEvidenceFrame,
  type AxisMeasureEvidenceFrame,
  type AxisMeasureEvidenceQualityLabel,
  type AxisMeasureEvidenceReviewStatus,
} from "../../../lib/axis/measure/evidence-capture";

export default function AxisMeasureReviewPage() {
  const frames = useSyncExternalStore(subscribeToEvidenceFrames, getAxisMeasureEvidenceFrameSnapshot, emptyEvidenceFrames);
  const [exportStatus, setExportStatus] = useState("");

  const exportName = useMemo(() => `axis-measure-evidence-${new Date().toISOString().slice(0, 10)}.json`, []);

  function setReviewStatus(id: string, reviewStatus: AxisMeasureEvidenceReviewStatus) {
    updateAxisMeasureEvidenceFrame(id, { reviewStatus });
  }

  function toggleLabel(frame: AxisMeasureEvidenceFrame, label: AxisMeasureEvidenceQualityLabel) {
    const qualityLabels = frame.qualityLabels.includes(label)
      ? frame.qualityLabels.filter((item) => item !== label)
      : [...frame.qualityLabels, label];
    updateAxisMeasureEvidenceFrame(frame.id, { qualityLabels });
  }

  function updateNotes(id: string, notes: string) {
    updateAxisMeasureEvidenceFrame(id, { notes });
  }

  function deleteFrame(id: string) {
    deleteAxisMeasureEvidenceFrame(id);
  }

  function getExportJson() {
    return JSON.stringify(frames, null, 2);
  }

  function exportJson() {
    if (frames.length === 0) return;
    setExportStatus("Export ready");
    const blob = new Blob([getExportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportStatus("Download started");
  }

  async function copyJson() {
    if (frames.length === 0) return;
    const json = getExportJson();
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = json;
      textarea.style.left = "-9999px";
      textarea.style.position = "fixed";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setExportStatus("Copied");
  }

  return (
    <main className="axis-measure-review">
      <header className="axis-measure-review__header">
        <div>
          <p>Axis Measure</p>
          <h1>Evidence Review</h1>
        </div>
        <div className="axis-measure-review__export">
          <button disabled={frames.length === 0} onClick={exportJson} type="button">
            Export JSON
          </button>
          <button disabled={frames.length === 0} onClick={() => void copyJson()} type="button">
            Copy JSON
          </button>
          {exportStatus && <span>{exportStatus}</span>}
        </div>
      </header>

      <section className="axis-measure-review__intro">
        <p>Saved test frames become Axis-owned evidence for improving player, ball, and rim lock.</p>
      </section>

      {frames.length === 0 ? (
        <section className="axis-measure-review__empty">
          <h2>No saved frames yet.</h2>
          <p>Open Debug mode in Vision, then save a test frame.</p>
        </section>
      ) : (
        <section className="axis-measure-review__grid" aria-label="Saved evidence frames">
          {frames.map((frame) => (
            <article className="axis-measure-review__card" key={frame.id}>
              <div
                aria-label="Saved camera frame"
                className="axis-measure-review__preview"
                role="img"
                style={{ backgroundImage: `url(${frame.imageDataUrl})` }}
              />
              <div className="axis-measure-review__body">
                <div className="axis-measure-review__meta">
                  <strong>{formatDate(frame.createdAt)}</strong>
                  <span>{frame.objects.length} objects</span>
                  <span>{frame.surface} - {frame.route}</span>
                  {typeof frame.detectorLatencyMs === "number" && <span>{frame.detectorLatencyMs}ms detector</span>}
                </div>

                <div className="axis-measure-review__labels" aria-label="Quality labels">
                  {axisMeasureEvidenceQualityLabels.map((label) => (
                    <button
                      data-active={frame.qualityLabels.includes(label)}
                      key={label}
                      onClick={() => toggleLabel(frame, label)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <textarea
                  aria-label="Reviewer notes"
                  onChange={(event) => updateNotes(frame.id, event.target.value)}
                  placeholder="Notes"
                  value={frame.notes ?? ""}
                />

                <div className="axis-measure-review__actions">
                  <button
                    data-active={frame.reviewStatus === "accepted"}
                    onClick={() => setReviewStatus(frame.id, "accepted")}
                    type="button"
                  >
                    Accept
                  </button>
                  <button
                    data-active={frame.reviewStatus === "rejected"}
                    onClick={() => setReviewStatus(frame.id, "rejected")}
                    type="button"
                  >
                    Reject
                  </button>
                  <button onClick={() => deleteFrame(frame.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <style jsx>{styles}</style>
    </main>
  );
}

function subscribeToEvidenceFrames(onStoreChange: () => void) {
  window.addEventListener(axisMeasureEvidenceStorageEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(axisMeasureEvidenceStorageEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function emptyEvidenceFrames(): AxisMeasureEvidenceFrame[] {
  return [];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const styles = `
  .axis-measure-review {
    background: #050706;
    color: #f7f4eb;
    min-height: 100dvh;
    padding: 1rem;
  }

  .axis-measure-review__header {
    align-items: center;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 72rem;
    padding: 1rem 0;
  }

  .axis-measure-review__export {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    justify-content: flex-end;
  }

  .axis-measure-review__export span {
    color: rgba(247, 244, 235, 0.68);
    font-size: 0.72rem;
    font-weight: 800;
  }

  .axis-measure-review__header p {
    color: rgba(247, 244, 235, 0.58);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    margin: 0 0 0.3rem;
    text-transform: uppercase;
  }

  .axis-measure-review h1,
  .axis-measure-review h2 {
    letter-spacing: 0;
    margin: 0;
  }

  .axis-measure-review h1 {
    font-size: clamp(2rem, 8vw, 4rem);
    line-height: 0.95;
  }

  .axis-measure-review button {
    background: rgba(247, 244, 235, 0.9);
    border: 1px solid rgba(247, 244, 235, 0.16);
    border-radius: 999px;
    color: #050706;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 850;
    min-height: 2.5rem;
    padding: 0 0.85rem;
  }

  .axis-measure-review button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .axis-measure-review button[data-active="true"] {
    background: #d8ad52;
    color: #151008;
  }

  .axis-measure-review__intro,
  .axis-measure-review__empty,
  .axis-measure-review__grid {
    margin: 0 auto;
    max-width: 72rem;
  }

  .axis-measure-review__intro {
    color: rgba(247, 244, 235, 0.68);
    padding-bottom: 1rem;
  }

  .axis-measure-review__empty {
    border: 1px solid rgba(247, 244, 235, 0.12);
    border-radius: 0.5rem;
    color: rgba(247, 244, 235, 0.7);
    padding: 1rem;
  }

  .axis-measure-review__grid {
    display: grid;
    gap: 0.8rem;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  }

  .axis-measure-review__card {
    background: rgba(247, 244, 235, 0.06);
    border: 1px solid rgba(247, 244, 235, 0.12);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .axis-measure-review__preview {
    aspect-ratio: 16 / 9;
    background-color: #111512;
    background-position: center;
    background-size: cover;
  }

  .axis-measure-review__body {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem;
  }

  .axis-measure-review__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .axis-measure-review__meta strong,
  .axis-measure-review__meta span {
    background: rgba(247, 244, 235, 0.08);
    border: 1px solid rgba(247, 244, 235, 0.1);
    border-radius: 999px;
    font-size: 0.7rem;
    padding: 0.3rem 0.5rem;
  }

  .axis-measure-review__labels,
  .axis-measure-review__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }

  .axis-measure-review__labels button {
    background: rgba(247, 244, 235, 0.08);
    color: #f7f4eb;
    font-size: 0.68rem;
    min-height: 2rem;
  }

  .axis-measure-review textarea {
    background: rgba(5, 7, 6, 0.7);
    border: 1px solid rgba(247, 244, 235, 0.14);
    border-radius: 0.5rem;
    color: #f7f4eb;
    font: inherit;
    min-height: 4.5rem;
    padding: 0.7rem;
    resize: vertical;
  }

  @media (max-width: 640px) {
    .axis-measure-review__header {
      align-items: stretch;
      display: grid;
    }
  }
`;
