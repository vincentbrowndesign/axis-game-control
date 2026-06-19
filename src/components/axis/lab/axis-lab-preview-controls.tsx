"use client";

import styles from "./axis-lab.module.css";

export type LabState = "empty" | "active";

interface Props {
  labState: LabState;
  onStateChange: (s: LabState) => void;
  onReset: () => void;
}

export default function AxisLabPreviewControls({
  labState,
  onStateChange,
  onReset,
}: Props) {
  return (
    <div className={styles.controls}>
      <span className={styles.stateNote}>Local preview</span>
      <span className={styles.stateToggle} role="group" aria-label="Preview state">
        <button
          type="button"
          className={`${styles.stateBtn}${labState === "empty" ? ` ${styles.stateBtnOn}` : ""}`}
          onClick={() => onStateChange("empty")}
        >
          Empty
        </button>
        <span className={styles.stateDot} aria-hidden="true">·</span>
        <button
          type="button"
          className={`${styles.stateBtn}${labState === "active" ? ` ${styles.stateBtnOn}` : ""}`}
          onClick={() => onStateChange("active")}
        >
          Active
        </button>
      </span>
      <button type="button" className={styles.resetBtn} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
