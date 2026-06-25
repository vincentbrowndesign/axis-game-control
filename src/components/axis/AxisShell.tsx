"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createAxisSessionDraftRequest, listAxisSessionDraftsRequest } from "../../lib/axis/client";
import type { AxisSession } from "../../lib/axis/types";
import { useAxisAuth } from "../../app/axis/axis-auth-control";
import { AxisAskSurface } from "./AxisAskSurface";
import { AxisBottomNav, type AxisNavKey } from "./AxisBottomNav";
import { AxisEmptyState } from "./AxisEmptyState";
import { AxisInputDock } from "./AxisInputDock";
import { AxisMemoryPreview } from "./AxisMemoryPreview";
import { AxisMemorySurface } from "./AxisMemorySurface";
import { AxisPlayersSurface } from "./AxisPlayersSurface";
import { AxisSessionCard } from "./AxisSessionCard";
import { AxisToolsSurface } from "./AxisToolsSurface";
import { AxisTopBar } from "./AxisTopBar";

export type AxisMomentType = "typed" | "tap";

export type AxisMomentStructure = {
  situation: string;
  actor: string;
  action: string;
  outcome: string;
  cause: string;
  correction: string;
  evidence: string;
};

export type AxisMomentReviewState = "needs_review" | "correct" | "refine" | "not_right";

export type AxisMoment = {
  id: string;
  content: string;
  createdAt: string;
  elapsedSeconds: number;
  interpretedTitle: string;
  needsReview: boolean;
  reviewState: AxisMomentReviewState;
  structure: AxisMomentStructure;
  type: AxisMomentType;
};

export type AxisMemorySession = {
  id: string;
  title: string;
  playerName?: string;
  objective: string;
  sessionType: string;
  startedAt: string;
  endedAt?: string;
  moments: AxisMoment[];
  nextFocus: string;
  savedState: "local" | "needs_sign_in" | "saved";
};

type AxisSessionType = AxisSession["sessionType"];
type AxisShellStatus = "idle" | "starting" | "running" | "saved";
type AxisShellProps = {
  initialNav?: AxisNavKey;
};

const localMemoryKey = "axis-a1-mobile-memory";

const sessionTypes: Array<{ label: string; value: AxisSessionType }> = [
  { label: "Practice", value: "practice" },
  { label: "Training", value: "training" },
  { label: "Game", value: "game" },
  { label: "Film", value: "film" },
  { label: "Other", value: "other" },
];

const quickMarks = [
  { label: "Paint Touch", content: "Got paint" },
  { label: "Extra Pass", content: "Extra pass was there" },
  { label: "Late", content: "Too late" },
  { label: "Footwork", content: "Feet too narrow" },
  { label: "Spacing", content: "Spacing was off" },
  { label: "Finish", content: "Finish at the rim" },
  { label: "Turnover", content: "Turnover" },
  { label: "Great Rep", content: "The current focus worked on this rep" },
];

