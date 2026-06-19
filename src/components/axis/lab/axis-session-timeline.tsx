import type { AxisLabTimelineEntry } from "./axis-lab-types";
import styles from "./axis-lab.module.css";

type Props = {
  entries: readonly AxisLabTimelineEntry[];
};

export default function AxisSessionTimeline({ entries }: Props) {
  return (
    <section className={styles.timeline} aria-labelledby="axis-lab-timeline-title">
      <div className={styles.sectionEyebrow}>Session timeline</div>
      <h2 id="axis-lab-timeline-title">What has happened</h2>
      <ol className={styles.timelineList}>
        {entries.map((entry) => (
          <li key={entry.id} className={styles.timelineEntry}>
            <time dateTime={entry.timestamp} title={formatFullDateTime(entry.timestamp)}>
              {formatShortTime(entry.timestamp)}
            </time>
            <div>
              <span>{entry.label}</span>
              <p>{entry.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
