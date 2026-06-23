"use client";

import type { AxisMemorySession, AxisMoment, AxisMomentReviewState } from "./AxisShell";

type Props = {
  elapsedSeconds: number;
  latestMoment: AxisMoment | null;
  onCorrect: (reviewState: AxisMomentReviewState) => void;
  onEndSession: () => void;
  onStartAnother: () => void;
  saveLabel: string;
  session: AxisMemorySession;
  status: "idle" | "starting" | "running" | "saved";
};

export function AxisSessionCard({
  elapsedSeconds,
  latestMoment,
  onCorrect,
  onEndSession,
  onStartAnother,
  saveLabel,
  session,
  status,
}: Props) {
  const saved = status === "saved";
  const timer = saved && session.endedAt
    ? formatElapsed(Math.max(0, Math.floor((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000)))
    : formatElapsed(elapsedSeconds);

  return (
    <section className="axis-card axis-session-card">
      <div className="axis-session-card__header">
        <div>
          <p className="axis-session-card__eyebrow">{saved ? "Saved to Memory" : "Active Session"}</p>
          <h1>{session.title}</h1>
        </div>
        <span className="axis-session-card__timer">{timer}</span>
      </div>

      <p className="axis-session-card__meta">
        {session.playerName ? `${session.playerName} - ` : ""}
        {session.objective} - {labelSessionType(session.sessionType)}
      </p>

      <div className="axis-session-card__moment">
        <small>{latestMoment ? "Last interpreted moment" : "Ready for the first moment"}</small>
        {latestMoment ? (
          <>
            <strong>{latestMoment.interpretedTitle}</strong>
            <span>{latestMoment.content}</span>
            <dl className="axis-moment-structure">
              <div>
                <dt>Situation</dt>
                <dd>{latestMoment.structure.situation}</dd>
              </div>
              <div>
                <dt>Actor</dt>
                <dd>{latestMoment.structure.actor}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>{latestMoment.structure.action}</dd>
              </div>
              <div>
                <dt>Outcome</dt>
                <dd>{latestMoment.structure.outcome}</dd>
              </div>
              <div>
                <dt>Cause</dt>
                <dd>{latestMoment.structure.cause}</dd>
              </div>
              <div>
                <dt>Correction</dt>
                <dd>{latestMoment.structure.correction}</dd>
              </div>
              <div>
                <dt>Evidence</dt>
                <dd>{latestMoment.structure.evidence}</dd>
              </div>
            </dl>
            <div className="axis-session-card__corrections" aria-label="Correction controls">
              <button className="axis-correction-chip" type="button" onClick={() => onCorrect("correct")}>
                Correct
              </button>
              <button className="axis-correction-chip" type="button" onClick={() => onCorrect("refine")}>
                Refine
              </button>
              <button className="axis-correction-chip" type="button" onClick={() => onCorrect("not_right")}>
                Not Right
              </button>
            </div>
          </>
        ) : (
          <span>Type a quick note or tap a moment when something happens.</span>
        )}
      </div>

      <div className="axis-session-card__actions">
        {saved ? (
          <>
            <button className="axis-primary" type="button" onClick={onStartAnother}>
              Start Another
            </button>
            <span className="axis-secondary">{saveLabel}</span>
          </>
        ) : (
          <>
            <span className="axis-secondary">{saveLabel}</span>
            <button className="axis-session-card__end" type="button" onClick={onEndSession}>
              End Session
            </button>
          </>
        )}
      </div>

      {saved && (
        <section className="axis-next-session-card" aria-label="Next Session Card">
          <small>Next Session Card</small>
          <strong>{session.nextFocus}</strong>
          <span>
            Start with {session.playerName || "the group"} and check whether this carryover still shows up.
          </span>
        </section>
      )}
    </section>
  );
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function labelSessionType(type: string) {
  if (type === "game") return "Game";
  if (type === "film") return "Film";
  if (type === "training") return "Training";
  if (type === "practice") return "Practice";
  return "Other";
}