export function AxisShell({ initialNav = "session" }: AxisShellProps) {
  const auth = useAxisAuth();
  const [activeNav, setActiveNav] = useState<AxisNavKey>(initialNav);
  const [shellStatus, setShellStatus] = useState<AxisShellStatus>("idle");
  const [sessionTitle, setSessionTitle] = useState("Today's Work");
  const [playerName, setPlayerName] = useState("");
  const [objective, setObjective] = useState("");
  const [sessionType, setSessionType] = useState<AxisSessionType>("practice");
  const [activeSession, setActiveSession] = useState<AxisMemorySession | null>(null);
  const [initialLocalMemory] = useState(loadLocalMemory);
  const [recentSessions, setRecentSessions] = useState<AxisMemorySession[]>(initialLocalMemory.sessions);
  const [backendDrafts, setBackendDrafts] = useState<AxisSession[]>([]);
  const [momentDraft, setMomentDraft] = useState("");
  const [saveLabel, setSaveLabel] = useState("Local");
  const [errorMessage] = useState(initialLocalMemory.errorMessage);

  useEffect(() => {
    try {
      window.localStorage.setItem(localMemoryKey, JSON.stringify({ recentSessions }));
    } catch {
      // Local fallback should never block the session.
    }
  }, [recentSessions]);

  useEffect(() => {
    if (auth.status !== "signed_in") return;
    let cancelled = false;
    listAxisSessionDraftsRequest()
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setBackendDrafts(result.sessions.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setBackendDrafts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.status]);

  const elapsedSeconds = useSessionTimer(shellStatus === "running", activeSession?.startedAt);
  const latestMoment = activeSession?.moments.at(-1) ?? null;

  const topStatus = useMemo(() => {
    if (auth.status === "loading") return "Checking sign in";
    if (auth.status === "signed_in") return shellStatus === "saved" ? "Saved to Memory" : "Signed in";
    if (auth.status === "error") return "Local mode";
    return "Sign in to save memory";
  }, [auth.status, shellStatus]);

  async function startSession(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const now = new Date().toISOString();
    const title = sessionTitle.trim() || "Today's Work";
    const nextSession: AxisMemorySession = {
      id: createLocalId(),
      title,
      playerName: playerName.trim() || undefined,
      objective: objective.trim() || "Open run",
      sessionType,
      startedAt: now,
      moments: [],
      nextFocus: "Capture one real moment, then name the correction before saving memory.",
      savedState: "local",
    };

    setActiveSession(nextSession);
    setShellStatus("starting");
    setSaveLabel(auth.status === "signed_in" ? "Memory will save when you finish" : "Sign in to save memory");
    setShellStatus("running");
  }

  function markMoment(content: string, type: AxisMomentType = "tap") {
    const trimmed = content.trim();
    if (!trimmed || !activeSession) return;

    const now = new Date().toISOString();
    const nextMoment: AxisMoment = {
      id: createLocalId(),
      content: trimmed,
      createdAt: now,
      elapsedSeconds,
      interpretedTitle: interpretMoment(trimmed),
      needsReview: true,
      reviewState: "needs_review",
      structure: structureMoment(trimmed, activeSession),
      type,
    };

    setActiveSession({
      ...activeSession,
      moments: [...activeSession.moments, nextMoment],
      nextFocus: getNextFocus(trimmed),
    });
    setMomentDraft("");
    setSaveLabel("Memory updated locally");
  }

  function submitMoment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    markMoment(momentDraft, "typed");
  }

  function correctLatestMoment(reviewState: AxisMomentReviewState) {
    if (!activeSession || !latestMoment) return;
    setActiveSession({
      ...activeSession,
      moments: activeSession.moments.map((moment) =>
        moment.id === latestMoment.id
          ? {
              ...moment,
              needsReview: reviewState !== "correct",
              reviewState,
              structure: {
                ...moment.structure,
                correction: getCorrectionForReview(reviewState, moment.structure.correction),
              },
            }
          : moment,
      ),
      nextFocus: getNextFocusForReview(reviewState, latestMoment),
    });
    setSaveLabel("Moment updated locally");
  }

  function rememberSession(session: AxisMemorySession) {
    setRecentSessions((sessions) => [session, ...sessions.filter((stored) => stored.id !== session.id)].slice(0, 8));
  }

  async function endSession() {
    if (!activeSession) return;
    const endedAt = new Date().toISOString();
    const localEnded: AxisMemorySession = {
      ...activeSession,
      endedAt,
      savedState: auth.status === "signed_in" ? "local" : "needs_sign_in",
    };

    if (auth.status !== "signed_in") {
      rememberSession(localEnded);
      setActiveSession(localEnded);
      setShellStatus("saved");
      setSaveLabel("Saved locally");
      return;
    }

    setSaveLabel("Saving memory...");

    try {
      const saved = await createAxisSessionDraftRequest({
        createdAt: localEnded.startedAt,
        durationSeconds: getSessionDurationSeconds(localEnded),
        endedAt: localEnded.endedAt,
        focus: localEnded.objective,
        id: localEnded.id,
        moments: localEnded.moments.map(mapMomentForBackend),
        nextSessionCard: createNextSessionCard(localEnded),
        playerName: localEnded.playerName,
        searchableText: createSearchableText(localEnded),
        sessionType: coerceAxisSessionType(localEnded.sessionType),
        source: getSessionMemorySource(localEnded),
        startedAt: localEnded.startedAt,
        status: "complete",
        summary: createSessionSummary(localEnded),
        title: localEnded.title,
      });

      if (saved.ok) {
        const persistedEnded: AxisMemorySession = {
          ...localEnded,
          id: saved.session.id,
          savedState: "saved",
          title: saved.session.title,
        };
        rememberSession(persistedEnded);
        setActiveSession(persistedEnded);
        setSaveLabel("Saved to Memory");
        setBackendDrafts((sessions) => [saved.session, ...sessions.filter((session) => session.id !== saved.session.id)].slice(0, 5));
      } else {
        rememberSession({ ...localEnded, savedState: "local" });
        setActiveSession({ ...localEnded, savedState: "local" });
        setSaveLabel("Saved locally");
      }
    } catch {
      rememberSession({ ...localEnded, savedState: "local" });
      setActiveSession({ ...localEnded, savedState: "local" });
      setSaveLabel("Saved locally");
    }

    setShellStatus("saved");
  }

  function startAnother() {
    setActiveSession(null);
    setShellStatus("idle");
    setMomentDraft("");
    setSaveLabel(auth.status === "signed_in" ? "Ready" : "Sign in to save memory");
  }

  async function signOut() {
    await auth.signOut();
    setBackendDrafts([]);
    setSaveLabel("Local");
  }

  const recentMemory = mergeRecentMemory(recentSessions, backendDrafts);

  return (
    <main className="axis-mobile-shell">
      <AxisTopBar
        authStatus={auth.status}
        email={auth.email}
        onSignIn={auth.signInWithGoogle}
        onSignOut={signOut}
        status={topStatus}
      />

      <section className="axis-mobile-shell__body" aria-label="Axis session memory">
        {activeNav === "session" && (
          <>
            {!activeSession && (
              <AxisEmptyState
                errorMessage={errorMessage}
                objective={objective}
                onObjectiveChange={setObjective}
                onPlayerNameChange={setPlayerName}
                onSessionTitleChange={setSessionTitle}
                onSessionTypeChange={setSessionType}
                onStartSession={startSession}
                playerName={playerName}
                saveLabel={saveLabel}
                sessionTitle={sessionTitle}
                sessionType={sessionType}
                sessionTypes={sessionTypes}
                signedIn={auth.status === "signed_in"}
              />
            )}

            {activeSession && (
              <AxisSessionCard
                elapsedSeconds={elapsedSeconds}
                latestMoment={latestMoment}
                onCorrect={correctLatestMoment}
                onEndSession={endSession}
                onStartAnother={startAnother}
                saveLabel={saveLabel}
                session={activeSession}
                status={shellStatus}
              />
            )}
          </>
        )}

        {activeNav === "ask" && (
          <AxisAskSurface sessions={recentMemory} />
        )}

        {activeNav === "memory" && (
          auth.status === "signed_in" ? (
            <AxisMemorySurface sessions={recentMemory} />
          ) : (
            <section className="axis-panel">
              <div className="axis-surface-header">
                <p>Review</p>
                <h2>Sign in to review memory.</h2>
                <span>Vision can preview. Log works locally. Review and saved memory need an account.</span>
              </div>
              <button className="axis-primary" type="button" onClick={() => void auth.signInWithGoogle()}>
                Sign in
              </button>
            </section>
          )
        )}

        {activeNav === "players" && (
          <AxisPlayersSurface sessions={recentMemory} onStartSession={() => setActiveNav("session")} />
        )}

        {activeNav === "tools" && (
          <AxisToolsSurface />
        )}

        {activeNav === "session" && activeSession && shellStatus === "running" && (
          <AxisInputDock
            draft={momentDraft}
            onDraftChange={setMomentDraft}
            onQuickMark={(content) => markMoment(content)}
            quickMarks={quickMarks}
            onSubmit={submitMoment}
          />
        )}

        {activeNav === "session" && <AxisMemoryPreview sessions={recentMemory.slice(0, 3)} compact />}
      </section>

      <AxisBottomNav active={activeNav} onChange={setActiveNav} />

      <style jsx global>{axisShellStyles}</style>
    </main>
  );
}

