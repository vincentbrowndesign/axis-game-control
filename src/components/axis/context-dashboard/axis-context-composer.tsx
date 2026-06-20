import type React from "react";
import styles from "./axis-context-dashboard.module.css";

export function AxisContextComposer({
  ariaLabel = "Axis composer",
  children,
  controls,
  disabled = false,
  inputId = "axis-context-dashboard-composer",
  inputRef,
  onKeyDown,
  onSubmit,
  placeholder = "Say the rough version...",
  value,
  onValueChange,
}: {
  ariaLabel?: string;
  children?: React.ReactNode;
  controls?: React.ReactNode;
  disabled?: boolean;
  inputId?: string;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  placeholder?: string;
  value?: string;
  onValueChange?: (value: string) => void;
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
      <textarea
        disabled={disabled}
        id={inputId}
        onChange={(event) => onValueChange?.(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        ref={inputRef}
        rows={1}
        value={value}
      />
      {controls && (
        <div className={styles.composerControls} aria-label="Composer controls">
          {controls}
        </div>
      )}
      {children}
    </form>
  );
}
