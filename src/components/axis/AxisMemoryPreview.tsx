"use client";

import type { AxisMemorySession } from "./AxisShell";

type Props = {
  compact?: boolean;
  sessions: AxisMemorySession[];
};

export function AxisMemoryPreview({ compact = false, sessions }: Props) {
  const visibleSessions = compact ? sessions.slice(0, 3) : sessions;

  return (
    <section className="axis-memory-preview" data-compact={compact}>
      <p>{compact ? "Memory Preview" : "Recent Memory"}</p>

      {visibleSessions.length === 0 ? (
        <div className="axis-memory-item">
          <strong>No memory yet.</strong>
          <span>Start a session and capture one moment. Axis will keep the useful shape here.</span>
        </div>
      ) : (
        <div className="axis-memory-list">
          {visibleSessions.map((session) => (
            <article className="axis-memory-item" key={session.id}>
              <small>
                {labelSavedState(session.savedState)} - {labelSessionType(session.sessionType)} - {formatSessionTime(session)}
              </small>
              <strong>{session.title}</strong>
              <span>
                {session.playerName ? `${session.playerName}: ` : ""}
                {session.objective}
              </span>
              <span>{session.moments.length} moments - Next: {session.nextFocus}</span>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function labelSessionType(type: string) {
  if (type === "game") return "Game";
  if (type === "film") return "Film";
  if (type === "training") return "Training";
  if (type === "practice") return "Practice";
  return "Other";
}

function labelSavedState(state: AxisMemorySession["savedState"]) {
  if (state === "saved") return "Saved";
  if (state === "needs_sign_in") return "Needs sign in";
  return "Local";
}

function formatSessionTime(session: AxisMemorySession) {
  const value = session.endedAt ?? session.startedAt;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Today";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}
