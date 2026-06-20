import type React from "react";
import styles from "./axis-context-dashboard.module.css";

export function AxisContextSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  if (!children) return null;

  return (
    <section className={styles.contextMiniBlock}>
      <h2>{title}</h2>
      {typeof children === "string" ? <p>{children}</p> : children}
    </section>
  );
}
