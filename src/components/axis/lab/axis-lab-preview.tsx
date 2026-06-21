"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Mic, Plus, Type, Upload, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AxisContextComposer } from "../context-dashboard/axis-context-composer";
import { AxisContextDashboardShell } from "../context-dashboard/axis-context-dashboard-shell";
import { IconButton } from "../context-dashboard/axis-context-header";
import type { AxisContextRecentItem } from "../context-dashboard/axis-context-dashboard-types";
import { axisLabDashboard } from "./axis-lab-mock-data";
import type {
  AxisGameSession,
  AxisLabPreviewState,
  AxisLabProofCandidate,
  AxisLabRecentReality,
  AxisLabTimelineEvent,
  AxisRealityMark,
  AxisRealityMarkLabel,
} from "./axis-lab-types";
import styles from "./axis-lab.module.css";

const VALID_STATES: AxisLabPreviewState[] = ["empty", "active", "expanded"];
const REALITY_MARK_LABELS: AxisRealityMarkLabel[] = [
  "proof",
  "turnover",
  "rushing",
  "spacing",
  "score",
  "stop",
  "foul",
  "question",
  "clip",
  "custom",
];
const GAME_MARK_LABELS: AxisRealityMarkLabel[] = [
  "turnover",
  "rushing",
  "spacing",
  "score",
  "stop",
  "foul",
  "question",
  "proof",
  "clip",
  "custom",
];
const PROOF_CANDIDATE_LABELS = new Set<AxisRealityMarkLabel>([
  "proof",
  "turnover",
  "rushing",
  "spacing",
  "stop",
  "foul",
  "clip",
]);

type AxisLiveRead = {
  pattern: string;
  proofNeeded: string;
  next: string;
};

const LOCAL_PREVIEW_COPY = "Manual inputs. Unverified. Local preview.";

function parsePreviewState(value: string | null): AxisLabPreviewState {
  return VALID_STATES.includes(value as AxisLabPreviewState)
    ? (value as AxisLabPreviewState)
    : "active";
}

