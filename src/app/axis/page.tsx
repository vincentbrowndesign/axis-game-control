"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AxisOsHeader,
  AxisOsNotice,
  AxisOsSection,
  AxisOsStatusChip,
} from "../../components/axis/AxisOsKit";
import {
  AXIS_EVENT_STATE_LABELS,
  type AxisAccessLink,
  type AxisEventContainer,
  type AxisEventPlayer,
} from "../../lib/axis-event-container";

const SOURCE_LABELS: Record<string, string> = {
  attach_stream: "Replay",
  attach_video: "Video",
  record_now: "Camera",
};

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

export default function AxisHomePage() {
  const [liveNow, setLiveNow] = useState<AxisEventContainer[]>([]);
  const [today, setToday] = useState<AxisEventContainer[]>([]);
  const [replays, setReplays] = useState<AxisEventContainer[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [links, setLinks] = useState<AxisAccessLink[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eventsRes, linksRes] = await Promise.all([
        fetch("/api/axis/events").catch(() => null),
        fetch("/api/axis/access-links").catch(() => null),
      ]);
      if (cancelled) return;
      if (!eventsRes || eventsRes.status === 503) {
        setState("offline");
        return;
      }
      if (!eventsRes.ok) {
        setState("error");
        return;
      }
      const events = (await eventsRes.json()) as { active: AxisEventContainer[]; recent: AxisEventContainer[] };
      if (cancelled) return;
      const active = events.active ?? [];
      const recent = events.recent ?? [];
      setLiveNow(active.filter((event) => event.status === "recording" || event.status === "live"));
      setToday(active.filter((event) => event.status !== "recording" && event.status !== "live"));
      setReplays(recent);
      if (linksRes?.ok) {
        const body = (await linksRes.json()) as { accessLinks: AxisAccessLink[] };
        if (!cancelled) setLinks(body.accessLinks ?? []);
      }
      setState("ready");

      // Surface roster names from the latest sessions (no dedicated players API yet).
      const sourceIds = [...active, ...recent].slice(0, 6).map((event) => event.id);
      const details = await Promise.all(
        sourceIds.map((id) =>
          fetch(`/api/axis/events/${id}`)
            .then((response) => (response.ok ? (response.json() as Promise<{ players: AxisEventPlayer[] }>) : null))
            .catch(() => null),
        ),
      );
      if (cancelled) return;
      const names = new Set<string>();
      for (const detail of details) {
        for (const player of detail?.players ?? []) names.add(player.display_name);
      }
      setPlayers([...names].slice(0, 12));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="axis-os">
      <AxisOsHeader
        kicker="Trophy Labs"
        title="Axis"
        right={<span className="axis-os-tagline">Every session becomes film, proof, and memory.</span>}
      />

      <section className="axis-os-hero">
        <Link className="axis-os-primary" href="/axis/events/new">
          Start Session
        </Link>
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
                <span>{SOURCE_LABELS[event.source_mode] ?? "Session"}</span>
              </div>
              <AxisOsStatusChip label="Live" tone="live" />
            </Link>
          ))}
        </AxisOsSection>
      )}

      {state === "ready" && (
        <AxisOsSection label="Today" title="Today">
          {!today.length && <AxisOsNotice tone="empty">Nothing in progress. Start a session.</AxisOsNotice>}
          {today.map((event) => {
            const target = continueTarget(event);
            return (
              <Link className="axis-os-row" href={target.href} key={event.id}>
                <div className="axis-os-row-main">
                  <strong>{event.title}</strong>
                  <span>
                    {SOURCE_LABELS[event.source_mode] ?? "Session"} · {AXIS_EVENT_STATE_LABELS[event.status]}
                  </span>
                </div>
                <em className="axis-os-row-go">{target.label}</em>
              </Link>
            );
          })}
        </AxisOsSection>
      )}

      {state === "ready" && (
        <AxisOsSection label="Recent replays" title="Recent replays">
          {!replays.length && <AxisOsNotice tone="empty">Finished sessions land here as replays.</AxisOsNotice>}
          {replays.map((event) => (
            <Link className="axis-os-row" href={`/axis/events/${event.id}`} key={event.id}>
              <div className="axis-os-row-main">
                <strong>{event.title}</strong>
                <span>{SOURCE_LABELS[event.source_mode] ?? "Session"}</span>
              </div>
              <AxisOsStatusChip
                label={AXIS_EVENT_STATE_LABELS[event.status]}
                tone={event.status === "ready" ? "ready" : "idle"}
              />
            </Link>
          ))}
        </AxisOsSection>
      )}

      {state === "ready" && players.length > 0 && (
        <AxisOsSection label="Players" title="Players">
          <div className="axis-os-chiprow">
            {players.map((name) => (
              <span className="axis-os-pill" key={name}>
                {name}
              </span>
            ))}
          </div>
        </AxisOsSection>
      )}

      {state === "ready" && links.length > 0 && (
        <AxisOsSection label="Packages" title="Packages">
          {links.map((link) => (
            <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
              <div className="axis-os-row-main">
                <strong>{link.label}</strong>
                <span>Shared package</span>
              </div>
              {typeof link.price_cents === "number" && (
                <em className="axis-os-row-go">${(link.price_cents / 100).toFixed(2)}</em>
              )}
            </a>
          ))}
        </AxisOsSection>
      )}
    </main>
  );
}
