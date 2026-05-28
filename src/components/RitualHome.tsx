"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "../lib/supabase-browser";

type RitualState = "idle" | "active" | "saving" | "complete";
type AuthPhase = "checking" | "entry" | "restoring" | "authenticated";
type ParticipationMode =
  | "Training"
  | "Station Work"
  | "Shooting"
  | "Conditioning"
  | "Small Group"
  | "Scrimmage"
  | "Open Gym";

const streakDays = ["M", "T", "W", "T", "F", "S", "S"];
const participationModes: ParticipationMode[] = [
  "Training",
  "Station Work",
  "Shooting",
  "Conditioning",
  "Small Group",
  "Scrimmage",
  "Open Gym",
];
const defaultParticipationMode: ParticipationMode = "Training";
const storageKey = "axis-ritual-save";
const identityStorageKey = "axis-identity-save";

type SavedSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  mode?: ParticipationMode;
  recordingAttached?: boolean;
  participants?: string[];
  participantCount?: number;
  activeParticipantCount?: number;
};

type ActiveParticipant = {
  id: string;
  name: string;
  joinedAt: string;
  leftAt?: string;
};

type AxisSave = {
  activeSession: {
    id: string;
    startedAt: string;
    mode?: ParticipationMode;
    recordingAttached?: boolean;
    participants?: ActiveParticipant[];
  } | null;
  sessions: SavedSession[];
};

type AxisIdentity = {
  email: string;
  id: string;
  restoredAt: string;
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

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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

    const activeSession = parsed.activeSession
      ? {
          id: parsed.activeSession.id,
          startedAt: parsed.activeSession.startedAt,
          mode: parsed.activeSession.mode ?? defaultParticipationMode,
          recordingAttached: Boolean(parsed.activeSession.recordingAttached),
          participants: Array.isArray(parsed.activeSession.participants) ? parsed.activeSession.participants : [],
        }
      : null;

    return {
      activeSession,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    };
  } catch {
    return defaultSave;
  }
}

function writeSave(save: AxisSave) {
  window.localStorage.setItem(storageKey, JSON.stringify(save));
}

function readIdentity(): AxisIdentity | null {
  try {
    const stored = window.localStorage.getItem(identityStorageKey);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<AxisIdentity>;
    if (!parsed.email || !parsed.restoredAt) return null;

    return {
      email: parsed.email,
      id: parsed.id ?? parsed.email,
      restoredAt: parsed.restoredAt,
    };
  } catch {
    return null;
  }
}

function writeIdentity(identity: AxisIdentity) {
  window.localStorage.setItem(identityStorageKey, JSON.stringify(identity));
}

