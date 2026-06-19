"use client";

import { useState } from "react";
import { axisActiveThreadMock, axisMakeSpaceMock } from "./axis-lab-mock-data";
import AxisActiveThought from "./axis-active-thought";
import AxisEmptyState from "./axis-empty-state";
import AxisLabComposer from "./axis-lab-composer";
import AxisLabPreviewControls, { type LabState } from "./axis-lab-preview-controls";
import AxisMakeSpace from "./axis-make-space";
import AxisQuietHeader from "./axis-quiet-header";
import AxisQuietSurface from "./axis-quiet-surface";
import styles from "./axis-lab.module.css";

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

  return (
    <AxisQuietSurface>
      <AxisQuietHeader
        labLabel="Axis Lab / UI Preview"
        stateLabel="Local preview"
      />

      {labState === "empty" ? (
        <AxisEmptyState />
      ) : (
        <div className={styles.field}>
          {labState === "active" && (
            <AxisActiveThought {...axisActiveThreadMock} />
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
                <p key={i} className={styles.localMessage}>{t}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <AxisLabComposer onSubmit={handleComposerSubmit} />

      <AxisLabPreviewControls
        labState={labState}
        onStateChange={setLabState}
        onReset={handleReset}
      />
    </AxisQuietSurface>
  );
}
