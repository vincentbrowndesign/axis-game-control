"use client";

import { useState } from "react";
import { axisActiveThreadMock, axisMakeSpaceMock } from "./axis-lab-mock-data";
import AxisApertureShell from "./AxisApertureShell";
import AxisActiveThought from "./axis-active-thought";
import AxisEmptyState from "./axis-empty-state";
import AxisLabComposer from "./axis-lab-composer";
import AxisLabPreviewControls, { type LabState } from "./axis-lab-preview-controls";
import AxisMakeSpace from "./axis-make-space";
import styles from "./axis-lab.module.css";

const STATE_LABEL: Record<LabState, string> = {
  empty: "Empty",
  active: "Active",
  "make-space": "Make Space",
  expanded: "Expanded",
};

function LabTopBar({ stateLabel }: { stateLabel: string }) {
  return (
    <header className={styles.header}>
      <span className={styles.wordmark}>Axis</span>
      <span className={styles.labLabel}>Axis Lab</span>
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

function LabAnnotations({
  annotations,
}: {
  annotations: readonly { label: string; note: string }[];
}) {
  return (
    <div className={styles.rpColumn}>
      {annotations.slice(0, 2).map((a, i) => (
        <div key={i} className={styles.rpAnnotation}>
          <span className={styles.rpLabel}>{a.label}</span>
          <span className={styles.rpNote}>{a.note}</span>
        </div>
      ))}
    </div>
  );
}

export default function AxisLabPreview() {
  const [labState, setLabState] = useState<LabState>("empty");
  const [localThoughts, setLocalThoughts] = useState<string[]>([]);

  function handleReset() {
    setLabState("empty");
    setLocalThoughts([]);
  }

  function handleComposerSubmit(text: string) {
    setLocalThoughts((prev) => [...prev, text]);
    if (labState === "empty") {
      setLabState("active");
    }
  }

  const showPorts = labState === "active" || labState === "expanded";

  return (
    <AxisApertureShell
      topPort={<LabTopBar stateLabel={STATE_LABEL[labState]} />}
      bottomPort={
        <>
          <AxisLabComposer onSubmit={handleComposerSubmit} />
          <AxisLabPreviewControls
            labState={labState}
            onStateChange={setLabState}
            onReset={handleReset}
          />
        </>
      }
      leftPort={
        showPorts ? (
          <LabTimestamp timestamp={axisActiveThreadMock.timestamp} />
        ) : null
      }
      rightPort={
        showPorts ? (
          <LabAnnotations annotations={axisActiveThreadMock.annotations} />
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
          {labState === "make-space" && (
            <AxisMakeSpace
              threadTitle={axisActiveThreadMock.threadTitle}
              items={axisMakeSpaceMock}
            />
          )}
          {labState === "expanded" && (
            <AxisMakeSpace
              threadTitle={axisActiveThreadMock.threadTitle}
              items={axisMakeSpaceMock}
              defaultExpandedId="keeper"
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
