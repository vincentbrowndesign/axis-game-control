"use client";

import type { CSSProperties, ReactNode } from "react";
import { Bookmark, Camera, ChevronDown, Mic, Plus, Search, Star, Upload } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AXIS_ROOM_COLORS, AXIS_STATUS_STYLES } from "../../../lib/axis-visual-language";
import { axisLabDashboard } from "./axis-lab-mock-data";
import type { AxisLabPreviewState, AxisLabProofCandidate, AxisLabRecentReality } from "./axis-lab-types";
import styles from "./axis-lab.module.css";

const VALID_STATES: AxisLabPreviewState[] = ["empty", "active", "expanded"];

function parsePreviewState(value: string | null): AxisLabPreviewState {
  return VALID_STATES.includes(value as AxisLabPreviewState)
    ? (value as AxisLabPreviewState)
    : "active";
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
  return (
    <>
      <section className={styles.dashboardGrid} aria-label="Context Bank dashboard mock">
        <TimelineRegion />
        <ActiveContextRegion expanded={expanded} />
        <RightRegion />
      </section>
      <DashboardComposer />
      <RecentRealityShelf />
    </>
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

function TimelineRegion() {
  return (
    <aside className={styles.timelineRegion} aria-labelledby="axis-lab-timeline-title">
      <h2 id="axis-lab-timeline-title">Thread Timeline</h2>
      <ol className={styles.timelineList}>
        {axisLabDashboard.timeline.map((event) => (
          <li className={styles.timelineItem} key={`${event.time}-${event.title}`}>
            <span className={styles.timelineDot} aria-hidden="true" />
            <time>{event.time}</time>
            <strong>{event.title}</strong>
            {event.detail && <p>{event.detail}</p>}
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

function RightRegion() {
  return (
    <aside className={styles.rightRegion} aria-label="Context intelligence preview">
      <section className={styles.rightSection}>
        <HeaderCount title="Proof Candidates" count={axisLabDashboard.proofCandidates.length} />
        <div className={styles.proofList}>
          {axisLabDashboard.proofCandidates.map((candidate) => (
            <ProofCard candidate={candidate} key={candidate.title} />
          ))}
        </div>
      </section>

      <section className={styles.rightSection}>
        <HeaderCount title="Open Loops" count={axisLabDashboard.openLoops.length} />
        <ul className={styles.loopList}>
          {axisLabDashboard.openLoops.map((loop) => (
            <li key={loop}>
              <span aria-hidden="true" />
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
        <p>{candidate.meta}</p>
        <span className={styles.unverified}>
          <span aria-hidden="true" />
          Unverified
        </span>
      </div>
    </article>
  );
}

function DashboardComposer() {
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
        <IconButton label="Microphone preview">
          <Mic size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label="Camera preview">
          <Camera size={16} aria-hidden="true" />
        </IconButton>
        <IconButton label="Upload preview">
          <Upload size={16} aria-hidden="true" />
        </IconButton>
        <button className={styles.plusSend} type="button" aria-label="Add preview note">
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

function RecentRealityShelf() {
  return (
    <section className={styles.recentShelf} aria-labelledby="axis-lab-recent-title">
      <div className={styles.recentHeader}>
        <h2 id="axis-lab-recent-title">Recent Reality</h2>
        <button type="button">View all</button>
      </div>
      <div className={styles.recentRow}>
        {axisLabDashboard.recentReality.map((item) => (
          <RecentRealityItem item={item} key={item.title} />
        ))}
      </div>
    </section>
  );
}

function RecentRealityItem({ item }: { item: AxisLabRecentReality }) {
  return (
    <article className={styles.recentItem}>
      <div className={styles.recentThumb}>
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

function IconButton({ children, label }: { children: ReactNode; label: string }) {
  return (
    <button className={styles.iconButton} type="button" aria-label={label}>
      {children}
    </button>
  );
}
