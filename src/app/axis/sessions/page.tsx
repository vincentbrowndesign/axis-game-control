"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AxisOsNotice, AxisOsSection, AxisOsStatusChip } from "../../../components/axis/AxisOsKit";
import { AxisSuiteShell } from "../../../components/axis/AxisSuiteShell";
import { AXIS_EVENT_STATE_LABELS, type AxisEventContainer } from "../../../lib/axis-event-container";

function continueTarget(event: AxisEventContainer): string {
  if (event.status === "recording" || event.status === "live") return `/axis/events/${event.id}/record`;
  if (event.status === "review") return `/axis/events/${event.id}/review`;
  return `/axis/events/${event.id}`;
}

export default function AxisSessionsPage() {
  const [sessions, setSessions] = useState<AxisEventContainer[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error" | "offline">("loading");

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
      const events = (await response.json()) as { active: AxisEventContainer[]; recent: AxisEventContainer[] };
      if (cancelled) return;
      setSessions([...(events.active ?? []), ...(events.recent ?? [])]);
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = query.trim()
    ? sessions.filter((event) => event.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  return (
    <AxisSuiteShell backHref="/axis" backLabel="Axis" title="Sessions">
      <section className="axis-suite-hero">
        <input
          className="axis-suite-cmd"
          onChange={(input) => setQuery(input.target.value)}
          placeholder="Find a session"
          value={query}
        />
      </section>

      <AxisOsSection label="Sessions" title="All sessions">
        <Link className="axis-os-row" href="/axis/events/new">
          <div className="axis-os-row-main">
            <strong>New session</strong>
            <span>Game, practice, training, video, or replay</span>
          </div>
          <em className="axis-os-row-go">Set up →</em>
        </Link>
        {state === "loading" && <AxisOsNotice tone="loading">Loading sessions…</AxisOsNotice>}
        {state === "offline" && <AxisOsNotice tone="offline">Session memory is offline right now.</AxisOsNotice>}
        {state === "error" && <AxisOsNotice tone="error">Sessions did not load. Pull to refresh.</AxisOsNotice>}
        {state === "ready" && !sessions.length && <AxisOsNotice tone="empty">No sessions yet.</AxisOsNotice>}
        {state === "ready" && sessions.length > 0 && !filtered.length && (
          <AxisOsNotice tone="empty">No sessions match “{query}”.</AxisOsNotice>
        )}
        {filtered.map((event) => (
          <Link className="axis-os-row" href={continueTarget(event)} key={event.id}>
            <div className="axis-os-row-main">
              <strong>{event.title}</strong>
              {event.team_name && <span>{event.team_name}</span>}
            </div>
            <AxisOsStatusChip
              label={AXIS_EVENT_STATE_LABELS[event.status]}
              tone={
                event.status === "recording" || event.status === "live"
                  ? "live"
                  : event.status === "ready"
                    ? "ready"
                    : "idle"
              }
            />
          </Link>
        ))}
      </AxisOsSection>
    </AxisSuiteShell>
  );
}
