import styles from "./axis-lab.module.css";

export default function AxisEmptyState() {
  return (
    <div className={styles.emptyField}>
      <div className={styles.emptyColumn}>
        <h1 className={styles.emptyPrompt}>What are we working on?</h1>
        <p className={styles.emptyHint}>Bring the rough version.</p>
        <span className={styles.emptyInputLine} aria-hidden="true" />
      </div>
    </div>
  );
}
