"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AxisCameraPreview,
  type AxisCameraState,
} from "../../../../../components/axis/AxisCameraPreview";
import {
  AxisOsHeader,
  AxisOsNotice,
  AxisOsScreenState,
  formatAxisClock,
} from "../../../../../components/axis/AxisOsKit";
import type { AxisEventContainer, AxisMoment, AxisMomentLabel } from "../../../../../lib/axis-event-container";
import { useAxisEventDetail } from "../../../../../lib/use-axis-event-detail";

// On-screen coach language; the stored values stay KEEP / FIX.
const MARK_LABELS: Record<AxisMomentLabel, string> = { FIX: "Teach", KEEP: "Save" };

export default function AxisEventRecordPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const eventId = params.id;
  const { detail, mutate, state } = useAxisEventDetail(eventId);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMark, setLastMark] = useState<string | null>(null);
  const [cameraState, setCameraState] = useState<AxisCameraState>("off");
  const lastMarkTimer = useRef<number | null>(null);

  const event = detail?.event ?? null;
  const startedAt = event?.recording_started_at ?? null;
  const live = Boolean(startedAt);

  useEffect(() => {
    if (!startedAt) return;
    const startedMs = new Date(startedAt).getTime();
    const tick = () => setElapsed((Date.now() - startedMs) / 1000);
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    return () => {
      if (lastMarkTimer.current) window.clearTimeout(lastMarkTimer.current);
    };
  }, []);

  async function goLive() {
    if (busy) return;
    setBusy(true);
    setError(null);
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
    mutate((current) => ({ ...current, event: body.event }));
  }

  async function mark(label: AxisMomentLabel) {
    if (!startedAt) return;
    const timestamp = (Date.now() - new Date(startedAt).getTime()) / 1000;
    const response = await fetch(`/api/axis/events/${eventId}/moments`, {
      body: JSON.stringify({ timestamp_seconds: timestamp, ui_label: label }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response?.ok) {
      setError("Could not save that moment.");
      return;
    }
    const body = (await response.json()) as { moment: AxisMoment };
    mutate((current) => ({ ...current, moments: [...current.moments, body.moment] }));
    setError(null);
    setLastMark(`${MARK_LABELS[label]} · ${formatAxisClock(body.moment.timestamp_seconds)}`);
    if (lastMarkTimer.current) window.clearTimeout(lastMarkTimer.current);
    lastMarkTimer.current = window.setTimeout(() => setLastMark(null), 2000);
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

  if (!detail || !event) {
    return (
      <AxisOsScreenState
        backHref={`/axis/events/${eventId}`}
        title="Axis Live"
        tone={state === "loading" ? "loading" : state === "offline" ? "offline" : "error"}
      >
        {state === "loading" && "Loading session…"}
        {state === "offline" && "Session memory is offline right now."}
        {state === "error" && "Could not load this session."}
      </AxisOsScreenState>
    );
  }

  const recentMoments = detail.moments.slice(-5).reverse();

  return (
    <main className="axis-os axis-os--live">
      <AxisOsHeader
        backHref={`/axis/events/${eventId}`}
        backLabel={event.title}
        title="Axis Live"
        right={
          <strong className={live ? "axis-os-livebadge axis-os-livebadge--on" : "axis-os-livebadge"}>
            {live ? "● LIVE" : "STANDBY"}
          </strong>
        }
      />

      {/* Preview only: the stage shows the camera but nothing is recorded or saved. */}
      <section className="axis-os-stage" aria-label="Broadcast stage">
        <div
          className={[
            "axis-os-stage-surface",
            live ? "axis-os-stage-surface--live" : "",
            cameraState === "ready" ? "axis-os-stage-surface--camera" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="axis-os-stage-signal">{live ? "AXIS LIVE" : "STANDBY"}</span>
          <span className="axis-os-stage-clock">{live ? formatAxisClock(elapsed) : "00:00"}</span>
          {lastMark && <span className="axis-os-stage-mark">{lastMark}</span>}
          <AxisCameraPreview onStateChange={setCameraState} />
        </div>
      </section>

      {!live ? (
        <section className="axis-os-liveactions">
          <button className="axis-os-primary" disabled={busy} onClick={goLive} type="button">
            Go Live
          </button>
          <AxisOsNotice tone="empty">The clock starts once. Every tap gets a timestamp.</AxisOsNotice>
        </section>
      ) : (
        <section className="axis-os-markgrid">
          <button className="axis-os-mark axis-os-mark--keep" onClick={() => mark("KEEP")} type="button">
            <strong>Save</strong>
            <span>Keep it</span>
          </button>
          <button className="axis-os-mark axis-os-mark--fix" onClick={() => mark("FIX")} type="button">
            <strong>Teach</strong>
            <span>Fix it</span>
          </button>
        </section>
      )}

      <section className="axis-os-list" aria-label="Latest moments">
        {live && !recentMoments.length && <AxisOsNotice tone="empty">Moments appear here as you tap.</AxisOsNotice>}
        {recentMoments.map((moment) => (
          <div className="axis-os-row" key={moment.id}>
            <div className="axis-os-row-main">
              <strong className={moment.ui_label === "KEEP" ? "axis-os-keep" : "axis-os-fix"}>
                {MARK_LABELS[moment.ui_label as AxisMomentLabel]}
              </strong>
            </div>
            <em className="axis-os-row-go">{formatAxisClock(moment.timestamp_seconds)}</em>
          </div>
        ))}
      </section>

      {error && <AxisOsNotice tone="error">{error}</AxisOsNotice>}

      {live && (
        <footer className="axis-os-livefooter">
          <button disabled={busy} onClick={endLive} type="button">
            End Session
          </button>
        </footer>
      )}
    </main>
  );
}
