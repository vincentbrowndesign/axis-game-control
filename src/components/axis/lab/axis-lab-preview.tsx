"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  axisActiveThreadMock,
  axisMakeSpaceMock,
  axisMockCandidates,
  axisMockFrames,
} from "./axis-lab-mock-data";
import AxisApertureShell from "./AxisApertureShell";
import AxisActiveThought from "./axis-active-thought";
import AxisEmptyState from "./axis-empty-state";
import AxisLabComposer from "./axis-lab-composer";
import AxisLabPreviewControls, { type LabState } from "./axis-lab-preview-controls";
import AxisMakeSpace from "./axis-make-space";
import styles from "./axis-lab.module.css";
import type {
  AxisApertureFocus,
  AxisLabAnnotationKind,
  LensEvidenceCandidateKind,
  LensMockFrame,
} from "./axis-lab-types";

// CSS class maps keyed by kind — no inline styles needed
const ANNOTATION_CLASS: Record<AxisLabAnnotationKind, string> = {
  observation: styles.accentUse,
  proof: styles.accentProof,
  question: styles.accentDecide,
  keeper: styles.accentUse,
};

const CANDIDATE_CLASS: Record<LensEvidenceCandidateKind, string> = {
  source_candidate: styles.accentProof,
  open_question: styles.accentDecide,
};

const STATE_LABEL: Record<LabState, string> = {
  empty: "Empty",
  active: "Active",
  "make-space": "Make Space",
  expanded: "Expanded",
};

const FOCUS_TO_LAB_STATE: Record<AxisApertureFocus, LabState> = {
  quiet: "active",
  input_active: "active",
  annotation_visible: "active",
  make_space: "make-space",
  lens_preview: "active",
  source_expanded: "active",
};

const DEFAULT_SELECTED_FRAME_ID = axisMockFrames.find((f) => f.selected)?.id ?? "f3";

function parseFocus(raw: string | null): AxisApertureFocus {
  if (raw === "quiet") return "quiet";
  if (raw === "input-active") return "input_active";
  if (raw === "annotation") return "annotation_visible";
  if (raw === "make-space") return "make_space";
  if (raw === "lens-preview") return "lens_preview";
  if (raw === "source-expanded") return "source_expanded";
  return "annotation_visible";
}

// ─── Top bar ──────────────────────────────────────────────

function LabTopBar({ stateLabel }: { stateLabel: string }) {
  return (
    <header className={styles.header}>
      <span className={styles.wordmark}>Axis</span>
      <span className={styles.labLabel}>First Six Minutes</span>
      <span className={styles.stateLabel}>{stateLabel}</span>
    </header>
  );
}

// ─── Left port helpers ─────────────────────────────────────

function LabTimestamp({ timestamp }: { timestamp: string }) {
  return (
    <div className={styles.lpColumn}>
      <time className={styles.lpTime} dateTime={timestamp}>
        {timestamp}
      </time>
    </div>
  );
}

function LabTimeMarks({
  frames,
  selectedId,
}: {
  frames: readonly LensMockFrame[];
  selectedId: string;
}) {
  return (
    <div className={styles.lpColumn}>
      {frames.map((f) => (
        <time
          key={f.id}
          className={f.id === selectedId ? styles.lpTimeSelected : styles.lpTime}
          dateTime={f.time}
        >
          {f.time}
        </time>
      ))}
    </div>
  );
}

// ─── Right port helpers ────────────────────────────────────

function LabAnnotationMarks({
  annotations,
}: {
  annotations: readonly { label: string; note: string; kind?: AxisLabAnnotationKind }[];
}) {
  return (
    <div className={styles.rpColumn}>
      {annotations.slice(0, 2).map((a, i) => (
        <div
          key={i}
          className={`${styles.rpAnnotation} ${a.kind ? ANNOTATION_CLASS[a.kind] : ""}`}
        >
          {a.kind && <span className={styles.rpDot} aria-hidden="true" />}
          <span className={styles.rpLabel}>{a.label}</span>
          <span className={styles.rpNote}>{a.note}</span>
        </div>
      ))}
    </div>
  );
}

