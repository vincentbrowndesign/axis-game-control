import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell pieces for the Axis Event Container screens (.axis-os family).
// Presentational only — no data fetching, no state.

export function AxisOsHeader({
  backHref,
  backLabel,
  kicker,
  title,
  right,
}: {
  backHref?: string;
  backLabel?: string;
  kicker?: string;
  title: string;
  right?: ReactNode;
}) {
  return (
    <header className="axis-os-topbar">
      <div className="axis-os-brand">
        {backHref ? (
          <Link className="axis-os-back" href={backHref}>
            ← {backLabel ?? "Back"}
          </Link>
        ) : (
          <span>{kicker}</span>
        )}
        {backHref && kicker ? <span>{kicker}</span> : null}
        <strong>{title}</strong>
      </div>
      {right ? <div className="axis-os-topbar-right">{right}</div> : null}
    </header>
  );
}

export function AxisOsStatusChip({ label, tone = "idle" }: { label: string; tone?: "idle" | "live" | "ready" }) {
  return <span className={`axis-os-status axis-os-status--${tone}`}>{label}</span>;
}

export type AxisOsFlowStep = {
  label: string;
  detail?: string;
  href?: string;
  state: "done" | "current" | "next";
};

export function AxisOsFlow({ steps }: { steps: AxisOsFlowStep[] }) {
  return (
    <nav className="axis-os-flow" aria-label="Event flow">
      {steps.map((step) =>
        step.href ? (
          <Link className={`axis-os-flowstep axis-os-flowstep--${step.state}`} href={step.href} key={step.label}>
            <strong>{step.label}</strong>
            {step.detail ? <span>{step.detail}</span> : null}
          </Link>
        ) : (
          <div className={`axis-os-flowstep axis-os-flowstep--${step.state}`} key={step.label}>
            <strong>{step.label}</strong>
            {step.detail ? <span>{step.detail}</span> : null}
          </div>
        ),
      )}
    </nav>
  );
}

export function AxisOsSection({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="axis-os-list" aria-label={label}>
      <h2>{title ?? label}</h2>
      {children}
    </section>
  );
}

export type AxisOsNoticeTone = "loading" | "empty" | "error" | "offline" | "saved";

export function AxisOsNotice({ tone, children }: { tone: AxisOsNoticeTone; children: ReactNode }) {
  return <p className={`axis-os-notice axis-os-notice--${tone}`}>{children}</p>;
}

// Full-page fallback while an event screen has nothing to render yet.
export function AxisOsScreenState({
  backHref,
  title,
  tone,
  children,
}: {
  backHref: string;
  title: string;
  tone: AxisOsNoticeTone;
  children: ReactNode;
}) {
  return (
    <main className="axis-os">
      <AxisOsHeader backHref={backHref} backLabel="Axis" title={title} />
      <div className="axis-os-screenstate">
        <AxisOsNotice tone={tone}>{children}</AxisOsNotice>
      </div>
    </main>
  );
}

export function formatAxisClock(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const core = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${hours}:${core}` : core;
}
