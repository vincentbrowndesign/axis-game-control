"use client";

import { useState } from "react";
import { axisActiveThreadMock } from "./axis-lab-mock-data";
import AxisActiveThought from "./axis-active-thought";
import AxisEmptyState from "./axis-empty-state";
import AxisLabPreviewControls, { type LabState } from "./axis-lab-preview-controls";
import AxisQuietHeader from "./axis-quiet-header";
import AxisQuietSurface from "./axis-quiet-surface";
import styles from "./axis-lab.module.css";

export default function AxisLabPreview() {
  const [labState, setLabState] = useState<LabState>("empty");

  function handleReset() {
    setLabState("empty");
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
          <AxisActiveThought {...axisActiveThreadMock} />
        </div>
      )}

      <AxisLabPreviewControls
        labState={labState}
        onStateChange={setLabState}
        onReset={handleReset}
      />
    </AxisQuietSurface>
  );
}
