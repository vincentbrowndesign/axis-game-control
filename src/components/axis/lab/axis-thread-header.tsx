import type { AxisLabSaveStatus } from "./axis-lab-types";
import AxisSaveStatus from "./axis-save-status";
import styles from "./axis-lab.module.css";

type Props = {
  labLabel: string;
  onReset: () => void;
  onSaveStatusChange: (status: AxisLabSaveStatus) => void;
  saveStatus: AxisLabSaveStatus;
  sessionStartedAt: string;
  threadTitle: string;
};

const previewStates: AxisLabSaveStatus[] = [
  "not_saved",
  "saving",
  "saved",
  "unsaved_changes",
  "error",
];

export default function AxisThreadHeader({
  labLabel,
  onReset,
  onSaveStatusChange,
  saveStatus,
  sessionStartedAt,
  threadTitle,
}: Props) {
  return (
    <header className={styles.threadHeader}>
      <div className={styles.threadTitleBlock}>
        <span className={styles.wordmark}>Axis</span>
        <div>
          <p className={styles.labLabel}>{labLabel}</p>
          <h1>{threadTitle}</h1>
          <time dateTime={sessionStartedAt} title={formatFullDateTime(sessionStartedAt)}>
            Started {formatShortTime(sessionStartedAt)}
          </time>
        </div>
      </div>

      <div className={styles.headerControls} aria-label="Preview controls">
        <AxisSaveStatus status={saveStatus} savedAt="2026-06-19T08:36:00-05:00" />
        <label className={styles.previewStateControl}>
          <span>Preview states</span>
          <select
            value={saveStatus}
            onChange={(event) => onSaveStatusChange(event.target.value as AxisLabSaveStatus)}
          >
            {previewStates.map((state) => (
              <option key={state} value={state}>
                {state.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button className={styles.resetButton} type="button" onClick={onReset}>
          Reset preview
        </button>
      </div>
    </header>
  );
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function formatFullDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
