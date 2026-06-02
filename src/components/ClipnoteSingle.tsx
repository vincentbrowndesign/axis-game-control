"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getCachedVideoUrl, getClipnote, type Clipnote, type Session } from "../lib/clipnote-store";

export function ClipnoteSingle({ clipnoteId }: { clipnoteId: string }) {
  const [clipnote, setClipnote] = useState<Clipnote | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [ended, setEnded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const result = getClipnote(clipnoteId);
    if (!result) return;

    setClipnote(result.clipnote);
    setSession(result.session);

    const cached = getCachedVideoUrl(result.session.id);
    if (cached) setVideoUrl(cached);
  }, [clipnoteId]);

  function handleReplay() {
    const video = videoRef.current;
    if (!video || !clipnote) return;
    setEnded(false);
    video.currentTime = clipnote.open_time;
    void video.play().catch(() => {
      setEnded(false);
    });
  }

  function handleShare() {
    if (!clipnote) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      void navigator.share({ title: clipnote.title, text: clipnote.title }).catch(() => {
        // dismissed
      });
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(clipnote.title);
    }
  }

  if (!clipnote) {
    return (
      <main className="cn-single-page">
        <nav className="cn-single-nav">
          <Link className="cn-back-btn" href="/">
            BACK
          </Link>
        </nav>
        <p className="cn-empty-state">Clipnote not found.</p>
      </main>
    );
  }

  return (
    <main className="cn-single-page">
      <nav className="cn-single-nav">
        <Link className="cn-back-btn" href={session ? `/session/${session.id}` : "/"}>
          BACK
        </Link>
      </nav>

      <p className="cn-single-title">{clipnote.title}</p>

      {videoUrl ? (
        <div className="cn-single-video-wrap">
          <video
            autoPlay
            className="cn-single-video"
            muted
            onEnded={() => setEnded(true)}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = clipnote.open_time;
            }}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime >= clipnote.close_time) {
                event.currentTarget.pause();
                setEnded(true);
              }
            }}
            playsInline
            poster={clipnote.thumbnail_url}
            ref={videoRef}
            src={videoUrl}
          />
        </div>
      ) : clipnote.thumbnail_url ? (
        <div className="cn-single-video-wrap">
          <img alt="" className="cn-single-video" src={clipnote.thumbnail_url} />
        </div>
      ) : null}

      <div className="cn-single-actions">
        {videoUrl ? (
          <button className="cn-single-action-btn cn-single-action-btn-primary" onClick={handleReplay} type="button">
            REPLAY
          </button>
        ) : null}
        <button className="cn-single-action-btn" onClick={handleShare} type="button">
          SHARE
        </button>
        <Link className="cn-single-action-btn" href={session ? `/session/${session.id}` : "/"}>
          BACK
        </Link>
      </div>
    </main>
  );
}
