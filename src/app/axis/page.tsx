"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisOsNotice, AxisOsSection, AxisOsStatusChip } from "../../components/axis/AxisOsKit";
import { AXIS_APPS, AxisSuiteShell } from "../../components/axis/AxisSuiteShell";
import { startInstantSession } from "../../lib/axis-instant-session";
import { AXIS_EVENT_STATE_LABELS, type AxisEventContainer } from "../../lib/axis-event-container";

// Where a session should resume when tapped from home.
function continueTarget(event: AxisEventContainer): { href: string; label: string } {
  if (event.status === "recording" || event.status === "live") {
    return { href: `/axis/events/${event.id}/record`, label: "Live now →" };
  }
  if (event.status === "review") {
    return { href: `/axis/events/${event.id}/review`, label: "Tag moments →" };
  }
  if (event.status === "draft" && event.source_mode === "record_now") {
    return { href: `/axis/events/${event.id}/record`, label: "Go live →" };
  }
  return { href: `/axis/events/${event.id}`, label: "Open →" };
}

export default function AxisSuiteHomePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<AxisEventContainer[]>([]);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"loading" | "ready" | "error" | "offline">("loading");
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
      const events = (await response.json()) as { active: AxisEventContainer[]; recent: AxisEventContainer[] };
      if (cancelled) return;
      // One list: live first, then in-progress, then finished.
      const active = events.active ?? [];
      const live = active.filter((event) => event.status === "recording" || event.status === "live");
      const rest = active.filter((event) => event.status !== "recording" && event.status !== "live");
      setSessions([...live, ...rest, ...(events.recent ?? [])].slice(0, 8));
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = query.trim()
    ? sessions.filter((event) => event.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  async function startSession() {
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

  function runCommand() {
    const text = query.trim().toLowerCase();
    if (!text) return;
    if (text.includes("live")) {
      router.push("/axis/live");
      return;
    }
    if (text.includes("player")) {
      router.push("/axis/players");
      return;
    }
    if (text.includes("package") || text.includes("share") || text.includes("sell")) {
      router.push("/axis/packages");
      return;
    }
    if (text.includes("start") || text.includes("session") || text.includes("new")) {
      router.push("/axis/events/new");
      return;
    }
    const match = filtered[0];
    if (match) router.push(continueTarget(match).href);
  }

  return (
    <AxisSuiteShell>
      <section className="axis-suite-hero">
        <input
          className="axis-suite-cmd"
          onChange={(input) => setQuery(input.target.value)}
          onKeyDown={(key) => {
            if (key.key === "Enter") runCommand();
          }}
          placeholder="What are we doing today?"
          value={query}
        />
        <button className="axis-os-primary" disabled={busy} onClick={startSession} type="button">
          {busy ? "Starting…" : "Start Session"}
        </button>
        <Link className="axis-os-setuplink" href="/axis/events/new">
          Set up a game, video, or replay session →
        </Link>
        {startError && <AxisOsNotice tone="error">{startError}</AxisOsNotice>}
      </section>

      <section className="axis-suite-homeapps" aria-label="Axis apps">
        {AXIS_APPS.map((app) => (
          <Link className="axis-suite-app axis-suite-app--card" href={app.href} key={app.name}>
            <span className={app.tone === "live" ? "axis-suite-glyph axis-suite-glyph--live" : "axis-suite-glyph"}>
              {app.glyph}
            </span>
            <strong>{app.name}</strong>
            <span className="axis-suite-app-sub">{app.sub}</span>
          </Link>
        ))}
      </section>

      <AxisOsSection label="Today" title="Today">
        {state === "loading" && <AxisOsNotice tone="loading">Loading your sessions…</AxisOsNotice>}
        {state === "offline" && <AxisOsNotice tone="offline">Session memory is offline right now.</AxisOsNotice>}
        {state === "error" && <AxisOsNotice tone="error">Sessions did not load. Pull to refresh.</AxisOsNotice>}
        {state === "ready" && !sessions.length && (
          <AxisOsNotice tone="empty">Nothing yet. Start a session.</AxisOsNotice>
        )}
        {state === "ready" && sessions.length > 0 && !filtered.length && (
          <AxisOsNotice tone="empty">No sessions match “{query}”.</AxisOsNotice>
        )}
        {filtered.map((event) => {
          const target = continueTarget(event);
          const isLive = event.status === "recording" || event.status === "live";
          return (
            <Link className="axis-os-row" href={target.href} key={event.id}>
              <div className="axis-os-row-main">
                <strong>{event.title}</strong>
                <span>{AXIS_EVENT_STATE_LABELS[event.status]}</span>
              </div>
              {isLive ? (
                <AxisOsStatusChip label="Live" tone="live" />
              ) : (
                <em className="axis-os-row-go">{target.label}</em>
              )}
            </Link>
          );
        })}
      </AxisOsSection>
    </AxisSuiteShell>
  );
}
