"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AxisEventContainer, AxisMoment, AxisMomentLabel } from "../../../../../lib/axis-event-container";

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  const core = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours ? `${hours}:${core}` : core;
}

export default function AxisEventRecordPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;
  const [event, setEvent] = useState<AxisEventContainer | null>(null);
  const [moments, setMoments] = useState<AxisMoment[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/axis/events/${eventId}`).catch(() => null);
      if (cancelled) return;
      if (!response?.ok) {
        setError("Could not load this event.");
        return;
      }
      const body = (await response.json()) as { event: AxisEventContainer; moments: AxisMoment[] };
      if (cancelled) return;
      setEvent(body.event);
      setMoments(body.moments.slice(-6).reverse());
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!event?.recording_started_at) return;
    const startedMs = new Date(event.recording_started_at).getTime();
    const tick = () => setElapsed((Date.now() - startedMs) / 1000);
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [event?.recording_started_at]);

  async function goLive() {
    if (busy) return;
    setBusy(true);
    const response = await fetch(`/api/axis/events/${eventId}`, {
      body: JSON.stringify({ start_clock: true, status: "live" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Could not start the clock.");
      return;
    }
    const body = (await response.json()) as { event: AxisEventContainer };
    setEvent(body.event);
  }

  async function mark(label: AxisMomentLabel) {
    if (!event?.recording_started_at) return;
    const timestamp = (Date.now() - new Date(event.recording_started_at).getTime()) / 1000;
    const response = await fetch(`/api/axis/events/${eventId}/moments`, {
      body: JSON.stringify({ timestamp_seconds: timestamp, ui_label: label }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      setError(`Could not save the ${label} moment.`);
      return;
    }
    const body = (await response.json()) as { moment: AxisMoment };
    setMoments((current) => [body.moment, ...current].slice(0, 6));
    setError(null);
  }

  async function endLive() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/axis/events/${eventId}`, {
      body: JSON.stringify({ status: "review" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).catch(() => null);
    router.push(`/axis/events/${eventId}/review`);
  }

  const live = Boolean(event?.recording_started_at);

  return (
    <main className="axis-os axis-os--live">
      <header className="axis-os-topbar">
        <Link href={`/axis/events/${eventId}`}>{event?.title ?? "Event"}</Link>
        <strong className={live ? "axis-os-livebadge axis-os-livebadge--on" : "axis-os-livebadge"}>AXIS LIVE</strong>
      </header>

      <section className="axis-os-clock">
        <span>{live ? formatClock(elapsed) : "00:00"}</span>
      </section>

      {!live ? (
        <section className="axis-os-liveactions">
          <button className="axis-os-primary" disabled={busy || !event} onClick={goLive} type="button">
            Go Live
          </button>
          <p className="axis-os-empty">The clock starts once. KEEP and FIX stamp against it.</p>
        </section>
      ) : (
        <section className="axis-os-markgrid">
          <button className="axis-os-mark axis-os-mark--keep" onClick={() => mark("KEEP")} type="button">
            KEEP
          </button>
          <button className="axis-os-mark axis-os-mark--fix" onClick={() => mark("FIX")} type="button">
            FIX
          </button>
        </section>
      )}

      <section className="axis-os-list" aria-label="Latest moments">
        {moments.map((moment) => (
          <div className="axis-os-row" key={moment.id}>
            <strong>{moment.ui_label}</strong>
            <span>{formatClock(moment.timestamp_seconds)}</span>
          </div>
        ))}
      </section>

      {error && <p className="axis-os-error">{error}</p>}

      {live && (
        <footer className="axis-os-livefooter">
          <button disabled={busy} onClick={endLive} type="button">
            End Live · Review
          </button>
        </footer>
      )}
    </main>
  );
}
