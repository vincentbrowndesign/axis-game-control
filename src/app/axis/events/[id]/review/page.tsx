"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AxisOsHeader,
  AxisOsNotice,
  AxisOsScreenState,
  AxisOsStatusChip,
  formatAxisClock,
} from "../../../../../components/axis/AxisOsKit";
import {
  AXIS_LENS_TAGS,
  AXIS_OUTPUT_TARGETS,
  type AxisMoment,
} from "../../../../../lib/axis-event-container";
import { useAxisEventDetail } from "../../../../../lib/use-axis-event-detail";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function AxisEventReviewPage() {
  const params = useParams<{ id: string }>();
  const eventId = params.id;
  const { detail, mutate, state } = useAxisEventDetail(eventId);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [eventPlayerId, setEventPlayerId] = useState<string>("");
  const [lensTags, setLensTags] = useState<string[]>([]);
  const [outcome, setOutcome] = useState("");
  const [outputTargets, setOutputTargets] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  function openMoment(moment: AxisMoment) {
    if (openId === moment.id) {
      setOpenId(null);
      return;
    }
    setOpenId(moment.id);
    setNote(moment.note ?? "");
    setEventPlayerId(moment.event_player_id ?? "");
    setLensTags(moment.lens_tags ?? []);
    setOutcome((moment.outcome_tags ?? []).join(", "));
    setOutputTargets(moment.output_targets ?? []);
    setError(null);
  }

  async function saveMoment(momentId: string) {
    if (busy || !detail) return;
    setBusy(true);
    const linkedPlayer = detail.players.find((player) => player.id === eventPlayerId);
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
    const body = (await response.json()) as { moment: AxisMoment };
    mutate((current) => ({
      ...current,
      moments: current.moments.map((moment) => (moment.id === momentId ? body.moment : moment)),
    }));
    setOpenId(null);
    setError(null);
    setSavedId(momentId);
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedId(null), 2000);
  }

  if (!detail) {
    return (
      <AxisOsScreenState
        backHref={`/axis/events/${eventId}`}
        title="Review"
        tone={state === "loading" ? "loading" : state === "offline" ? "offline" : "error"}
      >
        {state === "loading" && "Loading moments…"}
        {state === "offline" && "Event memory is offline. Check Supabase configuration."}
        {state === "error" && "Could not load this event."}
      </AxisOsScreenState>
    );
  }

  const { event, moments, players } = detail;
  const tagged = moments.filter(
    (moment) => moment.event_player_id || moment.lens_tags.length || moment.output_targets.length,
  ).length;

  return (
    <main className="axis-os">
      <AxisOsHeader
        backHref={`/axis/events/${eventId}`}
        backLabel={event.title}
        title="Review"
        right={<AxisOsStatusChip label={`${tagged}/${moments.length} tagged`} tone={tagged === moments.length && moments.length > 0 ? "ready" : "idle"} />}
      />

      <section className="axis-os-list" aria-label="Moments">
        {!moments.length && (
          <AxisOsNotice tone="empty">No moments yet. Mark KEEP or FIX on the live screen.</AxisOsNotice>
        )}
        {moments.map((moment) => {
          const playerName = moment.event_player_id
            ? players.find((player) => player.id === moment.event_player_id)?.display_name
            : null;
          const open = openId === moment.id;
          return (
            <article
              className={`axis-os-card axis-os-card--${moment.ui_label === "KEEP" ? "keep" : "fix"}${open ? " axis-os-card--open" : ""}`}
              key={moment.id}
            >
              <button className="axis-os-card-head" onClick={() => openMoment(moment)} type="button">
                <div className="axis-os-card-title">
                  <strong className={moment.ui_label === "KEEP" ? "axis-os-keep" : "axis-os-fix"}>
                    {moment.ui_label}
                  </strong>
                  <em>{formatAxisClock(moment.timestamp_seconds)}</em>
                  {playerName && <span>{playerName}</span>}
                  {savedId === moment.id && <span className="axis-os-savedchip">Saved</span>}
                </div>
                {(moment.lens_tags.length > 0 || moment.output_targets.length > 0 || moment.outcome_tags.length > 0) && (
                  <div className="axis-os-card-tags">
                    {moment.lens_tags.map((tag) => (
                      <span className="axis-os-minichip" key={`lens-${tag}`}>
                        {tag}
                      </span>
                    ))}
                    {moment.outcome_tags.map((tag) => (
                      <span className="axis-os-minichip axis-os-minichip--outcome" key={`outcome-${tag}`}>
                        {tag}
                      </span>
                    ))}
                    {moment.output_targets.map((target) => (
                      <span className="axis-os-minichip axis-os-minichip--target" key={`target-${target}`}>
                        → {target.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                )}
                {moment.note && <p className="axis-os-card-note">{moment.note}</p>}
              </button>

              {open && (
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
                    {!players.length && (
                      <AxisOsNotice tone="empty">
                        Add players on the <Link href={`/axis/events/${eventId}`}>event screen</Link> to tag them here.
                      </AxisOsNotice>
                    )}
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

                  <button
                    className="axis-os-primary"
                    disabled={busy}
                    onClick={() => saveMoment(moment.id)}
                    type="button"
                  >
                    {busy ? "Saving…" : "Save Moment"}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {error && <AxisOsNotice tone="error">{error}</AxisOsNotice>}

      <footer className="axis-os-livefooter">
        <Link href={`/axis/events/${eventId}/report`}>Build Report →</Link>
      </footer>
    </main>
  );
}
