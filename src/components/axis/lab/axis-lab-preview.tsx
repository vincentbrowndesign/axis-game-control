"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Mic, Plus, Type, Upload, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AxisContextComposer } from "../context-dashboard/axis-context-composer";
import { IconButton } from "../context-dashboard/axis-context-header";
import type { AxisContextRecentItem } from "../context-dashboard/axis-context-dashboard-types";
import { axisLabDashboard } from "./axis-lab-mock-data";
import type {
  AxisGameSession,
  AxisLabGameSource,
  AxisLabPreviewState,
  AxisLabProofCandidate,
  AxisLabRecentReality,
  AxisLabTimelineEvent,
  AxisLabSourceType,
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

function createSourceId() {
  return `source-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyGameSource(): AxisLabGameSource {
  return {
    id: createSourceId(),
    label: "No source",
    status: "idle",
    type: "none",
  };
}

function getMarkSourceType(sourceType: AxisLabSourceType): AxisRealityMark["sourceType"] {
  if (sourceType === "link" || sourceType === "mock_camera") return sourceType;
  return "manual";
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

  return <DashboardPreview state={previewState} />;
}

function DashboardPreview({
  state,
}: {
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
  const [gameSource, setGameSource] = useState<AxisLabGameSource>(() => createEmptyGameSource());
  const [sourceMessage, setSourceMessage] = useState("");
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
    () => [
      ...realityMarks.map(createMarkRecentReality),
      ...(gameSource.type === "none" ? [] : [createSourceRecentReality(gameSource)]),
      ...axisLabDashboard.recentReality,
    ],
    [gameSource, realityMarks],
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
        linkedSourceId: gameSource.type === "none" ? undefined : gameSource.id,
        note: note?.trim() || undefined,
        postRollSeconds: 10,
        preRollSeconds: 15,
        provenance: "manual",
        sessionTime: elapsedSeconds,
        sourceTime,
        sourceType: getMarkSourceType(gameSource.type),
        verification: "unverified",
      },
      ...current,
    ]);
    setLastMarkToastId(markId);
    setToastNoteOpen(false);
    setToastNote("");
  }, [gameSession.id, gameSession.status, gameSource.id, gameSource.type, sessionStartedAtMs, sourceStartedAtMs]);
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
    const nowMs = Date.now();
    const now = new Date(nowMs).toISOString();
    setSourceStartedAtMs(nowMs);
    setGameSource((current) => ({
      ...current,
      label: current.type === "none" ? "Local source clock" : current.label,
      startedAt: now,
      status: "live",
      type: current.type === "none" ? "manual" : current.type,
    }));
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
    setGameSource((current) => current.status === "idle" ? current : { ...current, status: "ended" });
  }, []);

  const setLinkedSource = useCallback((url: string) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    setGameSource({
      id: createSourceId(),
      label: "Linked source",
      status: "ready",
      type: "link",
      url: trimmedUrl,
    });
    setSourceMessage("Linked source only - no analysis.");
  }, []);

  const setMockCameraSource = useCallback(() => {
    setGameSource({
      id: createSourceId(),
      label: "Mock camera",
      status: "ready",
      type: "mock_camera",
    });
    setSourceMessage("Mock camera preview - no camera connected.");
  }, []);

  const showStartSessionMessage = useCallback(() => {
    setSourceMessage("Start session first.");
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

  const proofCandidateItems = proofCandidates.map((candidate, index) => ({
    ...candidate,
    id: candidate.id ?? `${candidate.title}-${index}`,
  }));
  const recentItems = recentReality.map(createRecentItem);
  const timelineItems = [...axisLabDashboard.timeline, ...[...markTimelineEvents].reverse()].map((event, index) => ({
    detail: event.detail,
    id: event.mark?.id ?? `${event.time}-${event.title}-${index}`,
    mediaKind: event.meta ? "voice" as const : "clip" as const,
    mediaLabel: event.mediaLabel,
    meta: event.meta,
    time: event.time,
    title: event.mark ? getMarkTitle(event.mark.label) : event.title,
  }));

  return (
    <>
      <div className={styles.desktopLabPreview}>
        {state === "empty" ? (
          <main className={styles.labRoot} aria-label="Axis Lab game source surface empty preview">
            <div className={styles.appSurface}>
              <LabGameHeader />
              <EmptyDashboard />
            </div>
          </main>
        ) : (
          <GameSourceLabShell
            actions={axisLabDashboard.actions.map((action) => ({ ...action, id: action.title }))}
            gameSession={gameSession}
            gameSource={gameSource}
            liveRead={liveRead}
            marks={realityMarks}
            onCreateRealityMark={createRealityMark}
            onEndSession={endSession}
            onLinkSource={setLinkedSource}
            onMockCamera={setMockCameraSource}
            onPauseSession={pauseSession}
            onResumeSession={resumeSession}
            onStartSession={startSession}
            onStartSessionMessage={showStartSessionMessage}
            onStartSource={startSource}
            openLoops={axisLabDashboard.openLoops.map((loop) => ({ id: loop, text: loop }))}
            proofCandidates={proofCandidateItems}
            recentItems={recentItems}
            sessionElapsed={sessionElapsed}
            sourceElapsed={sourceElapsed}
            sourceMessage={sourceMessage}
            timelineItems={timelineItems}
          />
        )}
      </div>
      <MobileGameSurface
        boardOpen={mobileBoardOpen}
        gameSession={gameSession}
        gameSource={gameSource}
        liveRead={liveRead}
        marks={realityMarks}
        onAddToastNote={addToastNote}
        onCloseBoard={() => setMobileBoardOpen(false)}
        onCreateRealityMark={createRealityMark}
        onEndSession={endSession}
        onLinkSource={setLinkedSource}
        onMockCamera={setMockCameraSource}
        onOpenBoard={() => setMobileBoardOpen(true)}
        onPauseSession={pauseSession}
        onResumeSession={resumeSession}
        onStartSession={startSession}
        onStartSessionMessage={showStartSessionMessage}
        onStartSource={startSource}
        onUndoLast={undoLastRealityMark}
        sessionElapsed={sessionElapsed}
        sourceElapsed={sourceElapsed}
        sourceMessage={sourceMessage}
        toastMark={toastMark}
        toastNote={toastNote}
        toastNoteOpen={toastNoteOpen}
        onToastNoteChange={setToastNote}
        onToastNoteOpen={() => setToastNoteOpen(true)}
      />
    </>
  );
}

function LabGameHeader() {
  return (
    <header className={styles.labHeader}>
      <div className={styles.headerLeft}>
        <span className={styles.wordmark}>Axis</span>
        <span className={styles.headerSeparator} aria-hidden="true" />
        <button className={styles.threadSwitch} type="button">
          <span>{axisLabDashboard.threadTitle}</span>
        </button>
      </div>
      <div className={styles.headerCenter}>
        <span className={styles.savedDot} aria-hidden="true" />
        <span>Local preview</span>
      </div>
      <div className={styles.headerRight}>
        <span className={styles.realityMeta}>Lab only</span>
      </div>
    </header>
  );
}

function GameSourceLabShell({
  actions,
  gameSession,
  gameSource,
  liveRead,
  marks,
  onCreateRealityMark,
  onEndSession,
  onLinkSource,
  onMockCamera,
  onPauseSession,
  onResumeSession,
  onStartSession,
  onStartSessionMessage,
  onStartSource,
  openLoops,
  proofCandidates,
  recentItems,
  sessionElapsed,
  sourceElapsed,
  sourceMessage,
  timelineItems,
}: {
  actions: readonly { due?: string; id: string; title: string }[];
  gameSession: AxisGameSession;
  gameSource: AxisLabGameSource;
  liveRead: AxisLiveRead;
  marks: AxisRealityMark[];
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string) => void;
  onEndSession: () => void;
  onLinkSource: (url: string) => void;
  onMockCamera: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStartSession: () => void;
  onStartSessionMessage: () => void;
  onStartSource: () => void;
  openLoops: readonly { id: string; text: string }[];
  proofCandidates: readonly (AxisLabProofCandidate & { id: string })[];
  recentItems: readonly AxisContextRecentItem[];
  sessionElapsed?: number;
  sourceElapsed?: number;
  sourceMessage: string;
  timelineItems: readonly {
    detail?: string;
    id: string;
    mediaLabel?: string;
    meta?: string;
    time: string;
    title: string;
  }[];
}) {
  return (
    <main className={styles.labRoot} aria-label="Axis Lab game source surface">
      <div className={styles.appSurface}>
        <LabGameHeader />
        <section className={`${styles.dashboardGrid} ${styles.gameSourceGrid}`} aria-label="Game source surface">
          <LabTimeline items={timelineItems} />
          <section className={styles.contextRegion} aria-label="Game source">
            <SourceWindow
              gameSession={gameSession}
              gameSource={gameSource}
              marks={marks}
              onEndSession={onEndSession}
              onLinkSource={onLinkSource}
              onMockCamera={onMockCamera}
              onPauseSession={onPauseSession}
              onResumeSession={onResumeSession}
              onStartSession={onStartSession}
              onStartSource={onStartSource}
              sessionElapsed={sessionElapsed}
              sourceElapsed={sourceElapsed}
              sourceMessage={sourceMessage}
            />
          </section>
          <LabGameRail
            actions={actions}
            liveRead={liveRead}
            openLoops={openLoops}
            proofCandidates={proofCandidates}
          />
        </section>
        <DashboardComposer
          canCreateMark={gameSession.status === "live"}
          onCreateRealityMark={onCreateRealityMark}
          onStartSessionMessage={onStartSessionMessage}
        />
        <LabRecentRealityShelf items={recentItems} />
      </div>
    </main>
  );
}

function LabTimeline({
  items,
}: {
  items: readonly {
    detail?: string;
    id: string;
    mediaLabel?: string;
    meta?: string;
    time: string;
    title: string;
  }[];
}) {
  return (
    <aside className={styles.timelineRegion} aria-label="Thread timeline">
      <h2>Timeline</h2>
      <ol className={styles.timelineList}>
        {items.map((item) => (
          <li className={styles.timelineItem} key={item.id}>
            <span className={styles.timelineDot} aria-hidden="true" />
            <time>{item.time}</time>
            <strong>{item.title}</strong>
            {item.detail && <p>{item.detail}</p>}
            {item.meta && <p>{item.meta}</p>}
          </li>
        ))}
      </ol>
    </aside>
  );
}

function SourceWindow({
  gameSession,
  gameSource,
  marks,
  onEndSession,
  onLinkSource,
  onMockCamera,
  onPauseSession,
  onResumeSession,
  onStartSession,
  onStartSource,
  sessionElapsed,
  sourceElapsed,
  sourceMessage,
}: {
  gameSession: AxisGameSession;
  gameSource: AxisLabGameSource;
  marks: AxisRealityMark[];
  onEndSession: () => void;
  onLinkSource: (url: string) => void;
  onMockCamera: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStartSession: () => void;
  onStartSource: () => void;
  sessionElapsed?: number;
  sourceElapsed?: number;
  sourceMessage: string;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const sourceStateLabel = getSourceStateLabel(gameSource, gameSession.status);

  function submitLink() {
    const trimmed = linkValue.trim();
    if (!trimmed) return;
    onLinkSource(trimmed);
    setLinkOpen(false);
    setLinkValue("");
  }

  return (
    <section className={styles.sourceWindowBlock} aria-labelledby="axis-lab-source-title">
      <div className={`${styles.sourceFrame} ${styles[`sourceFrame-${gameSource.type}`]}`}>
        <div className={styles.sourceFrameTopline}>
          <span>{sourceStateLabel}</span>
          <span>Manual - Unverified - Local preview</span>
        </div>
        {gameSource.type === "none" ? (
          <div className={styles.sourcePlaceholder}>
            <h1 id="axis-lab-source-title">Add game source</h1>
            <p>Paste a video link or start a local game clock.</p>
          </div>
        ) : gameSource.type === "link" ? (
          <div className={styles.linkedSourceCard}>
            <p className={styles.regionEyebrow}>Linked source only - no analysis.</p>
            <h1 id="axis-lab-source-title">{gameSource.label}</h1>
            {gameSource.url && (
              <a href={gameSource.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            )}
            <p>{gameSource.url}</p>
          </div>
        ) : gameSource.type === "mock_camera" ? (
          <div className={styles.mockCameraFrame}>
            <h1 id="axis-lab-source-title">Mock camera</h1>
            <p>Mock camera preview - no camera connected.</p>
          </div>
        ) : (
          <div className={styles.sourcePlaceholder}>
            <h1 id="axis-lab-source-title">Local source clock</h1>
            <p>Local source clock - no media connected.</p>
          </div>
        )}
        <div className={styles.sourceClockRow}>
          <span>Session {sessionElapsed === undefined ? "--:--" : getSessionTimestamp(sessionElapsed)}</span>
          <span>Source {sourceElapsed === undefined ? "--:--" : getSessionTimestamp(sourceElapsed)}</span>
          <span>{marks.length} mark{marks.length === 1 ? "" : "s"}</span>
        </div>
        <p className={styles.sourceCue}>Mark moments now. Review later.</p>
      </div>

      <div className={styles.sourceControls}>
        <button type="button" onClick={() => setLinkOpen((current) => !current)}>
          Paste link
        </button>
        <button type="button" onClick={onMockCamera}>
          Mock camera
        </button>
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

      {linkOpen && (
        <div className={styles.sourceLinkRow}>
          <label className={styles.srOnly} htmlFor="axis-lab-source-link">Video source URL</label>
          <input
            id="axis-lab-source-link"
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitLink();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setLinkOpen(false);
                setLinkValue("");
              }
            }}
            placeholder="Paste video link..."
          />
          <button type="button" onClick={submitLink} disabled={!linkValue.trim()}>
            Link
          </button>
        </div>
      )}
      {sourceMessage && <p className={styles.sourceMessage}>{sourceMessage}</p>}
      {gameSession.status === "ended" && (
        <p className={styles.sourceMessage}>Final local mark count: {marks.length}</p>
      )}
    </section>
  );
}

function getSourceStateLabel(gameSource: AxisLabGameSource, sessionStatus: AxisGameSession["status"]) {
  if (sessionStatus === "ended" || gameSource.status === "ended") return "Source ended";
  if (sessionStatus === "paused" || gameSource.status === "paused") return "Source paused";
  if (sessionStatus === "live" || gameSource.status === "live") return "Source active";
  if (gameSource.type === "link") return "Link source";
  if (gameSource.type === "mock_camera") return "Mock camera source";
  return "No source";
}

function LabGameRail({
  actions,
  liveRead,
  openLoops,
  proofCandidates,
}: {
  actions: readonly { due?: string; id: string; title: string }[];
  liveRead: AxisLiveRead;
  openLoops: readonly { id: string; text: string }[];
  proofCandidates: readonly (AxisLabProofCandidate & { id: string })[];
}) {
  return (
    <aside className={styles.rightRegion} aria-label="Live read and review">
      <section className={styles.rightSection}>
        <div className={styles.sectionHeader}>
          <h2>Live Read</h2>
        </div>
        <dl className={styles.labLiveReadList}>
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
      {proofCandidates.length > 0 && (
        <section className={styles.rightSection}>
          <div className={styles.sectionHeader}>
            <h2>Proof Candidates</h2>
            <span>{proofCandidates.length}</span>
          </div>
          <div className={styles.proofList}>
            {proofCandidates.map((candidate) => (
              <article className={styles.proofCard} key={candidate.id}>
                <div className={styles.mockThumb}>
                  <span>{candidate.duration}</span>
                </div>
                <div>
                  <h3>{candidate.title}</h3>
                  <p>{candidate.source}</p>
                  <p>{candidate.meta}</p>
                  <span className={styles.unverified}>
                    <span aria-hidden="true" />
                    {candidate.confidence ?? "Unverified"}
                  </span>
                  {candidate.boundary && <p className={styles.boundaryText}>{candidate.boundary}</p>}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {openLoops.length > 0 && (
        <section className={styles.rightSection}>
          <div className={styles.sectionHeader}>
            <h2>Open Loops</h2>
            <span>{openLoops.length}</span>
          </div>
          <ul className={styles.loopList}>
            {openLoops.map((loop) => (
              <li key={loop.id}>
                <span className={styles.statusDot} aria-hidden="true" />
                <p>{loop.text}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      {actions.length > 0 && (
        <section className={styles.rightSection}>
          <h2>Actions</h2>
          {actions.map((action) => (
            <article className={styles.actionCard} key={action.id}>
              <p>{action.title}</p>
              {action.due && <span>Due: {action.due}</span>}
            </article>
          ))}
        </section>
      )}
    </aside>
  );
}

function LabRecentRealityShelf({ items }: { items: readonly AxisContextRecentItem[] }) {
  if (items.length === 0) return null;

  return (
    <section className={styles.recentShelf} aria-labelledby="axis-lab-recent-title">
      <div className={styles.recentHeader}>
        <h2 id="axis-lab-recent-title">Recent Reality</h2>
      </div>
      <div className={styles.recentRow}>
        {items.map((item) => (
          <article className={styles.recentItem} key={item.id}>
            {item.preview}
            <h3>{item.title}</h3>
            <p>
              {item.kind}
              {item.time ? ` - ${item.time}` : ""}
            </p>
            {item.meta?.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </article>
        ))}
      </div>
    </section>
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

function createSourceRecentReality(source: AxisLabGameSource): AxisLabRecentReality {
  return {
    kind: "Source",
    time: source.startedAt ? getClockTime(source.startedAt) : undefined,
    title: source.type === "link"
      ? "Linked source"
      : source.type === "mock_camera"
        ? "Mock camera source"
        : "Local source clock",
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
  canCreateMark = true,
  onCreateRealityMark,
  onStartSessionMessage,
}: {
  canCreateMark?: boolean;
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string) => void;
  onStartSessionMessage?: () => void;
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
    if (!canCreateMark) {
      onStartSessionMessage?.();
      return;
    }
    onCreateRealityMark(label);
    closeMenu();
  }

  function createCustomMark() {
    const note = customValue.trim();
    if (!note) return;
    if (!canCreateMark) {
      onStartSessionMessage?.();
      return;
    }
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
  gameSource,
  liveRead,
  marks,
  onAddToastNote,
  onCloseBoard,
  onCreateRealityMark,
  onEndSession,
  onLinkSource,
  onMockCamera,
  onOpenBoard,
  onPauseSession,
  onResumeSession,
  onStartSession,
  onStartSessionMessage,
  onStartSource,
  onToastNoteChange,
  onToastNoteOpen,
  onUndoLast,
  sessionElapsed,
  sourceElapsed,
  sourceMessage,
  toastMark,
  toastNote,
  toastNoteOpen,
}: {
  boardOpen: boolean;
  gameSession: AxisGameSession;
  gameSource: AxisLabGameSource;
  liveRead: AxisLiveRead;
  marks: AxisRealityMark[];
  onAddToastNote: () => void;
  onCloseBoard: () => void;
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string) => void;
  onEndSession: () => void;
  onLinkSource: (url: string) => void;
  onMockCamera: () => void;
  onOpenBoard: () => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStartSession: () => void;
  onStartSessionMessage: () => void;
  onStartSource: () => void;
  onToastNoteChange: (value: string) => void;
  onToastNoteOpen: () => void;
  onUndoLast: () => void;
  sessionElapsed?: number;
  sourceElapsed?: number;
  sourceMessage: string;
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
    if (!canMark) {
      onStartSessionMessage();
      return;
    }
    if (label === "custom") {
      setMobileCustomOpen(true);
      return;
    }
    onCreateRealityMark(label);
  }

  function createMobileCustomMark() {
    const note = mobileCustomValue.trim();
    if (!note) return;
    if (!canMark) {
      onStartSessionMessage();
      return;
    }
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

      <SourceWindow
        gameSession={gameSession}
        gameSource={gameSource}
        marks={marks}
        onEndSession={onEndSession}
        onLinkSource={onLinkSource}
        onMockCamera={onMockCamera}
        onPauseSession={onPauseSession}
        onResumeSession={onResumeSession}
        onStartSession={onStartSession}
        onStartSource={onStartSource}
        sessionElapsed={sessionElapsed}
        sourceElapsed={sourceElapsed}
        sourceMessage={sourceMessage}
      />

      <button
        className={styles.markRealityButton}
        type="button"
        onClick={() => {
          if (!canMark) {
            onStartSessionMessage();
            return;
          }
          onCreateRealityMark("proof");
        }}
        disabled={gameSession.status === "ended"}
      >
        Add Reality Mark
      </button>

      <section className={styles.quickMarks} aria-label="Quick Reality Marks">
        {GAME_MARK_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => createMobileMark(label)}
            disabled={gameSession.status === "ended"}
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
