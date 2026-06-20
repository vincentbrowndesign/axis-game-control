"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Camera, ChevronDown, Mic, Plus, Search, Star, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AXIS_ROOM_COLORS, AXIS_STATUS_STYLES } from "../../../lib/axis-visual-language";
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
  "proof",
  "turnover",
  "rushing",
  "spacing",
  "score",
  "stop",
  "teach",
  "question",
  "clip",
  "custom",
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

  return (
    <main
      className={styles.labRoot}
      style={{
        "--lab-action": AXIS_STATUS_STYLES.use.accent,
        "--lab-context": AXIS_ROOM_COLORS.parked,
        "--lab-grid": AXIS_ROOM_COLORS.grid,
        "--lab-ink": AXIS_ROOM_COLORS.ink,
        "--lab-line": AXIS_ROOM_COLORS.line,
        "--lab-paper": AXIS_ROOM_COLORS.paper,
        "--lab-proof": AXIS_STATUS_STYLES.proof.accent,
        "--lab-room": AXIS_ROOM_COLORS.room,
      } as CSSProperties}
      aria-label="Axis Lab Context Bank dashboard preview"
    >
      <div className={styles.appSurface}>
        <DashboardHeader />
        {previewState === "empty" ? <EmptyDashboard /> : <DashboardBody expanded={previewState === "expanded"} />}
      </div>
    </main>
  );
}

function DashboardHeader() {
  return (
    <header className={styles.labHeader}>
      <div className={styles.headerLeft}>
        <span className={styles.wordmark}>Axis</span>
        <span className={styles.headerSeparator} aria-hidden="true" />
        <button className={styles.threadSwitch} type="button" aria-label="Thread preview selector">
          <span>{axisLabDashboard.threadTitle}</span>
          <ChevronDown size={14} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.headerCenter} aria-label="Saved preview status">
        <span className={styles.savedDot} aria-hidden="true" />
        <span>Saved</span>
        <span className={styles.statusDot} aria-hidden="true" />
        <time dateTime="2026-06-20T20:42:00-05:00">{axisLabDashboard.savedAt}</time>
      </div>

      <div className={styles.headerRight}>
        <IconButton label="Search preview">
          <Search size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label="Star preview">
          <Star size={16} aria-hidden="true" />
        </IconButton>
        <span className={styles.avatar} aria-label="Preview user avatar">
          V
        </span>
      </div>
    </header>
  );
}

