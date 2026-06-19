import type { CSSProperties, ReactNode } from "react";
import { AXIS_ROOM_COLORS } from "../../../lib/axis-visual-language";
import styles from "./axis-lab.module.css";

interface Props {
  topPort?: ReactNode;
  bottomPort?: ReactNode;
  leftPort?: ReactNode;
  rightPort?: ReactNode;
  floatingLayer?: ReactNode;
  expansionLayer?: ReactNode;
  children: ReactNode;
}

const labVars = {
  "--lab-room": AXIS_ROOM_COLORS.room,
  "--lab-paper": AXIS_ROOM_COLORS.paper,
  "--lab-ink": AXIS_ROOM_COLORS.ink,
  "--lab-line": AXIS_ROOM_COLORS.line,
  "--lab-grid": AXIS_ROOM_COLORS.grid,
} as CSSProperties;

export default function AxisApertureShell({
  topPort,
  bottomPort,
  leftPort,
  rightPort,
  floatingLayer,
  expansionLayer,
  children,
}: Props) {
  return (
    <div
      className={styles.apertureRoom}
      style={labVars}
      aria-label="Axis Lab UI preview"
    >
      {/* DOM reading order: top → center row → bottom */}
      {topPort != null && (
        <div className={styles.apertureTop}>{topPort}</div>
      )}

      <div className={styles.apertureCenterRow}>
        {/* Left port — timestamps or frame marks. Empty when unused. */}
        <div className={styles.apertureLeft}>
          {leftPort}
        </div>

        {/* Center aperture — the sacred center. Never moves. */}
        <main className={styles.apertureCenter}>
          {children}
        </main>

        {/* Right port — annotations or proof candidates. Empty when unused. */}
        <div className={styles.apertureRight}>
          {rightPort}
        </div>
      </div>

      {bottomPort != null && (
        <div className={styles.apertureBottom}>{bottomPort}</div>
      )}

      {/* Floating layer — contextual marks near their object. No layout width reserved. */}
      {floatingLayer != null && (
        <div className={styles.apertureFloat} aria-hidden="true">
          {floatingLayer}
        </div>
      )}

      {/* Expansion layer — temporarily overlays reserved air around one selected object. */}
      {expansionLayer != null && (
        <div className={styles.apertureExpand}>
          {expansionLayer}
        </div>
      )}
    </div>
  );
}
