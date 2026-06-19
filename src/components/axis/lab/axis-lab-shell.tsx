import type { CSSProperties, ReactNode } from "react";
import type { AXIS_ROOM_COLORS, AXIS_STATUS_STYLES } from "../../../lib/axis-visual-language";
import styles from "./axis-lab.module.css";

type Props = {
  board: ReactNode;
  colors: typeof AXIS_ROOM_COLORS;
  composer: ReactNode;
  header: ReactNode;
  inspector: ReactNode;
  statusStyles: typeof AXIS_STATUS_STYLES;
  timeline: ReactNode;
};

export default function AxisLabShell({
  board,
  colors,
  composer,
  header,
  inspector,
  statusStyles,
  timeline,
}: Props) {
  const style = {
    "--axis-lab-grid": colors.grid,
    "--axis-lab-ink": colors.ink,
    "--axis-lab-line": colors.line,
    "--axis-lab-paper": colors.paper,
    "--axis-lab-room": colors.room,
    "--axis-lab-status-use": statusStyles.use.accent,
    "--axis-lab-status-decide": statusStyles.decide.accent,
    "--axis-lab-status-fix": statusStyles.fix.accent,
    "--axis-lab-status-proof": statusStyles.proof.accent,
    "--axis-lab-status-parked": statusStyles.parked.accent,
  } as CSSProperties;

  return (
    <main className={styles.shell} style={style} aria-label="Axis Lab UI preview">
      <div className={styles.header}>{header}</div>
      <div className={styles.room}>
        <aside className={styles.timelineRegion} aria-label="Session timeline">
          {timeline}
        </aside>
        <section className={styles.boardRegion} aria-label="Current focus board">
          {board}
        </section>
        <aside className={styles.inspectorRegion} aria-label="Selected card inspector">
          {inspector}
        </aside>
      </div>
      <div className={styles.composerRegion}>{composer}</div>
    </main>
  );
}