function useSessionTimer(active: boolean, startedAt?: string) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active || !startedAt) return undefined;
    const started = Date.parse(startedAt);
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [active, startedAt]);

  return elapsed;
}

function mergeRecentMemory(localSessions: AxisMemorySession[], backendDrafts: AxisSession[]): AxisMemorySession[] {
  const mappedDrafts: AxisMemorySession[] = backendDrafts.map(mapBackendSessionToMemory);

  const byId = new Map<string, AxisMemorySession>();
  [...localSessions, ...mappedDrafts].forEach((session) => byId.set(session.id, session));
  return [...byId.values()].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}

function coerceAxisSessionType(type: string): AxisSessionType {
  if (type === "training" || type === "game" || type === "film" || type === "practice" || type === "other") {
    return type;
  }

  return "practice";
}

function mapBackendSessionToMemory(session: AxisSession): AxisMemorySession {
  const moments = (session.moments ?? []).map((moment) => ({
    id: moment.id,
    content: moment.content,
    createdAt: moment.createdAt,
    elapsedSeconds: moment.elapsedSeconds,
    interpretedTitle: moment.interpretedTitle,
    needsReview: moment.reviewState !== "correct",
    reviewState: moment.reviewState,
    structure: moment.structure,
    type: moment.source,
  }));

  return {
    id: session.id,
    title: session.title,
    playerName: session.playerName,
    objective: session.focus || session.title,
    sessionType: session.sessionType,
    startedAt: session.startedAt || session.createdAt,
    ...(session.endedAt ? { endedAt: session.endedAt } : {}),
    moments,
    nextFocus: session.nextSessionCard?.nextFocus || "Reopen this saved session and continue the carryover.",
    savedState: "saved",
  };
}

function mapMomentForBackend(moment: AxisMoment): NonNullable<AxisSession["moments"]>[number] {
  return {
    id: moment.id,
    content: moment.content,
    createdAt: moment.createdAt,
    elapsedSeconds: moment.elapsedSeconds,
    interpretedTitle: moment.interpretedTitle,
    reviewState: moment.reviewState,
    source: moment.type,
    structure: moment.structure,
  };
}

function createNextSessionCard(session: AxisMemorySession): NonNullable<AxisSession["nextSessionCard"]> {
  return {
    title: "Next Session Card",
    nextFocus: session.nextFocus,
    carryover: session.moments.at(-1)?.structure.correction || session.nextFocus,
    reminders: [
      session.playerName ? `Start with ${session.playerName}.` : "Start with the group.",
      "Check the carryover before adding new work.",
    ],
  };
}