export function RitualHome() {
  const [authPhase, setAuthPhase] = useState<AuthPhase>("checking");
  const [identity, setIdentity] = useState<AxisIdentity | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [save, setSave] = useState<AxisSave>(defaultSave);
  const [ritualState, setRitualState] = useState<RitualState>("idle");
  const [now, setNow] = useState(() => Date.now());
  const [latestSavedSessionId, setLatestSavedSessionId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = getSupabaseBrowserClient();

    async function restoreSession() {
      const storedSave = readSave();
      let storedIdentity: AxisIdentity | null = null;

      if (supabase) {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error("Unable to restore Supabase session", error);
        const user = data.session?.user;

        if (user) {
          storedIdentity = {
            email: user.email ?? "athlete@axis.local",
            id: user.id,
            restoredAt: new Date().toISOString(),
          };
          writeIdentity(storedIdentity);
        }
      } else {
        storedIdentity = readIdentity();
      }

      if (!isMounted) return;

      setIdentity(storedIdentity);
      setSave(storedSave);
      setRitualState(storedSave.activeSession ? "active" : "idle");
      setAuthPhase(storedIdentity ? "restoring" : "entry");
    }

    void restoreSession();

    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (!session?.user) {
        window.localStorage.removeItem(identityStorageKey);
        setIdentity(null);
        setAuthPhase("entry");
        return;
      }

      const nextIdentity = {
        email: session.user.email ?? "athlete@axis.local",
        id: session.user.id,
        restoredAt: new Date().toISOString(),
      };

      writeIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setAuthPhase("restoring");
    });

    return () => {
      isMounted = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authPhase !== "restoring") return;

    const timeout = window.setTimeout(() => {
      setAuthPhase("authenticated");
    }, 950);

    return () => window.clearTimeout(timeout);
  }, [authPhase]);

  useEffect(() => {
    if (!save.activeSession) return;

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [save.activeSession]);

  const participationLabel = useMemo(() => {
    if (ritualState === "active") return "Group session active";
    if (ritualState === "saving") return "Saving history";
    if (ritualState === "complete") return "History grew";
    return "Ready";
  }, [ritualState]);

  const latestSession = save.sessions[0] ?? null;
  const athleteLabel = identity?.email ? identity.email.split("@")[0] || "Athlete 01" : "Athlete 01";
  const currentMode = save.activeSession?.mode ?? latestSession?.mode ?? defaultParticipationMode;
  const isRecordingAttached = Boolean(save.activeSession?.recordingAttached);
  const recordingLabel = isRecordingAttached ? "Recording attached" : "Recording off";
  const activeParticipants = save.activeSession?.participants ?? [];
  const presentParticipants = activeParticipants.filter((participant) => !participant.leftAt);
  const inactiveParticipants = activeParticipants.filter((participant) => participant.leftAt);
  const activeParticipantCount = presentParticipants.length;
  const participantCount = activeParticipants.length;
  const currentStreak = calculateStreak(save.sessions);
  const lastCheckIn = save.activeSession
    ? formatTime(save.activeSession.startedAt)
    : latestSession
      ? formatTime(latestSession.endedAt)
      : "None";
  const elapsedSeconds = save.activeSession
    ? Math.max(0, Math.floor((now - new Date(save.activeSession.startedAt).getTime()) / 1000))
    : latestSession?.durationSeconds ?? 0;
  const sessionSummary = save.activeSession
    ? `Started ${formatTime(save.activeSession.startedAt)}`
    : latestSession
      ? `${formatDuration(latestSession.durationSeconds)} saved`
      : "Session waiting";
  const activeTimerLabel = save.activeSession ? `${formatDuration(elapsedSeconds)} preserved` : null;
  const historyStatus =
    ritualState === "complete" && latestSession
      ? `History grew / ${formatDuration(latestSession.durationSeconds)}`
      : `${save.sessions.length} sessions saved`;
  const activeWeekDays = new Set(
    save.sessions
      .filter((session) => {
        const endedAt = new Date(session.endedAt);
        const diff = Date.now() - endedAt.getTime();
        return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
      })
      .map((session) => dayKey(session.endedAt)),
  );

  async function enterAxis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthMessage("");

    const trimmedEmail = email.trim();
    const supabase = getSupabaseBrowserClient();

    if (!trimmedEmail || !password) {
      setAuthMessage("Email and password required.");
      return;
    }

    if (!supabase) {
      const nextIdentity = {
        email: trimmedEmail,
        id: trimmedEmail,
        restoredAt: new Date().toISOString(),
      };

      writeIdentity(nextIdentity);
      setIdentity(nextIdentity);
      setEmail("");
      setPassword("");
      setAuthPhase("restoring");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });

    if (error || !data.user) {
      console.error("Unable to enter Axis", error);
      setAuthMessage("Unable to enter.");
      return;
    }

    const nextIdentity = {
      email: data.user.email ?? trimmedEmail,
      id: data.user.id,
      restoredAt: new Date().toISOString(),
    };

    writeIdentity(nextIdentity);
    setIdentity(nextIdentity);
    setEmail("");
    setPassword("");
    setAuthPhase("restoring");
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient();
    const savedRitual = window.localStorage.getItem(storageKey);

    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) console.error("Unable to sign out", error);
    }

    if (savedRitual && !window.localStorage.getItem(storageKey)) {
      window.localStorage.setItem(storageKey, savedRitual);
    }

    window.localStorage.removeItem(identityStorageKey);
    setIdentity(null);
    setEmail("");
    setPassword("");
    setAuthMessage("");
    setRitualState(save.activeSession ? "active" : "idle");
    setAuthPhase("entry");
  }

  function checkIn() {
    const starterName = athleteLabel.trim() || "Athlete";
    const nextSave = {
      ...save,
      activeSession: {
        id: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
        mode: defaultParticipationMode,
        recordingAttached: false,
        participants: [
          {
            id: identity?.id ?? starterName,
            name: starterName,
            joinedAt: new Date().toISOString(),
          },
        ],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setNow(Date.now());
    setRitualState("active");
    setLatestSavedSessionId(null);
  }

  function changeMode(mode: ParticipationMode) {
    if (!save.activeSession) return;

    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        mode,
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  function toggleRecordingAttachment() {
    if (!save.activeSession) return;

    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        recordingAttached: !isRecordingAttached,
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
  }

  function addParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!save.activeSession) return;

    const name = participantName.trim();
    if (!name) return;

    const existingParticipant = activeParticipants.find(
      (participant) => participant.name.toLowerCase() === name.toLowerCase(),
    );

    if (existingParticipant && !existingParticipant.leftAt) {
      setParticipantName("");
      return;
    }

    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        participants: existingParticipant
          ? activeParticipants.map((participant) =>
              participant.id === existingParticipant.id
                ? {
                    ...participant,
                    joinedAt: new Date().toISOString(),
                    leftAt: undefined,
                  }
                : participant,
            )
          : [
              ...activeParticipants,
              {
                id: crypto.randomUUID(),
                name,
                joinedAt: new Date().toISOString(),
              },
            ],
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
    setParticipantName("");
  }

  function removeParticipant(participantId: string) {
    if (!save.activeSession) return;

    const nextSave = {
      ...save,
      activeSession: {
        ...save.activeSession,
        participants: activeParticipants.map((participant) =>
          participant.id === participantId
            ? {
                ...participant,
                leftAt: new Date().toISOString(),
              }
            : participant,
        ),
      },
    };

    writeSave(nextSave);
    setSave(nextSave);
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
      mode: save.activeSession.mode ?? defaultParticipationMode,
      recordingAttached: Boolean(save.activeSession.recordingAttached),
      participants: activeParticipants.map((participant) => participant.name),
      participantCount,
      activeParticipantCount,
    };
    const nextSave = {
      activeSession: null,
      sessions: [completedSession, ...save.sessions].slice(0, 40),
    };

    setRitualState("saving");
    writeSave(nextSave);
    setSave(nextSave);
    setLatestSavedSessionId(completedSession.id);

    window.setTimeout(() => {
      setRitualState("complete");
    }, 520);
  }

  if (authPhase === "checking" || authPhase === "restoring") {
    return (
      <main className="axis-shell axis-entry-shell">
        <section className="axis-restore" aria-label="Restoring continuity">
          <p className="axis-meta">Identity restored</p>
          <h1>Restoring continuity...</h1>
          <div className="axis-restore-line" aria-hidden="true" />
          <div className="axis-restore-rail" aria-label="Continuity restoration steps">
            <span>Loading session...</span>
            <span>Restoring history...</span>
            <span>Return ready</span>
          </div>
        </section>
      </main>
    );
  }

  if (authPhase === "entry" || !identity) {
    return (
      <main className="axis-shell axis-entry-shell">
        <section className="axis-entry" aria-label="Axis entry">
          <header className="axis-entry-top">
            <span>Axis</span>
            <span>Continuity system</span>
            <span>Athletic history</span>
          </header>

          <section className="axis-entry-center">
            <p className="axis-meta">{isSupabaseConfigured() ? "Identity required" : "Local mode"}</p>
            <h1>Enter Axis</h1>
          </section>

          <form className="axis-entry-form" onSubmit={enterAxis}>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="athlete@axis"
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Password</span>
              <input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="save data key"
                type="password"
                value={password}
              />
            </label>
            <button type="submit">Enter</button>
          </form>
          {authMessage ? <p className="axis-auth-message">{authMessage}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="axis-shell">
      <section className="axis-surface" aria-label="Axis ritual home">
        <header className="axis-top">
          <div className="axis-identity">
            <p className="axis-meta">Axis</p>
            <h1>{athleteLabel}</h1>
            <button className="axis-sign-out" onClick={signOut} type="button">
              Sign out
            </button>
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
            <p>
              <span>Mode</span>
              <strong>{currentMode}</strong>
            </p>
            <p>
              <span>Memory</span>
              <strong>{recordingLabel}</strong>
            </p>
          </div>
        </header>

        <section className="axis-ritual" aria-label="Check in ritual" data-state={ritualState}>
          <p className="axis-meta">Participation ritual</p>
          <button
            className="axis-check-button"
            onClick={ritualState === "active" || ritualState === "saving" ? undefined : checkIn}
            disabled={ritualState === "active" || ritualState === "saving"}
            type="button"
          >
            {ritualState === "active" ? "Group active" : ritualState === "saving" ? "Saving" : "Check in"}
          </button>
          <div className="axis-active-state">
            <span>{participationLabel}</span>
            <strong>{sessionSummary}</strong>
            {activeTimerLabel ? <em>{activeTimerLabel}</em> : null}
          </div>
          {save.activeSession ? (
            <section className="axis-group-session" aria-label="Active group session">
              <header>
                <span>Participation mode</span>
                <strong>{currentMode}</strong>
              </header>
              <div className="axis-mode-list" aria-label="Participation modes">
                {participationModes.map((mode) => (
                  <button
                    aria-pressed={currentMode === mode}
                    key={mode}
                    onClick={() => changeMode(mode)}
                    type="button"
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <header>
                <span>Participation memory</span>
                <strong>{recordingLabel}</strong>
              </header>
              <button
                className="axis-recording-toggle"
                data-attached={isRecordingAttached}
                onClick={toggleRecordingAttachment}
                type="button"
              >
                {isRecordingAttached ? "Recording attached" : "Recording off"}
              </button>
              <header>
                <span>Active participants</span>
                <strong>{formatCount(activeParticipantCount, "athlete")}</strong>
              </header>
              <div className="axis-participant-list">
                {presentParticipants.map((participant) => (
                  <span className="axis-participant-token" key={participant.id}>
                    <span>{participant.name}</span>
                    <button onClick={() => removeParticipant(participant.id)} type="button">
                      Remove
                    </button>
                  </span>
                ))}
              </div>
              {inactiveParticipants.length ? (
                <>
                  <header>
                    <span>Inactive</span>
                    <strong>{formatCount(inactiveParticipants.length, "athlete")}</strong>
                  </header>
                  <div className="axis-participant-list axis-participant-list-inactive">
                    {inactiveParticipants.map((participant) => (
                      <span className="axis-participant-token" key={participant.id}>
                        <span>{participant.name}</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
              <form className="axis-participant-form" onSubmit={addParticipant}>
                <label>
                  <span>Add athlete</span>
                  <input
                    onChange={(event) => setParticipantName(event.target.value)}
                    placeholder="Name"
                    type="text"
                    value={participantName}
                  />
                </label>
                <button type="submit">Check in</button>
              </form>
            </section>
          ) : null}
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
              <strong>{historyStatus}</strong>
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
                      <article
                        className={
                          index === 0 || session.id === latestSavedSessionId
                            ? "axis-session-row axis-session-row-latest"
                            : "axis-session-row"
                        }
                        key={session.id}
                      >
                        <span>{formatStamp(session.endedAt)}</span>
                        <strong>{formatDuration(session.durationSeconds)}</strong>
                        <em>
                          {session.participantCount
                            ? `${formatCount(session.participantCount, "athlete")} / ${session.recordingAttached ? "Memory attached" : "Memory off"}`
                            : session.mode
                              ? session.mode
                              : index === 0
                                ? "Latest participation"
                                : "Session memory"}
                        </em>
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
