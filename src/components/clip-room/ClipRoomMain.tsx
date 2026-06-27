"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { axisAuthenticatedFetch } from "../../lib/axis-client-auth";
import { useAxisAuth } from "../../app/axis/axis-auth-control";
import AxisAuthControl from "../../app/axis/axis-auth-control";
import type { ClipSource } from "../../lib/clip-room/types";

export function ClipRoomMain() {
  const auth = useAxisAuth();
  const [clips, setClips] = useState<ClipSource[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.status !== "signed_in") return;
    setLoading(true);
    axisAuthenticatedFetch("/api/clip-room/sources")
      .then((r) => r.json())
      .then((d) => setClips(d.clips ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [auth.status]);

  return (
    <div className="cr-root">
      <header className="cr-header">
        <span className="cr-logo">Axis</span>
        <AxisAuthControl auth={auth} />
      </header>

      <main className="cr-main">
        <div className="cr-actions">
          <Link href="/record" className="cr-card cr-card--primary">
            <span className="cr-card-title">Record Clip</span>
            <span className="cr-card-sub">Use your camera</span>
          </Link>
          <Link href="/upload" className="cr-card">
            <span className="cr-card-title">Upload Clip</span>
            <span className="cr-card-sub">Choose a video file</span>
          </Link>
        </div>

        {auth.status === "signed_in" && (
          <section className="cr-library">
            <p className="cr-library-label">Recent</p>
            {loading && <p className="cr-muted">Loading...</p>}
            {!loading && clips.length === 0 && (
              <p className="cr-muted">No clips yet.</p>
            )}
            <div className="cr-clip-list">
              {clips.map((clip) => (
                <Link key={clip.id} href={`/clips/${clip.id}`} className="cr-clip-card">
                  <span className="cr-clip-origin">
                    {clip.origin === "recorded" ? "REC" : "UP"}
                  </span>
                  <span className="cr-clip-name">{clip.filename ?? "Clip"}</span>
                  <span className={`cr-clip-status cr-clip-status--${clip.status}`}>
                    {statusLabel(clip.status)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {auth.status === "signed_out" && (
          <p className="cr-muted cr-muted--center">Sign in to save clips.</p>
        )}
      </main>

      <style jsx>{`
        .cr-root {
          background: var(--axis-bg);
          color: var(--axis-ink);
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, sans-serif;
          min-height: 100dvh;
        }

        .cr-header {
          align-items: center;
          border-bottom: 1px solid var(--axis-line);
          display: flex;
          justify-content: space-between;
          min-height: 52px;
          padding: 0 clamp(16px, 4vw, 32px);
        }

        .cr-logo {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .cr-main {
          display: flex;
          flex-direction: column;
          gap: 40px;
          padding: clamp(24px, 6vw, 56px) clamp(16px, 4vw, 32px);
        }

        .cr-actions {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr;
          max-width: 480px;
        }

        .cr-card {
          align-items: flex-start;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--axis-line);
          border-radius: 14px;
          color: var(--axis-ink);
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-height: 100px;
          padding: 20px 18px;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
        }

        .cr-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .cr-card--primary {
          background: var(--axis-live);
          border-color: transparent;
          color: #070a04;
        }

        .cr-card--primary:hover {
          background: color-mix(in srgb, var(--axis-live) 90%, white);
        }

        .cr-card-title {
          font-size: clamp(16px, 3vw, 20px);
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .cr-card-sub {
          font-size: 12px;
          font-weight: 500;
          opacity: 0.68;
        }

        .cr-library {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 480px;
        }

        .cr-library-label {
          color: var(--axis-muted);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin: 0;
          text-transform: uppercase;
        }

        .cr-clip-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .cr-clip-card {
          align-items: center;
          border: 1px solid var(--axis-line);
          border-radius: 8px;
          color: var(--axis-ink);
          display: flex;
          gap: 10px;
          min-height: 48px;
          padding: 8px 14px;
          text-decoration: none;
          transition: background 0.12s;
        }

        .cr-clip-card:hover {
          background: rgba(255,255,255,0.04);
        }

        .cr-clip-origin {
          background: rgba(255,255,255,0.08);
          border-radius: 4px;
          color: var(--axis-muted);
          flex-shrink: 0;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          padding: 2px 5px;
        }

        .cr-clip-name {
          flex: 1;
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .cr-clip-status {
          flex-shrink: 0;
          font-size: 11px;
          font-weight: 600;
        }

        .cr-clip-status--ready    { color: var(--axis-live); }
        .cr-clip-status--processing { color: #f4c95d; }
        .cr-clip-status--failed   { color: #e77; }
        .cr-clip-status--uploading,
        .cr-clip-status--uploaded,
        .cr-clip-status--pending  { color: var(--axis-muted); }

        .cr-muted {
          color: var(--axis-muted);
          font-size: 13px;
          margin: 0;
        }

        .cr-muted--center { text-align: center; }

        @media (max-width: 400px) {
          .cr-actions { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

function statusLabel(status: ClipSource["status"]) {
  const labels: Record<ClipSource["status"], string> = {
    pending: "Pending",
    uploading: "Uploading",
    uploaded: "Uploaded",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
  };
  return labels[status] ?? status;
}
