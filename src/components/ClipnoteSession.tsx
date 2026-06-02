"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  addFlag,
  cacheVideoUrl,
  completeSession,
  createTag,
  getCachedVideoUrl,
  getSession,
  getStacks,
  getTag,
  saveClipnote,
  saveSession,
  updateSessionTitle,
  type Clipnote,
  type Flag,
  type Session,
} from "../lib/clipnote-store";

const PRESET_TAGS = [
  "PASS_BEFORE_BASKET",
  "SHOT_AFTER_MISS",
  "GOT_IT_BACK",
  "SHOOTING_MACHINE",
  "FIRST_TO_THE_BALL",
  "TRANSITION",
  "DEFENSE",
];

type SessionSummary = {
  clipnotesCount: number;
  firstClipnoteId?: string;
  tags: Array<{ after: number; before: number; name: string }>;
};

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function buildSessionSummary(session: Session): SessionSummary {
  const sessionTagCounts = new Map<string, number>();
  for (const cn of session.clipnotes) {
    if (cn.tag_id) {
      sessionTagCounts.set(cn.tag_id, (sessionTagCounts.get(cn.tag_id) ?? 0) + 1);
    }
  }

  const stacks = getStacks();
  const tags = [...sessionTagCounts.entries()].map(([tagId, sessionCount]) => {
    const stack = stacks.find((s) => s.tag_id === tagId);
    const after = stack?.count ?? sessionCount;
    const before = Math.max(0, after - sessionCount);
    const name = stack?.tag_name ?? getTag(tagId)?.name ?? tagId;
    return { after, before, name };
  });

  return {
    clipnotesCount: session.clipnotes.length,
    firstClipnoteId: session.clipnotes[0]?.id,
    tags,
  };
}