function LabEvidenceCandidates() {
  return (
    <div className={styles.rpColumn}>
      {axisMockCandidates.slice(0, 2).map((c) => (
        <div
          key={c.id}
          className={`${styles.ecCandidate} ${CANDIDATE_CLASS[c.kind]}`}
        >
          <span className={styles.rpDot} aria-hidden="true" />
          <span className={styles.ecLabel}>{c.label}</span>
          <span className={styles.ecBody}>{c.body}</span>
          {(c.source || c.confidence) && (
            <span className={styles.ecMeta}>
              {[c.source, c.confidence].filter(Boolean).join(" · ")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function LabSourceDetails() {
  return (
    <div className={styles.rpColumn}>
      <div className={`${styles.ecCandidate} ${styles.accentProof}`}>
        <span className={styles.rpDot} aria-hidden="true" />
        <span className={styles.ecLabel}>SOURCE</span>
        <span className={styles.ecBody}>Mock clip · 00:18–00:24</span>
        <span className={styles.ecMeta}>Needs confirmation</span>
      </div>
      <div className={`${styles.ecCandidate} ${styles.accentUse}`}>
        <span className={styles.rpDot} aria-hidden="true" />
        <span className={styles.ecLabel}>PATTERN</span>
        <span className={styles.ecBody}>Second mistake follows the first.</span>
      </div>
    </div>
  );
}

// ─── Lens strip ────────────────────────────────────────────

function LabLensStrip({
  frames,
  selectedId,
  onSelect,
}: {
  frames: readonly LensMockFrame[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={styles.lensStrip}>
      <div className={styles.lensFrameRow} role="list" aria-label="Mock clip frames">
        {frames.map((f) => {
          const isSelected = f.id === selectedId;
          return (
            <div key={f.id} className={styles.lensFrameItem} role="listitem">
              <button
                type="button"
                className={isSelected ? styles.lensFrameSelected : styles.lensFrame}
                aria-label={`Frame at ${f.time}${isSelected ? " (selected)" : ""}`}
                onClick={() => onSelect(f.id)}
              />
              <p className={styles.lensFrameTime}>{f.time}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Source expanded center ────────────────────────────────

function LabSourceView({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.sourceView}>
      <div className={styles.sourceMockClip}>
        <button
          type="button"
          className={styles.sourceCloseBtn}
          onClick={onClose}
          aria-label="Close source, return to current thought"
        >
          ×
        </button>
      </div>
      <p className={styles.sourceRange}>Mock clip · 00:18–00:24</p>
      <p className={styles.sourceRecessedThought}>
        {axisActiveThreadMock.userThought}
      </p>
    </div>
  );
}

// ─── Main preview ──────────────────────────────────────────

export default function AxisLabPreview() {
  const searchParams = useSearchParams();
  const apertureFocus = parseFocus(searchParams.get("focus"));

  const [labState, setLabState] = useState<LabState>(FOCUS_TO_LAB_STATE[apertureFocus]);
  const [localThoughts, setLocalThoughts] = useState<string[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState(DEFAULT_SELECTED_FRAME_ID);
  const [expandedSource, setExpandedSource] = useState(apertureFocus === "source_expanded");

  const isLensMode = apertureFocus === "lens_preview" || apertureFocus === "source_expanded";
  const isSourceOpen = isLensMode && expandedSource;
  const isPostClose = apertureFocus === "source_expanded" && !expandedSource;
  const showLensStrip = isLensMode && !isPostClose;

  function handleReset() {
    setLabState(FOCUS_TO_LAB_STATE[apertureFocus]);
    setLocalThoughts([]);
    setSelectedFrameId(DEFAULT_SELECTED_FRAME_ID);
    setExpandedSource(apertureFocus === "source_expanded");
  }

  function handleComposerSubmit(text: string) {
    setLocalThoughts((prev) => [...prev, text]);
    if (labState === "empty") setLabState("active");
  }

  function handleFrameSelect(id: string) {
    setSelectedFrameId(id);
    setExpandedSource(true);
  }

  const leftPort = (() => {
    if (isSourceOpen) return null;
    if (isLensMode) return <LabTimeMarks frames={axisMockFrames} selectedId={selectedFrameId} />;
    if (labState === "active") return <LabTimestamp timestamp={axisActiveThreadMock.timestamp} />;
    return null;
  })();

  const rightPort = (() => {
    if (isSourceOpen) return <LabSourceDetails />;
    if (isPostClose)
      return (
        <LabAnnotationMarks
          annotations={[{
            label: "PROOF NEEDED",
            note: "Check possessions immediately after turnovers.",
            kind: "proof",
          }]}
        />
      );
    if (isLensMode) return <LabEvidenceCandidates />;
    if (labState === "active" && apertureFocus === "annotation_visible")
      return <LabAnnotationMarks annotations={axisActiveThreadMock.annotations} />;
    return null;
  })();

  return (
    <AxisApertureShell
      topPort={<LabTopBar stateLabel={STATE_LABEL[labState]} />}
      bottomPort={
        <>
          {showLensStrip && (
            <LabLensStrip
              frames={axisMockFrames}
              selectedId={selectedFrameId}
              onSelect={handleFrameSelect}
            />
          )}
          <AxisLabComposer
            onSubmit={handleComposerSubmit}
            defaultFocused={apertureFocus === "input_active"}
          />
          <AxisLabPreviewControls
            labState={labState}
            onStateChange={setLabState}
            onReset={handleReset}
          />
        </>
      }
      leftPort={leftPort}
      rightPort={rightPort}
    >
      {isSourceOpen ? (
        <LabSourceView onClose={() => setExpandedSource(false)} />
      ) : labState === "empty" ? (
        <AxisEmptyState />
      ) : (
        <>
          {(labState === "active" || isLensMode || isPostClose) && (
            <AxisActiveThought
              threadTitle={axisActiveThreadMock.threadTitle}
              userThought={axisActiveThreadMock.userThought}
              axisResponse={axisActiveThreadMock.axisResponse}
            />
          )}
          {(labState === "make-space" || labState === "expanded") && (
            <AxisMakeSpace
              threadTitle={axisActiveThreadMock.threadTitle}
              items={axisMakeSpaceMock}
              priorThought={axisActiveThreadMock.userThought}
              defaultExpandedId={labState === "expanded" ? "keeper" : undefined}
            />
          )}
          {localThoughts.length > 0 && (
            <div className={styles.localMessages}>
              {localThoughts.map((t, i) => (
                <p key={i} className={styles.localMessage}>
                  {t}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </AxisApertureShell>
  );
}
