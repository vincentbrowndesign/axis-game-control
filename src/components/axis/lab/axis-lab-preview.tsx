"use client";

import { type CSSProperties, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AXIS_ROOM_COLORS } from "../../../lib/axis-visual-language";
import { axisActiveThreadMock, axisMakeSpaceMock } from "./axis-lab-mock-data";
import AxisApertureShell from "./AxisApertureShell";
import AxisActiveThought from "./axis-active-thought";
import AxisEmptyState from "./axis-empty-state";
import AxisLabComposer from "./axis-lab-composer";
import AxisLabPreviewControls, { type LabState } from "./axis-lab-preview-controls";
import AxisMakeSpace from "./axis-make-space";
import styles from "./axis-lab.module.css";
import type { AxisApertureFocus, AxisLabAnnotationKind } from "./axis-lab-types";

const ANNOTATION_ACCENT: Record<AxisLabAnnotationKind, string> = {
  observation: AXIS_ROOM_COLORS.use,
  proof: AXIS_ROOM_COLORS.proof,
  question: AXIS_ROOM_COLORS.decide,
  keeper: AXIS_ROOM_COLORS.use,
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
};

function parseFocus(raw: string | null): AxisApertureFocus {
  if (raw === "quiet") return "quiet";
  if (raw === "input-active") return "input_active";
  if (raw === "annotation") return "annotation_visible";
  if (raw === "make-space") return "make_space";
  return "annotation_visible";
}

function LabTopBar({ stateLabel }: { stateLabel: string }) {
  return (
    <header className={styles.header}>
      <span className={styles.wordmark}>Axis</span>
      <span className={styles.labLabel}>First Six Minutes</span>
      <span className={styles.stateLabel}>{stateLabel}</span>
    </header>
  );
}

function LabTimestamp({ timestamp }: { timestamp: string }) {
  return (
    <div className={styles.lpColumn}>
      <time className={styles.lpTime} dateTime={timestamp}>
        {timestamp}
      </time>
    </div>
  );
}

function LabAnnotationMarks({
  annotations,
}: {
  annotations: readonly { label: string; note: string; kind?: AxisLabAnnotationKind }[];
}) {
  return (
    <div className={styles.rpColumn}>
      {annotations.slice(0, 2).map((a, i) => {
        const accent = a.kind ? ANNOTATION_ACCENT[a.kind] : undefined;
        return (
          <div
            key={i}
            className={styles.rpAnnotation}
            style={accent ? ({ "--mark-accent": accent } as CSSProperties) : undefined}
          >
            {accent && <span className={styles.rpDot} aria-hidden="true" />}
            <span className={styles.rpLabel}>{a.label}</span>
            <span className={styles.rpNote}>{a.note}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AxisLabPreview() {
  const searchParams = useSearchParams();
  const apertureFocus = parseFocus(searchParams.get("focus"));

  const [labState, setLabState] = useState<LabState>(FOCUS_TO_LAB_STATE[apertureFocus]);
  const [localThoughts, setLocalThoughts] = useState<string[]>([]);

  function handleReset() {
    setLabState(FOCUS_TO_LAB_STATE[apertureFocus]);
    setLocalThoughts([]);
  }

  function handleComposerSubmit(text: string) {
    setLocalThoughts((prev) => [...prev, text]);
    if (labState === "empty") {
      setLabState("active");
    }
  }

  const showLeftPort = labState === "active";
  const showRightPort = labState === "active" && apertureFocus === "annotation_visible";
  const composerDefaultFocused = apertureFocus === "input_active";

  return (
    <AxisApertureShell
      topPort={<LabTopBar stateLabel={STATE_LABEL[labState]} />}
      bottomPort={
        <>
          <AxisLabComposer
            onSubmit={handleComposerSubmit}
            defaultFocused={composerDefaultFocused}
          />
          <AxisLabPreviewControls
            labState={labState}
            onStateChange={setLabState}
            onReset={handleReset}
          />
        </>
      }
      leftPort={
        showLeftPort ? (
          <LabTimestamp timestamp={axisActiveThreadMock.timestamp} />
        ) : null
      }
      rightPort={
        showRightPort ? (
          <LabAnnotationMarks annotations={axisActiveThreadMock.annotations} />
        ) : null
      }
    >
      {labState === "empty" ? (
        <AxisEmptyState />
      ) : (
        <>
          {labState === "active" && (
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
