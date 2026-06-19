"use client";

import { axisLabBoardCards, axisLabFocus } from "./axis-lab-mock-data";
import AxisCurrentWork from "./axis-current-work";
import AxisLabPreviewControls from "./axis-lab-preview-controls";
import AxisQuietHeader from "./axis-quiet-header";
import AxisQuietSurface from "./axis-quiet-surface";
import styles from "./axis-lab.module.css";

export default function AxisLabPreview() {
  function handleReset() {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }

  return (
    <AxisQuietSurface>
      <AxisQuietHeader
        labLabel="Axis Lab / UI Preview"
        stateLabel="Local preview"
      />
      <div className={styles.field}>
        <AxisCurrentWork focus={axisLabFocus} cards={axisLabBoardCards} />
      </div>
      <AxisLabPreviewControls onReset={handleReset} />
    </AxisQuietSurface>
  );
}
