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
  "reality",
  "proof",
  "turnover",
  "rushing",
  "spacing",
  "score",
  "stop",
  "foul",
  "teach",
  "question",
  "clip",
  "custom",
];
const GAME_MARK_LABELS: AxisRealityMarkLabel[] = [
  "score",
  "stop",
  "turnover",
  "rushing",
  "spacing",
  "foul",
  "question",
  "clip",
];
const PROOF_CANDIDATE_LABELS = new Set<AxisRealityMarkLabel>([
  "proof",
  "turnover",
  "rushing",
  "spacing",
  "stop",
  "clip",
]);

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
  const sessionStartedAtRef = useRef<number | null>(null);
  const [realityMarks, setRealityMarks] = useState<AxisRealityMark[]>([]);
  const [mobileBoardOpen, setMobileBoardOpen] = useState(false);

  const markTimelineEvents = useMemo<AxisLabTimelineEvent[]>(
    () =>
      realityMarks.map((mark) => ({
        detail: getMarkTitle(mark.label),
        mark,
        meta: "Manual · Unverified",
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

  const createRealityMark = useCallback((label: AxisRealityMarkLabel, note?: string, source: AxisRealityMark["source"] = "chip") => {
    const now = Date.now();
    if (sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = now;
    }
    const createdAt = new Date().toISOString();
    const elapsedSeconds = Math.max(0, Math.floor((now - sessionStartedAtRef.current) / 1000));
    setRealityMarks((current) => [
      {
        createdAt,
        id: createMarkId(),
        label,
        note: note?.trim() || undefined,
        source,
        sessionTime: elapsedSeconds,
        sourceType: "manual",
        verification: "unverified",
      },
      ...current,
    ]);
  }, []);
  const undoLastRealityMark = useCallback(() => {
    setRealityMarks((current) => current.slice(1));
  }, []);

  const activeContext =
    state === "empty"
      ? undefined
      : {
          ...axisLabDashboard.activeContext,
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
        meta: event.mark
          ? `Manual · Unverified${
              typeof event.mark.sessionTime === "number" ? ` · ${getSessionTimestamp(event.mark.sessionTime)}` : ""
            }`
          : event.meta,
        time: event.time,
        title: event.title,
      }))}
        />
      </div>
      <MobileGameSurface
        boardOpen={mobileBoardOpen}
        marks={realityMarks}
        onCloseBoard={() => setMobileBoardOpen(false)}
        onCreateRealityMark={createRealityMark}
        onOpenBoard={() => setMobileBoardOpen(true)}
        onUndoLast={undoLastRealityMark}
      />
    </>
  );
}

function createMarkProofCandidate(mark: AxisRealityMark): AxisLabProofCandidate {
  const timestamp = getSessionTimestamp(mark.sessionTime);
  return {
    boundary: "Needs confirmation",
    confidence: "Unverified",
    duration: timestamp || "Manual",
    id: mark.id,
    meta: "Manual Reality Mark",
    source: "Manual Reality Mark",
    time: timestamp || getClockTime(mark.createdAt),
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
        `${markTimestamp ? `${markTimestamp} · ` : ""}${getClockTime(item.mark.createdAt)}`,
        "Manual · Unverified",
      ].filter((line): line is string => Boolean(line))
    : undefined;

  return {
    duration: item.duration,
    id: item.mark?.id ?? item.title,
    kind: item.kind,
    meta: markMeta,
    preview: item.mark ? <RealityMarkPreview mark={item.mark} /> : undefined,
    time: item.time,
    title: item.title,
  };
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
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string, source?: AxisRealityMark["source"]) => void;
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
    onCreateRealityMark(label, undefined, "chip");
    closeMenu();
  }

  function createCustomMark() {
    const note = customValue.trim();
    if (!note) return;
    onCreateRealityMark("custom", note, "text");
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
  marks,
  onCloseBoard,
  onCreateRealityMark,
  onOpenBoard,
  onUndoLast,
}: {
  boardOpen: boolean;
  marks: AxisRealityMark[];
  onCloseBoard: () => void;
  onCreateRealityMark: (label: AxisRealityMarkLabel, note?: string, source?: AxisRealityMark["source"]) => void;
  onOpenBoard: () => void;
  onUndoLast: () => void;
}) {
  return (
    <main className={styles.gameSurface} aria-label="Axis Lab mobile game surface">
      <header className={styles.gameHeader}>
        <span>AXIS</span>
        <strong>{axisLabDashboard.threadTitle}</strong>
        <em>Local</em>
      </header>

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
        onClick={() => onCreateRealityMark("reality", undefined, "button")}
      >
        Mark Reality
      </button>

      <section className={styles.quickMarks} aria-label="Quick Reality Marks">
        {GAME_MARK_LABELS.map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onCreateRealityMark(label, undefined, "chip")}
          >
            {getMarkTitle(label)}
          </button>
        ))}
      </section>

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
                  {getSessionTimestamp(mark.sessionTime) || getClockTime(mark.createdAt)}
                </time>
                <strong>{getMarkTitle(mark.label)}</strong>
                {mark.note && <span>{mark.note}</span>}
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
            <h3>Next Cue</h3>
            <p>{axisLabDashboard.activeContext.nextMove}</p>
            <h3>Need To Check</h3>
            <ul>
              {axisLabDashboard.openLoops.map((loop) => (
                <li key={loop}>{loop}</li>
              ))}
            </ul>
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
          <strong>Clip mark</strong>
          <em>No media attached</em>
          {sessionTimestamp && <b>{sessionTimestamp}</b>}
        </>
      ) : mark.label === "question" ? (
        <strong>?</strong>
      ) : mark.label === "score" ? (
        <strong>00</strong>
      ) : (
        <strong>{title}</strong>
      )}
    </div>
  );
}
