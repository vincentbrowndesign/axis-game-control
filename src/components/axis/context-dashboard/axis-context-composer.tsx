import type React from "react";
import styles from "./axis-context-dashboard.module.css";

export function AxisContextComposer({
  ariaLabel = "Axis composer",
  children,
  controls,
  inputId = "axis-context-dashboard-composer",
  onSubmit,
  placeholder = "Say the rough version...",
}: {
  ariaLabel?: string;
  children?: React.ReactNode;
  controls?: React.ReactNode;
  inputId?: string;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  placeholder?: string;
}) {
  return (
    <form
      className={styles.dashboardComposer}
      aria-label={ariaLabel}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.(event);
      }}
    >
      <label className={styles.srOnly} htmlFor={inputId}>
        Say the rough version
      </label>
      <input id={inputId} placeholder={placeholder} />
      {controls && (
        <div className={styles.composerControls} aria-label="Composer controls">
          {controls}
        </div>
      )}
      {children}
    </form>
  );
}
