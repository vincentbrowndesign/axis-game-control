"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import {
  AxisOsFlow,
  type AxisOsFlowStep,
  AxisOsHeader,
  AxisOsNotice,
  AxisOsScreenState,
  AxisOsSection,
  AxisOsStatusChip,
} from "../../../../components/axis/AxisOsKit";
import type { AxisEventContainer, AxisEventMedia, AxisEventPlayer } from "../../../../lib/axis-event-container";
import { useAxisEventDetail } from "../../../../lib/use-axis-event-detail";

const MEDIA_KIND_BY_SOURCE: Record<string, string> = {
  attach_stream: "stream",
  attach_video: "upload",
  record_now: "recording",
};

function statusRank(status: AxisEventContainer["status"]) {
  if (status === "draft") return 0;
  if (status === "recording" || status === "live") return 1;
  if (status === "review" || status === "processing") return 2;
  return 3;
}

function nextStepHint(event: AxisEventContainer, momentCount: number) {
  const rank = statusRank(event.status);
  if (rank === 0) {
    return event.source_mode === "record_now"
      ? "Next: go live and mark KEEP / FIX."
      : "Next: attach media, then open Live to mark moments.";
  }
  if (rank === 1) return "Live now. Mark KEEP / FIX as it happens.";
  if (rank === 2) {
    return momentCount ? "Next: tag moments, then build the report." : "No moments yet. Go live to mark some.";
  }
  return "Saved to memory. Share access or start the next event.";
}

export default function AxisEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const { detail, mutate, state } = useAxisEventDetail(eventId);
  const [mediaUrl, setMediaUrl] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function attachMedia() {
    if (!detail || !mediaUrl.trim() || busy) return;
    setBusy(true);
    setActionError(null);
    const response = await fetch(`/api/axis/events/${eventId}/media`, {
      body: JSON.stringify({
        kind: MEDIA_KIND_BY_SOURCE[detail.event.source_mode] ?? "upload",
        url: mediaUrl,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setActionError("Could not attach media.");
      return;
    }
    const body = (await response.json()) as { media: AxisEventMedia };
    mutate((current) => ({ ...current, media: [...current.media, body.media] }));
    setMediaUrl("");
  }

  async function addPlayer() {
    if (!playerName.trim() || busy) return;
    setBusy(true);
    setActionError(null);
    const response = await fetch(`/api/axis/events/${eventId}/players`, {
      body: JSON.stringify({ display_name: playerName }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setActionError("Could not add the player.");
      return;
    }
    const body = (await response.json()) as { eventPlayer: AxisEventPlayer };
    mutate((current) => ({ ...current, players: [...current.players, body.eventPlayer] }));
    setPlayerName("");
  }

  async function markReady() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const response = await fetch(`/api/axis/events/${eventId}`, {
      body: JSON.stringify({ status: "ready" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setActionError("Could not mark the event ready.");
      return;
    }
    const body = (await response.json()) as { event: AxisEventContainer };
    mutate((current) => ({ ...current, event: body.event }));
  }

  if (!detail) {
    return (
      <AxisOsScreenState backHref="/axis" title="Event" tone={state === "loading" ? "loading" : state === "offline" ? "offline" : "error"}>
        {state === "loading" && "Loading event…"}
        {state === "offline" && "Event memory is offline. Check Supabase configuration."}
        {state === "error" && "Could not load this event."}
      </AxisOsScreenState>
    );
  }

  const { event, media, moments, players, reports } = detail;
  const keeps = moments.filter((moment) => moment.ui_label === "KEEP").length;
  const fixes = moments.length - keeps;
  const rank = statusRank(event.status);

  const flow: AxisOsFlowStep[] = [
    {
      detail: "Keep / Fix",
      href: `/axis/events/${eventId}/record`,
      label: "Live",
      state: rank === 1 ? "current" : rank > 1 ? "done" : "next",
    },
    {
      detail: moments.length ? `${keeps} keep · ${fixes} fix` : "Tag moments",
      href: `/axis/events/${eventId}/review`,
      label: "Review",
      state: rank === 2 ? "current" : rank > 2 ? "done" : "next",
    },
    {
      detail: reports.length ? "Draft saved" : "Package",
      href: `/axis/events/${eventId}/report`,
      label: "Report",
      state: reports.length ? (rank > 2 ? "done" : "current") : rank >= 2 ? "current" : "next",
    },
    {
      detail: "Memory",
      label: "Ready",
      state: rank >= 3 ? "done" : "next",
    },
  ];

  return (
    <main className="axis-os">
      <AxisOsHeader
        backHref="/axis"
        backLabel="Axis"
        kicker={`${event.event_type.replace("_", " ")}${event.team_name ? ` · ${event.team_name}` : ""}`}
        title={event.title}
        right={<AxisOsStatusChip label={event.status} tone={rank === 1 ? "live" : rank === 3 ? "ready" : "idle"} />}
      />

      <section className="axis-os-hint">
        <p>{nextStepHint(event, moments.length)}</p>
      </section>

      <AxisOsFlow steps={flow} />

      <AxisOsSection label="Media">
        {!media.length && <AxisOsNotice tone="empty">No media attached yet.</AxisOsNotice>}
        {media.map((item) => (
          <a className="axis-os-row" href={item.url ?? "#"} key={item.id} rel="noreferrer" target="_blank">
            <div className="axis-os-row-main">
              <strong>{item.kind}</strong>
              <span>{item.url}</span>
            </div>
          </a>
        ))}
        <div className="axis-os-inline">
          <input
            onChange={(input) => setMediaUrl(input.target.value)}
            placeholder="Paste video or stream link"
            value={mediaUrl}
          />
          <button disabled={!mediaUrl.trim() || busy} onClick={attachMedia} type="button">
            Attach
          </button>
        </div>
      </AxisOsSection>

      <AxisOsSection label="Players">
        {!players.length && <AxisOsNotice tone="empty">No players attached yet.</AxisOsNotice>}
        {players.map((player) => (
          <div className="axis-os-row" key={player.id}>
            <div className="axis-os-row-main">
              <strong>{player.display_name}</strong>
              <span>{player.jersey_number ? `#${player.jersey_number}` : "—"}</span>
            </div>
          </div>
        ))}
        <div className="axis-os-inline">
          <input onChange={(input) => setPlayerName(input.target.value)} placeholder="Player name" value={playerName} />
          <button disabled={!playerName.trim() || busy} onClick={addPlayer} type="button">
            Add
          </button>
        </div>
      </AxisOsSection>

      {actionError && <AxisOsNotice tone="error">{actionError}</AxisOsNotice>}

      {rank < 3 && (
        <section className="axis-os-list" aria-label="Finish">
          <button className="axis-os-primary axis-os-primary--quiet" disabled={busy} onClick={markReady} type="button">
            Mark Event Ready
          </button>
        </section>
      )}
    </main>
  );
}
