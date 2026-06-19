import styles from "./axis-lab.module.css";

interface Props {
  threadTitle: string;
  userThought: string;
  axisResponse: string;
}

export default function AxisActiveThought({ threadTitle, userThought, axisResponse }: Props) {
  return (
    <div className={styles.thoughtColumn}>
      <p className={styles.threadEyebrow}>{threadTitle}</p>
      <p className={styles.userThought}>{userThought}</p>
      <p className={styles.axisResponse}>{axisResponse}</p>
    </div>
  );
}