function DashboardBody({ expanded }: { expanded: boolean }) {
  const sessionStartedAtRef = useRef<number | null>(null);
  const [realityMarks, setRealityMarks] = useState<AxisRealityMark[]>([]);

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
    () => [...realityMarks.filter((mark) => PROOF_CANDIDATE_LABELS.has(mark.label)).map(createMarkProofCandidate), ...axisLabDashboard.proofCandidates],
    [realityMarks],
  );
  const recentReality = useMemo(
    () => [...realityMarks.map(createMarkRecentReality), ...axisLabDashboard.recentReality],
    [realityMarks],
  );

  const createRealityMark = useCallback((label: AxisRealityMarkLabel, note?: string) => {
    const now = Date.now();
    if (sessionStartedAtRef.current === null) {
      sessionStartedAtRef.current = now;
    }
    const createdAt = new Date().toISOString();
    const elapsedSeconds = Math.max(0, Math.floor((now - sessionStartedAtRef.current) / 1000));
    setRealityMarks((current) => [
      {
        id: createMarkId(),
        label,
        note: note?.trim() || undefined,
        sourceType: "manual",
        verification: "unverified",
        sessionTime: elapsedSeconds,
        createdAt,
      },
      ...current,
    ]);
  }, []);

  return (
    <>
      <section className={styles.dashboardGrid} aria-label="Context Bank dashboard mock">
        <TimelineRegion markEvents={markTimelineEvents} />
        <ActiveContextRegion expanded={expanded} />
        <RightRegion proofCandidates={proofCandidates} />
      </section>
      <DashboardComposer onCreateRealityMark={createRealityMark} />
      <RecentRealityShelf items={recentReality} />
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

function EmptyDashboard() {
  return (
    <section className={styles.emptyDashboard} aria-labelledby="axis-lab-empty-title">
      <p className={styles.regionEyebrow}>Active context</p>
      <h1 id="axis-lab-empty-title">Say the rough version.</h1>
      <p>The Context Bank preview is ready, but this lab state stays mock-only.</p>
    </section>
  );
}

function TimelineRegion({ markEvents }: { markEvents: AxisLabTimelineEvent[] }) {
  const timelineEvents = [...axisLabDashboard.timeline, ...[...markEvents].reverse()];

  return (
    <aside className={styles.timelineRegion} aria-labelledby="axis-lab-timeline-title">
      <h2 id="axis-lab-timeline-title">Thread Timeline</h2>
      <ol className={styles.timelineList}>
        {timelineEvents.map((event) => (
          <li className={styles.timelineItem} key={event.mark?.id ?? `${event.time}-${event.title}`}>
            <span className={styles.timelineDot} aria-hidden="true" />
            <time>{event.time}</time>
            <strong>{event.title}</strong>
            {event.detail && <p>{event.detail}</p>}
            {event.mark && (
              <p className={styles.realityMeta}>
                Manual · Unverified
                {typeof event.mark.sessionTime === "number" ? ` · ${getSessionTimestamp(event.mark.sessionTime)}` : ""}
              </p>
            )}
            {event.mediaLabel && (
              <div className={event.meta ? styles.waveformPreview : styles.miniThumb}>
                <span>{event.mediaLabel}</span>
                {event.meta && <em>{event.meta}</em>}
              </div>
            )}
          </li>
        ))}
      </ol>
      <button className={styles.addMoment} type="button">
        <Plus size={18} aria-hidden="true" />
        <span>Add moment</span>
      </button>
    </aside>
  );
}

function ActiveContextRegion({ expanded }: { expanded: boolean }) {
  const context = axisLabDashboard.activeContext;

  return (
    <section className={styles.contextRegion} aria-labelledby="axis-lab-context-title">
      <span className={styles.contextPill}>Active Context</span>
      <h1 id="axis-lab-context-title">{context.mainText}</h1>
      <p className={styles.contextSupport}>{context.support}</p>

      <div className={styles.contextPair}>
        <section className={styles.contextMiniBlock}>
          <h2>Proof Needed</h2>
          <p>{context.proofNeeded}</p>
        </section>
        <section className={styles.contextMiniBlock}>
          <h2>Next Move</h2>
          <p>{context.nextMove}</p>
        </section>
      </div>

      <section className={styles.keeperBlock}>
        <div>
          <h2>Keeper</h2>
          <p>{context.keeper}</p>
        </div>
        <Bookmark size={18} aria-label="Keeper preview bookmark" />
      </section>

      {expanded && (
        <section className={styles.expandedMock} aria-label="Expanded preview detail">
          <h2>Selected mock detail</h2>
          <p>Source-only items stay separate from suggested interpretation until the user accepts the read.</p>
        </section>
      )}

      <div className={styles.tagRow} aria-label="Topic chips">
        {context.tags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
        <button type="button" aria-label="Add topic preview">
          <Plus size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

function RightRegion({ proofCandidates }: { proofCandidates: AxisLabProofCandidate[] }) {
  return (
    <aside className={styles.rightRegion} aria-label="Context intelligence preview">
      <section className={styles.rightSection}>
        <HeaderCount title="Proof Candidates" count={proofCandidates.length} />
        <div className={styles.proofList}>
          {proofCandidates.map((candidate) => (
            <ProofCard
              candidate={candidate}
              key={candidate.id ?? `${candidate.title}-${candidate.time ?? candidate.duration}`}
            />
          ))}
        </div>
      </section>

      <section className={styles.rightSection}>
        <HeaderCount title="Open Loops" count={axisLabDashboard.openLoops.length} />
        <ul className={styles.loopList}>
          {axisLabDashboard.openLoops.map((loop) => (
            <li key={loop}>
              <button type="button" aria-label={`Mark preview loop complete: ${loop}`} />
              <p>{loop}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.rightSection}>
        <h2>Actions</h2>
        {axisLabDashboard.actions.map((action) => (
          <article className={styles.actionCard} key={action.title}>
            <p>{action.title}</p>
            <span>Due: {action.due}</span>
          </article>
        ))}
        <button className={styles.addAction} type="button">
          <Plus size={14} aria-hidden="true" />
          Add action
        </button>
      </section>
    </aside>
  );
}

function HeaderCount({ count, title }: { count: number; title: string }) {
  return (
    <div className={styles.sectionHeader}>
      <h2>{title}</h2>
      <span>{count}</span>
    </div>
  );
}

function ProofCard({ candidate }: { candidate: AxisLabProofCandidate }) {
  return (
    <article className={styles.proofCard}>
      <div className={styles.mockThumb}>
        <span>{candidate.duration}</span>
      </div>
      <div>
        <h3>{candidate.title}</h3>
        {candidate.source && <p>{candidate.source}</p>}
        <p>{candidate.meta}</p>
        {candidate.time && <p>{candidate.time}</p>}
        <span className={styles.unverified}>
          <span aria-hidden="true" />
          {candidate.confidence ?? "Unverified"}
        </span>
        {candidate.boundary && <p className={styles.boundaryText}>{candidate.boundary}</p>}
      </div>
    </article>
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
    <form
      className={styles.dashboardComposer}
      aria-label="Preview composer"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className={styles.srOnly} htmlFor="axis-lab-dashboard-composer">
        Say the rough version
      </label>
      <input id="axis-lab-dashboard-composer" placeholder="Say the rough version..." />
      <div className={styles.composerControls} aria-label="Preview-only controls">
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
      </div>
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
    </form>
  );
}

function RecentRealityShelf({ items }: { items: AxisLabRecentReality[] }) {
  return (
    <section className={styles.recentShelf} aria-labelledby="axis-lab-recent-title">
      <div className={styles.recentHeader}>
        <h2 id="axis-lab-recent-title">Recent Reality</h2>
        <button type="button">View all</button>
      </div>
      <div className={styles.recentRow}>
        {items.map((item) => (
          <RecentRealityItem item={item} key={item.mark?.id ?? item.title} />
        ))}
      </div>
    </section>
  );
}

function RecentRealityItem({ item }: { item: AxisLabRecentReality }) {
  if (item.mark) {
    return <RealityMarkCard mark={item.mark} />;
  }

  return (
    <article className={styles.recentItem}>
      <div className={`${styles.recentThumb} ${styles[`recent-${item.kind.toLowerCase()}`]}`}>
        {item.duration ? <span>{item.duration}</span> : <Plus size={14} aria-hidden="true" />}
      </div>
      <h3>{item.title}</h3>
      <p>
        {item.kind}
        {item.time ? ` - ${item.time}` : ""}
      </p>
    </article>
  );
}

function RealityMarkCard({ mark }: { mark: AxisRealityMark }) {
  const sessionTimestamp = getSessionTimestamp(mark.sessionTime);
  const title = getMarkTitle(mark.label);

  return (
    <article className={`${styles.recentItem} ${styles.realityMarkCard} ${styles[`markPreview-${mark.label}`]}`}>
      <div className={styles.realityMarkPreview}>
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
      <h3>{title}</h3>
      {mark.note && <p>{mark.note}</p>}
      <p>
        {sessionTimestamp ? `${sessionTimestamp} · ` : ""}
        {getClockTime(mark.createdAt)}
      </p>
      <p>Manual · Unverified</p>
    </article>
  );
}

function IconButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button className={styles.iconButton} type="button" aria-label={label}>
      {children}
    </button>
  );
}
