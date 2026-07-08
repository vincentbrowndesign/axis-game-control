"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AxisOsNotice, AxisOsSection, AxisOsStatusChip } from "../../components/axis/AxisOsKit";
import { AXIS_APPS, AxisSuiteShell } from "../../components/axis/AxisSuiteShell";
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
  const [liveNow, setLiveNow] = useState<AxisEventContainer[]>([]);
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
      const active = events.active ?? [];
      const recent = events.recent ?? [];
      setLiveNow(active.filter((event) => event.status === "recording" || event.status === "live"));
      setSessions(
        [...active.filter((event) => event.status !== "recording" && event.status !== "live"), ...recent].slice(0, 8),
      );
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const needsPackage = sessions.filter((event) => event.status === "review");
  const filtered = query.trim()
    ? sessions.filter((event) => event.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;

  const liveTarget = liveNow[0] ? `/axis/events/${liveNow[0].id}/record` : "/axis/events/new";
  const packageTarget = needsPackage[0] ? `/axis/events/${needsPackage[0].id}/report` : "/axis/packages";

  function runCommand() {
    const text = query.trim().toLowerCase();
    if (!text) return;
    if (text.includes("live")) {
      router.push(liveTarget);
      return;
    }
    if (text.includes("player")) {
      router.push("/axis/players");
      return;
    }
    if (text.includes("package") || text.includes("share") || text.includes("sell")) {
      router.push(packageTarget);
      return;
    }
    if (text.includes("film") || text.includes("replay") || text.includes("clip")) {
      router.push("/axis/clip-room");
      return;
    }
    if (text.includes("start") || text.includes("session") || text.includes("new")) {
      router.push("/axis/events/new");
      return;
    }
    const match = filtered[0];
    router.push(match ? continueTarget(match).href : "/axis/events/new");
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
        <div className="axis-suite-quick">
          <Link className="axis-suite-quickbtn axis-suite-quickbtn--primary" href="/axis/events/new">
            Start Session
          </Link>
          <Link className="axis-suite-quickbtn" href="/axis/players">
            Find Player
          </Link>
          <Link className="axis-suite-quickbtn" href={liveTarget}>
            Open Live
          </Link>
          <Link className="axis-suite-quickbtn" href={packageTarget}>
            Build Package
          </Link>
        </div>
      </section>

      <section className="axis-suite-homeapps" aria-label="Axis apps">
        {AXIS_APPS.map((app) => (
          <Link className="axis-suite-app axis-suite-app--card" href={app.href} key={app.name}>
            <span className="axis-suite-glyph">{app.glyph}</span>
            <strong>{app.name}</strong>
            <span className="axis-suite-app-sub">{app.sub}</span>
          </Link>
        ))}
      </section>

      {state === "loading" && (
        <section className="axis-os-list" aria-label="Loading">
          <AxisOsNotice tone="loading">Loading your sessions…</AxisOsNotice>
        </section>
      )}
      {state === "offline" && (
        <section className="axis-os-list" aria-label="Offline">
          <AxisOsNotice tone="offline">Session memory is offline right now.</AxisOsNotice>
        </section>
      )}
      {state === "error" && (
        <section className="axis-os-list" aria-label="Error">
          <AxisOsNotice tone="error">Sessions did not load. Pull to refresh.</AxisOsNotice>
        </section>
      )}

      {state === "ready" && liveNow.length > 0 && (
        <AxisOsSection label="Live now" title="Live now">
          {liveNow.map((event) => (
            <Link className="axis-os-row" href={`/axis/events/${event.id}/record`} key={event.id}>
              <div className="axis-os-row-main">
                <strong>{event.title}</strong>
              </div>
              <AxisOsStatusChip label="Live" tone="live" />
            </Link>
          ))}
        </AxisOsSection>
      )}

      {state === "ready" && (
        <AxisOsSection label="Recent sessions" title="Recent sessions">
          {!filtered.length && !query && <AxisOsNotice tone="empty">Nothing yet. Start a session.</AxisOsNotice>}
          {!filtered.length && query && <AxisOsNotice tone="empty">No sessions match “{query}”.</AxisOsNotice>}
          {filtered.map((event) => {
            const target = continueTarget(event);
            return (
              <Link className="axis-os-row" href={target.href} key={event.id}>
                <div className="axis-os-row-main">
                  <strong>{event.title}</strong>
                  <span>{AXIS_EVENT_STATE_LABELS[event.status]}</span>
                </div>
                <em className="axis-os-row-go">{target.label}</em>
              </Link>
            );
          })}
        </AxisOsSection>
      )}

      {state === "ready" && needsPackage.length > 0 && (
        <AxisOsSection label="Needs package" title="Needs package">
          {needsPackage.map((event) => (
            <Link className="axis-os-row" href={`/axis/events/${event.id}/report`} key={event.id}>
              <div className="axis-os-row-main">
                <strong>{event.title}</strong>
                <span>Moments marked, package not built</span>
              </div>
              <em className="axis-os-row-go">Build →</em>
            </Link>
          ))}
        </AxisOsSection>
      )}
    </AxisSuiteShell>
  );
}
