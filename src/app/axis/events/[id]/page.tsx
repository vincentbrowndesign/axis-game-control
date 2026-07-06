"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type {
  AxisAccessLink,
  AxisEventContainer,
  AxisEventMedia,
  AxisEventPlayer,
  AxisMoment,
} from "../../../../lib/axis-event-container";

type EventDetail = {
  accessLinks: AxisAccessLink[];
  event: AxisEventContainer;
  media: AxisEventMedia[];
  moments: AxisMoment[];
  players: AxisEventPlayer[];
};

const MEDIA_KIND_BY_SOURCE: Record<string, string> = {
  attach_stream: "stream",
  attach_video: "upload",
  record_now: "recording",
};

export default function AxisEventDetailPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/axis/events/${eventId}`).catch(() => null);
      if (cancelled) return;
      if (!response?.ok) {
        setError("Could not load this event.");
        return;
      }
      const body = (await response.json()) as EventDetail;
      if (cancelled) return;
      setDetail(body);
      setError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function attachMedia() {
    if (!detail || !mediaUrl.trim() || busy) return;
    setBusy(true);
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
      setError("Could not attach media.");
      return;
    }
    setMediaUrl("");
    reload();
  }

  async function addPlayer() {
    if (!playerName.trim() || busy) return;
    setBusy(true);
    const response = await fetch(`/api/axis/events/${eventId}/players`, {
      body: JSON.stringify({ display_name: playerName }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Could not add the player.");
      return;
    }
    setPlayerName("");
    reload();
  }

  async function markReady() {
    if (busy) return;
    setBusy(true);
    await fetch(`/api/axis/events/${eventId}`, {
      body: JSON.stringify({ status: "ready" }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).catch(() => null);
    setBusy(false);
    reload();
  }

  if (error && !detail) {
    return (
      <main className="axis-os">
        <header className="axis-os-topbar">
          <Link href="/axis">Axis</Link>
        </header>
        <p className="axis-os-empty">{error}</p>
      </main>
    );
  }
  if (!detail) {
    return (
      <main className="axis-os">
        <header className="axis-os-topbar">
          <Link href="/axis">Axis</Link>
        </header>
        <p className="axis-os-empty">Loading event…</p>
      </main>
    );
  }

  const keeps = detail.moments.filter((moment) => moment.ui_label === "KEEP").length;
  const fixes = detail.moments.length - keeps;

  return (
    <main className="axis-os">
      <header className="axis-os-topbar">
        <Link href="/axis">Axis</Link>
        <span>{detail.event.status}</span>
      </header>

      <section className="axis-os-eventhead">
        <h1>{detail.event.title}</h1>
        <p>
          {detail.event.event_type.replace("_", " ")}
          {detail.event.team_name ? ` · ${detail.event.team_name}` : ""}
          {detail.event.location ? ` · ${detail.event.location}` : ""}
        </p>
      </section>

      <section className="axis-os-actiongrid">
        <Link className="axis-os-action" href={`/axis/events/${eventId}/record`}>
          <strong>Live</strong>
          <span>Mark KEEP / FIX moments</span>
        </Link>
        <Link className="axis-os-action" href={`/axis/events/${eventId}/review`}>
          <strong>Review</strong>
          <span>
            {keeps} keep · {fixes} fix
          </span>
        </Link>
        <Link className="axis-os-action" href={`/axis/events/${eventId}/report`}>
          <strong>Report</strong>
          <span>Summary, corrections, access</span>
        </Link>
      </section>

      <section className="axis-os-list" aria-label="Media">
        <h2>Media</h2>
        {!detail.media.length && <p className="axis-os-empty">No media attached yet.</p>}
        {detail.media.map((media) => (
          <a className="axis-os-row" href={media.url ?? "#"} key={media.id} rel="noreferrer" target="_blank">
            <strong>{media.kind}</strong>
            <span>{media.url}</span>
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
      </section>

      <section className="axis-os-list" aria-label="Players">
        <h2>Players</h2>
        {!detail.players.length && <p className="axis-os-empty">No players attached yet.</p>}
        {detail.players.map((player) => (
          <div className="axis-os-row" key={player.id}>
            <strong>{player.display_name}</strong>
            <span>{player.jersey_number ? `#${player.jersey_number}` : "—"}</span>
          </div>
        ))}
        <div className="axis-os-inline">
          <input onChange={(input) => setPlayerName(input.target.value)} placeholder="Player name" value={playerName} />
          <button disabled={!playerName.trim() || busy} onClick={addPlayer} type="button">
            Add
          </button>
        </div>
      </section>

      {detail.event.status !== "ready" && detail.event.status !== "archived" && (
        <section className="axis-os-list">
          <button className="axis-os-primary axis-os-primary--quiet" disabled={busy} onClick={markReady} type="button">
            Mark Event Ready
          </button>
        </section>
      )}
      {error && <p className="axis-os-error">{error}</p>}
    </main>
  );
}
