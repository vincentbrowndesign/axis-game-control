"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { axisAuthenticatedFetch } from "../../lib/axis-client-auth";
import { useAxisAuth } from "../../app/axis/axis-auth-control";
import AxisAuthControl from "../../app/axis/axis-auth-control";
import type {
  ClipEvent,
  ClipPlay,
  ClipPressPack,
  ClipResult,
  ClipSource,
  ClipStatLines,
} from "../../lib/clip-room/types";

type Tab = "activity" | "stats" | "check-plays" | "press-pack";

const WHAT_HAPPENED_QUESTION = "What happened in this clip?";

const PROCESSING_STAGES = [
  "Source saved",
  "Stream ready",
  "Source Probe",
  "Frame extraction",
  "CV detection",
  "Tracking",
  "OCR/audio/pose",
  "Basketball rules",
  "Confidence gate",
  "Activity",
  "Stats",
  "Check Plays",
  "Press Pack",
];

function getStageStatuses(
  processingStage: string | null,
  status: string,
): Array<"done" | "active" | "pending"> {
  if (status === "ready") return PROCESSING_STAGES.map(() => "done");
  if (status === "failed") return ["done", "done", "done", "pending", "pending", "pending", "pending"];

  const stageMap: Record<string, number> = {
    queued: 1,
    waiting_for_video: 1,
    source_probe: 2,
    probe: 2,
    frame_extraction: 3,
    extracting_frames: 3,
    cv_detection: 4,
    tracking: 5,
    ocr_audio_pose: 6,
    extracting_audio: 6,
    scoreboard_ocr: 6,
    basketball_rules_engine: 7,
    applying_basketball_logic: 7,
    confidence_gate: 8,
    activity: 9,
    stats: 10,
    check_plays: 11,
    creating_check_plays: 11,
    press_pack: 12,
    generating_press_pack: 12,
    complete: 13,
  };

  const active = processingStage ? (stageMap[processingStage] ?? 3) : 3;
  return PROCESSING_STAGES.map((_, i) => {
    if (i < active) return "done";
    if (i === active) return "active";
    return "pending";
  });
}

