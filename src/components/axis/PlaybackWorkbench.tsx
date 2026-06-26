"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type PlaybackCandidate = {
  confidence: number;
  evidenceBucket?: "check_this" | "hidden_low_value" | "not_enough_evidence" | "report_ready";
  id: string;
  labels: string[];
  needsReview: boolean;
  note: string;
  status: "accepted" | "pending" | "rejected";
  timestampSeconds: number;
  title: string;
};

export type PlaybackJob = {
  candidates: PlaybackCandidate[];
  clipName: string;
  clipUrl?: string;
  compiledIntent?: string;
  id: string;
  lastViewedTimestamp?: number;
  query: string;
};

type RecheckResult = {
  attempt?: boolean;
  confidence: number;
  contestVisible?: boolean;
  limitation: string;
  note: string;
  outcomeEstimate?: "make" | "miss" | "unknown";
  outcomeVisible?: boolean;
  releaseVisible?: boolean;
  title: string;
};

type RecheckState = {
  findingId: string;
  result?: RecheckResult;
  status: "failed" | "loading" | "ready";
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatTimecode(seconds: number): string {
  const total = Math.floor(seconds * 30);
  const fr = total % 30;
  const s = Math.floor(seconds) % 60;
  const m = Math.floor(seconds / 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(fr).padStart(2, "0")}`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

async function sampleWindowFrames(
  src: string,
  startSeconds: number,
  endSeconds: number,
  count: number,
): Promise<Array<{ imageDataUrl: string; timestampSeconds: number }>> {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video load failed."));
  });

  const canvas = document.createElement("canvas");
  const w = Math.min(480, video.videoWidth || 480);
  const h = Math.max(1, Math.round(w / ((video.videoWidth || 16) / (video.videoHeight || 9))));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  const dur = endSeconds - startSeconds;
  const frames: Array<{ imageDataUrl: string; timestampSeconds: number }> = [];

  for (let i = 0; i < count; i++) {
    const t = startSeconds + (dur * i) / Math.max(1, count - 1);
    video.currentTime = Math.max(0, t);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    ctx.drawImage(video, 0, 0, w, h);
    frames.push({ imageDataUrl: canvas.toDataURL("image/jpeg", 0.65), timestampSeconds: t });
  }

  return frames;
}

async function captureStillFrame(
  src: string,
  timestampSeconds: number,
  title: string,
  note: string,
): Promise<void> {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Video load failed."));
  });

  video.currentTime = timestampSeconds;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.drawImage(video, 0, 0);

  const overlayH = 86;
  ctx.fillStyle = "rgba(12, 12, 9, 0.82)";
  ctx.fillRect(0, canvas.height - overlayH, canvas.width, overlayH);

  ctx.fillStyle = "#b7ff5c";
  ctx.font = `bold 10px monospace`;
  ctx.fillText(formatTimecode(timestampSeconds), 16, canvas.height - overlayH + 18);

  ctx.fillStyle = "#fffdf7";
  ctx.font = `bold 15px sans-serif`;
  ctx.fillText(title.slice(0, 64), 16, canvas.height - overlayH + 40);

  ctx.fillStyle = "rgba(255,253,247,0.72)";
  ctx.font = `12px sans-serif`;
  ctx.fillText(note.slice(0, 110), 16, canvas.height - overlayH + 62);

  ctx.fillStyle = "#b7ff5c";
  ctx.font = `bold 9px monospace`;
  ctx.textAlign = "right";
  ctx.fillText("AXIS", canvas.width - 14, canvas.height - 10);
  ctx.textAlign = "left";

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/jpeg", 0.92);
  link.download = `axis-${title.slice(0, 28).replace(/\W+/g, "-")}-${Math.floor(timestampSeconds)}s.jpg`;
  link.click();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlaybackWorkbench({
  job,
  onClose,
  onUpdateCandidate,
}: {
  job: PlaybackJob;
  onClose: (lastTimestamp?: number) => void;
  onUpdateCandidate: (candidateId: string, patch: Partial<PlaybackCandidate>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const trimBarRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState(job.lastViewedTimestamp ?? 0);
  const [videoDuration, setVideoDuration] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recheckState, setRecheckState] = useState<RecheckState | null>(null);
  const [trimWindow, setTrimWindow] = useState<{ end: number; start: number } | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDuration = () => setVideoDuration(video.duration || 0);
    const onSeeked = () => setCurrentTime(video.currentTime);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("seeked", onSeeked);
    if (video.duration) setVideoDuration(video.duration);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("seeked", onSeeked);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !job.lastViewedTimestamp) return;
    video.currentTime = job.lastViewedTimestamp;
  }, [job.lastViewedTimestamp]);

  useEffect(() => {
    const el = trimBarRef.current;
    if (!el) return;
    if (trimWindow && videoDuration > 0) {
      el.style.left = `${(trimWindow.start / videoDuration) * 100}%`;
      el.style.right = `${100 - (trimWindow.end / videoDuration) * 100}%`;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }, [trimWindow, videoDuration]);

  const handleClose = useCallback(() => {
    const video = videoRef.current;
    onClose(video ? video.currentTime : undefined);
  }, [onClose]);

  function jumpToFinding(finding: PlaybackCandidate) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, finding.timestampSeconds - 0.5);
    setSelectedId(finding.id);
    setTrimWindow(null);
    video.play().catch(() => undefined);
  }

  function trimAround(finding: PlaybackCandidate) {
    const video = videoRef.current;
    if (!video) return;
    const dur = videoDuration || video.duration || 999;
    const start = Math.max(0, finding.timestampSeconds - 1.5);
    const end = Math.min(dur, finding.timestampSeconds + 1.5);
    setTrimWindow({ end, start });
    video.currentTime = start;
    setSelectedId(finding.id);
    video.pause();
  }

  async function recheckMoment(finding: PlaybackCandidate) {
    const src = job.clipUrl;
    if (!src) return;

    setRecheckState({ findingId: finding.id, status: "loading" });

    try {
      const dur = videoDuration || 999;
      const timeStart = Math.max(0, finding.timestampSeconds - 1.5);
      const timeEnd = Math.min(dur, finding.timestampSeconds + 1.5);
      const frames = await sampleWindowFrames(src, timeStart, timeEnd, 6);

      const isShot = finding.labels.some((l) =>
        ["shot_v0", "attempt", "player_action"].includes(l),
      );

      const response = await fetch("/api/axis/watch/recheck", {
        body: JSON.stringify({
          frames,
          isShot,
          momentNote: finding.note,
          momentTitle: finding.title,
          query: job.query,
          timeEnd,
          timeStart,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) throw new Error("Recheck failed");
      const result = (await response.json()) as RecheckResult;
      setRecheckState({ findingId: finding.id, result, status: "ready" });
    } catch {
      setRecheckState({ findingId: finding.id, status: "failed" });
    }
  }

  async function exportFrame(finding: PlaybackCandidate) {
    const src = job.clipUrl;
    if (!src) return;
    await captureStillFrame(src, finding.timestampSeconds, finding.title, finding.note);
  }

  const sorted = [...job.candidates].sort((a, b) => a.timestampSeconds - b.timestampSeconds);
  const hasVideo = Boolean(job.clipUrl);

  return (
    <div className="axis-wb" role="dialog" aria-modal="true" aria-label="Clip workbench">
      <div className="axis-wb__scanlines" aria-hidden="true" />

      <header className="axis-wb__header">
        <div className="axis-wb__label-strip">
          <span className="axis-wb__brand">AXIS</span>
          <span className="axis-wb__timecode" aria-live="off">{formatTimecode(currentTime)}</span>
          <span className="axis-wb__clip-name">{job.clipName}</span>
        </div>
        <button
          aria-label="Close workbench"
          className="axis-wb__close"
          onClick={handleClose}
          type="button"
        >
          ✕
        </button>
      </header>

      <div className="axis-wb__body">
        <div className="axis-wb__video-panel">
          <div className="axis-wb__video-frame">
            {hasVideo ? (
              <video
                className="axis-wb__video"
                controls
                playsInline
                ref={videoRef}
                src={job.clipUrl}
              />
            ) : (
              <div className="axis-wb__no-video">
                <span>No video available for this clip.</span>
                <p>Reattach the clip to enable playback.</p>
              </div>
            )}
            <div className="axis-wb__tracking-line" aria-hidden="true" />
            <div className="axis-wb__corners" aria-hidden="true">
              <span /><span /><span /><span />
            </div>
            <div className="axis-wb__trim-bar" aria-hidden="true" hidden ref={trimBarRef} />
          </div>

          {recheckState?.status === "loading" && (
            <div className="axis-wb__recheck-status" data-status="loading">
              <span className="axis-wb__dot" aria-hidden="true" />
              Rechecking this moment…
            </div>
          )}

          {recheckState?.status === "failed" && (
            <div className="axis-wb__recheck-status" data-status="failed">
              Recheck could not complete. Try again.
            </div>
          )}

          {recheckState?.status === "ready" && recheckState.result && (
            <RecheckResultCard
              findingId={recheckState.findingId}
              result={recheckState.result}
              onAccept={(id) => {
                onUpdateCandidate(id, { status: "accepted" });
                setRecheckState(null);
              }}
              onDismiss={() => setRecheckState(null)}
            />
          )}
        </div>

        <div className="axis-wb__findings-panel">
          <div className="axis-wb__panel-strip">
            <span>Findings</span>
            <span className="axis-wb__count">{sorted.length}</span>
          </div>

          <div className="axis-wb__findings-list">
            {sorted.length === 0 && (
              <p className="axis-wb__empty">No findings for this clip.</p>
            )}
            {sorted.map((finding) => {
              const isSelected = selectedId === finding.id;
              const isRechecking =
                recheckState?.findingId === finding.id && recheckState.status === "loading";

              return (
                <article
                  className="axis-wb__finding"
                  data-bucket={finding.evidenceBucket}
                  data-selected={isSelected || undefined}
                  data-status={finding.status}
                  key={finding.id}
                >
                  <button
                    className="axis-wb__finding-jump"
                    onClick={() => jumpToFinding(finding)}
                    type="button"
                  >
                    <span className="axis-wb__finding-tc">{formatTimecode(finding.timestampSeconds)}</span>
                    <span className="axis-wb__finding-title">{finding.title}</span>
                  </button>
                  <p className="axis-wb__finding-note">{finding.note}</p>
                  <div className="axis-wb__finding-actions">
                    <button onClick={() => trimAround(finding)} type="button">
                      Trim
                    </button>
                    <button
                      data-loading={isRechecking || undefined}
                      disabled={isRechecking || !hasVideo}
                      onClick={() => void recheckMoment(finding)}
                      type="button"
                    >
                      {isRechecking ? "Checking…" : "Recheck"}
                    </button>
                    <button
                      disabled={!hasVideo}
                      onClick={() => void exportFrame(finding)}
                      type="button"
                    >
                      Export
                    </button>
                    {finding.status !== "accepted" && (
                      <button
                        onClick={() => onUpdateCandidate(finding.id, { status: "accepted" })}
                        type="button"
                      >
                        Accept
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="axis-wb__panel-strip axis-wb__panel-strip--footer">
            <span>{job.compiledIntent ?? job.query}</span>
          </div>
        </div>
      </div>

      <style jsx>{wbStyles}</style>
    </div>
  );
}

// ─── Recheck result card ──────────────────────────────────────────────────────

function RecheckResultCard({
  findingId,
  result,
  onAccept,
  onDismiss,
}: {
  findingId: string;
  onAccept: (id: string) => void;
  onDismiss: () => void;
  result: RecheckResult;
}) {
  const hasShot =
    result.attempt !== undefined ||
    result.releaseVisible !== undefined ||
    result.outcomeEstimate !== undefined;

  return (
    <div className="axis-wb__recheck-card">
      <div className="axis-wb__recheck-header">
        <span className="axis-wb__recheck-label">Recheck</span>
        <button
          aria-label="Dismiss recheck result"
          className="axis-wb__recheck-dismiss"
          onClick={onDismiss}
          type="button"
        >
          ✕
        </button>
      </div>

      <strong className="axis-wb__recheck-title">{result.title}</strong>
      <p className="axis-wb__recheck-note">{result.note}</p>

      {hasShot && (
        <dl className="axis-wb__shot-evidence">
          {result.attempt !== undefined && (
            <div>
              <dt>Attempt visible</dt>
              <dd data-value={result.attempt ? "yes" : "no"}>{result.attempt ? "Yes" : "No"}</dd>
            </div>
          )}
          {result.releaseVisible !== undefined && (
            <div>
              <dt>Release visible</dt>
              <dd data-value={result.releaseVisible ? "yes" : "no"}>
                {result.releaseVisible ? "Yes" : "No"}
              </dd>
            </div>
          )}
          {result.contestVisible !== undefined && (
            <div>
              <dt>Contest visible</dt>
              <dd data-value={result.contestVisible ? "yes" : "no"}>
                {result.contestVisible ? "Yes" : "No"}
              </dd>
            </div>
          )}
          {result.outcomeEstimate !== undefined && (
            <div>
              <dt>Outcome</dt>
              <dd data-value={result.outcomeEstimate}>{result.outcomeEstimate}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="axis-wb__recheck-limitation">{result.limitation}</p>

      <div className="axis-wb__recheck-actions">
        <span className="axis-wb__confidence">
          {Math.round(result.confidence * 100)}% confidence
        </span>
        <button onClick={() => onAccept(findingId)} type="button">
          Accept Finding
        </button>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const wbStyles = `
  .axis-wb {
    background: #0c0c09;
    bottom: 0;
    color: #fffdf7;
    display: grid;
    grid-template-rows: auto 1fr;
    left: 0;
    overflow: hidden;
    position: fixed;
    right: 0;
    top: 0;
    z-index: 50;
  }

  .axis-wb,
  .axis-wb * {
    box-sizing: border-box;
  }

  /* ── Scanline texture ─────────────────────────────────────── */
  .axis-wb__scanlines {
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 0, 0, 0.028) 2px,
      rgba(0, 0, 0, 0.028) 4px
    );
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: 100;
  }

  /* ── Header / label strip ────────────────────────────────── */
  .axis-wb__header {
    align-items: center;
    background: #141610;
    border-bottom: 1px solid rgba(183, 255, 92, 0.12);
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0 0.85rem;
  }

  .axis-wb__label-strip {
    align-items: center;
    display: flex;
    font-family: monospace;
    font-size: 0.72rem;
    font-weight: 700;
    gap: 1rem;
    letter-spacing: 0.1em;
    padding: 0.6rem 0;
    text-transform: uppercase;
  }

  .axis-wb__brand {
    color: #b7ff5c;
    font-weight: 900;
    letter-spacing: 0.18em;
  }

  .axis-wb__timecode {
    color: #b7ff5c;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    min-width: 6.2ch;
  }

  .axis-wb__clip-name {
    color: rgba(255, 253, 247, 0.52);
    font-family: inherit;
    font-size: 0.68rem;
    max-width: 18ch;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .axis-wb__close {
    background: transparent;
    border: 1px solid rgba(255, 253, 247, 0.18);
    border-radius: 0.5rem;
    color: rgba(255, 253, 247, 0.72);
    cursor: pointer;
    font: inherit;
    font-size: 0.85rem;
    height: 2.2rem;
    line-height: 1;
    padding: 0;
    transition: background 0.15s ease, color 0.15s ease;
    width: 2.2rem;
  }

  .axis-wb__close:hover {
    background: rgba(255, 253, 247, 0.08);
    color: #fffdf7;
  }

  /* ── Body grid ───────────────────────────────────────────── */
  .axis-wb__body {
    display: grid;
    grid-template-columns: 1fr;
    min-height: 0;
    overflow: hidden;
  }

  @media (min-width: 760px) {
    .axis-wb__body {
      grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
    }
  }

  /* ── Video panel ─────────────────────────────────────────── */
  .axis-wb__video-panel {
    border-right: 1px solid rgba(183, 255, 92, 0.08);
    display: grid;
    gap: 0;
    grid-template-rows: 1fr;
    min-height: 0;
    overflow-y: auto;
  }

  .axis-wb__video-frame {
    background: #000;
    overflow: hidden;
    position: relative;
  }

  .axis-wb__video {
    aspect-ratio: 16 / 9;
    display: block;
    max-height: 55vh;
    object-fit: contain;
    width: 100%;
  }

  /* Tracking line — slow animated band simulating tape transport */
  .axis-wb__tracking-line {
    animation: axis-wb-track 5s linear infinite;
    background: linear-gradient(
      transparent 0%,
      rgba(183, 255, 92, 0.055) 50%,
      transparent 100%
    );
    height: 6px;
    left: 0;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 2;
  }

  @keyframes axis-wb-track {
    0%   { transform: translateY(0); }
    100% { transform: translateY(100vh); }
  }

  /* Corner marks */
  .axis-wb__corners {
    inset: 0;
    pointer-events: none;
    position: absolute;
    z-index: 3;
  }

  .axis-wb__corners span {
    border-color: rgba(183, 255, 92, 0.38);
    border-style: solid;
    height: 1.1rem;
    position: absolute;
    width: 1.1rem;
  }

  .axis-wb__corners span:nth-child(1) {
    border-width: 1.5px 0 0 1.5px;
    left: 0.5rem;
    top: 0.5rem;
  }

  .axis-wb__corners span:nth-child(2) {
    border-width: 1.5px 1.5px 0 0;
    right: 0.5rem;
    top: 0.5rem;
  }

  .axis-wb__corners span:nth-child(3) {
    border-width: 0 0 1.5px 1.5px;
    bottom: 0.5rem;
    left: 0.5rem;
  }

  .axis-wb__corners span:nth-child(4) {
    border-width: 0 1.5px 1.5px 0;
    bottom: 0.5rem;
    right: 0.5rem;
  }

  /* Trim highlight bar — shown below video at the timeline position */
  .axis-wb__trim-bar {
    background: rgba(183, 255, 92, 0.34);
    bottom: 0;
    height: 3px;
    pointer-events: none;
    position: absolute;
    z-index: 4;
  }

  .axis-wb__no-video {
    align-items: center;
    aspect-ratio: 16 / 9;
    display: grid;
    gap: 0.4rem;
    justify-items: center;
    max-height: 55vh;
    padding: 2rem;
    place-content: center;
    text-align: center;
  }

  .axis-wb__no-video span {
    color: rgba(255, 253, 247, 0.72);
    font-size: 0.95rem;
    font-weight: 700;
  }

  .axis-wb__no-video p {
    color: rgba(255, 253, 247, 0.42);
    font-size: 0.78rem;
    margin: 0;
  }

  /* Recheck status inline */
  .axis-wb__recheck-status {
    align-items: center;
    border-top: 1px solid rgba(183, 255, 92, 0.08);
    color: rgba(255, 253, 247, 0.72);
    display: flex;
    font-size: 0.82rem;
    font-weight: 700;
    gap: 0.6rem;
    padding: 0.75rem 1rem;
  }

  .axis-wb__recheck-status[data-status="failed"] {
    color: rgba(255, 200, 100, 0.86);
  }

  .axis-wb__dot {
    animation: axis-wb-pulse 1s ease infinite;
    background: #b7ff5c;
    border-radius: 50%;
    display: inline-block;
    height: 0.5rem;
    width: 0.5rem;
  }

  @keyframes axis-wb-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  /* ── Recheck result card ─────────────────────────────────── */
  .axis-wb__recheck-card {
    background: #1a1c14;
    border-top: 1px solid rgba(183, 255, 92, 0.16);
    display: grid;
    gap: 0.6rem;
    padding: 0.9rem 1rem;
  }

  .axis-wb__recheck-header {
    align-items: center;
    display: flex;
    gap: 0.6rem;
    justify-content: space-between;
  }

  .axis-wb__recheck-label {
    color: #b7ff5c;
    font-size: 0.62rem;
    font-weight: 900;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .axis-wb__recheck-dismiss {
    background: transparent;
    border: none;
    color: rgba(255, 253, 247, 0.48);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    line-height: 1;
    padding: 0;
  }

  .axis-wb__recheck-dismiss:hover {
    color: rgba(255, 253, 247, 0.88);
  }

  .axis-wb__recheck-title {
    color: #fffdf7;
    font-size: 0.92rem;
    font-weight: 800;
  }

  .axis-wb__recheck-note {
    color: rgba(255, 253, 247, 0.78);
    font-size: 0.82rem;
    line-height: 1.45;
    margin: 0;
  }

  .axis-wb__shot-evidence {
    border-left: 2px solid rgba(183, 255, 92, 0.28);
    display: grid;
    gap: 0.3rem;
    margin: 0;
    padding-left: 0.75rem;
  }

  .axis-wb__shot-evidence > div {
    align-items: center;
    display: flex;
    gap: 0.5rem;
  }

  .axis-wb__shot-evidence dt {
    color: rgba(255, 253, 247, 0.52);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    width: 10ch;
  }

  .axis-wb__shot-evidence dd {
    color: #fffdf7;
    font-size: 0.82rem;
    font-weight: 700;
    margin: 0;
    text-transform: capitalize;
  }

  .axis-wb__shot-evidence dd[data-value="make"]  { color: #b7ff5c; }
  .axis-wb__shot-evidence dd[data-value="miss"]  { color: rgba(255, 180, 80, 0.9); }
  .axis-wb__shot-evidence dd[data-value="yes"]   { color: #b7ff5c; }

  .axis-wb__recheck-limitation {
    color: rgba(255, 253, 247, 0.48);
    font-size: 0.76rem;
    font-style: italic;
    margin: 0;
  }

  .axis-wb__recheck-actions {
    align-items: center;
    display: flex;
    gap: 0.6rem;
    justify-content: space-between;
  }

  .axis-wb__confidence {
    color: rgba(255, 253, 247, 0.52);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .axis-wb__recheck-actions button {
    background: rgba(183, 255, 92, 0.12);
    border: 1px solid rgba(183, 255, 92, 0.28);
    border-radius: 0.5rem;
    color: #b7ff5c;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 800;
    min-height: 2rem;
    padding: 0 0.75rem;
    transition: background 0.15s ease;
  }

  .axis-wb__recheck-actions button:hover {
    background: rgba(183, 255, 92, 0.2);
  }

  /* ── Findings panel ─────────────────────────────────────── */
  .axis-wb__findings-panel {
    background: #0e0e0b;
    display: grid;
    grid-template-rows: auto 1fr auto;
    min-height: 0;
    overflow: hidden;
  }

  .axis-wb__panel-strip {
    align-items: center;
    background: #141610;
    border-bottom: 1px solid rgba(183, 255, 92, 0.1);
    color: rgba(255, 253, 247, 0.52);
    display: flex;
    font-size: 0.62rem;
    font-weight: 900;
    gap: 0.6rem;
    justify-content: space-between;
    letter-spacing: 0.14em;
    padding: 0.55rem 0.85rem;
    text-transform: uppercase;
  }

  .axis-wb__panel-strip--footer {
    border-bottom: none;
    border-top: 1px solid rgba(183, 255, 92, 0.08);
    font-size: 0.68rem;
    font-weight: 600;
    font-style: italic;
    letter-spacing: 0;
    text-transform: none;
  }

  .axis-wb__count {
    background: rgba(183, 255, 92, 0.12);
    border-radius: 999px;
    color: #b7ff5c;
    font-size: 0.6rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    padding: 0.18rem 0.5rem;
  }

  .axis-wb__findings-list {
    display: grid;
    gap: 0;
    overflow-y: auto;
    padding: 0;
  }

  .axis-wb__empty {
    color: rgba(255, 253, 247, 0.38);
    font-size: 0.82rem;
    margin: 0;
    padding: 1.5rem 0.85rem;
    text-align: center;
  }

  /* ── Individual finding ──────────────────────────────────── */
  .axis-wb__finding {
    border-bottom: 1px solid rgba(255, 253, 247, 0.06);
    display: grid;
    gap: 0.45rem;
    padding: 0.75rem 0.85rem;
    position: relative;
    transition: background 0.14s ease;
  }

  .axis-wb__finding::before {
    background: #b7ff5c;
    border-radius: 999px;
    content: "";
    height: 100%;
    left: 0;
    opacity: 0;
    position: absolute;
    top: 0;
    width: 2px;
  }

  .axis-wb__finding[data-selected] {
    background: rgba(183, 255, 92, 0.05);
  }

  .axis-wb__finding[data-selected]::before {
    opacity: 1;
  }

  .axis-wb__finding[data-bucket="report_ready"]::before {
    opacity: 0.6;
  }

  .axis-wb__finding[data-status="accepted"] {
    background: rgba(183, 255, 92, 0.04);
  }

  .axis-wb__finding[data-status="rejected"] {
    opacity: 0.48;
  }

  .axis-wb__finding-jump {
    align-items: baseline;
    background: transparent;
    border: none;
    color: #fffdf7;
    cursor: pointer;
    display: flex;
    gap: 0.6rem;
    padding: 0;
    text-align: left;
    width: 100%;
  }

  .axis-wb__finding-jump:hover .axis-wb__finding-title {
    color: #b7ff5c;
  }

  .axis-wb__finding-tc {
    color: #b7ff5c;
    flex-shrink: 0;
    font-family: monospace;
    font-size: 0.65rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
  }

  .axis-wb__finding-title {
    font-size: 0.88rem;
    font-weight: 750;
    line-height: 1.3;
    transition: color 0.14s ease;
  }

  .axis-wb__finding-note {
    color: rgba(255, 253, 247, 0.52);
    font-size: 0.76rem;
    line-height: 1.4;
    margin: 0;
  }

  .axis-wb__finding-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.38rem;
  }

  .axis-wb__finding-actions button {
    background: rgba(255, 253, 247, 0.07);
    border: 1px solid rgba(255, 253, 247, 0.12);
    border-radius: 0.45rem;
    color: rgba(255, 253, 247, 0.78);
    cursor: pointer;
    font: inherit;
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    min-height: 1.85rem;
    padding: 0 0.62rem;
    text-transform: uppercase;
    transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
  }

  .axis-wb__finding-actions button:hover:not(:disabled) {
    background: rgba(255, 253, 247, 0.12);
    border-color: rgba(255, 253, 247, 0.2);
    color: #fffdf7;
  }

  .axis-wb__finding-actions button:disabled {
    opacity: 0.38;
    pointer-events: none;
  }

  .axis-wb__finding-actions button[data-loading] {
    color: #b7ff5c;
  }
`;
