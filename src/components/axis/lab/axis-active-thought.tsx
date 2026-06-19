import styles from "./axis-lab.module.css";
import type { AxisLabAnnotation } from "./axis-lab-types";

interface Props {
  threadTitle: string;
  userThought: string;
  axisResponse: string;
  timestamp: string;
  annotations: readonly AxisLabAnnotation[];
}

export default function AxisActiveThought({
  threadTitle,
  userThought,
  axisResponse,
  timestamp,
  annotations,
}: Props) {
  const visible = annotations.slice(0, 2);

  return (
    <div className={styles.thoughtColumn}>
      <p className={styles.threadEyebrow}>{threadTitle}</p>

      <div className={styles.thoughtRow}>
        <time className={styles.timestamp} dateTime={timestamp}>
          {timestamp}
        </time>

        <div className={styles.thoughtMain}>
          <p className={styles.userThought}>{userThought}</p>
          <p className={styles.axisResponse}>{axisResponse}</p>
        </div>

        <aside className={styles.annotations} aria-label="Thread annotations">
          {visible.map((a, i) => (
            <div key={i} className={styles.annotation}>
              <span className={styles.annotationLabel}>{a.label}</span>
              <span className={styles.annotationNote}>{a.note}</span>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