function createSessionSummary(session: AxisMemorySession) {
  const momentCount = session.moments.length;
  const latestMoment = session.moments.at(-1);
  if (!latestMoment) return `${session.title}: ${session.objective}. No moments were captured yet.`;
  return `${session.title}: ${session.objective}. ${momentCount} moment${momentCount === 1 ? "" : "s"} captured. Latest: ${latestMoment.interpretedTitle}`;
}

function createSearchableText(session: AxisMemorySession) {
  return [
    session.title,
    session.sessionType,
    session.objective,
    session.playerName,
    createSessionSummary(session),
    session.nextFocus,
    ...session.moments.flatMap((moment) => [
      moment.interpretedTitle,
      moment.content,
      moment.structure.situation,
      moment.structure.actor,
      moment.structure.action,
      moment.structure.outcome,
      moment.structure.cause,
      moment.structure.correction,
      moment.structure.evidence,
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function getSessionDurationSeconds(session: AxisMemorySession) {
  if (!session.endedAt) return undefined;
  return Math.max(0, Math.floor((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000));
}

function getSessionMemorySource(session: AxisMemorySession): "mixed" | "tap" | "typed" {
  const hasTyped = session.moments.some((moment) => moment.type === "typed");
  const hasTap = session.moments.some((moment) => moment.type === "tap");
  if (hasTyped && hasTap) return "mixed";
  if (hasTap) return "tap";
  return "typed";
}

function interpretMoment(input: string) {
  const normalized = input.toLowerCase();
  if (hasPaintExtraRead(normalized)) return "Got paint, missed the extra.";
  if (normalized.includes("horns")) return "Too slow getting back to horns.";
  if (normalized.includes("feet too narrow")) return "Feet too narrow.";
  if (normalized.includes("again") || normalized.includes("run it again")) return "Repeat the rep and fix the detail.";
  if (normalized.includes("great") || normalized.includes("worked")) return "Current focus worked on this rep.";
  if (normalized.includes("feet") || normalized.includes("footwork")) return "Footwork changed the rep.";
  if (normalized.includes("extra pass")) return "Extra pass decision captured.";
  if (normalized.includes("spacing")) return "Spacing changed the rep.";
  if (normalized.includes("finish")) return "Finishing moment captured.";
  if (normalized.includes("shot")) return "Shot moment captured.";
  if (normalized.includes("turnover")) return "Possession broke down.";
  if (normalized.includes("late")) return "Timing was late.";
  if (normalized.includes("paint")) return "Paint touch created the decision.";
  return input.length > 48 ? `${input.slice(0, 45)}...` : input;
}

function getNextFocus(input: string) {
  const normalized = input.toLowerCase();
  if (hasPaintExtraRead(normalized)) return "Recognize help earlier and make the extra pass on time.";
  if (normalized.includes("horns")) return "Reset faster into horns before the next possession.";
  if (normalized.includes("feet too narrow")) return "Widen the base before the next rep.";
  if (normalized.includes("again") || normalized.includes("run it again")) return "Run the next rep with one clear correction.";
  if (normalized.includes("great") || normalized.includes("worked")) return "Keep the cue that made this rep work and see if it repeats.";
  if (normalized.includes("feet") || normalized.includes("footwork")) return "Check base, balance, and timing next.";
  if (normalized.includes("paint")) return "Look for the next decision after the paint touch.";
  return "Add one cause or correction before ending the session.";
}

function structureMoment(input: string, session: AxisMemorySession): AxisMomentStructure {
  const normalized = input.toLowerCase();
  const actor = session.playerName || "Current player";
  const evidence = "Manual note";

  if (hasPaintExtraRead(normalized)) {
    return {
      situation: "Advantage created",
      actor: "Offense",
      action: "Paint touch",
      outcome: "Extra pass missed",
      cause: "Timing / decision",
      correction: "Recognize help earlier",
      evidence,
    };
  }

  if (normalized.includes("horns")) {
    return {
      situation: "Shape transition",
      actor: "Team",
      action: "Return to horns",
      outcome: "Late",
      cause: "Timing",
      correction: "Reset faster",
      evidence,
    };
  }

  if (normalized.includes("feet too narrow")) {
    return {
      situation: "Biomechanics",
      actor: session.playerName || "Player",
      action: "Base",
      outcome: "Unstable",
      cause: "Feet too narrow",
      correction: "Widen base",
      evidence,
    };
  }

  if (normalized.includes("again") || normalized.includes("run it again")) {
    return {
      situation: session.objective,
      actor,
      action: "Repeat the rep",
      outcome: "The current attempt needs another look",
      cause: "One detail needs to be fixed before moving on",
      correction: "Run it again with the correction named out loud",
      evidence,
    };
  }

  if (normalized.includes("great") || normalized.includes("worked")) {
    return {
      situation: session.objective,
      actor,
      action: "Executed the current focus",
      outcome: "The rep is worth keeping in memory",
      cause: "The cue or setup worked on this attempt",
      correction: "Repeat the same cue and see if it holds",
      evidence,
    };
  }

  if (normalized.includes("feet") || normalized.includes("footwork")) {
    return {
      situation: "Footwork",
      actor,
      action: "Changed base, timing, or step pattern",
      outcome: "The rep depends on how the feet organize the action",
      cause: "Footwork is shaping the result",
      correction: "Name the footwork detail before the next rep",
      evidence,
    };
  }

  if (normalized.includes("shot")) {
    return {
      situation: "Shot moment",
      actor,
      action: "Took or prepared for a shot",
      outcome: "Shot detail needs review",
      cause: "Timing, balance, or decision may be driving the result",
      correction: "Capture what changed before the shot",
      evidence,
    };
  }

  if (normalized.includes("extra pass")) {
    return {
      situation: "Decision after advantage",
      actor: "Offense",
      action: "Extra pass",
      outcome: "Decision needs review",
      cause: "Timing / recognition",
      correction: "Move the ball one count earlier",
      evidence,
    };
  }

  if (normalized.includes("spacing")) {
    return {
      situation: "Spacing",
      actor: "Team",
      action: "Floor balance",
      outcome: "Spacing was off",
      cause: "Shape or timing",
      correction: "Restore spacing before the next action",
      evidence,
    };
  }

  if (normalized.includes("finish")) {
    return {
      situation: "Finishing",
      actor,
      action: "Finish at the rim",
      outcome: "Finish needs review",
      cause: "Balance, angle, or contact",
      correction: "Name the finishing detail before the next rep",
      evidence,
    };
  }

  if (normalized.includes("turnover")) {
    return {
      situation: "Possession",
      actor,
      action: "Lost the ball or advantage",
      outcome: "Turnover",
      cause: "Decision, spacing, or pressure needs review",
      correction: "Identify what gave the possession away",
      evidence,
    };
  }

  if (normalized.includes("paint")) {
    return {
      situation: "Advantage near the paint",
      actor,
      action: "Got paint or forced help",
      outcome: "The next decision became important",
      cause: "The defense had to react",
      correction: "Look for the pass, finish, or reset that keeps the advantage",
      evidence,
    };
  }

  return {
    situation: session.objective,
    actor,
    action: input.length > 72 ? `${input.slice(0, 69)}...` : input,
    outcome: "Moment captured for review",
    cause: "Cause is not locked yet",
    correction: "Add the next correction when it becomes clear",
    evidence,
  };
}

function hasPaintExtraRead(normalized: string) {
  return normalized.includes("paint") && (normalized.includes("extra") || normalized.includes("missed the extra"));
}

function getCorrectionForReview(reviewState: AxisMomentReviewState, currentCorrection: string) {
  if (reviewState === "correct") return "Keep this structure and repeat the useful cue";
  if (reviewState === "refine") return "Refine this moment with one sharper detail";
  if (reviewState === "not_right") return "Rewrite this moment before trusting it";
  return currentCorrection;
}

function getNextFocusForReview(reviewState: AxisMomentReviewState, moment: AxisMoment) {
  if (reviewState === "correct") return `Carry over: ${moment.structure.correction}`;
  if (reviewState === "refine") return "Add one sharper detail before the next session.";
  if (reviewState === "not_right") return "Correct the memory before building from it.";
  return "Review the latest moment before ending the session.";
}

function createLocalId() {
  return `axis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadLocalMemory() {
  if (typeof window === "undefined") return { errorMessage: "", sessions: [] as AxisMemorySession[] };

  try {
    const raw = window.localStorage.getItem(localMemoryKey);
    if (!raw) return { errorMessage: "", sessions: [] as AxisMemorySession[] };
    const parsed = JSON.parse(raw) as { recentSessions?: AxisMemorySession[] };
    if (!Array.isArray(parsed.recentSessions)) return { errorMessage: "", sessions: [] as AxisMemorySession[] };
    return {
      errorMessage: "",
      sessions: parsed.recentSessions.map(normalizeAxisMemorySession).filter(isPresent).slice(0, 8),
    };
  } catch {
    return { errorMessage: "Local memory could not be restored.", sessions: [] as AxisMemorySession[] };
  }
}

function isAxisMemorySession(value: unknown): value is AxisMemorySession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<AxisMemorySession>;
  return typeof record.id === "string" && typeof record.title === "string" && typeof record.startedAt === "string";
}

function normalizeAxisMemorySession(value: unknown): AxisMemorySession | null {
  if (!isAxisMemorySession(value)) return null;
  const session = value as AxisMemorySession;
  return {
    ...session,
    moments: Array.isArray(session.moments)
      ? session.moments.map((moment) => normalizeAxisMoment(moment, session)).filter(isPresent)
      : [],
    nextFocus: typeof session.nextFocus === "string" ? session.nextFocus : "Start with the clearest carryover.",
    savedState: isAxisMemorySavedState(session.savedState) ? session.savedState : "local",
  };
}

function isAxisMemorySavedState(value: unknown): value is AxisMemorySession["savedState"] {
  return value === "local" || value === "needs_sign_in" || value === "saved";
}

function normalizeAxisMoment(value: unknown, session: AxisMemorySession): AxisMoment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Partial<AxisMoment>;
  if (typeof record.id !== "string" || typeof record.content !== "string" || typeof record.createdAt !== "string") {
    return null;
  }

  return {
    id: record.id,
    content: record.content,
    createdAt: record.createdAt,
    elapsedSeconds: typeof record.elapsedSeconds === "number" ? record.elapsedSeconds : 0,
    interpretedTitle: typeof record.interpretedTitle === "string" ? record.interpretedTitle : interpretMoment(record.content),
    needsReview: typeof record.needsReview === "boolean" ? record.needsReview : true,
    reviewState: isAxisMomentReviewState(record.reviewState) ? record.reviewState : "needs_review",
    structure: isAxisMomentStructure(record.structure) ? record.structure : structureMoment(record.content, session),
    type: record.type === "tap" ? "tap" : "typed",
  };
}

function isAxisMomentReviewState(value: unknown): value is AxisMomentReviewState {
  return value === "needs_review" || value === "correct" || value === "refine" || value === "not_right";
}

function isAxisMomentStructure(value: unknown): value is AxisMomentStructure {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<AxisMomentStructure>;
  return (
    typeof record.situation === "string" &&
    typeof record.actor === "string" &&
    typeof record.action === "string" &&
    typeof record.outcome === "string" &&
    typeof record.cause === "string" &&
    typeof record.correction === "string" &&
    typeof record.evidence === "string"
  );
}

function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

const axisShellStyles = `
  :root {
    color-scheme: dark;
  }

  body {
    background: #030504;
  }

  .axis-mobile-shell {
    min-height: 100dvh;
    width: 100%;
    background:
      radial-gradient(circle at 50% -10%, rgba(238, 103, 42, 0.22), transparent 18rem),
      linear-gradient(180deg, #0a100d 0%, #030504 48%, #010202 100%);
    color: #f8f5ee;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    overflow-x: hidden;
  }

  .axis-mobile-shell__body {
    display: grid;
    gap: 0.82rem;
    margin: 0 auto;
    max-width: 31rem;
    min-height: calc(100dvh - 8.4rem);
    padding: max(4.75rem, env(safe-area-inset-top) + 4.15rem) 0.85rem calc(7.15rem + env(safe-area-inset-bottom));
  }

  .axis-topbar {
    align-items: center;
    display: flex;
    gap: 0.55rem;
    justify-content: space-between;
    left: 50%;
    max-width: 31rem;
    padding: max(0.85rem, env(safe-area-inset-top)) 0.85rem 0;
    position: fixed;
    top: 0;
    transform: translateX(-50%);
    width: 100%;
    z-index: 20;
  }

  .axis-topbar__brand {
    min-width: 0;
  }

  .axis-topbar__brand p,
  .axis-panel p,
  .axis-empty-state__eyebrow,
  .axis-memory-preview > p,
  .axis-surface-header p,
  .axis-session-card__eyebrow {
    color: rgba(248, 245, 238, 0.58);
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    margin: 0;
    text-transform: uppercase;
  }

  .axis-topbar__brand p {
    max-width: min(52vw, 14rem);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .axis-topbar__brand strong {
    display: block;
    font-size: 1.05rem;
    letter-spacing: 0.02em;
  }

  .axis-topbar__actions {
    align-items: center;
    display: flex;
    gap: 0.45rem;
    flex-shrink: 0;
    min-width: 0;
  }

  .axis-pill,
  .axis-topbar button,
  .axis-panel a {
    align-items: center;
    background: rgba(248, 245, 238, 0.09);
    border: 1px solid rgba(248, 245, 238, 0.13);
    border-radius: 999px;
    color: #f8f5ee;
    display: inline-flex;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 850;
    min-height: 2.2rem;
    padding: 0 0.68rem;
    text-decoration: none;
    white-space: nowrap;
  }

  .axis-pill[data-state="live"]::before {
    background: #83f4c8;
    border-radius: 50%;
    content: "";
    height: 0.46rem;
    margin-right: 0.42rem;
    width: 0.46rem;
  }

  .axis-card,
  .axis-panel,
  .axis-memory-preview,
  .axis-input-dock,
  .axis-surface {
    background: rgba(12, 17, 14, 0.78);
    backdrop-filter: blur(22px);
    border: 1px solid rgba(248, 245, 238, 0.12);
    border-radius: 1.45rem;
    box-shadow: 0 1.2rem 3.2rem rgba(0, 0, 0, 0.24);
  }

  .axis-empty-state,
  .axis-session-card,
  .axis-panel,
  .axis-surface {
    display: grid;
    gap: 0.85rem;
    padding: 0.92rem;
  }

  .axis-empty-state h1,
  .axis-session-card h1,
  .axis-panel h2,
  .axis-surface-header h2 {
    font-size: clamp(1.72rem, 8.6vw, 3.65rem);
    letter-spacing: -0.045em;
    line-height: 0.96;
    margin: 0;
  }

  .axis-empty-state form,
  .axis-input-dock form,
  .axis-ask-form {
    display: grid;
    gap: 0.75rem;
  }

  .axis-empty-state label,
  .axis-input-dock label,
  .axis-ask-form label {
    color: rgba(248, 245, 238, 0.66);
    display: grid;
    font-size: 0.7rem;
    font-weight: 850;
    gap: 0.4rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .axis-empty-state input,
  .axis-empty-state select,
  .axis-input-dock input,
  .axis-ask-form input {
    background: rgba(248, 245, 238, 0.08);
    border: 1px solid rgba(248, 245, 238, 0.16);
    border-radius: 1rem;
    color: #f8f5ee;
    font: inherit;
    font-size: 1rem;
    min-height: 3.25rem;
    padding: 0 0.95rem;
    width: 100%;
  }

  .axis-empty-state input:focus,
  .axis-empty-state select:focus,
  .axis-input-dock input:focus,
  .axis-ask-form input:focus {
    border-color: rgba(238, 103, 42, 0.8);
    outline: none;
  }

  .axis-primary,
  .axis-session-card__end,
  .axis-input-dock__mark {
    background: #ee672a;
    border: 1px solid #ee672a;
    border-radius: 999px;
    color: #120704;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 950;
    min-height: 3.35rem;
    padding: 0 1rem;
    text-transform: uppercase;
  }

  .axis-secondary,
  .axis-correction-chip,
  .axis-input-dock button:not(.axis-input-dock__mark),
  .axis-session-card__again,
  .axis-suggestion-list button,
  .axis-memory-actions button,
  .axis-tool-row a {
    background: rgba(248, 245, 238, 0.08);
    border: 1px solid rgba(248, 245, 238, 0.14);
    border-radius: 999px;
    color: #f8f5ee;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 850;
    min-height: 2.85rem;
    padding: 0 0.8rem;
  }

  .axis-empty-state__meta,
  .axis-session-card__meta,
  .axis-panel span,
  .axis-surface-header span {
    color: rgba(248, 245, 238, 0.64);
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .axis-session-card__header {
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    min-width: 0;
  }

  .axis-session-card__timer {
    color: #83f4c8;
    flex-shrink: 0;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.98rem;
    font-weight: 900;
  }

  .axis-session-card__moment {
    background: rgba(248, 245, 238, 0.07);
    border: 1px solid rgba(248, 245, 238, 0.1);
    border-radius: 1.1rem;
    display: grid;
    gap: 0.42rem;
    padding: 0.78rem;
  }

  .axis-session-card__moment strong {
    font-size: 1.05rem;
    line-height: 1.16;
  }

  .axis-session-card__moment small,
  .axis-next-session-card small {
    color: rgba(248, 245, 238, 0.48);
    font-size: 0.66rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .axis-session-card__moment span,
  .axis-memory-item span,
  .axis-next-session-card span {
    color: rgba(248, 245, 238, 0.62);
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .axis-live-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .axis-live-tags span {
    background: rgba(238, 103, 42, 0.12);
    border: 1px solid rgba(238, 103, 42, 0.18);
    border-radius: 999px;
    color: rgba(255, 209, 184, 0.9);
    font-size: 0.7rem;
    font-weight: 850;
    line-height: 1.1;
    padding: 0.34rem 0.5rem;
  }

  .axis-moment-detail {
    border-top: 1px solid rgba(248, 245, 238, 0.08);
    margin-top: 0.1rem;
    padding-top: 0.45rem;
  }

  .axis-moment-detail summary {
    color: rgba(255, 176, 133, 0.9);
    cursor: pointer;
    font-size: 0.74rem;
    font-weight: 900;
    list-style-position: inside;
  }

  .axis-moment-structure {
    display: grid;
    gap: 0.45rem;
    margin: 0.25rem 0 0;
  }

  .axis-moment-structure div {
    border-top: 1px solid rgba(248, 245, 238, 0.08);
    display: grid;
    gap: 0.18rem;
    grid-template-columns: 5.7rem minmax(0, 1fr);
    padding-top: 0.45rem;
  }

  .axis-moment-structure dt,
  .axis-moment-structure dd {
    margin: 0;
  }

  .axis-moment-structure dt {
    color: rgba(248, 245, 238, 0.48);
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-moment-structure dd {
    color: rgba(248, 245, 238, 0.78);
    font-size: 0.86rem;
    line-height: 1.35;
  }

  .axis-session-card__corrections {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
  }

  .axis-next-session-card {
    background: rgba(131, 244, 200, 0.08);
    border: 1px solid rgba(131, 244, 200, 0.15);
    border-radius: 1.1rem;
    display: grid;
    gap: 0.35rem;
    padding: 0.85rem;
  }

  .axis-next-session-card strong {
    color: #d6ffe9;
    font-size: 0.98rem;
    line-height: 1.25;
  }

  .axis-session-card__actions,
  .axis-input-dock__quick,
  .axis-empty-state__links {
    display: grid;
    gap: 0.55rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .axis-session-card__actions {
    grid-template-columns: 1fr 1fr;
  }

  .axis-session-card__actions .axis-secondary {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    text-align: center;
  }

  .axis-session-card__save-help {
    color: rgba(248, 245, 238, 0.52);
    font-size: 0.76rem;
    grid-column: 1 / -1;
    line-height: 1.35;
    text-align: center;
  }

  .axis-input-dock {
    bottom: calc(3.75rem + env(safe-area-inset-bottom));
    display: grid;
    gap: 0.55rem;
    left: 50%;
    max-width: 31rem;
    padding: 0.58rem;
    position: fixed;
    transform: translateX(-50%);
    width: calc(100% - 1rem);
    z-index: 18;
  }

  .axis-input-dock__row {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .axis-input-dock__quick {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .axis-memory-preview {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem;
  }

  .axis-memory-preview[data-compact="true"] {
    box-shadow: none;
  }

  .axis-memory-list {
    display: grid;
    gap: 0.55rem;
  }

  .axis-memory-item {
    background: rgba(248, 245, 238, 0.06);
    border: 1px solid rgba(248, 245, 238, 0.09);
    border-radius: 1rem;
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem;
  }

  .axis-memory-item strong {
    font-size: 0.96rem;
  }

  .axis-memory-item small {
    color: rgba(248, 245, 238, 0.48);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-bottom-nav {
    background: rgba(4, 7, 6, 0.86);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(248, 245, 238, 0.1);
    border-radius: 1.2rem 1.2rem 0 0;
    bottom: 0;
    display: grid;
    gap: 0.2rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    left: 50%;
    max-width: 31rem;
    padding: 0.45rem 0.45rem max(0.55rem, env(safe-area-inset-bottom));
    position: fixed;
    transform: translateX(-50%);
    width: 100%;
    z-index: 19;
  }

  .axis-bottom-nav button,
  .axis-bottom-nav a {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0.9rem;
    color: rgba(248, 245, 238, 0.54);
    display: inline-flex;
    justify-content: center;
    font: inherit;
    font-size: 0.68rem;
    font-weight: 900;
    min-height: 3.05rem;
    text-decoration: none;
  }

  .axis-bottom-nav button[data-active="true"] {
    background: rgba(238, 103, 42, 0.16);
    color: #ffb085;
  }

  .axis-panel {
    min-height: 18rem;
  }

  .axis-surface-header {
    display: grid;
    gap: 0.45rem;
  }

  .axis-suggestion-list,
  .axis-memory-actions {
    display: grid;
    gap: 0.55rem;
    grid-template-columns: 1fr;
  }

  .axis-answer-card,
  .axis-empty-memory-card,
  .axis-memory-detail,
  .axis-memory-detail__section,
  .axis-player-card,
  .axis-tool-row {
    background: rgba(248, 245, 238, 0.06);
    border: 1px solid rgba(248, 245, 238, 0.09);
    border-radius: 1rem;
    display: grid;
    gap: 0.4rem;
    padding: 0.85rem;
  }

  .axis-answer-card small,
  .axis-memory-detail small,
  .axis-memory-detail__section small,
  .axis-player-card small,
  .axis-tool-row small {
    color: rgba(248, 245, 238, 0.48);
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .axis-answer-card strong,
  .axis-empty-memory-card strong,
  .axis-memory-detail strong,
  .axis-memory-detail h3,
  .axis-player-card strong,
  .axis-tool-row strong {
    color: #f8f5ee;
    font-size: 1rem;
    line-height: 1.25;
    margin: 0;
  }

  .axis-answer-card span,
  .axis-empty-memory-card span,
  .axis-memory-detail span,
  .axis-player-card span,
  .axis-tool-row span {
    color: rgba(248, 245, 238, 0.64);
    font-size: 0.84rem;
    line-height: 1.4;
  }

  .axis-memory-detail__back {
    justify-self: start;
  }

  .axis-memory-moment-list,
  .axis-player-list,
  .axis-tool-list {
    display: grid;
    gap: 0.6rem;
  }

  .axis-memory-moment-list article {
    border-top: 1px solid rgba(248, 245, 238, 0.08);
    display: grid;
    gap: 0.2rem;
    padding-top: 0.55rem;
  }

  .axis-tool-row {
    align-items: center;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .axis-tool-row a {
    min-height: 2.45rem;
  }

  @media (min-width: 720px) {
    .axis-mobile-shell__body {
      padding-left: 0;
      padding-right: 0;
    }
  }

  @media (max-width: 380px) {
    .axis-pill {
      max-width: 8.5rem;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .axis-topbar button {
      padding: 0 0.55rem;
    }

    .axis-input-dock__quick {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
`;
