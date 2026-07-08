"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AxisOsNotice, AxisOsSection } from "../../../components/axis/AxisOsKit";
import { AxisSuiteShell } from "../../../components/axis/AxisSuiteShell";
import type { AxisAccessLink, AxisEventContainer } from "../../../lib/axis-event-container";

export default function AxisPackagesPage() {
  const [links, setLinks] = useState<AxisAccessLink[]>([]);
  const [needsPackage, setNeedsPackage] = useState<AxisEventContainer[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error" | "offline">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [linksRes, eventsRes] = await Promise.all([
        fetch("/api/axis/access-links").catch(() => null),
        fetch("/api/axis/events").catch(() => null),
      ]);
      if (cancelled) return;
      if (!linksRes || linksRes.status === 503) {
        setState("offline");
        return;
      }
      if (!linksRes.ok) {
        setState("error");
        return;
      }
      const linkBody = (await linksRes.json()) as { accessLinks: AxisAccessLink[] };
      if (cancelled) return;
      setLinks(linkBody.accessLinks ?? []);
      if (eventsRes?.ok) {
        const events = (await eventsRes.json()) as { active: AxisEventContainer[] };
        if (!cancelled) setNeedsPackage((events.active ?? []).filter((event) => event.status === "review"));
      }
      setState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AxisSuiteShell backHref="/axis" backLabel="Axis" title="Packages">
      <section className="axis-os-hint">
        <p>Packages turn a session into a recap, teaching points, and a link you can share or sell.</p>
      </section>

      <AxisOsSection label="Ready to build" title="Ready to build">
        {state === "loading" && <AxisOsNotice tone="loading">Loading packages…</AxisOsNotice>}
        {state === "offline" && <AxisOsNotice tone="offline">Session memory is offline right now.</AxisOsNotice>}
        {state === "error" && <AxisOsNotice tone="error">Packages did not load. Pull to refresh.</AxisOsNotice>}
        {state === "ready" && !needsPackage.length && (
          <AxisOsNotice tone="empty">Sessions with tagged moments show up here, ready to package.</AxisOsNotice>
        )}
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

      {state === "ready" && (
        <AxisOsSection label="Shared" title="Shared">
          {!links.length && <AxisOsNotice tone="empty">Links you share or sell land here.</AxisOsNotice>}
          {links.map((link) => (
            <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
              <div className="axis-os-row-main">
                <strong>{link.label}</strong>
                <span>Shared</span>
              </div>
              {typeof link.price_cents === "number" && (
                <em className="axis-os-row-go">${(link.price_cents / 100).toFixed(2)}</em>
              )}
            </a>
          ))}
        </AxisOsSection>
      )}
    </AxisSuiteShell>
  );
}
