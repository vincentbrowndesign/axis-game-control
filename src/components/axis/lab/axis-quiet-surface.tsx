import type { CSSProperties, ReactNode } from "react";
import { AXIS_ROOM_COLORS } from "../../../lib/axis-visual-language";
import styles from "./axis-lab.module.css";

interface Props {
  children: ReactNode;
}

const labVars = {
  "--lab-room": AXIS_ROOM_COLORS.room,
  "--lab-paper": AXIS_ROOM_COLORS.paper,
  "--lab-ink": AXIS_ROOM_COLORS.ink,
  "--lab-line": AXIS_ROOM_COLORS.line,
  "--lab-grid": AXIS_ROOM_COLORS.grid,
} as CSSProperties;

export default function AxisQuietSurface({ children }: Props) {
  return (
    <main className={styles.surface} style={labVars} aria-label="Axis Lab UI preview">
      {children}
    </main>
  );
}