export function ClipnoteSession({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // Bottom sheet
  const [activeFlag, setActiveFlag] = useState<Flag | null>(null);
  const [sheetOpenTime, setSheetOpenTime] = useState<number | null>(null);
  const [sheetCloseTime, setSheetCloseTime] = useState<number | null>(null);
  const [sheetPresetTag, setSheetPresetTag] = useState<string | null>(null);
  const [sheetCustomTag, setSheetCustomTag] = useState("");

  // Session Complete
  const [showComplete, setShowComplete] = useState(false);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const s = getSession(sessionId);
    if (s) {
      setSession(s);
      if (s.status === "complete") setShowComplete(true);
    }
    const cached = getCachedVideoUrl(sessionId);
    if (cached) setVideoUrl(cached);
  }, [sessionId]);

  function handleVideoImport(file: File | undefined) {
    if (!file || !session) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    cacheVideoUrl(session.id, url);
    saveSession({ ...session, source_video_url: url });
  }

  function handleFlag() {
    if (!session) return;
    const timestamp = videoRef.current?.currentTime ?? 0;
    try {
      const flag = addFlag(session.id, timestamp);
      setSession((cur) => cur ? { ...cur, flags: [...cur.flags, flag] } : cur);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(40);
      }
    } catch {
      // session not found in store
    }
  }

  function handlePlay() {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => {
      // Browser playback can be blocked until the user taps again.
    });
  }

  function openSheet(flag: Flag) {
    const t = flag.timestamp;
    const dur = duration > 0 ? duration : t + 30;
    setActiveFlag(flag);
    setSheetOpenTime(Math.max(0, t - 2));
    setSheetCloseTime(Math.min(dur, t + 6));
    setSheetPresetTag(null);
    setSheetCustomTag("");
  }

  function closeSheet() {
    setActiveFlag(null);
  }

  function setOpenToCurrent() {
    setSheetOpenTime(videoRef.current?.currentTime ?? 0);
  }

  function setCloseToCurrent() {
    setSheetCloseTime(videoRef.current?.currentTime ?? 0);
  }

  function handleSaveClipnote() {
    if (
      !session ||
      !activeFlag ||
      sheetOpenTime === null ||
      sheetCloseTime === null ||
      sheetCloseTime <= sheetOpenTime
    )
      return;

    let tagId: string | undefined;
    if (sheetPresetTag) {
      tagId = createTag(sheetPresetTag).id;
    } else if (sheetCustomTag.trim()) {
      tagId = createTag(sheetCustomTag.trim().toUpperCase().replace(/\s+/g, "_")).id;
    }

    if (!tagId) return;

    const tagName = getTag(tagId)?.name ?? "";

    let thumbnailUrl: string | undefined;
    const video = videoRef.current;
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      try {
        const canvas = document.createElement("canvas");
        const w = Math.min(video.videoWidth, 640);
        canvas.width = w;
        canvas.height = Math.round(w * (video.videoHeight / video.videoWidth));
        canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnailUrl = canvas.toDataURL("image/jpeg", 0.72);
      } catch {
        // skip thumbnail
      }
    }

    const clipnote: Clipnote = {
      id: `cn-${Date.now()}`,
      session_id: session.id,
      flag_id: activeFlag.id,
      open_time: sheetOpenTime,
      close_time: sheetCloseTime,
      title: tagName,
      tag_id: tagId,
      thumbnail_url: thumbnailUrl,
      created_at: new Date().toISOString(),
    };

    saveClipnote(clipnote);

    setSession((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        flags: cur.flags.map((f) =>
          f.id === activeFlag.id
            ? { ...f, converted_to_clipnote_id: clipnote.id }
            : f,
        ),
        clipnotes: [...cur.clipnotes, clipnote],
      };
    });

    setActiveFlag(null);
  }

  function handleFinish() {
    if (!session) return;

    const nextSummary = buildSessionSummary(session);
    completeSession(session.id);
    setSession((cur) => cur ? { ...cur, status: "complete" } : cur);
    setSummary(nextSummary);
    setShowComplete(true);
  }

  function handleTitleBlur() {
    if (!session || !titleRef.current) return;
    const next = titleRef.current.value.trim() || session.title;
    updateSessionTitle(session.id, next);
    setSession((cur) => cur ? { ...cur, title: next } : cur);
  }

  const clipDuration =
    sheetOpenTime !== null && sheetCloseTime !== null && sheetCloseTime > sheetOpenTime
      ? Math.round(sheetCloseTime - sheetOpenTime)
      : null;

  const hasTag = sheetPresetTag !== null || sheetCustomTag.trim().length > 0;
  const canSave = clipDuration !== null && clipDuration > 0 && hasTag;

  // ─── Session Complete ──────────────────────────────────────────────────────
  if (showComplete) {
    const completeSummary = summary ?? (session ? buildSessionSummary(session) : {
      clipnotesCount: 0,
      tags: [],
    });
    return (
      <main className="cn-session-page">
        <nav className="cn-session-nav">
          <Link className="cn-back-btn" href="/">
            ← Clipnote
          </Link>
        </nav>
        <div className="cn-complete-screen">
          <div className="cn-complete-hero">
            <p className="cn-complete-count">{completeSummary.clipnotesCount}</p>
            <p className="cn-complete-label">Clipnotes Saved</p>
          </div>

          {completeSummary.tags.length > 0 && (
            <section className="cn-complete-progress">
              <div className="cn-complete-section-heading">
                <p>Tags Used</p>
                <span>Dataset Counts Updated</span>
              </div>
              <div className="cn-complete-bins">
                {completeSummary.tags.map((tag) => (
                  <div className="cn-complete-bin" key={tag.name}>
                    <span className="cn-complete-bin-name">{tag.name}</span>
                    <span className="cn-complete-bin-count">
                      {tag.before} → {tag.after}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="cn-complete-actions">
            <Link className="cn-complete-primary-btn" href="/">
              RETURN TO SESSIONS
            </Link>
            {completeSummary.firstClipnoteId && (
              <Link
                className="cn-complete-secondary-btn"
                href={`/clipnote/${completeSummary.firstClipnoteId}`}
              >
                REVIEW CLIPNOTES
              </Link>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ─── Session workspace ─────────────────────────────────────────────────────
  return (
    <main className="cn-session-page">
      <nav className="cn-session-nav">
        <Link className="cn-back-btn" href="/">
          ← Clipnote
        </Link>
        {session && (
          <input
            className="cn-session-title-input"
            defaultValue={session.title}
            onBlur={handleTitleBlur}
            ref={titleRef}
          />
        )}
      </nav>

      {videoUrl ? (
        <>
          <div className="cn-video-wrap">
            <video
              className="cn-video"
              onLoadedMetadata={(e) =>
                setDuration(
                  Number.isFinite(e.currentTarget.duration)
                    ? e.currentTarget.duration
                    : 0,
                )
              }
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              playsInline
              ref={videoRef}
              src={videoUrl}
            />
          </div>

          <div className="cn-rail">
            {duration > 0 && (
              <>
                <div
                  className="cn-rail-playhead"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
                {session?.flags.map((flag) => (
                  <button
                    className="cn-rail-flag"
                    data-converted={
                      flag.converted_to_clipnote_id ? "true" : undefined
                    }
                    key={flag.id}
                    onClick={() => openSheet(flag)}
                    style={{ left: `${(flag.timestamp / duration) * 100}%` }}
                    type="button"
                  />
                ))}
              </>
            )}
          </div>

          <div className="cn-session-actions">
            <button className="cn-play-btn" onClick={handlePlay} type="button">
              PLAY
            </button>
            <button className="cn-flag-btn" onClick={handleFlag} type="button">
              FLAG
            </button>
          </div>

          {session && session.clipnotes.length > 0 && (
            <section className="cn-clipnotes-section">
              <p className="cn-section-label">
                {session.clipnotes.length}{" "}
                {session.clipnotes.length === 1 ? "Clipnote" : "Clipnotes"}
              </p>
              {session.clipnotes.map((cn) => {
                const tag = cn.tag_id ? getTag(cn.tag_id) : null;
                return (
                  <Link
                    className="cn-clipnote-card"
                    href={`/clipnote/${cn.id}`}
                    key={cn.id}
                  >
                    {cn.thumbnail_url ? (
                      <img
                        alt=""
                        className="cn-clipnote-thumb"
                        src={cn.thumbnail_url}
                      />
                    ) : (
                      <div className="cn-clipnote-thumb-empty" />
                    )}
                    <div className="cn-clipnote-info">
                      <span className="cn-clipnote-title">{cn.title}</span>
                      <span className="cn-clipnote-meta">
                        <span>
                          {formatTime(cn.open_time)} – {formatTime(cn.close_time)}
                        </span>
                        {tag && (
                          <span className="cn-clipnote-tag">{tag.name}</span>
                        )}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </section>
          )}

          {session?.status === "active" && (
            <button
              className="cn-finish-btn"
              onClick={handleFinish}
              type="button"
            >
              FINISH SESSION
            </button>
          )}
        </>
      ) : (
        <div className="cn-import-wrap">
          <p className="cn-import-label">Import your video to start.</p>
          <label className="cn-import-btn">
            <input
              accept="video/*"
              onChange={(e) => handleVideoImport(e.currentTarget.files?.[0])}
              type="file"
            />
            <span>Import Video</span>
          </label>
        </div>
      )}

      {activeFlag ? (
        <div className="cn-sheet-backdrop" onClick={closeSheet}>
          <div className="cn-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="cn-sheet-handle" />

            <p className="cn-sheet-timestamp">
              Flag at {formatTime(activeFlag.timestamp)}
            </p>

            <div className="cn-sheet-range-row">
              <button
                className="cn-sheet-range-btn"
                onClick={setOpenToCurrent}
                type="button"
              >
                <span>Open</span>
                <em>
                  {sheetOpenTime !== null ? formatTime(sheetOpenTime) : "—"}
                </em>
              </button>
              <button
                className="cn-sheet-range-btn"
                onClick={setCloseToCurrent}
                type="button"
              >
                <span>Close</span>
                <em>
                  {sheetCloseTime !== null ? formatTime(sheetCloseTime) : "—"}
                </em>
              </button>
            </div>

            {clipDuration !== null && (
              <p className="cn-sheet-clip-duration">{clipDuration}s clip</p>
            )}

            <div className="cn-tag-row">
              {PRESET_TAGS.map((name) => (
                <button
                  className="cn-tag-pill"
                  data-selected={sheetPresetTag === name ? "true" : undefined}
                  key={name}
                  onClick={() => {
                    setSheetPresetTag(sheetPresetTag === name ? null : name);
                    setSheetCustomTag("");
                  }}
                  type="button"
                >
                  {name}
                </button>
              ))}
              <input
                className="cn-tag-custom"
                onChange={(e) => {
                  setSheetCustomTag(e.target.value);
                  if (e.target.value) setSheetPresetTag(null);
                }}
                placeholder="Custom..."
                type="text"
                value={sheetCustomTag}
              />
            </div>

            <button
              className="cn-sheet-save-btn"
              disabled={!canSave}
              onClick={handleSaveClipnote}
              type="button"
            >
              Save Clipnote
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
