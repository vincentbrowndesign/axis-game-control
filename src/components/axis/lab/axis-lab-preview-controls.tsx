"use client";

import { Fragment } from "react";
import styles from "./axis-lab.module.css";

export type LabState = "empty" | "active" | "make-space";

const LAB_STATES: { id: LabState; label: string }[] = [
  { id: "empty", label: "Empty" },
  { id: "active", label: "Active" },
  { id: "make-space", label: "Make Space" },
];

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
        {LAB_STATES.map((s, i) => (
          <Fragment key={s.id}>
            {i > 0 && (
              <span className={styles.stateDot} aria-hidden="true">·</span>
            )}
            <button
              type="button"
              className={`${styles.stateBtn}${labState === s.id ? ` ${styles.stateBtnOn}` : ""}`}
              onClick={() => onStateChange(s.id)}
            >
              {s.label}
            </button>
          </Fragment>
        ))}
      </span>
      <button type="button" className={styles.resetBtn} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
