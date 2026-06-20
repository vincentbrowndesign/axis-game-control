import type { AxisContextTimelineItem } from "./axis-context-dashboard-types";
import styles from "./axis-context-dashboard.module.css";

export function AxisThreadTimeline({ items = [] }: { items?: readonly AxisContextTimelineItem[] }) {
  if (items.length === 0) return null;

  return (
    <aside className={styles.timelineRegion} aria-labelledby="axis-context-timeline-title">
      <h2 id="axis-context-timeline-title">Thread Timeline</h2>
      <ol className={styles.timelineList}>
        {items.map((event) => (
          <li className={styles.timelineItem} key={event.id}>
            <span className={styles.timelineDot} aria-hidden="true" />
            <time>{event.time}</time>
            <strong>{event.title}</strong>
            {event.detail && <p>{event.detail}</p>}
            {event.meta && <p className={styles.realityMeta}>{event.meta}</p>}
            {event.mediaLabel && (
              <div className={event.mediaKind === "voice" ? styles.waveformPreview : styles.miniThumb}>
                <span>{event.mediaLabel}</span>
              </div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
