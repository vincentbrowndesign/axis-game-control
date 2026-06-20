import styles from "./axis-lab.module.css";

interface Props {
  threadTitle: string;
  userThought: string;
  axisResponse: string;
  compactMeta?: string;
}

export default function AxisActiveThought({ threadTitle, userThought, axisResponse, compactMeta }: Props) {
  return (
    <div className={styles.thoughtColumn}>
      {compactMeta && (
        <p className={styles.compactMeta} aria-label={`Thread time: ${compactMeta}`}>
          {compactMeta}
        </p>
      )}
      <p className={styles.threadEyebrow}>{threadTitle}</p>
      <p className={styles.userThought}>{userThought}</p>
      <p className={styles.axisResponse}>{axisResponse}</p>
    </div>
  );
}
