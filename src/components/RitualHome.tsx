"use client";

import { useEffect, useMemo, useState } from "react";

type RitualState = "idle" | "active" | "complete";

const streakDays = ["M", "T", "W", "T", "F", "S", "S"];
const storageKey = "axis-ritual-save";

type SavedSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

type AxisSave = {
  activeSession: {
    id: string;
    startedAt: string;
  } | null;
  sessions: SavedSession[];
};

const defaultSave: AxisSave = {
  activeSession: null,
  sessions: [],
};

function formatTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
}

function formatDate(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(value);
}

function formatStamp(date: Date | string) {
  return `${formatDate(date)} / ${formatTime(date)}`;
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes < 1) return `${seconds}s`;

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function dayKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;

  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function calculateStreak(sessions: SavedSession[]) {
  const sessionDays = new Set(sessions.map((session) => dayKey(session.endedAt)));
  let cursor = new Date();
  let streak = 0;

  while (sessionDays.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }

  return streak;
}

function readSave(): AxisSave {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return defaultSave;

    const parsed = JSON.parse(stored) as Partial<AxisSave>;

    return {
      activeSession: parsed.activeSession ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return defaultSave;
  }
}

function writeSave(save: AxisSave) {
  window.localStorage.setItem(storageKey, JSON.stringify(save));
}

export function RitualHome() {
  const [save, setSave] = useState<AxisSave>(defaultSave);
  const [ritualState, setRitualState] = useState<RitualState>("idle");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const storedSave = readSave();
    setSave(storedSave);
    setRitualState(storedSave.activeSession ? "active" : "idle");
  }, []);

  useEffect(() => {
    if (!save.activeSession) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [save.activeSession]);

  const participationLabel = useMemo(() => {
    if (ritualState === "active") return "Active session";
    if (ritualState === "complete") return "History updated";
    return "Ready";
  }, [ritualState]);

  const latestSession = save.sessions[0] ?? null;
  const currentStreak = calculateStreak(save.sessions);
  const lastCheckIn = save.activeSession
    ? formatTime(save.activeSession.startedAt)
    : latestSession
      ? formatTime(latestSession.endedAt)
      : "None";
  const elapsedSeconds = save.activeSession
    ? Math.max(0, Math.floor((now - new Date(save.activeSession.startedAt).getTime()) / 1000))
    : latestSession?.durationSeconds ?? 0;
  const activeWeekDays = new Set(
    save.sessions
      .filter((session) => {
        const endedAt = new Date(session.endedAt);
        const diff = Date.now() - endedAt.getTime();
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      })
      .map((session) => dayKey(session.endedAt)),
  );

  function checkIn() {
    const nextSave = {
      ...save,
      activeSession: {
        id: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setNow(Date.now());
    setRitualState("active");
  }

  function checkOut() {
    if (!save.activeSession) return;

    const endedAt = new Date().toISOString();
    const durationSeconds = Math.max(
      0,
      Math.floor((new Date(endedAt).getTime() - new Date(save.activeSession.startedAt).getTime()) / 1000),
    );
    const completedSession = {
      id: save.activeSession.id,
      startedAt: save.activeSession.startedAt,
      endedAt,
      durationSeconds,
    };
    const nextSave = {
      activeSession: null,
      sessions: [completedSession, ...save.sessions].slice(0, 40),
    };

    writeSave(nextSave);
    setSave(nextSave);
    setRitualState("complete");
  }

  return (
    <main className="axis-shell">
      <section className="axis-surface" aria-label="Axis ritual home">
        <header className="axis-top">
          <div className="axis-identity">
            <p className="axis-meta">Axis</p>
            <h1>Athlete 01</h1>
          </div>

          <div className="axis-presence" aria-label="Participation data">
            <p>
              <span>Organization</span>
              <strong>Bridge</strong>
            </p>
            <p>
              <span>Streak</span>
              <strong>{currentStreak} days</strong>
            </p>
            <p>
              <span>Last check-in</span>
              <strong>{lastCheckIn}</strong>
            </p>
            <p>
              <span>Continuity</span>
              <strong>{participationLabel}</strong>
            </p>
          </div>
        </header>

        <section className="axis-ritual" aria-label="Check in ritual">
          <p className="axis-meta">Participation ritual</p>
          <button
            className="axis-check-button"
            onClick={ritualState === "active" ? undefined : checkIn}
            disabled={ritualState === "active"}
            type="button"
          >
            {ritualState === "active" ? "Active session" : "Check in"}
          </button>
          <div className="axis-active-state">
            <span>{participationLabel}</span>
            <strong>
              {save.activeSession
                ? `${formatDuration(elapsedSeconds)} active`
                : latestSession
                  ? `${formatDuration(latestSession.durationSeconds)} saved`
                  : "Session waiting"}
            </strong>
          </div>
          {ritualState === "active" ? (
            <button className="axis-checkout-button" onClick={checkOut} type="button">
              Check out
            </button>
          ) : null}
        </section>

        <footer className="axis-bottom" aria-label="Continuity records">
          <section className="axis-history" aria-label="Axis History">
            <header className="axis-history-header">
              <p className="axis-meta">Axis History</p>
              <strong>{save.sessions.length} sessions saved</strong>
            </header>

            <div className="axis-history-grid">
              <section className="axis-rail" aria-label="Streak progression">
                <span>Streak progression</span>
                <div>
                  {streakDays.map((day, index) => (
                    <span
                      className={index < activeWeekDays.size ? "axis-day axis-day-active" : "axis-day"}
                      key={`${day}-${index}`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </section>

              <section className="axis-session-ledger" aria-label="Recent sessions">
                <span>Recent sessions</span>
                <div>
                  {save.sessions.length ? (
                    save.sessions.slice(0, 4).map((session, index) => (
                      <article className="axis-session-row" key={session.id}>
                        <span>{formatStamp(session.endedAt)}</span>
                        <strong>{formatDuration(session.durationSeconds)}</strong>
                        <em>{index === 0 ? "Latest participation" : "Session memory"}</em>
                      </article>
                    ))
                  ) : (
                    <article className="axis-session-row">
                      <span>No sessions yet</span>
                      <strong>History waiting</strong>
                      <em>Check in to begin</em>
                    </article>
                  )}
                </div>
              </section>
            </div>

            <section className="axis-archive-strip" aria-label="Replay memory archive">
              <div>
                <span>Replay memory</span>
                <strong>{save.sessions.length ? "Continuity archive" : "No memory yet"}</strong>
              </div>
              <div>
                <span>Participation proof</span>
                <strong>{latestSession ? formatStamp(latestSession.endedAt) : "Waiting"}</strong>
              </div>
              <div>
                <span>Historical persistence</span>
                <strong>{save.sessions.length ? "Saved locally" : "Waiting"}</strong>
              </div>
            </section>
          </section>
        </footer>
      </section>
    </main>
  );
}
