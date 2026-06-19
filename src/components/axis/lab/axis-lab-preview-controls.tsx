"use client";

import styles from "./axis-lab.module.css";

interface Props {
  onReset: () => void;
}

export default function AxisLabPreviewControls({ onReset }: Props) {
  return (
    <div className={styles.controls}>
      <span className={styles.stateNote}>Local preview · not saved</span>
      <button type="button" className={styles.resetBtn} onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
