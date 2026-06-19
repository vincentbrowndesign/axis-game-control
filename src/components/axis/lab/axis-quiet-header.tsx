import styles from "./axis-lab.module.css";

interface Props {
  labLabel: string;
  stateLabel: string;
}

export default function AxisQuietHeader({ labLabel, stateLabel }: Props) {
  return (
    <div className={styles.header}>
      <span className={styles.wordmark}>Axis</span>
      <span className={styles.labLabel}>{labLabel}</span>
      <span className={styles.stateLabel}>{stateLabel}</span>
    </div>
  );
}
