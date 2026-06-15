"use client";

import React from "react";
import type { SidebarThread } from "../../lib/axis-server";

interface DevSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeThreadId: string | null;
  threads: SidebarThread[];
  authLabel: string;
  authType: string;
  isGuest: boolean;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortTitle(title: string | null, fallback = "Untitled"): string {
  if (!title) return fallback;
  return title.length > 38 ? `${title.slice(0, 38)}…` : title;
}

function threadSubtitle(t: SidebarThread): string | null {
  const s = t.current_bottleneck ?? t.focus;
  if (!s) return null;
  return s.length > 52 ? `${s.slice(0, 52)}…` : s;
}

export function DevSidebar({
  isOpen,
  onClose,
  activeThreadId,
  threads,
  authLabel,
  authType,
  isGuest,
  onSelectThread,
  onNewThread,
  onSignIn,
  onSignOut,
}: DevSidebarProps) {
  // Lock body scroll while sidebar is open (prevents iOS scroll-bleed)
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="backdrop" onClick={onClose} aria-hidden />

      <aside className="sidebar" role="dialog" aria-label="Axis threads">
        <div className="sidebar-hd">
          <span className="sidebar-wordmark">Axis</span>
          <button
            className="sidebar-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            ×
          </button>
        </div>

        <button
          className="new-thread-btn"
          onClick={() => {
            onNewThread();
            onClose();
          }}
          type="button"
        >
          + New thread
        </button>

        <div className="sidebar-body">
          <ul className="thread-list">
            {threads.length === 0 && (
              <li className="empty-state">No threads yet.</li>
            )}
            {threads.map((t) => {
              const subtitle = threadSubtitle(t);
              return (
                <li key={t.id}>
                  <button
                    className={`thread-item${t.id === activeThreadId ? " thread-item--active" : ""}`}
                    onClick={() => {
                      onSelectThread(t.id);
                      onClose();
                    }}
                    type="button"
                  >
                    <div className="thread-row-top">
                      <span className="thread-title">{shortTitle(t.title)}</span>
                      <span className="thread-time">{relTime(t.updated_at)}</span>
                    </div>
                    {subtitle && (
                      <span className="thread-subtitle">{subtitle}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="account-control">
          <span className="account-kicker">Account</span>
          <strong className="account-id">{authLabel}</strong>
          <span className="account-type">{authType}</span>
          {isGuest && (
            <button className="account-link" type="button" onClick={onSignIn}>
              Sign in with Google
            </button>
          )}
          {!isGuest && (
            <button className="sign-out-btn" type="button" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </aside>

      <style jsx>{`
        .backdrop {
          background: rgba(0, 0, 0, 0.32);
          bottom: 0;
          left: 0;
          position: fixed;
          right: 0;
          top: 0;
          z-index: 40;
        }

        .sidebar {
          background: #111110;
          bottom: 0;
          color: #fafaf9;
          display: flex;
          flex-direction: column;
          left: 0;
          max-width: 320px;
          overflow: hidden;
          position: fixed;
          top: 0;
          width: 88vw;
          z-index: 41;
        }

        .sidebar-hd {
          align-items: center;
          border-bottom: 1px solid rgba(250, 250, 249, 0.07);
          display: flex;
          flex-shrink: 0;
          justify-content: space-between;
          padding: 14px 18px;
        }

        .sidebar-wordmark {
          color: rgba(250, 250, 249, 0.28);
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .sidebar-close {
          align-items: center;
          background: none;
          border: none;
          color: rgba(250, 250, 249, 0.38);
          cursor: pointer;
          display: flex;
          font-size: 20px;
          height: 44px;
          justify-content: center;
          line-height: 1;
          padding: 0;
          transition: color 0.12s;
          width: 44px;
        }

        .sidebar-close:hover {
          color: rgba(250, 250, 249, 0.72);
        }

        .new-thread-btn {
          background: none;
          border: none;
          border-bottom: 1px solid rgba(250, 250, 249, 0.07);
          color: rgba(140, 190, 40, 0.8);
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 13px 18px;
          text-align: left;
          text-transform: uppercase;
          transition: color 0.12s;
          width: 100%;
        }

        .new-thread-btn:hover {
          color: rgba(140, 190, 40, 1);
        }

        .sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .thread-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .empty-state {
          color: rgba(250, 250, 249, 0.24);
          font-size: 12px;
          padding: 24px 18px;
        }

        .thread-item {
          background: none;
          border: none;
          border-bottom: 1px solid rgba(250, 250, 249, 0.05);
          color: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          font: inherit;
          gap: 4px;
          padding: 12px 18px;
          text-align: left;
          transition: background 0.1s;
          width: 100%;
        }

        .thread-item:hover {
          background: rgba(250, 250, 249, 0.04);
        }

        .thread-item--active {
          background: rgba(140, 190, 40, 0.07);
          border-left: 2px solid rgba(140, 190, 40, 0.6);
          padding-left: 16px;
        }

        .thread-row-top {
          align-items: baseline;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          width: 100%;
        }

        .thread-title {
          color: rgba(250, 250, 249, 0.88);
          font-size: 13px;
          font-weight: 520;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .thread-time {
          color: rgba(250, 250, 249, 0.26);
          flex-shrink: 0;
          font-size: 10px;
          letter-spacing: 0.02em;
        }

        .thread-subtitle {
          color: rgba(250, 250, 249, 0.38);
          font-size: 11px;
          line-height: 1.45;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .account-control {
          border-top: 1px solid rgba(250, 250, 249, 0.07);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          gap: 6px;
          padding: 14px 18px 18px;
        }

        .account-kicker {
          color: rgba(250, 250, 249, 0.26);
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .account-id {
          color: rgba(250, 250, 249, 0.82);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .account-type {
          color: rgba(250, 250, 249, 0.32);
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .account-link,
        .sign-out-btn {
          align-self: flex-start;
          background: transparent;
          border: 0;
          cursor: pointer;
          font: inherit;
          font-size: 12px;
          margin-top: 3px;
          padding: 0;
          transition: color 0.12s;
        }

        .account-link {
          color: rgba(140, 190, 40, 0.78);
        }

        .account-link:hover {
          color: rgba(140, 190, 40, 1);
        }

        .sign-out-btn {
          color: rgba(250, 250, 249, 0.4);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .sign-out-btn:hover {
          color: rgba(250, 250, 249, 0.7);
        }
      `}</style>
    </>
  );
}
