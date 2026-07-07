"use client";

import Link from "next/link";
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
import {
  AXIS_EVENT_STATE_LABELS,
  type AxisEventContainer,
  type AxisEventMedia,
  type AxisEventPlayer,
} from "../../../../lib/axis-event-container";
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
      : "Next: attach media, then go live to mark moments.";
  }
  if (rank === 1) return "Live now. Mark KEEP / FIX as it happens.";
  if (rank === 2) {
    return momentCount ? "Next: tag moments, then build the package." : "No moments yet. Go live to mark some.";
  }
  return "Saved to memory. Share access or start the next event.";
}

export default function AxisEventWorkspacePage() {
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
      <AxisOsScreenState
        backHref="/axis"
        title="Event"
        tone={state === "loading" ? "loading" : state === "offline" ? "offline" : "error"}
      >
        {state === "loading" && "Loading event…"}
        {state === "offline" && "Event memory is offline. Check Supabase configuration."}
        {state === "error" && "Could not load this event."}
      </AxisOsScreenState>
    );
  }

  const { accessLinks, event, media, moments, players, reports } = detail;
  const keeps = moments.filter((moment) => moment.ui_label === "KEEP").length;
  const fixes = moments.length - keeps;
  const rank = statusRank(event.status);

  const flow: AxisOsFlowStep[] = [
    {
      detail: "Media · Players",
      label: "Setup",
      state: rank === 0 ? "current" : "done",
    },
    {
      detail: "Keep / Fix",
      href: `/axis/events/${eventId}/record`,
      label: "Live",
      state: rank === 1 ? "current" : rank > 1 ? "done" : "next",
    },
    {
      detail: moments.length ? `${keeps} keep · ${fixes} fix` : "Tag moments",
      href: `/axis/events/${eventId}/review`,
      label: "Moments",
      state: rank > 2 || (rank === 2 && reports.length > 0) ? "done" : rank === 2 ? "current" : "next",
    },
    {
      detail: reports.length ? "Draft saved" : "Report + access",
      href: `/axis/events/${eventId}/report`,
      label: "Package",
      state: rank > 2 ? "done" : rank === 2 && reports.length > 0 ? "current" : "next",
    },
    {
      detail: "Memory",
      label: "Ready",
      state: rank >= 3 ? "done" : "next",
    },
  ];

  // One primary action per screen: the next recommended step.
  const primary =
    rank === 0 && event.source_mode !== "record_now" && !media.length
      ? { href: "#axis-setup", label: "Attach Media" }
      : rank <= 1
        ? { href: `/axis/events/${eventId}/record`, label: rank === 1 ? "Back to Live" : "Go Live" }
        : rank === 2
          ? reports.length || !moments.length
            ? { href: `/axis/events/${eventId}/report`, label: "Build Package" }
            : { href: `/axis/events/${eventId}/review`, label: "Tag Moments" }
          : null;

  return (
    <main className="axis-os">
      <AxisOsHeader
        backHref="/axis"
        backLabel="Axis"
        kicker={`${event.event_type.replace("_", " ")}${event.team_name ? ` · ${event.team_name}` : ""}`}
        title={event.title}
        right={
          <AxisOsStatusChip
            label={AXIS_EVENT_STATE_LABELS[event.status]}
            tone={rank === 1 ? "live" : rank === 3 ? "ready" : "idle"}
          />
        }
      />

      <section className="axis-os-hint">
        <p>{nextStepHint(event, moments.length)}</p>
      </section>

      {primary && (
        <section className="axis-os-hero">
          <Link className="axis-os-primary" href={primary.href}>
            {primary.label}
          </Link>
        </section>
      )}

      <AxisOsFlow steps={flow} />

      <span id="axis-setup" />
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

      <AxisOsSection label="Access">
        {!accessLinks.length && (
          <AxisOsNotice tone="empty">No access links yet. Build the package to attach one.</AxisOsNotice>
        )}
        {accessLinks.map((link) => (
          <a className="axis-os-row" href={link.url} key={link.id} rel="noreferrer" target="_blank">
            <div className="axis-os-row-main">
              <strong>{link.label}</strong>
              <span>{link.target_type}</span>
            </div>
            {typeof link.price_cents === "number" && (
              <em className="axis-os-row-go">${(link.price_cents / 100).toFixed(2)}</em>
            )}
          </a>
        ))}
      </AxisOsSection>

      {actionError && <AxisOsNotice tone="error">{actionError}</AxisOsNotice>}

      {rank < 3 && (
        <section className="axis-os-list" aria-label="Finish">
          <button className="axis-os-primary axis-os-primary--quiet" disabled={busy} onClick={markReady} type="button">
            Mark Ready · Save to Memory
          </button>
        </section>
      )}
    </main>
  );
}
