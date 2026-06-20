import type { CSSProperties } from "react";
import { Plus } from "lucide-react";
import { AXIS_ROOM_COLORS, AXIS_STATUS_STYLES } from "../../../lib/axis-visual-language";
import { AxisActiveContext } from "./axis-active-context";
import { AxisContextHeader } from "./axis-context-header";
import { AxisContextRail } from "./axis-context-rail";
import type { AxisContextDashboardShellProps, AxisContextRecentItem } from "./axis-context-dashboard-types";
import { AxisThreadTimeline } from "./axis-thread-timeline";
import styles from "./axis-context-dashboard.module.css";

export function AxisContextDashboardShell({
  actions = [],
  activeContext,
  ariaLabel = "Axis context dashboard",
  composer,
  emptyState,
  header,
  lowerSourceRegion,
  openLoops = [],
  proofCandidates = [],
  recentItems = [],
  timelineItems = [],
}: AxisContextDashboardShellProps) {
  const hasTimeline = timelineItems.length > 0;
  const hasRail = proofCandidates.length > 0 || openLoops.length > 0 || actions.length > 0;
  const gridClassName = [
    styles.dashboardGrid,
    !hasTimeline && hasRail ? styles.dashboardGridNoTimeline : "",
    hasTimeline && !hasRail ? styles.dashboardGridNoRail : "",
    !hasTimeline && !hasRail ? styles.dashboardGridSingle : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main
      className={styles.labRoot}
      style={
        {
          "--lab-action": AXIS_STATUS_STYLES.use.accent,
          "--lab-context": AXIS_ROOM_COLORS.parked,
          "--lab-grid": AXIS_ROOM_COLORS.grid,
          "--lab-ink": AXIS_ROOM_COLORS.ink,
          "--lab-line": AXIS_ROOM_COLORS.line,
          "--lab-paper": AXIS_ROOM_COLORS.paper,
          "--lab-proof": AXIS_STATUS_STYLES.proof.accent,
          "--lab-room": AXIS_ROOM_COLORS.room,
        } as CSSProperties
      }
      aria-label={ariaLabel}
    >
      <div className={styles.appSurface}>
        <AxisContextHeader {...header} />
        {activeContext ? (
          <section className={gridClassName} aria-label="Context dashboard">
            {hasTimeline && <AxisThreadTimeline items={timelineItems} />}
            <AxisActiveContext {...activeContext} />
            {hasRail && (
              <AxisContextRail actions={actions} openLoops={openLoops} proofCandidates={proofCandidates} />
            )}
          </section>
        ) : (
          emptyState
        )}
        {composer}
        {lowerSourceRegion ?? <RecentRealityShelf items={recentItems} />}
      </div>
    </main>
  );
}

function RecentRealityShelf({ items }: { items: readonly AxisContextRecentItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className={styles.recentShelf} aria-labelledby="axis-context-recent-title">
      <div className={styles.recentHeader}>
        <h2 id="axis-context-recent-title">Recent Reality</h2>
        <button type="button">View all</button>
      </div>
      <div className={styles.recentRow}>
        {items.map((item) => (
          <RecentRealityItem item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}

function RecentRealityItem({ item }: { item: AxisContextRecentItem }) {
  return (
    <article className={styles.recentItem}>
      {item.preview ?? (
        <div className={`${styles.recentThumb} ${styles[`recent-${item.kind.toLowerCase()}`]}`}>
          {item.duration ? <span>{item.duration}</span> : <Plus size={14} aria-hidden="true" />}
        </div>
      )}
      <h3>{item.title}</h3>
      <p>
        {item.kind}
        {item.time ? ` - ${item.time}` : ""}
      </p>
      {item.meta?.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </article>
  );
}
