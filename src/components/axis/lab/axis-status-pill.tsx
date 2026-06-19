import type { CSSProperties } from "react";
import type { AxisCardStatus } from "../../../lib/axis-visual-language";
import { getAxisStatusStyle } from "../../../lib/axis-visual-language";
import styles from "./axis-lab.module.css";

type Props = {
  status: AxisCardStatus;
};

const statusLabels: Record<AxisCardStatus, string> = {
  decide: "DECIDE",
  fix: "FIX",
  neutral: "NEUTRAL",
  parked: "PARKED",
  proof: "PROOF",
  use: "USE",
};

const statusCopy: Record<AxisCardStatus, string> = {
  decide: "Needs a choice or read",
  fix: "Needs correction",
  neutral: "Context",
  parked: "Intentionally deferred",
  proof: "Signal, not verified evidence",
  use: "Ready to apply",
};

export default function AxisStatusPill({ status }: Props) {
  const style = getAxisStatusStyle(status);
  return (
    <span
      className={styles.statusPill}
      title={statusCopy[status]}
      aria-label={`${statusLabels[status]}: ${statusCopy[status]}`}
      style={{
        "--axis-card-accent": style.accent,
      } as CSSProperties}
    >
      <span aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

export function getAxisLabStatusMeaning(status: AxisCardStatus) {
  return statusCopy[status];
}

export function getAxisLabStatusLabel(status: AxisCardStatus) {
  return statusLabels[status];
}