export function ClipRoomDetail({ clipId }: { clipId: string }) {
  const auth = useAxisAuth();
  const [source, setSource] = useState<ClipSource | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("activity");
  const [events, setEvents] = useState<ClipEvent[]>([]);
  const [stats, setStats] = useState<ClipStatLines | null>(null);
  const [plays, setPlays] = useState<ClipPlay[]>([]);
  const [pressPack, setPressPack] = useState<ClipPressPack | null>(null);
  const [result, setResult] = useState<ClipResult | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSource = useCallback(async () => {
    if (auth.status !== "signed_in") return;
    const res = await axisAuthenticatedFetch(`/api/clip-room/sources/${clipId}`).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.clip) setSource(data.clip);
    return data?.clip as ClipSource | undefined;
  }, [auth.status, clipId]);

  const fetchAll = useCallback(async () => {
    if (auth.status !== "signed_in") return;
    const [evRes, stRes, plRes, ppRes, resRes] = await Promise.all([
      axisAuthenticatedFetch(`/api/clip-room/${clipId}/activity`).catch(() => null),
      axisAuthenticatedFetch(`/api/clip-room/${clipId}/stats`).catch(() => null),
      axisAuthenticatedFetch(`/api/clip-room/${clipId}/plays`).catch(() => null),
      axisAuthenticatedFetch(`/api/clip-room/${clipId}/press-pack`).catch(() => null),
      axisAuthenticatedFetch(`/api/clip-room/${clipId}/result`).catch(() => null),
    ]);

    if (evRes?.ok) {
      const d = await evRes.json().catch(() => null);
      if (Array.isArray(d?.events)) setEvents(d.events);
    }
    if (stRes?.ok) {
      const d = await stRes.json().catch(() => null);
      if (d?.stats) setStats(d.stats);
    }
    if (plRes?.ok) {
      const d = await plRes.json().catch(() => null);
      if (Array.isArray(d?.plays)) setPlays(d.plays);
    }
    if (ppRes?.ok) {
      const d = await ppRes.json().catch(() => null);
      if (d?.pressPack) setPressPack(d.pressPack);
    }
    if (resRes?.ok) {
      const d = await resRes.json().catch(() => null);
      if (d?.result) setResult(d.result);
    }
  }, [auth.status, clipId]);

  useEffect(() => {
    if (auth.status !== "signed_in") return;
    let cancelled = false;

    void Promise.resolve()
      .then(() => {
        if (!cancelled) setLoading(true);
        return Promise.all([fetchSource(), fetchAll()]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auth.status, clipId, fetchSource, fetchAll]);

  useEffect(() => {
    if (!source) return;
    if (source.status === "ready" || source.status === "failed") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    pollRef.current = setInterval(async () => {
      const updated = await fetchSource();
      if (updated?.status === "ready" || updated?.status === "failed") {
        clearInterval(pollRef.current!);
        if (updated.status === "ready") await fetchAll();
      }
    }, 4000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [source, source?.status, fetchSource, fetchAll]);

  async function resolvePlay(playId: string, resolution: string) {
    const res = await axisAuthenticatedFetch(`/api/clip-room/plays/${playId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolution }),
    }).catch(() => null);
    if (!res?.ok) return;
    const data = await res.json().catch(() => null);
    if (data?.stats) setStats(data.stats);
    await fetchAll();
  }

  const pendingPlays = plays.filter((p) => p.status === "pending");
  const regularPendingPlays = pendingPlays.filter((p) => p.question !== WHAT_HAPPENED_QUESTION);
  const isProcessing = source
    ? source.status !== "ready" && source.status !== "failed"
    : false;
  const stageStatuses = source
    ? getStageStatuses(source.processingStage, source.status)
    : null;
  const hasCountedEvents = events.some((e) => e.status === "counted");

  return (
    <div className="crd-root">
      <header className="crd-header">
        <Link href="/" className="crd-back">Clip Room</Link>
        <span className="crd-header-title">{source?.filename ?? "Clip"}</span>
        <AxisAuthControl auth={auth} />
      </header>

      {isProcessing && source && stageStatuses && (
        <div className="crd-status-card">
          <div className="crd-stage-list">
            {PROCESSING_STAGES.map((label, i) => {
              const s = stageStatuses[i];
              return (
                <div key={label} className={`crd-stage crd-stage--${s}`}>
                  <span className="crd-stage-dot">
                    {s === "done" ? "✓" : s === "active" ? "●" : "○"}
                  </span>
                  <span className="crd-stage-label">{label}</span>
                </div>
              );
            })}
          </div>
          <div className="crd-progress-track">
            <div className="crd-progress-fill" style={{ width: `${source.processingProgress}%` }} />
          </div>
        </div>
      )}

      {source?.status === "failed" && (
        <div className="crd-error">Processing could not complete. Try uploading the clip again.</div>
      )}

      <nav className="crd-tabs">
        {([
          ["activity", "Activity"],
          ["stats", "Stats"],
          ["check-plays", regularPendingPlays.length > 0 ? `Check Plays (${regularPendingPlays.length})` : "Check Plays"],
          ["press-pack", "Press Pack"],
        ] as [Tab, string][]).map(([tab, label]) => (
          <button
            key={tab}
            type="button"
            className={`crd-tab ${activeTab === tab ? "crd-tab--on" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="crd-main">
        {loading && <p className="crd-muted">Loading...</p>}

        {!loading && activeTab === "activity" && (
          <ActivityTab
            events={events}
            plays={plays}
            result={result}
            isProcessing={isProcessing}
            onResolve={resolvePlay}
          />
        )}
        {!loading && activeTab === "stats" && (
          <StatsTab stats={stats} hasCountedEvents={hasCountedEvents} isProcessing={isProcessing} />
        )}
        {!loading && activeTab === "check-plays" && (
          <CheckPlaysTab
            plays={plays.filter((p) => p.question !== WHAT_HAPPENED_QUESTION)}
            onResolve={resolvePlay}
          />
        )}
        {!loading && activeTab === "press-pack" && (
          <PressPackTab pressPack={pressPack} stats={stats} isProcessing={isProcessing} />
        )}
      </main>

      <style jsx>{`
        .crd-root {
          background: var(--axis-bg);
          color: var(--axis-ink);
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, sans-serif;
          min-height: 100dvh;
        }

        .crd-header {
          align-items: center;
          border-bottom: 1px solid var(--axis-line);
          display: flex;
          gap: 12px;
          justify-content: space-between;
          min-height: 52px;
          padding: 0 clamp(16px, 4vw, 32px);
        }

        .crd-back {
          color: var(--axis-muted);
          font-size: 13px;
          text-decoration: none;
        }

        .crd-header-title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          max-width: 40ch;
          overflow: hidden;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .crd-status-card {
          border-bottom: 1px solid var(--axis-line);
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px clamp(16px, 4vw, 32px);
        }

        .crd-stage-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .crd-stage {
          align-items: center;
          display: flex;
          gap: 8px;
        }

        .crd-stage-dot {
          font-size: 11px;
          width: 14px;
        }

        .crd-stage-label {
          font-size: 12px;
          font-weight: 600;
        }

        .crd-stage--done .crd-stage-dot { color: var(--axis-live); }
        .crd-stage--done .crd-stage-label { color: var(--axis-muted); }
        .crd-stage--active .crd-stage-dot { color: var(--axis-ink); }
        .crd-stage--active .crd-stage-label { color: var(--axis-ink); }
        .crd-stage--pending .crd-stage-dot { color: rgba(244,244,240,0.2); }
        .crd-stage--pending .crd-stage-label { color: rgba(244,244,240,0.2); }

        .crd-progress-track {
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
          height: 2px;
          overflow: hidden;
        }

        .crd-progress-fill {
          background: var(--axis-live);
          border-radius: 3px;
          height: 100%;
          transition: width 0.4s ease;
        }

        .crd-error {
          background: rgba(220, 60, 60, 0.12);
          border-bottom: 1px solid rgba(220,60,60,0.2);
          color: #e77;
          font-size: 13px;
          padding: 10px clamp(16px, 4vw, 32px);
        }

        .crd-tabs {
          border-bottom: 1px solid var(--axis-line);
          display: flex;
          overflow-x: auto;
          padding: 0 clamp(16px, 4vw, 32px);
          scrollbar-width: none;
        }

        .crd-tabs::-webkit-scrollbar { display: none; }

        .crd-tab {
          background: transparent;
          border: 0;
          border-bottom: 2px solid transparent;
          color: var(--axis-muted);
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          min-height: 44px;
          padding: 0 12px;
          text-transform: uppercase;
          transition: color 0.12s;
          white-space: nowrap;
        }

        .crd-tab--on {
          border-bottom-color: var(--axis-ink);
          color: var(--axis-ink);
        }

        .crd-main {
          flex: 1;
          padding: clamp(20px, 4vw, 36px) clamp(16px, 4vw, 32px);
        }

        .crd-muted {
          color: var(--axis-muted);
          font-size: 13px;
          margin: 0;
        }
      `}</style>
    </div>
  );
}

// ─── Activity Tab ─────────────────────────────────────────────────────────────

const WHAT_HAPPENED_OPTIONS = [
  { label: "Made 2", resolution: "made_2" },
  { label: "Made 3", resolution: "made_3" },
  { label: "Miss", resolution: "miss" },
  { label: "Rebound", resolution: "rebound" },
  { label: "Turnover", resolution: "turnover" },
  { label: "Assist", resolution: "assist" },
  { label: "Skip", resolution: "skip" },
];

function ActivityTab({
  events,
  plays,
  result,
  isProcessing,
  onResolve,
}: {
  events: ClipEvent[];
  plays: ClipPlay[];
  result: ClipResult | null;
  isProcessing: boolean;
  onResolve: (playId: string, resolution: string) => Promise<void>;
}) {
  const [resolving, setResolving] = useState<string | null>(null);

  const whatHappenedPlay = plays.find(
    (p) => p.question === WHAT_HAPPENED_QUESTION && p.status === "pending",
  );
  const whatHappenedResolved = plays.find(
    (p) => p.question === WHAT_HAPPENED_QUESTION && p.status === "resolved",
  );

  async function handleWhatHappened(playId: string, resolution: string) {
    setResolving(resolution);
    await onResolve(playId, resolution).catch(() => null);
    setResolving(null);
  }

  if (isProcessing && events.length === 0) {
    return (
      <div className="act-empty">
        <p className="act-empty-msg">Axis is reading the clip. Activity will appear after Axis counts or creates a Check Play.</p>
        <style jsx>{`.act-empty { display: flex; flex-direction: column; gap: 6px; } .act-empty-msg { color: var(--axis-muted); font-size: 14px; line-height: 1.5; margin: 0; max-width: 40ch; }`}</style>
      </div>
    );
  }

  if (events.length === 0 && !isProcessing) {
    return (
      <div className="act-no-events">
        {result && (
          <div className="act-probe-card">
            <p className="act-probe-title">Source Probe</p>
            <div className="act-probe-grid">
              <span className="act-probe-item">
                <span className={result.isPlayable ? "act-probe-yes" : "act-probe-no"}>
                  {result.isPlayable ? "yes" : "no"}
                </span>
                Playable video
              </span>
              <span className="act-probe-item">
                <span className="act-probe-neutral">{sourceTypeLabel(result.sourceType)}</span>
                Source type
              </span>
              <span className="act-probe-item">
                <span className={result.courtVisible ? "act-probe-yes" : "act-probe-no"}>
                  {result.courtVisible ? "✓" : "✗"}
                </span>
                Court visible
              </span>
              <span className="act-probe-item">
                <span className={result.hoopVisible ? "act-probe-yes" : "act-probe-no"}>
                  {result.hoopVisible ? "yes" : "no"}
                </span>
                Hoop visible
              </span>
              <span className="act-probe-item">
                <span className={result.playersVisible ? "act-probe-yes" : "act-probe-no"}>
                  {result.playersVisible ? "✓" : "✗"}
                </span>
                Players visible
              </span>
              <span className="act-probe-item">
                <span className={result.scoreboardVisible ? "act-probe-yes" : "act-probe-no"}>
                  {result.scoreboardVisible ? "✓" : "✗"}
                </span>
                Scoreboard
              </span>
              <span className="act-probe-item">
                <span className={result.actionWindowFound ? "act-probe-yes" : "act-probe-no"}>
                  {result.actionWindowFound ? "✓" : "✗"}
                </span>
                Action found
              </span>
            </div>
            {result.sourceQuality && (
              <p className="act-probe-quality">Quality: <strong>{result.sourceQuality}</strong></p>
            )}
            {result.probeNotes && (
              <p className="act-probe-notes">{result.probeNotes}</p>
            )}
          </div>
        )}

        {whatHappenedPlay && (
          <div className="act-what-card">
            <p className="act-what-q">{whatHappenedPlay.question}</p>
            {whatHappenedPlay.context && (
              <p className="act-what-ctx">{whatHappenedPlay.context}</p>
            )}
            <div className="act-what-btns">
              {WHAT_HAPPENED_OPTIONS.map(({ label, resolution }) => (
                <button
                  key={resolution}
                  type="button"
                  className={`act-what-btn ${resolution === "skip" ? "act-what-btn--skip" : "act-what-btn--primary"}`}
                  disabled={resolving !== null}
                  onClick={() => void handleWhatHappened(whatHappenedPlay.id, resolution)}
                >
                  {resolving === resolution ? "..." : label}
                </button>
              ))}
            </div>
          </div>
        )}

        {!whatHappenedPlay && whatHappenedResolved && (
          <p className="act-resolved-note">
            Marked as: <strong>{whatHappenedResolved.resolution?.replace(/_/g, " ")}</strong>
          </p>
        )}

        {!whatHappenedPlay && !whatHappenedResolved && (
          <p className="act-empty-msg">Clip Result created. Check Plays will appear when Axis needs a manual mark.</p>
        )}

        <style jsx>{`
          .act-no-events { display: flex; flex-direction: column; gap: 16px; max-width: 520px; }
          .act-probe-card { background: rgba(255,255,255,0.04); border: 1px solid var(--axis-line); border-radius: 10px; display: flex; flex-direction: column; gap: 10px; padding: 14px; }
          .act-probe-title { color: var(--axis-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; margin: 0; text-transform: uppercase; }
          .act-probe-grid { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; }
          .act-probe-item { align-items: center; color: var(--axis-muted); display: flex; font-size: 12px; gap: 6px; }
          .act-probe-yes { color: var(--axis-live); font-size: 11px; }
          .act-probe-no { color: rgba(244,244,240,0.3); font-size: 11px; }
          .act-probe-neutral { color: var(--axis-ink); font-size: 11px; font-weight: 700; text-transform: capitalize; }
          .act-probe-quality { color: var(--axis-muted); font-size: 12px; margin: 0; }
          .act-probe-quality strong { color: var(--axis-ink); }
          .act-probe-notes { color: var(--axis-muted); font-size: 12px; line-height: 1.45; margin: 0; }
          .act-what-card { border: 1px solid var(--axis-line); border-radius: 10px; display: flex; flex-direction: column; gap: 10px; padding: 14px; }
          .act-what-q { font-size: 15px; font-weight: 600; margin: 0; }
          .act-what-ctx { color: var(--axis-muted); font-size: 12px; margin: 0; }
          .act-what-btns { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
          .act-what-btn { border: 1px solid var(--axis-line); border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; min-height: 36px; padding: 0 14px; transition: all 0.12s; }
          .act-what-btn:disabled { cursor: default; opacity: 0.4; }
          .act-what-btn--primary { background: rgba(255,255,255,0.06); color: var(--axis-ink); }
          .act-what-btn--primary:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
          .act-what-btn--skip { background: transparent; color: var(--axis-muted); }
          .act-resolved-note { color: var(--axis-muted); font-size: 14px; margin: 0; }
          .act-resolved-note strong { color: var(--axis-ink); text-transform: capitalize; }
          .act-empty-msg { color: var(--axis-muted); font-size: 14px; line-height: 1.5; margin: 0; max-width: 40ch; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="act-root">
      <div className="act-list">
        {events.map((event) => (
          <div key={event.id} className={`act-row act-row--${event.status}`}>
            <div className="act-left">
              <span className={`act-badge act-badge--${event.status}`}>
                {statusLabel(event.status)}
              </span>
              {event.timestampSeconds !== null && (
                <span className="act-time">{formatTime(event.timestampSeconds)}</span>
              )}
            </div>
            <div className="act-center">
              <span className="act-event">{eventLabel(event.eventType, event.shotZone, event.points)}</span>
              {event.proof && <span className="act-proof">{event.proof}</span>}
            </div>
            {event.points > 0 && <span className="act-pts">+{event.points}</span>}
          </div>
        ))}
      </div>

      <style jsx>{`
        .act-root { display: flex; flex-direction: column; gap: 2px; max-width: 560px; }
        .act-list { display: flex; flex-direction: column; gap: 1px; }
        .act-row { align-items: center; border-radius: 8px; display: flex; gap: 10px; min-height: 46px; padding: 8px 10px; }
        .act-row--counted { background: rgba(168, 217, 51, 0.06); }
        .act-row--suggested { background: rgba(255,255,255,0.03); }
        .act-row--check { background: rgba(244, 201, 93, 0.06); }
        .act-row--skipped { opacity: 0.38; }
        .act-left { align-items: center; display: flex; flex-shrink: 0; gap: 6px; width: 120px; }
        .act-badge { border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 0.08em; padding: 2px 5px; text-transform: uppercase; }
        .act-badge--counted { background: rgba(168,217,51,0.18); color: var(--axis-live); }
        .act-badge--suggested { background: rgba(255,255,255,0.08); color: var(--axis-muted); }
        .act-badge--check { background: rgba(244,201,93,0.15); color: #f4c95d; }
        .act-badge--skipped { background: rgba(255,255,255,0.05); color: rgba(244,244,240,0.3); }
        .act-time { color: var(--axis-muted); font-size: 11px; font-weight: 600; }
        .act-center { display: flex; flex: 1; flex-direction: column; gap: 2px; min-width: 0; }
        .act-event { font-size: 14px; font-weight: 600; }
        .act-proof { color: var(--axis-muted); font-size: 11px; }
        .act-pts { color: var(--axis-live); flex-shrink: 0; font-size: 14px; font-weight: 700; }
      `}</style>
    </div>
  );
}

// ─── Stats Tab ────────────────────────────────────────────────────────────────

function StatsTab({
  stats,
  hasCountedEvents,
  isProcessing,
}: {
  stats: ClipStatLines | null;
  hasCountedEvents: boolean;
  isProcessing: boolean;
}) {
  if (isProcessing || !hasCountedEvents) {
    return (
      <>
        <p className="st-waiting">Stats will appear after Axis counts or you mark the play.</p>
        <style jsx>{`.st-waiting { color: var(--axis-muted); font-size: 13px; line-height: 1.5; margin: 0; max-width: 44ch; }`}</style>
      </>
    );
  }

  if (!stats) return null;

  const rows: Array<{ label: string; value: string | number }> = [
    { label: "FGM/FGA", value: stats.fga > 0 ? `${stats.fgm}/${stats.fga}` : "—" },
    { label: "FG%", value: stats.fg_pct !== null ? `${stats.fg_pct}%` : "—" },
    { label: "3PM/3PA", value: stats.tpa > 0 ? `${stats.tpm}/${stats.tpa}` : "—" },
    { label: "3P%", value: stats.tp_pct !== null ? `${stats.tp_pct}%` : "—" },
    { label: "FTM/FTA", value: stats.fta > 0 ? `${stats.ftm}/${stats.fta}` : "—" },
    { label: "FT%", value: stats.ft_pct !== null ? `${stats.ft_pct}%` : "—" },
    { label: "REB", value: stats.reb },
    { label: "AST", value: stats.ast },
    { label: "STL", value: stats.stl },
    { label: "BLK", value: stats.blk },
    { label: "TO", value: stats.to },
    { label: "PF", value: stats.pf },
  ];

  return (
    <div className="st-root">
      <div className="st-pts">{stats.pts}</div>
      <div className="st-pts-label">Points</div>
      <div className="st-grid">
        {rows.map((row) => (
          <div key={row.label} className="st-cell">
            <span className="st-val">{row.value}</span>
            <span className="st-key">{row.label}</span>
          </div>
        ))}
      </div>

      <style jsx>{`
        .st-root { display: flex; flex-direction: column; gap: 16px; max-width: 480px; }
        .st-pts { font-size: clamp(48px, 12vw, 72px); font-weight: 900; letter-spacing: -0.04em; line-height: 1; }
        .st-pts-label { color: var(--axis-muted); font-size: 11px; font-weight: 700; letter-spacing: 0.08em; margin-top: -4px; text-transform: uppercase; }
        .st-grid { display: grid; gap: 1px; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); margin-top: 8px; }
        .st-cell { align-items: flex-start; background: rgba(255,255,255,0.03); border-radius: 8px; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; }
        .st-val { font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
        .st-key { color: var(--axis-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
      `}</style>
    </div>
  );
}

// ─── Check Plays Tab ──────────────────────────────────────────────────────────
// Shows only regular check plays (not "What happened?" — those are in Activity tab)

function CheckPlaysTab({
  plays,
  onResolve,
}: {
  plays: ClipPlay[];
  onResolve: (playId: string, resolution: string) => Promise<void>;
}) {
  const [resolving, setResolving] = useState<string | null>(null);

  const pending = plays.filter((p) => p.status === "pending");
  const resolved = plays.filter((p) => p.status === "resolved");

  if (plays.length === 0) {
    return (
      <div className="cp-empty">
        <p className="cp-empty-title">No check plays.</p>
        <p className="cp-empty-sub">Axis resolved all events automatically.</p>
        <style jsx>{`
          .cp-empty { display: flex; flex-direction: column; gap: 4px; }
          .cp-empty-title { color: var(--axis-ink); font-size: 15px; margin: 0; }
          .cp-empty-sub { color: var(--axis-muted); font-size: 13px; margin: 0; }
        `}</style>
      </div>
    );
  }

  async function resolve(playId: string, resolution: string) {
    setResolving(playId);
    await onResolve(playId, resolution).catch(() => null);
    setResolving(null);
  }

  return (
    <div className="cp-root">
      {pending.length === 0 && <p className="cp-all-done">All plays resolved.</p>}

      {pending.map((play) => (
        <div key={play.id} className="cp-card">
          {play.timestampSeconds !== null && (
            <span className="cp-time">{formatTime(play.timestampSeconds)}</span>
          )}
          <p className="cp-question">{play.question}</p>
          {play.context && <p className="cp-context">{play.context}</p>}
          <div className="cp-actions">
            <button
              type="button"
              className="cp-btn cp-btn--count"
              disabled={resolving === play.id}
              onClick={() => void resolve(play.id, "counted")}
            >
              Counted
            </button>
            <button
              type="button"
              className="cp-btn cp-btn--skip"
              disabled={resolving === play.id}
              onClick={() => void resolve(play.id, "skipped")}
            >
              Skip
            </button>
            {play.question.toLowerCase().includes("make") && (
              <button
                type="button"
                className="cp-btn cp-btn--miss"
                disabled={resolving === play.id}
                onClick={() => void resolve(play.id, "miss")}
              >
                Miss
              </button>
            )}
          </div>
        </div>
      ))}

      {resolved.length > 0 && (
        <div className="cp-resolved-section">
          <p className="cp-resolved-label">Resolved</p>
          {resolved.map((play) => (
            <div key={play.id} className="cp-resolved-row">
              <span className="cp-resolved-q">{play.question}</span>
              <span className="cp-resolved-r">{play.resolution}</span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .cp-root { display: flex; flex-direction: column; gap: 12px; max-width: 520px; }
        .cp-all-done { color: var(--axis-live); font-size: 14px; font-weight: 600; margin: 0; }
        .cp-card { border: 1px solid var(--axis-line); border-radius: 10px; display: flex; flex-direction: column; gap: 8px; padding: 14px; }
        .cp-time { color: var(--axis-muted); font-size: 11px; font-weight: 600; }
        .cp-question { font-size: 15px; font-weight: 600; margin: 0; }
        .cp-context { color: var(--axis-muted); font-size: 12px; margin: 0; }
        .cp-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
        .cp-btn { border: 1px solid var(--axis-line); border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; font-weight: 700; min-height: 34px; padding: 0 12px; transition: all 0.12s; }
        .cp-btn:disabled { cursor: default; opacity: 0.4; }
        .cp-btn--count { background: rgba(168,217,51,0.12); border-color: rgba(168,217,51,0.3); color: var(--axis-live); }
        .cp-btn--skip { background: transparent; color: var(--axis-muted); }
        .cp-btn--miss { background: rgba(220,60,60,0.1); border-color: rgba(220,60,60,0.25); color: #e77; }
        .cp-resolved-section { border-top: 1px solid var(--axis-line); display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding-top: 16px; }
        .cp-resolved-label { color: var(--axis-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; margin: 0; text-transform: uppercase; }
        .cp-resolved-row { align-items: center; display: flex; gap: 8px; justify-content: space-between; opacity: 0.6; }
        .cp-resolved-q { font-size: 13px; }
        .cp-resolved-r { background: rgba(255,255,255,0.08); border-radius: 4px; color: var(--axis-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.06em; padding: 2px 6px; text-transform: uppercase; }
      `}</style>
    </div>
  );
}

// ─── Press Pack Tab ───────────────────────────────────────────────────────────

function PressPackTab({
  pressPack,
  stats,
  isProcessing,
}: {
  pressPack: ClipPressPack | null;
  stats: ClipStatLines | null;
  isProcessing: boolean;
}) {
  if (isProcessing && !pressPack) {
    return (
      <>
        <p className="pp-waiting">Press Pack generating...</p>
        <style jsx>{`.pp-waiting { color: var(--axis-muted); font-size: 13px; line-height: 1.5; margin: 0; }`}</style>
      </>
    );
  }

  if (!pressPack) {
    return (
      <>
        <p className="pp-waiting">Press Pack will generate after Activity is created.</p>
        <style jsx>{`.pp-waiting { color: var(--axis-muted); font-size: 13px; line-height: 1.5; margin: 0; max-width: 40ch; }`}</style>
      </>
    );
  }

  const s = stats ?? pressPack.statLines;
  const statLine = s && s.pts > 0
    ? `${s.pts} PTS · ${s.fgm}/${s.fga} FG · ${s.reb} REB · ${s.ast} AST`
    : null;

  return (
    <div className="pp-root">
      {pressPack.headline && <h2 className="pp-headline">{pressPack.headline}</h2>}
      {statLine && <p className="pp-statline">{statLine}</p>}
      {pressPack.summary && <p className="pp-summary">{pressPack.summary}</p>}

      {pressPack.keyMoments && pressPack.keyMoments.length > 0 && (
        <div className="pp-moments">
          <p className="pp-moments-label">Key Moments</p>
          {pressPack.keyMoments.map((m, i) => (
            <div key={i} className="pp-moment">
              <span className="pp-moment-time">{formatTime(m.timestampSeconds)}</span>
              <span className="pp-moment-desc">{m.description}</span>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .pp-root { display: flex; flex-direction: column; gap: 16px; max-width: 560px; }
        .pp-headline { font-size: clamp(20px, 5vw, 28px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; margin: 0; }
        .pp-statline { color: var(--axis-live); font-size: 13px; font-weight: 700; letter-spacing: 0.04em; margin: 0; }
        .pp-summary { color: rgba(244,244,240,0.78); font-size: 15px; line-height: 1.55; margin: 0; }
        .pp-moments { display: flex; flex-direction: column; gap: 6px; }
        .pp-moments-label { color: var(--axis-muted); font-size: 10px; font-weight: 700; letter-spacing: 0.08em; margin: 0; text-transform: uppercase; }
        .pp-moment { align-items: baseline; display: flex; gap: 10px; }
        .pp-moment-time { color: var(--axis-muted); flex-shrink: 0; font-size: 11px; font-weight: 600; width: 42px; }
        .pp-moment-desc { font-size: 13px; }
      `}</style>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function statusLabel(status: ClipEvent["status"]) {
  return { counted: "Counted", suggested: "Suggested", check: "Check", skipped: "Skipped" }[status] ?? status;
}

function sourceTypeLabel(sourceType: ClipResult["sourceType"]) {
  if (sourceType === "raw_game") return "Raw game video";
  if (sourceType === "screen_recording") return "Screen recording";
  if (sourceType === "gallery_playback") return "Gallery playback";
  return "Unknown";
}

function eventLabel(type: string, shotZone: string | null, points: number) {
  if (type === "make") {
    if (shotZone === "three_point" || points === 3) return "Three-point make";
    if (shotZone === "free_throw") return "Free throw made";
    return "Field goal";
  }
  if (type === "miss") return "Missed shot";
  if (type === "shot_attempt") return "Shot attempt";
  if (type === "rebound") return "Rebound";
  if (type === "assist") return "Assist";
  if (type === "turnover") return "Turnover";
  if (type === "steal") return "Steal";
  if (type === "block") return "Block";
  if (type === "foul") return "Foul";
  if (type === "free_throw") return "Free throw";
  return type;
}
