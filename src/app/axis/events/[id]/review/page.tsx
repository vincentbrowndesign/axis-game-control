"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AXIS_LENS_TAGS,
  AXIS_OUTPUT_TARGETS,
  type AxisEventContainer,
  type AxisEventPlayer,
  type AxisMoment,
} from "../../../../../lib/axis-event-container";

function formatClock(totalSeconds: number) {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function AxisEventReviewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const [event, setEvent] = useState<AxisEventContainer | null>(null);
  const [moments, setMoments] = useState<AxisMoment[]>([]);
  const [players, setPlayers] = useState<AxisEventPlayer[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [eventPlayerId, setEventPlayerId] = useState<string>("");
  const [lensTags, setLensTags] = useState<string[]>([]);
  const [outcome, setOutcome] = useState("");
  const [outputTargets, setOutputTargets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const body = (await response.json()) as {
        event: AxisEventContainer;
        moments: AxisMoment[];
        players: AxisEventPlayer[];
      };
      if (cancelled) return;
      setEvent(body.event);
      setMoments(body.moments);
      setPlayers(body.players);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, reloadKey]);

  function openMoment(moment: AxisMoment) {
    setOpenId(moment.id);
    setNote(moment.note ?? "");
    setEventPlayerId(moment.event_player_id ?? "");
    setLensTags(moment.lens_tags ?? []);
    setOutcome((moment.outcome_tags ?? []).join(", "));
    setOutputTargets(moment.output_targets ?? []);
    setError(null);
  }

  async function saveMoment(momentId: string) {
    if (busy) return;
    setBusy(true);
    const linkedPlayer = players.find((player) => player.id === eventPlayerId);
    const response = await fetch(`/api/axis/moments/${momentId}`, {
      body: JSON.stringify({
        event_player_id: eventPlayerId || null,
        lens_tags: lensTags,
        note,
        outcome_tags: outcome
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        output_targets: outputTargets,
        player_id: linkedPlayer?.player_id ?? null,
      }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      setError("Could not save the moment.");
      return;
    }
    setOpenId(null);
    setReloadKey((key) => key + 1);
  }

  return (
    <main className="axis-os">
      <header className="axis-os-topbar">
        <Link href={`/axis/events/${eventId}`}>{event?.title ?? "Event"}</Link>
        <span>Review</span>
      </header>

      <section className="axis-os-list" aria-label="Moments">
        {!moments.length && <p className="axis-os-empty">No moments yet. Mark KEEP or FIX on the live screen.</p>}
        {moments.map((moment) => (
          <div className="axis-os-moment" key={moment.id}>
            <button className="axis-os-row" onClick={() => openMoment(moment)} type="button">
              <strong className={moment.ui_label === "KEEP" ? "axis-os-keep" : "axis-os-fix"}>{moment.ui_label}</strong>
              <span>
                {formatClock(moment.timestamp_seconds)}
                {moment.event_player_id
                  ? ` · ${players.find((player) => player.id === moment.event_player_id)?.display_name ?? "player"}`
                  : ""}
                {moment.lens_tags.length ? ` · ${moment.lens_tags.join(" ")}` : ""}
              </span>
            </button>

            {openId === moment.id && (
              <div className="axis-os-editor">
                <div className="axis-os-field">
                  <span>Player</span>
                  <div className="axis-os-chiprow">
                    <button
                      className={!eventPlayerId ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                      onClick={() => setEventPlayerId("")}
                      type="button"
                    >
                      Team
                    </button>
                    {players.map((player) => (
                      <button
                        className={player.id === eventPlayerId ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                        key={player.id}
                        onClick={() => setEventPlayerId(player.id)}
                        type="button"
                      >
                        {player.display_name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="axis-os-field">
                  <span>Lens</span>
                  <div className="axis-os-chiprow">
                    {AXIS_LENS_TAGS.map((tag) => (
                      <button
                        className={lensTags.includes(tag) ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                        key={tag}
                        onClick={() => setLensTags((current) => toggle(current, tag))}
                        type="button"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="axis-os-field">
                  <span>Outcome</span>
                  <input
                    onChange={(input) => setOutcome(input.target.value)}
                    placeholder="made shot, drift right"
                    value={outcome}
                  />
                </label>

                <div className="axis-os-field">
                  <span>Output</span>
                  <div className="axis-os-chiprow">
                    {AXIS_OUTPUT_TARGETS.map((target) => (
                      <button
                        className={outputTargets.includes(target) ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                        key={target}
                        onClick={() => setOutputTargets((current) => toggle(current, target))}
                        type="button"
                      >
                        {target.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="axis-os-field">
                  <span>Note</span>
                  <input onChange={(input) => setNote(input.target.value)} placeholder="What happened" value={note} />
                </label>

                <button className="axis-os-primary" disabled={busy} onClick={() => saveMoment(moment.id)} type="button">
                  Save Moment
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      {error && <p className="axis-os-error">{error}</p>}

      <footer className="axis-os-livefooter">
        <Link href={`/axis/events/${eventId}/report`}>Build Report</Link>
      </footer>
    </main>
  );
}
