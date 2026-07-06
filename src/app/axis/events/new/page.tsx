"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AxisOsHeader, AxisOsNotice } from "../../../../components/axis/AxisOsKit";
import { AXIS_EVENT_TYPES, type AxisEventType, type AxisSourceMode } from "../../../../lib/axis-event-container";

const SOURCE_MODES: Array<{ mode: AxisSourceMode; name: string; detail: string }> = [
  { mode: "record_now", name: "Record Now", detail: "Live training, private session, practice segment" },
  { mode: "attach_video", name: "Attach Video", detail: "Phone video, AI camera file, uploaded replay" },
  { mode: "attach_stream", name: "Attach Stream", detail: "Facebook Live, YouTube Live, OBS, replay link" },
];

const TYPE_LABELS: Record<AxisEventType, string> = {
  calibrate: "Calibrate",
  clinic: "Clinic",
  film_review: "Film Review",
  game: "Game",
  other: "Other",
  practice: "Practice",
  private: "Private",
  small_group: "Small Group",
  training: "Training",
};

export default function AxisEventNewPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<AxisEventType>("training");
  const [sourceMode, setSourceMode] = useState<AxisSourceMode>("record_now");
  const [teamName, setTeamName] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ tone: "error" | "offline"; message: string } | null>(null);

  async function createEvent() {
    if (!title.trim() || saving) return;
    setSaving(true);
    setError(null);
    const response = await fetch("/api/axis/events", {
      body: JSON.stringify({
        event_type: eventType,
        location,
        source_mode: sourceMode,
        team_name: teamName,
        title,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => null);
    if (!response || response.status === 503) {
      setError({ message: "Event memory is offline. Check Supabase configuration.", tone: "offline" });
      setSaving(false);
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError({ message: body?.error ?? "Could not create the event.", tone: "error" });
      setSaving(false);
      return;
    }
    const body = (await response.json()) as { event: { id: string } };
    router.push(
      sourceMode === "record_now" ? `/axis/events/${body.event.id}/record` : `/axis/events/${body.event.id}`,
    );
  }

  return (
    <main className="axis-os">
      <AxisOsHeader backHref="/axis" backLabel="Axis" kicker="Trophy Labs" title="New Event" />

      <section className="axis-os-form">
        <label className="axis-os-field">
          <span>Event title</span>
          <input
            autoFocus
            onChange={(input) => setTitle(input.target.value)}
            placeholder="Tuesday small group"
            value={title}
          />
        </label>

        <div className="axis-os-field">
          <span>Event type</span>
          <div className="axis-os-chiprow">
            {AXIS_EVENT_TYPES.map((type) => (
              <button
                className={type === eventType ? "axis-os-chip axis-os-chip--on" : "axis-os-chip"}
                key={type}
                onClick={() => setEventType(type)}
                type="button"
              >
                {TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <div className="axis-os-field">
          <span>Source</span>
          <div className="axis-os-sourcegrid">
            {SOURCE_MODES.map((source) => (
              <button
                className={source.mode === sourceMode ? "axis-os-source axis-os-source--on" : "axis-os-source"}
                key={source.mode}
                onClick={() => setSourceMode(source.mode)}
                type="button"
              >
                <strong>{source.name}</strong>
                <p>{source.detail}</p>
              </button>
            ))}
          </div>
        </div>

        <label className="axis-os-field">
          <span>Team (optional)</span>
          <input onChange={(input) => setTeamName(input.target.value)} placeholder="Bridge 14U" value={teamName} />
        </label>

        <label className="axis-os-field">
          <span>Location (optional)</span>
          <input onChange={(input) => setLocation(input.target.value)} placeholder="Main gym" value={location} />
        </label>

        {error && <AxisOsNotice tone={error.tone}>{error.message}</AxisOsNotice>}

        <button className="axis-os-primary" disabled={!title.trim() || saving} onClick={createEvent} type="button">
          {saving ? "Creating…" : sourceMode === "record_now" ? "Create · Go Live" : "Create Event"}
        </button>
      </section>
    </main>
  );
}
