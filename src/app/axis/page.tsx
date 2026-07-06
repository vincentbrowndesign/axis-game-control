"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AxisOsHeader,
  AxisOsNotice,
  AxisOsSection,
  AxisOsStatusChip,
} from "../../components/axis/AxisOsKit";
import type { AxisAccessLink, AxisEventContainer } from "../../lib/axis-event-container";

const MODULES = [
  { name: "Film", detail: "Video, replay, clips, report evidence" },
  { name: "Live", detail: "Capture, stream source, live markers" },
  { name: "Calibrate", detail: "Movement, footwork, body thresholds" },
  { name: "Studio", detail: "Reels, captions, sponsor recaps" },
  { name: "Intelligence", detail: "Tags, history, event memory" },
  { name: "Access", detail: "Paid links, clip packs, media passes" },
];

const SOURCE_LABELS: Record<string, string> = {
  attach_stream: "Stream",
  attach_video: "Video",
  record_now: "Record",
};

// Where an active event should resume when tapped from the dashboard.
function continueTarget(event: AxisEventContainer): { href: string; label: string } {
  if (event.status === "recording" || event.status === "live") {
    return { href: `/axis/events/${event.id}/record`, label: "Live now →" };
  }
  if (event.status === "review") {
    return { href: `/axis/events/${event.id}/review`, label: "Review moments →" };
  }
  if (event.status === "draft" && event.source_mode === "record_now") {
    return { href: `/axis/events/${event.id}/record`, label: "Go live →" };
  }
  return { href: `/axis/events/${event.id}`, label: "Open →" };
}

export default function AxisDashboardPage() {
  const [active, setActive] = useState<AxisEventContainer[]>([]);
  const [recent, setRecent] = useState<AxisEventContainer[]>([]);
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
      setActive(events.active ?? []);
      setRecent(events.recent ?? []);
      if (linksRes?.ok) {
        const body = (await linksRes.json()) as { accessLinks: AxisAccessLink[] };
        if (!cancelled) setLinks(body.accessLinks ?? []);
      }
      setState("ready");
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
        right={<span className="axis-os-tagline">Basketball performance intelligence</span>}
      />

      <section className="axis-os-hero">
        <Link className="axis-os-primary" href="/axis/events/new">
          Start Axis Event
        </Link>
        <p>Turn one event into film, data, reports, access, and player memory.</p>
      </section>

      <AxisOsSection label="Active events" title="Active">
        {state === "loading" && <AxisOsNotice tone="loading">Checking events…</AxisOsNotice>}
        {state === "offline" && (
          <AxisOsNotice tone="offline">Event memory is offline. Check Supabase configuration.</AxisOsNotice>
        )}
        {state === "error" && <AxisOsNotice tone="error">Events did not load. Pull to refresh.</AxisOsNotice>}
        {state === "ready" && !active.length && <AxisOsNotice tone="empty">No active event. Start one.</AxisOsNotice>}
        {state === "ready" &&
          active.map((event) => {
            const target = continueTarget(event);
            return (
              <Link className="axis-os-row" href={target.href} key={event.id}>
                <div className="axis-os-row-main">
                  <strong>{event.title}</strong>
                  <span>
                    {SOURCE_LABELS[event.source_mode] ?? event.source_mode} · {event.status}
                  </span>
                </div>
                <em className="axis-os-row-go">{target.label}</em>
              </Link>
            );
          })}
      </AxisOsSection>

      <AxisOsSection label="Recent events" title="Recent">
        {state === "ready" && !recent.length && <AxisOsNotice tone="empty">Finished events land here.</AxisOsNotice>}
        {state === "ready" &&
          recent.map((event) => (
            <Link className="axis-os-row" href={`/axis/events/${event.id}`} key={event.id}>
              <div className="axis-os-row-main">
                <strong>{event.title}</strong>
                <span>{SOURCE_LABELS[event.source_mode] ?? event.source_mode}</span>
              </div>
              <AxisOsStatusChip label={event.status} tone={event.status === "ready" ? "ready" : "idle"} />
            </Link>
          ))}
      </AxisOsSection>

      <AxisOsSection label="Access links" title="Money Links">
        {state === "ready" && !links.length && (
          <AxisOsNotice tone="empty">Access and payment links land here.</AxisOsNotice>
        )}
        {links.map((link) => (
          <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
            <div className="axis-os-row-main">
              <strong>{link.label}</strong>
              <span>
                {link.target_type} · {link.access_level}
              </span>
            </div>
            {typeof link.price_cents === "number" && (
              <em className="axis-os-row-go">${(link.price_cents / 100).toFixed(2)}</em>
            )}
          </a>
        ))}
      </AxisOsSection>

      <section className="axis-os-modules" aria-label="Product modules">
        <h2>Axis System</h2>
        <div>
          {MODULES.map((module) => (
            <article key={module.name}>
              <strong>Axis {module.name}</strong>
              <p>{module.detail}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
