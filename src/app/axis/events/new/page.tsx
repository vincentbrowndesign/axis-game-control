"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AxisOsNotice } from "../../../../components/axis/AxisOsKit";
import { AxisSuiteShell } from "../../../../components/axis/AxisSuiteShell";
import type { AxisEventType, AxisSourceMode } from "../../../../lib/axis-event-container";

const WHAT: Array<{ type: AxisEventType; name: string }> = [
  { name: "Game", type: "game" },
  { name: "Practice", type: "practice" },
  { name: "Training", type: "training" },
  { name: "Small Group", type: "small_group" },
  { name: "Private", type: "private" },
];

const HOW: Array<{ mode: AxisSourceMode; name: string; detail: string }> = [
  { detail: "Go live from this phone or a court camera", mode: "record_now", name: "Camera" },
  { detail: "Attach a video you already recorded", mode: "attach_video", name: "Upload Video" },
  { detail: "Paste a stream or replay link", mode: "attach_stream", name: "Add Replay Link" },
];

const WHO = ["Team", "Player", "Group"] as const;

const TYPE_LABELS: Record<string, string> = {
  game: "Game",
  practice: "Practice",
  private: "Private",
  small_group: "Small Group",
  training: "Training",
};

export default function AxisNewSessionPage() {
  const router = useRouter();
  const [what, setWhat] = useState<AxisEventType>("training");
  const [how, setHow] = useState<AxisSourceMode>("record_now");
  const [who, setWho] = useState<(typeof WHO)[number]>("Team");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ tone: "error" | "offline"; message: string } | null>(null);

  async function start() {
    if (saving) return;
    setSaving(true);
    setError(null);
    const trimmedName = name.trim();
    const dateLabel = new Date().toLocaleDateString("en-US", { day: "numeric", month: "short" });
    const title = [trimmedName, TYPE_LABELS[what], dateLabel].filter(Boolean).join(" · ");

    const response = await fetch("/api/axis/events", {
      body: JSON.stringify({
        event_type: what,
        source_mode: how,
        team_name: who === "Team" && trimmedName ? trimmedName : null,
        title,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response || response.status === 503) {
      setError({ message: "Session memory is offline right now.", tone: "offline" });
      setSaving(false);
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError({ message: body?.error ?? "Could not start the session.", tone: "error" });
      setSaving(false);
      return;
    }
    const body = (await response.json()) as { event: { id: string } };

    // If this session is for one player, put them on the roster right away.
    if (who === "Player" && trimmedName) {
      await fetch(`/api/axis/events/${body.event.id}/players`, {
        body: JSON.stringify({ display_name: trimmedName }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      }).catch(() => null);
    }

    router.push(how === "record_now" ? `/axis/events/${body.event.id}/record` : `/axis/events/${body.event.id}`);
  }

  return (
    <AxisSuiteShell backHref="/axis" backLabel="Axis" title="New Session">
      <section className="axis-os-form">
        <div className="axis-os-field">
          <span>What are we capturing?</span>
          <div className="axis-os-chiprow">
            {WHAT.map((option) => (
              <button
                className={option.type === what ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                key={option.type}
                onClick={() => setWhat(option.type)}
                type="button"
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div className="axis-os-field">
          <span>How are we capturing?</span>
          <div className="axis-os-sourcegrid">
            {HOW.map((option) => (
              <button
                className={option.mode === how ? "axis-os-source axis-os-source--on" : "axis-os-source"}
                key={option.mode}
                onClick={() => setHow(option.mode)}
                type="button"
              >
                <strong>{option.name}</strong>
                <p>{option.detail}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="axis-os-field">
          <span>Who is this for?</span>
          <div className="axis-os-chiprow">
            {WHO.map((option) => (
              <button
                className={option === who ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                key={option}
                onClick={() => setWho(option)}
                type="button"
              >
                {option}
              </button>
            ))}
          </div>
          <input
            className="axis-os-loneinput"
            onChange={(input) => setName(input.target.value)}
            placeholder={who === "Player" ? "Player name (optional)" : who === "Team" ? "Team name (optional)" : "Group name (optional)"}
            value={name}
          />
        </div>

        {error && <AxisOsNotice tone={error.tone}>{error.message}</AxisOsNotice>}

        <button className="axis-os-primary" disabled={saving} onClick={start} type="button">
          {saving ? "Starting…" : "Start"}
        </button>
      </section>
    </AxisSuiteShell>
  );
}
