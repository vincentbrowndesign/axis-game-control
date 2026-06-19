import type { AxisLabSaveStatus } from "./axis-lab-types";
import styles from "./axis-lab.module.css";

type Props = {
  savedAt?: string;
  status: AxisLabSaveStatus;
};

export default function AxisSaveStatus({ savedAt, status }: Props) {
  const label = getSaveLabel(status, savedAt);

  return (
    <span className={styles.saveStatus} aria-live="polite">
      {status === "saved" && savedAt ? (
        <time dateTime={savedAt} title={formatFullDateTime(savedAt)}>
          {label}
        </time>
      ) : (
        label
      )}
    </span>
  );
}

function getSaveLabel(status: AxisLabSaveStatus, savedAt?: string) {
  if (status === "saving") return "Saving...";
  if (status === "saved") return savedAt ? `Saved ${formatShortTime(savedAt)}` : "Saved";
  if (status === "unsaved_changes") return "Unsaved changes";
  if (status === "error") return "Save failed";
  return "Not saved";
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
