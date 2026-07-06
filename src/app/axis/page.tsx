"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

export default function AxisDashboardPage() {
  const [active, setActive] = useState<AxisEventContainer[]>([]);
  const [recent, setRecent] = useState<AxisEventContainer[]>([]);
  const [links, setLinks] = useState<AxisAccessLink[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eventsRes, linksRes] = await Promise.all([
        fetch("/api/axis/events").catch(() => null),
        fetch("/api/axis/access-links").catch(() => null),
      ]);
      if (cancelled) return;
      if (!eventsRes?.ok) {
        setState("offline");
        return;
      }
      const events = (await eventsRes.json()) as { active: AxisEventContainer[]; recent: AxisEventContainer[] };
      setActive(events.active ?? []);
      setRecent(events.recent ?? []);
      if (linksRes?.ok) {
        const body = (await linksRes.json()) as { accessLinks: AxisAccessLink[] };
        setLinks(body.accessLinks ?? []);
      }
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="axis-os">
      <header className="axis-os-topbar">
        <div>
          <span>Trophy Labs</span>
          <strong>Axis</strong>
        </div>
        <span>Basketball performance intelligence</span>
      </header>

      <section className="axis-os-hero">
        <Link className="axis-os-primary" href="/axis/events/new">
          Start Axis Event
        </Link>
        <p>Turn one event into film, data, reports, access, and player memory.</p>
      </section>

      <section className="axis-os-list" aria-label="Active events">
        <h2>Active</h2>
        {state === "loading" && <p className="axis-os-empty">Checking events…</p>}
        {state === "offline" && <p className="axis-os-empty">Event memory is offline. Check Supabase configuration.</p>}
        {state === "ready" && !active.length && <p className="axis-os-empty">No active event. Start one.</p>}
        {active.map((event) => (
          <Link className="axis-os-row" href={`/axis/events/${event.id}`} key={event.id}>
            <strong>{event.title}</strong>
            <span>
              {SOURCE_LABELS[event.source_mode] ?? event.source_mode} · {event.status}
            </span>
          </Link>
        ))}
      </section>

      <section className="axis-os-list" aria-label="Recent events">
        <h2>Recent</h2>
        {state === "ready" && !recent.length && <p className="axis-os-empty">Finished events land here.</p>}
        {recent.map((event) => (
          <Link className="axis-os-row" href={`/axis/events/${event.id}`} key={event.id}>
            <strong>{event.title}</strong>
            <span>
              {SOURCE_LABELS[event.source_mode] ?? event.source_mode} · {event.status}
            </span>
          </Link>
        ))}
      </section>

      <section className="axis-os-list" aria-label="Access links">
        <h2>Money Links</h2>
        {state === "ready" && !links.length && <p className="axis-os-empty">Access and payment links land here.</p>}
        {links.map((link) => (
          <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
            <strong>{link.label}</strong>
            <span>
              {link.target_type} · {link.access_level}
              {typeof link.price_cents === "number" ? ` · $${(link.price_cents / 100).toFixed(2)}` : ""}
            </span>
          </a>
        ))}
      </section>

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
