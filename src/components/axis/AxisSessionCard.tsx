"use client";

import type { AxisEvidence } from "../../axis/core/types";
import type { AxisMemorySession, AxisMoment } from "./AxisShell";

type Props = {
  elapsedSeconds: number;
  latestEvidence: AxisEvidence | null;
  latestMoment: AxisMoment | null;
  onEndSession: () => void;
  onStartAnother: () => void;
  saveLabel: string;
  session: AxisMemorySession;
  status: "idle" | "starting" | "running" | "saved";
};

export function AxisSessionCard({
  elapsedSeconds,
  latestEvidence,
  latestMoment,
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
          <p className="axis-session-card__eyebrow">{saved ? "Saved Memory" : "Today&apos;s Work"}</p>
          <h1>{session.title}</h1>
        </div>
        <span className="axis-session-card__timer">{timer}</span>
      </div>

      <p className="axis-session-card__meta">
        {session.playerName ? `${session.playerName} - ` : ""}
        {session.objective} - {labelSessionType(session.sessionType)}
      </p>

      <div className="axis-session-card__moment">
        <small>{latestEvidence ? "Saved read" : "Session memory"}</small>
        {latestEvidence ? (
          <>
            <strong>{latestEvidence.summary}</strong>
            <span>{latestEvidence.capturedAt ? `Saved ${formatResultTime(latestEvidence.capturedAt)}` : "Saved locally"}</span>
          </>
        ) : latestMoment ? (
          <>
            <strong>{latestMoment.interpretedTitle}</strong>
            <div className="axis-live-tags" aria-label="Moment tags">
              <span>{latestMoment.structure.situation}</span>
              <span>{latestMoment.structure.action}</span>
            </div>
            <span>{latestMoment.structure.outcome}</span>
          </>
        ) : (
          <span>Use the query toolbar to save the current player read.</span>
        )}
      </div>

      <div className="axis-session-card__actions">
        {saved ? (
          <>
            <button className="axis-primary" type="button" onClick={onStartAnother}>
              New Session
            </button>
            <span className="axis-secondary">{saveLabel}</span>
          </>
        ) : (
          <>
            <span className="axis-secondary">{saveLabel}</span>
            <button className="axis-session-card__end" type="button" onClick={onEndSession}>
              Save Session
            </button>
            <span className="axis-session-card__save-help">Memory saves when you finish.</span>
          </>
        )}
      </div>
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

function formatResultTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "locally";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
