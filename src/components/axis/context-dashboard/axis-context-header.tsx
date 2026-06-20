import type React from "react";
import { ChevronDown, Search, Star } from "lucide-react";
import styles from "./axis-context-dashboard.module.css";

export function AxisContextHeader({
  actions,
  savedAt,
  savedDateTime,
  status = "Saved",
  threadTitle,
}: {
  actions?: React.ReactNode;
  savedAt?: string;
  savedDateTime?: string;
  status?: string;
  threadTitle: string;
}) {
  return (
    <header className={styles.labHeader}>
      <div className={styles.headerLeft}>
        <span className={styles.wordmark}>Axis</span>
        <span className={styles.headerSeparator} aria-hidden="true" />
        <button className={styles.threadSwitch} type="button" aria-label="Thread selector">
          <span>{threadTitle}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      {(status || savedAt) && (
        <div className={styles.headerCenter} aria-label="Thread status">
          <span className={styles.savedDot} aria-hidden="true" />
          {status && <span>{status}</span>}
          {savedAt && <span className={styles.statusDot} aria-hidden="true" />}
          {savedAt && <time dateTime={savedDateTime}>{savedAt}</time>}
        </div>
      )}

      <div className={styles.headerRight}>
        {actions ?? (
          <>
            <IconButton label="Search">
              <Search size={16} aria-hidden="true" />
            </IconButton>
            <IconButton label="Star">
              <Star size={16} aria-hidden="true" />
            </IconButton>
            <span className={styles.avatar} aria-label="User avatar">
              V
            </span>
          </>
        )}
      </div>
    </header>
  );
}

export function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button className={styles.iconButton} type="button" aria-label={label}>
      {children}
    </button>
  );
}