function getMarkTitle(label: AxisRealityMarkLabel) {
  return label
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSessionTimestamp(seconds?: number) {
  if (typeof seconds !== "number") return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function getClockTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function createMarkId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mark-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createSessionId() {
  return `game-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function countMarks(marks: AxisRealityMark[], label: AxisRealityMarkLabel) {
  return marks.filter((mark) => mark.label === label).length;
}

function countNearbyPairs(
  marks: AxisRealityMark[],
  firstLabel: AxisRealityMarkLabel,
  secondLabel: AxisRealityMarkLabel,
  seconds: number,
) {
  const firstMarks = marks.filter((mark) => mark.label === firstLabel);
  const secondMarks = marks.filter((mark) => mark.label === secondLabel);
  return firstMarks.filter((firstMark) =>
    secondMarks.some((secondMark) => Math.abs(firstMark.sessionTime - secondMark.sessionTime) <= seconds),
  ).length;
}

function createLiveRead(marks: AxisRealityMark[], status: AxisGameSession["status"]): AxisLiveRead {
  if (marks.length === 0) {
    return {
      pattern: status === "live"
        ? `No manual marks yet. ${LOCAL_PREVIEW_COPY}`
        : `Start the local session before marking live moments. ${LOCAL_PREVIEW_COPY}`,
      proofNeeded: `No proof candidate yet. ${LOCAL_PREVIEW_COPY}`,
      next: `Use one Reality Mark when the next useful moment happens. ${LOCAL_PREVIEW_COPY}`,
    };
  }

  const latest = marks[0];
  const latestTime = getSessionTimestamp(latest.sessionTime);
  const rushingCount = countMarks(marks, "rushing");
  const turnoverCount = countMarks(marks, "turnover");
  const spacingCount = countMarks(marks, "spacing");
  const stopCount = countMarks(marks, "stop");
  const foulCount = countMarks(marks, "foul");
  const pressureCount = rushingCount + turnoverCount + spacingCount;
  const proofLabels = marks.filter((mark) => PROOF_CANDIDATE_LABELS.has(mark.label)).length;
  const turnoverRushingPairs = countNearbyPairs(marks, "turnover", "rushing", 20);

  const pattern =
    turnoverRushingPairs > 0
      ? `Turnover and Rushing were marked within 20 seconds ${turnoverRushingPairs} time${turnoverRushingPairs === 1 ? "" : "s"}. ${LOCAL_PREVIEW_COPY}`
      : pressureCount > 1
        ? `${pressureCount} pressure-related marks so far. ${LOCAL_PREVIEW_COPY}`
        : `${getMarkTitle(latest.label)} marked at ${latestTime}. ${LOCAL_PREVIEW_COPY}`;

  const proofNeeded =
    proofLabels > 0
      ? `${proofLabels} mark${proofLabels === 1 ? "" : "s"} could be reviewed later. ${LOCAL_PREVIEW_COPY}`
      : `No proof candidate yet. Manual labels are not evidence. ${LOCAL_PREVIEW_COPY}`;

  let next = `Add one short note if the latest mark needs context. ${LOCAL_PREVIEW_COPY}`;
  if (turnoverCount > 0 || rushingCount > 0) {
    next = `Review Rushing and Turnover mark times before making a claim. ${LOCAL_PREVIEW_COPY}`;
  } else if (spacingCount > 0) {
    next = `Review Spacing mark times before making a claim. ${LOCAL_PREVIEW_COPY}`;
  } else if (stopCount > 0) {
    next = `Review Stop mark times before calling it a pattern. ${LOCAL_PREVIEW_COPY}`;
  } else if (foulCount > 0) {
    next = `Review Foul mark times before making a contact claim. ${LOCAL_PREVIEW_COPY}`;
  }

  return { pattern, proofNeeded, next };
}

export default function AxisLabPreview() {
  const searchParams = useSearchParams();
  const previewState = parsePreviewState(searchParams.get("state"));

  return <DashboardPreview expanded={previewState === "expanded"} state={previewState} />;
}

function DashboardPreview({
  expanded,
  state,
}: {
  expanded: boolean;
  state: AxisLabPreviewState;
}) {
  const [sessionStartedAtMs, setSessionStartedAtMs] = useState<number | null>(null);
  const [sourceStartedAtMs, setSourceStartedAtMs] = useState<number | null>(null);
  const [realityMarks, setRealityMarks] = useState<AxisRealityMark[]>([]);
  const [mobileBoardOpen, setMobileBoardOpen] = useState(false);
  const [lastMarkToastId, setLastMarkToastId] = useState<string | null>(null);
  const [toastNoteOpen, setToastNoteOpen] = useState(false);
  const [toastNote, setToastNote] = useState("");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [gameSession, setGameSession] = useState<AxisGameSession>(() => ({
    id: createSessionId(),
    saveStatus: "local",
    sourceType: "manual",
    status: "setup",
    title: axisLabDashboard.threadTitle,
  }));

  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  const markTimelineEvents = useMemo<AxisLabTimelineEvent[]>(
    () =>
      realityMarks.map((mark) => ({
        detail: getMarkTitle(mark.label),
        mark,
        meta: `${getSessionTimestamp(mark.sessionTime)} - Manual - Unverified`,
        time: getClockTime(mark.createdAt),
        title: "Reality mark",
      })),
    [realityMarks],
  );
  const proofCandidates = useMemo(
    () => [
      ...realityMarks
        .filter((mark) => PROOF_CANDIDATE_LABELS.has(mark.label))
        .map(createMarkProofCandidate),
      ...axisLabDashboard.proofCandidates,
    ],
    [realityMarks],
  );
  const recentReality = useMemo(
    () => [...realityMarks.map(createMarkRecentReality), ...axisLabDashboard.recentReality],
    [realityMarks],
  );
  const liveRead = useMemo(
    () => createLiveRead(realityMarks, gameSession.status),
    [gameSession.status, realityMarks],
  );

  const createRealityMark = useCallback((label: AxisRealityMarkLabel, note?: string) => {
    if (gameSession.status !== "live" || sessionStartedAtMs === null) return;
    const now = Date.now();
    const createdAt = new Date().toISOString();
    const elapsedSeconds = Math.max(0, Math.floor((now - sessionStartedAtMs) / 1000));
    const sourceTime = sourceStartedAtMs === null
      ? undefined
      : Math.max(0, Math.floor((now - sourceStartedAtMs) / 1000));
    const markId = createMarkId();
    setRealityMarks((current) => [
      {
        createdAt,
        gameSessionId: gameSession.id,
        id: markId,
        label,
        linkedSourceId: undefined,
        note: note?.trim() || undefined,
        postRollSeconds: 10,
        preRollSeconds: 15,
        provenance: "manual",
        sessionTime: elapsedSeconds,
        sourceTime,
        sourceType: "manual",
        verification: "unverified",
      },
      ...current,
    ]);
    setLastMarkToastId(markId);
    setToastNoteOpen(false);
    setToastNote("");
  }, [gameSession.id, gameSession.status, sessionStartedAtMs, sourceStartedAtMs]);
  const undoLastRealityMark = useCallback(() => {
    setRealityMarks((current) => {
      const next = current.slice(1);
      setLastMarkToastId(next[0]?.id ?? null);
      return next;
    });
    setToastNoteOpen(false);
    setToastNote("");
  }, []);

  const startSource = useCallback(() => {
    const now = new Date().toISOString();
    setSourceStartedAtMs(Date.now());
    setGameSession((current) => ({
      ...current,
      sourceStartedAt: now,
      sourceType: "manual",
    }));
  }, []);

  const startSession = useCallback(() => {
    const nowMs = Date.now();
    setSessionStartedAtMs(nowMs);
    setGameSession((current) => ({
      ...current,
      startedAt: new Date(nowMs).toISOString(),
      status: "live",
    }));
  }, []);

  const pauseSession = useCallback(() => {
    setGameSession((current) => current.status === "live" ? { ...current, status: "paused" } : current);
  }, []);

  const resumeSession = useCallback(() => {
    setGameSession((current) => current.status === "paused" ? { ...current, status: "live" } : current);
  }, []);

  const endSession = useCallback(() => {
    setGameSession((current) => ({
      ...current,
      endedAt: new Date().toISOString(),
      status: "ended",
    }));
  }, []);

  const addToastNote = useCallback(() => {
    const note = toastNote.trim();
    if (!lastMarkToastId || !note) return;
    setRealityMarks((current) => current.map((mark) => (
      mark.id === lastMarkToastId ? { ...mark, note } : mark
    )));
    setToastNote("");
    setToastNoteOpen(false);
  }, [lastMarkToastId, toastNote]);

  const sourceElapsed = sourceStartedAtMs === null
    ? undefined
    : Math.max(0, Math.floor((clockNow - sourceStartedAtMs) / 1000));
  const sessionElapsed = sessionStartedAtMs === null
    ? undefined
    : Math.max(0, Math.floor((clockNow - sessionStartedAtMs) / 1000));
  const toastMark = realityMarks.find((mark) => mark.id === lastMarkToastId) ?? null;

  const activeContext =
    state === "empty"
      ? undefined
      : {
          ...axisLabDashboard.activeContext,
          nextMove: liveRead.next,
          proofNeeded: liveRead.proofNeeded,
          support: liveRead.pattern,
          detail: expanded ? (
            <section className={styles.expandedMock} aria-label="Expanded preview detail">
              <h2>Selected mock detail</h2>
              <p>Source-only items stay separate from suggested interpretation until the user accepts the read.</p>
            </section>
          ) : undefined,
        };

  return (
    <>
      <div className={styles.desktopLabPreview}>
        <AxisContextDashboardShell
      activeContext={activeContext}
      ariaLabel="Axis Lab Context Bank dashboard preview"
      actions={axisLabDashboard.actions.map((action) => ({
        ...action,
        id: action.title,
      }))}
      composer={<DashboardComposer onCreateRealityMark={createRealityMark} />}
      emptyState={<EmptyDashboard />}
      header={{
        savedAt: axisLabDashboard.savedAt,
        savedDateTime: "2026-06-20T20:42:00-05:00",
        status: "Saved",
        threadTitle: axisLabDashboard.threadTitle,
      }}
      openLoops={axisLabDashboard.openLoops.map((loop) => ({
        id: loop,
        text: loop,
      }))}
      proofCandidates={proofCandidates.map((candidate, index) => ({
        ...candidate,
        id: candidate.id ?? `${candidate.title}-${index}`,
      }))}
      recentItems={recentReality.map(createRecentItem)}
      timelineItems={[...axisLabDashboard.timeline, ...[...markTimelineEvents].reverse()].map((event, index) => ({
        detail: event.detail,
        id: event.mark?.id ?? `${event.time}-${event.title}-${index}`,
        mediaKind: event.meta ? "voice" : "clip",
        mediaLabel: event.mediaLabel,
        meta: event.meta,
        time: event.time,
        title: event.title,
      }))}
        />
      </div>
      <MobileGameSurface
        boardOpen={mobileBoardOpen}
        gameSession={gameSession}
        liveRead={liveRead}
        marks={realityMarks}
        onAddToastNote={addToastNote}
        onCloseBoard={() => setMobileBoardOpen(false)}
        onCreateRealityMark={createRealityMark}
        onEndSession={endSession}
        onOpenBoard={() => setMobileBoardOpen(true)}
        onPauseSession={pauseSession}
        onResumeSession={resumeSession}
        onStartSession={startSession}
        onStartSource={startSource}
        onUndoLast={undoLastRealityMark}
        sessionElapsed={sessionElapsed}
        sourceElapsed={sourceElapsed}
        toastMark={toastMark}
        toastNote={toastNote}
        toastNoteOpen={toastNoteOpen}
        onToastNoteChange={setToastNote}
        onToastNoteOpen={() => setToastNoteOpen(true)}
      />
    </>
  );
}

function createMarkProofCandidate(mark: AxisRealityMark): AxisLabProofCandidate {
  const timestamp = getSessionTimestamp(mark.sessionTime);
  return {
    boundary: "Needs confirmation",
    confidence: "Unverified",
    duration: timestamp,
    id: mark.id,
    meta: "Unverified",
    source: "Manual Reality Mark",
    time: timestamp,
    title: getMarkTitle(mark.label),
  };
}

function createMarkRecentReality(mark: AxisRealityMark): AxisLabRecentReality {
  return {
    kind: "Reality Mark",
    mark,
    time: getClockTime(mark.createdAt),
    title: getMarkTitle(mark.label),
  };
}

function createRecentItem(item: AxisLabRecentReality): AxisContextRecentItem {
  const markTimestamp = item.mark ? getSessionTimestamp(item.mark.sessionTime) : "";
  const markMeta = item.mark
    ? [
        item.mark.note,
        `${markTimestamp ? `${markTimestamp} - ` : ""}${getClockTime(item.mark.createdAt)}`,
        "Manual - Unverified",
      ].filter((line): line is string => Boolean(line))
    : undefined;

  return {
    duration: item.duration,
    id: item.mark?.id ?? item.title,
    kind: item.kind,
    meta: markMeta,
    preview: item.mark ? <RealityMarkPreview mark={item.mark} /> : <MockRecentPreview item={item} />,
    time: item.time,
    title: item.title,
  };
}

function MockRecentPreview({ item }: { item: AxisLabRecentReality }) {
  const className = [
    styles.mockRecentPreview,
    styles[`mockRecent-${item.kind.toLowerCase().replace(/\s+/g, "-")}`],
  ]
    .filter(Boolean)
    .join(" ");

  if (item.kind === "Clip") {
    return (
      <div className={className}>
        <strong>Clip preview</strong>
        <em>Preview only</em>
        {item.duration && <b>{item.duration}</b>}
      </div>
    );
  }

  if (item.kind === "Voice") {
    return (
      <div className={className}>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <em>Voice preview</em>
        {item.duration && <b>{item.duration}</b>}
      </div>
    );
  }

  if (item.kind === "Image") {
    return (
      <div className={className}>
        <strong>Diagram</strong>
        <em>Preview only</em>
      </div>
    );
  }

  if (item.kind === "Note") {
    return (
      <div className={className}>
        <strong>Note</strong>
        <em>Preview only</em>
      </div>
    );
  }

  return (
    <div className={className}>
      <strong>Source</strong>
      <em>Preview only</em>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <section className={styles.emptyDashboard} aria-labelledby="axis-lab-empty-title">
      <p className={styles.regionEyebrow}>Active context</p>
      <h1 id="axis-lab-empty-title">Say the rough version.</h1>
      <p>The Context Bank preview is ready, but this lab state stays mock-only.</p>
    </section>
  );
}

function DashboardComposer({
  onCreateRealityMark,
}: {
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const plusRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setCustomOpen(false);
    setCustomValue("");
    requestAnimationFrame(() => plusRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current || !plusRef.current) return;
      if (!(event.target instanceof Node)) return;
      if (menuRef.current.contains(event.target) || plusRef.current.contains(event.target)) return;
      closeMenu();
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeMenu, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(() => firstMenuItemRef.current?.focus());
  }, [menuOpen]);

  useEffect(() => {
    if (!customOpen) return;
    requestAnimationFrame(() => customInputRef.current?.focus());
  }, [customOpen]);

  function createStandardMark(label: AxisRealityMarkLabel) {
    onCreateRealityMark(label);
    closeMenu();
  }

  function createCustomMark() {
    const note = customValue.trim();
    if (!note) return;
    onCreateRealityMark("custom", note);
    closeMenu();
  }

  return (
    <AxisContextComposer ariaLabel="Preview composer" inputId="axis-lab-dashboard-composer" controls={
      <>
        <IconButton label="Microphone preview only">
          <Mic size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label="Camera preview only">
          <Camera size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label="Upload preview only">
          <Upload size={16} aria-hidden="true" />
        </IconButton>
        <button
          className={styles.plusSend}
          type="button"
          aria-label="Add Reality Mark"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => {
            setMenuOpen((current) => !current);
            setCustomOpen(false);
            setCustomValue("");
          }}
          ref={plusRef}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </>
    }>
      {menuOpen && (
        <div className={styles.realityMenu} ref={menuRef}>
          <div className={styles.realityMenuGrid} role="menu" aria-label="Add Reality Mark">
            {REALITY_MARK_LABELS.map((label, index) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                ref={index === 0 ? firstMenuItemRef : undefined}
                onClick={() => {
                  if (label === "custom") {
                    setCustomOpen(true);
                    return;
                  }
                  createStandardMark(label);
                }}
              >
                {getMarkTitle(label)}
              </button>
            ))}
          </div>
          {customOpen && (
            <div className={styles.customMarkRow}>
              <label className={styles.srOnly} htmlFor="axis-lab-custom-mark">
                Custom Reality Mark note
              </label>
              <input
                id="axis-lab-custom-mark"
                ref={customInputRef}
                value={customValue}
                onChange={(event) => setCustomValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    createCustomMark();
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeMenu();
                  }
                }}
                placeholder="Name the mark..."
              />
              <button type="button" onClick={createCustomMark} disabled={!customValue.trim()}>
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </AxisContextComposer>
  );
}

function MobileGameSurface({
  boardOpen,
  gameSession,
  liveRead,
  marks,
  onAddToastNote,
  onCloseBoard,
  onCreateRealityMark,
  onEndSession,
  onOpenBoard,
  onPauseSession,
  onResumeSession,
  onStartSession,
  onStartSource,
  onToastNoteChange,
  onToastNoteOpen,
  onUndoLast,
  sessionElapsed,
  sourceElapsed,
  toastMark,
  toastNote,
  toastNoteOpen,
}: {
  boardOpen: boolean;
  gameSession: AxisGameSession;
  liveRead: AxisLiveRead;
  marks: AxisRealityMark[];
  onAddToastNote: () => void;
  onCloseBoard: () => void;
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string) => void;
  onEndSession: () => void;
  onOpenBoard: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStartSession: () => void;
  onStartSource: () => void;
  onToastNoteChange: (value: string) => void;
  onToastNoteOpen: () => void;
  onUndoLast: () => void;
  sessionElapsed?: number;
  sourceElapsed?: number;
  toastMark: AxisRealityMark | null;
  toastNote: string;
  toastNoteOpen: boolean;
}) {
  const canMark = gameSession.status === "live";
  const [mobileCustomOpen, setMobileCustomOpen] = useState(false);
  const [mobileCustomValue, setMobileCustomValue] = useState("");
  const mobileCustomInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!mobileCustomOpen) return;
    requestAnimationFrame(() => mobileCustomInputRef.current?.focus());
  }, [mobileCustomOpen]);

  function closeMobileCustom() {
    setMobileCustomOpen(false);
    setMobileCustomValue("");
  }

  function createMobileMark(label: AxisRealityMarkLabel) {
    if (label === "custom") {
      setMobileCustomOpen(true);
      return;
    }
    onCreateRealityMark(label);
  }

  function createMobileCustomMark() {
    const note = mobileCustomValue.trim();
    if (!note) return;
    onCreateRealityMark("custom", note);
    closeMobileCustom();
  }

  return (
    <main className={styles.gameSurface} aria-label="Axis Lab mobile game surface">
      <header className={styles.gameHeader}>
        <span>AXIS</span>
        <strong>{axisLabDashboard.threadTitle}</strong>
        <em>{gameSession.saveStatus}</em>
      </header>

      <section className={styles.gameSessionPanel} aria-label="Local game session controls">
        <div>
          <p>Local source clock - no media connected.</p>
          <strong>{sourceElapsed === undefined ? "Source not started" : getSessionTimestamp(sourceElapsed)}</strong>
        </div>
        <div>
          <p>Session {gameSession.status}</p>
          <strong>{sessionElapsed === undefined ? "Not live" : getSessionTimestamp(sessionElapsed)}</strong>
        </div>
        <div className={styles.gameSessionActions}>
          <button type="button" onClick={onStartSource} disabled={sourceElapsed !== undefined}>
            Start source
          </button>
          {gameSession.status === "setup" && (
            <button type="button" onClick={onStartSession}>Start session</button>
          )}
          {gameSession.status === "live" && (
            <>
              <button type="button" onClick={onPauseSession}>Pause</button>
              <button type="button" onClick={onEndSession}>End</button>
            </>
          )}
          {gameSession.status === "paused" && (
            <>
              <button type="button" onClick={onResumeSession}>Resume</button>
              <button type="button" onClick={onEndSession}>End</button>
            </>
          )}
        </div>
        {gameSession.status === "ended" && (
          <p className={styles.gameSessionFinal}>Final local mark count: {marks.length}</p>
        )}
      </section>

      <section className={styles.gameReadCard} aria-labelledby="axis-game-current-read">
        <p className={styles.regionEyebrow}>Current read</p>
        <h1 id="axis-game-current-read">First six minutes.</h1>
        <ul>
          <li><strong>Main:</strong> No second mistake.</li>
          <li><strong>Pressure:</strong> Contact is not a stop sign.</li>
          <li><strong>Cue:</strong> Slow the next decision.</li>
        </ul>
      </section>

      <button
        className={styles.markRealityButton}
        type="button"
        onClick={() => onCreateRealityMark("proof")}
        disabled={!canMark}
      >
        Add Reality Mark
      </button>

      <section className={styles.quickMarks} aria-label="Quick Reality Marks">
        {GAME_MARK_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => createMobileMark(label)}
            disabled={!canMark}
          >
            {getMarkTitle(label)}
          </button>
        ))}
      </section>

      {mobileCustomOpen && (
        <div className={styles.mobileCustomMark}>
          <label className={styles.srOnly} htmlFor="axis-lab-mobile-custom-mark">
            Custom Reality Mark note
          </label>
          <input
            id="axis-lab-mobile-custom-mark"
            ref={mobileCustomInputRef}
            value={mobileCustomValue}
            onChange={(event) => setMobileCustomValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                createMobileCustomMark();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                closeMobileCustom();
              }
            }}
            placeholder="Short custom mark..."
          />
          <button type="button" onClick={createMobileCustomMark} disabled={!mobileCustomValue.trim()}>
            Add
          </button>
          <button type="button" onClick={closeMobileCustom}>
            Cancel
          </button>
        </div>
      )}

      <section className={styles.liveReadPanel} aria-labelledby="axis-game-live-read">
        <h2 id="axis-game-live-read">Live Read</h2>
        <dl>
          <div>
            <dt>Pattern</dt>
            <dd>{liveRead.pattern}</dd>
          </div>
          <div>
            <dt>Proof Needed</dt>
            <dd>{liveRead.proofNeeded}</dd>
          </div>
          <div>
            <dt>Next</dt>
            <dd>{liveRead.next}</dd>
          </div>
        </dl>
      </section>

      {toastMark && (
        <section className={styles.markToast} aria-live="polite" aria-label="Latest Reality Mark">
          <div>
            <strong>{getMarkTitle(toastMark.label)} - {getSessionTimestamp(toastMark.sessionTime)}</strong>
            <span>Manual - Unverified</span>
          </div>
          <div className={styles.markToastActions}>
            <button type="button" onClick={onUndoLast}>Undo</button>
            <button type="button" onClick={onToastNoteOpen}>Add note</button>
          </div>
          {toastNoteOpen && (
            <div className={styles.markToastNote}>
              <label className={styles.srOnly} htmlFor="axis-lab-toast-note">Reality Mark note</label>
              <input
                id="axis-lab-toast-note"
                value={toastNote}
                onChange={(event) => onToastNoteChange(event.target.value)}
                placeholder="Short note..."
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onAddToastNote();
                  }
                }}
              />
              <button type="button" onClick={onAddToastNote} disabled={!toastNote.trim()}>
                Save
              </button>
            </div>
          )}
        </section>
      )}

      <section className={styles.recentMarks} aria-labelledby="axis-game-recent-marks">
        <div>
          <h2 id="axis-game-recent-marks">Recent Marks</h2>
          <button type="button" onClick={onUndoLast} disabled={marks.length === 0}>
            Undo last mark
          </button>
        </div>
        {marks.length === 0 ? (
          <p>No marks yet.</p>
        ) : (
          <ol>
            {marks.slice(0, 6).map((mark) => (
              <li key={mark.id}>
                <time dateTime={mark.createdAt}>
                  {getSessionTimestamp(mark.sessionTime)}
                </time>
                <strong>{getMarkTitle(mark.label)}</strong>
                <span>Created {getClockTime(mark.createdAt)}</span>
                {mark.note && <span>{mark.note}</span>}
                <em>Manual - Unverified</em>
              </li>
            ))}
          </ol>
        )}
      </section>

      <button className={styles.reviewBoardButton} type="button" onClick={onOpenBoard}>
        Review Board
      </button>

      {boardOpen && (
        <section className={styles.reviewBoardOverlay} aria-label="Review Board">
          <div>
            <button type="button" onClick={onCloseBoard} aria-label="Close Review Board">
              <X size={18} aria-hidden="true" />
            </button>
            <p className={styles.regionEyebrow}>Review Board</p>
            <h2>{axisLabDashboard.activeContext.mainText}</h2>
            <p>{axisLabDashboard.activeContext.support}</p>
            <h3>Pattern</h3>
            <p>{liveRead.pattern}</p>
            <h3>Proof Needed</h3>
            <p>{liveRead.proofNeeded}</p>
            <h3>Next</h3>
            <p>{liveRead.next}</p>
            <h3>Recent Reality</h3>
            {marks.length === 0 ? (
              <p>No manual marks yet.</p>
            ) : (
              <ul>
                {marks.slice(0, 5).map((mark) => (
                  <li key={mark.id}>
                    {getSessionTimestamp(mark.sessionTime)} - {getMarkTitle(mark.label)} - Manual - Unverified
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <nav className={styles.gameCaptureRail} aria-label="Preview capture controls">
        <button type="button" disabled>
          <Mic size={18} aria-hidden="true" />
          <span>mic</span>
        </button>
        <button type="button" disabled>
          <Camera size={18} aria-hidden="true" />
          <span>camera</span>
        </button>
        <button type="button" disabled>
          <Upload size={18} aria-hidden="true" />
          <span>upload</span>
        </button>
        <button type="button" disabled>
          <Type size={18} aria-hidden="true" />
          <span>text</span>
        </button>
      </nav>
    </main>
  );
}

function RealityMarkPreview({ mark }: { mark: AxisRealityMark }) {
  const sessionTimestamp = getSessionTimestamp(mark.sessionTime);
  const title = getMarkTitle(mark.label);

  return (
    <div className={`${styles.realityMarkPreview} ${styles[`markPreview-${mark.label}`]}`}>
      <span className={styles.realityMarkAccent} aria-hidden="true" />
      {mark.label === "clip" ? (
        <>
          <strong>Clip mark - no media attached</strong>
          <em>No media attached</em>
          {sessionTimestamp && <b>{sessionTimestamp}</b>}
        </>
      ) : mark.label === "question" ? (
        <>
          <strong>Question</strong>
          <em>{sessionTimestamp}</em>
        </>
      ) : mark.label === "score" ? (
        <>
          <strong>Score</strong>
          <em>{sessionTimestamp}</em>
        </>
      ) : (
        <>
          <strong>{title}</strong>
          <em>{sessionTimestamp}</em>
        </>
      )}
    </div>
  );
}
