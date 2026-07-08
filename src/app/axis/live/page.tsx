"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisOsNotice, AxisOsSection } from "../../../components/axis/AxisOsKit";
import { AxisSuiteShell } from "../../../components/axis/AxisSuiteShell";
import { startInstantSession } from "../../../lib/axis-instant-session";
import type { AxisEventContainer } from "../../../lib/axis-event-container";

// Live gateway: if something is live, go straight to it. Otherwise one tap
// starts a live session.

export default function AxisLivePage() {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "idle" | "error" | "offline">("checking");
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/axis/events").catch(() => null);
      if (cancelled) return;
      if (!response || response.status === 503) {
        setState("offline");
        return;
      }
      if (!response.ok) {
        setState("error");
        return;
      }
      const events = (await response.json()) as { active: AxisEventContainer[] };
      if (cancelled) return;
      const live = (events.active ?? []).find(
        (event) => event.status === "recording" || event.status === "live",
      );
      if (live) {
        router.replace(`/axis/events/${live.id}/record`);
        return;
      }
      setState("idle");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function goLive() {
    if (busy) return;
    setBusy(true);
    setStartError(null);
    const result = await startInstantSession();
    if (!result.ok) {
      setStartError(result.message);
      setBusy(false);
      return;
    }
    router.push(`/axis/events/${result.id}/record`);
  }

  return (
    <AxisSuiteShell backHref="/axis" backLabel="Axis" title="Live">
      {state === "checking" && (
        <AxisOsSection label="Live" title="Live">
          <AxisOsNotice tone="loading">Checking for a live session…</AxisOsNotice>
        </AxisOsSection>
      )}
      {state === "offline" && (
        <AxisOsSection label="Live" title="Live">
          <AxisOsNotice tone="offline">Session memory is offline right now.</AxisOsNotice>
        </AxisOsSection>
      )}
      {state === "error" && (
        <AxisOsSection label="Live" title="Live">
          <AxisOsNotice tone="error">Could not check live sessions. Pull to refresh.</AxisOsNotice>
        </AxisOsSection>
      )}
      {state === "idle" && (
        <section className="axis-os-hero">
          <button className="axis-os-primary" disabled={busy} onClick={goLive} type="button">
            {busy ? "Starting…" : "Start Live Session"}
          </button>
          <p>Nothing is live right now. One tap puts you on the clock.</p>
          {startError && <AxisOsNotice tone="error">{startError}</AxisOsNotice>}
        </section>
      )}
    </AxisSuiteShell>
  );
}
