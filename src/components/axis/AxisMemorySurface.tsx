"use client";

import { useState } from "react";
import type { AxisMemorySession } from "./AxisShell";
import { AxisMemoryPreview } from "./AxisMemoryPreview";
import { AxisSurfaceHeader } from "./AxisSurfaceHeader";

type Props = {
  sessions: AxisMemorySession[];
};

export function AxisMemorySurface({ sessions }: Props) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? null;

  return (
    <section className="axis-surface">
      <AxisSurfaceHeader
        eyebrow="Memory"
        title="Recent Memory"
        body="Saved sessions, local sessions, and carryovers stay together here."
      />

      {selectedSession ? (
        <MemoryDetail session={selectedSession} onBack={() => setSelectedSessionId(null)} />
      ) : (
        <>
          <AxisMemoryPreview sessions={sessions} />
          {sessions.length > 0 && (
            <div className="axis-memory-actions" aria-label="Open memory detail">
              {sessions.slice(0, 6).map((session) => (
                <button key={session.id} type="button" onClick={() => setSelectedSessionId(session.id)}>
                  Review {session.title}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function MemoryDetail({ onBack, session }: { onBack: () => void; session: AxisMemorySession }) {
  const latestMoment = session.moments.at(-1);

  return (
    <article className="axis-memory-detail">
      <button className="axis-secondary axis-memory-detail__back" type="button" onClick={onBack}>
        Back to memory
      </button>

      <small>{labelSavedState(session.savedState)} - {labelSessionType(session.sessionType)}</small>
      <h3>{session.title}</h3>
      <span>
        {session.playerName ? `${session.playerName}: ` : ""}
        {session.objective}
      </span>

      {latestMoment ? (
        <section className="axis-memory-detail__section">
          <small>Last interpreted moment</small>
          <strong>{latestMoment.interpretedTitle}</strong>
          <span>{latestMoment.content}</span>
          <span>Correction: {latestMoment.structure.correction}</span>
          <span>Evidence: {latestMoment.structure.evidence || "Manual note"}</span>
        </section>
      ) : (
        <section className="axis-memory-detail__section">
          <small>Moments</small>
          <strong>No moment cards saved here yet.</strong>
          <span>This saved session came from the current session index. Full moment memory is kept when moments were captured on this device.</span>
        </section>
      )}

      {session.moments.length > 0 && (
        <section className="axis-memory-detail__section">
          <small>Session moments</small>
          <div className="axis-memory-moment-list">
            {session.moments.map((moment) => (
              <article key={moment.id}>
                <strong>{moment.interpretedTitle}</strong>
                <span>{moment.structure.situation} - {moment.structure.correction}</span>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="axis-next-session-card" aria-label="Next Session Card">
        <small>Next Session Card</small>
        <strong>{session.nextFocus}</strong>
        <span>Start here before adding new work.</span>
      </section>
    </article>
  );
}

function labelSavedState(state: AxisMemorySession["savedState"]) {
  if (state === "saved") return "Saved";
  if (state === "needs_sign_in") return "Needs sign in";
  return "Local";
}

function labelSessionType(type: string) {
  if (type === "game") return "Game";
  if (type === "film") return "Film";
  if (type === "training") return "Training";
  if (type === "practice") return "Practice";
  return "Other";
}
