"use client";

import type { Breakthrough, DevEvidence, DevThread } from "../../lib/axis-dev-persistence";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "threads" | "breakthroughs" | "evidence";

interface DevSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeThreadId: string | null;
  threads: DevThread[];
  breakthroughs: Breakthrough[];
  evidence: DevEvidence[];
  authLabel: string;
  authType: string;
  isGuest: boolean;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortTitle(title: string | null, fallback = "Untitled session"): string {
  if (!title) return fallback;
  return title.length > 42 ? title.slice(0, 42) + "…" : title;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DevSidebar({
  isOpen,
  onClose,
  activeThreadId,
  threads,
  breakthroughs,
  evidence,
  authLabel,
  authType,
  isGuest,
  onSelectThread,
  onNewThread,
  onSignIn,
  onSignOut,
}: DevSidebarProps) {
  const [tab, setTab] = React.useState<Tab>("threads");

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="backdrop" onClick={onClose} aria-hidden />

      <aside className="sidebar" role="dialog" aria-label="Development history">

        {/* Header */}
        <div className="sidebar-hd">
          <span className="sidebar-wordmark">Axis</span>
          <button className="sidebar-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* New thread */}
        <button className="new-thread-btn" onClick={() => { onNewThread(); onClose(); }}>
          + New session
        </button>

        {/* Tab bar */}
        <div className="tab-bar" role="tablist">
          {(["threads", "breakthroughs", "evidence"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`tab-btn${tab === t ? " tab-btn--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "threads" ? "Sessions" : t === "breakthroughs" ? "Breakthroughs" : "Evidence"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="sidebar-body">

          {/* ── Threads ── */}
          {tab === "threads" && (
            <ul className="thread-list">
              {threads.length === 0 && (
                <li className="empty-state">No sessions yet.</li>
              )}
              {threads.map((t) => (
                <li key={t.id}>
                  <button
                    className={`thread-item${t.id === activeThreadId ? " thread-item--active" : ""}`}
                    onClick={() => { onSelectThread(t.id); onClose(); }}
                  >
                    <span className="thread-title">{shortTitle(t.title)}</span>
                    <span className="thread-meta">{relTime(t.updated_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* ── Breakthroughs ── */}
          {tab === "breakthroughs" && (
            <ul className="bt-list">
              {breakthroughs.length === 0 && (
                <li className="empty-state">No breakthroughs yet.<br />Mark a key insight as a breakthrough during a session.</li>
              )}
              {breakthroughs.map((b) => (
                <li key={b.id} className="bt-item">
                  <p className="bt-desc">{b.description}</p>
                  <span className="bt-meta">
                    {b.domain ? `${b.domain} · ` : ""}{relTime(b.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* ── Evidence ── */}
          {tab === "evidence" && (
            <ul className="ev-list">
              {evidence.length === 0 && (
                <li className="empty-state">No evidence collected yet.</li>
              )}
              {evidence.map((e) => (
                <li key={e.id} className="ev-item">
                  <p className="ev-obs">{e.observation}</p>
                  {e.claim && <p className="ev-claim">{e.claim}</p>}
                  <span className="ev-meta">
                    {Math.round(e.confidence * 100)}% confidence · {relTime(e.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}

        </div>

        <div className="account-control" aria-label="Account">
          <span className="account-kicker">Account</span>
          <strong className="account-id">{authLabel}</strong>
          <span className="account-type">{authType}</span>
          {isGuest && (
            <button className="account-link" type="button" onClick={onSignIn}>
              Save with account
            </button>
          )}
          <button className="sign-out-btn" type="button" onClick={onSignOut}>
            Sign Out
          </button>
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
          background: none;
          border: none;
          color: rgba(250, 250, 249, 0.38);
          cursor: pointer;
          font-size: 20px;
          line-height: 1;
          padding: 0;
          transition: color 0.12s;
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

        .tab-bar {
          border-bottom: 1px solid rgba(250, 250, 249, 0.07);
          display: flex;
          flex-shrink: 0;
        }

        .tab-btn {
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(250, 250, 249, 0.32);
          cursor: pointer;
          flex: 1;
          font: inherit;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 10px 0;
          text-transform: uppercase;
          transition: color 0.12s, border-color 0.12s;
        }

        .tab-btn--active {
          border-bottom-color: rgba(140, 190, 40, 0.7);
          color: rgba(250, 250, 249, 0.88);
        }

        .sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
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
          padding: 0;
          transition: color 0.12s;
        }

        .account-link {
          color: rgba(140, 190, 40, 0.78);
          margin-top: 3px;
        }

        .account-link:hover {
          color: rgba(140, 190, 40, 1);
        }

        .sign-out-btn {
          color: rgba(250, 250, 249, 0.4);
          margin-top: 5px;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .sign-out-btn:hover {
          color: rgba(250, 250, 249, 0.7);
        }

        /* ── Thread list ── */

        .thread-list,
        .bt-list,
        .ev-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .empty-state {
          color: rgba(250, 250, 249, 0.24);
          font-size: 12px;
          line-height: 1.6;
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
          gap: 3px;
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
        }

        .thread-title {
          color: rgba(250, 250, 249, 0.82);
          font-size: 13px;
          font-weight: 450;
          line-height: 1.4;
        }

        .thread-meta {
          color: rgba(250, 250, 249, 0.28);
          font-size: 11px;
          letter-spacing: 0.02em;
        }

        /* ── Breakthroughs ── */

        .bt-item {
          border-bottom: 1px solid rgba(250, 250, 249, 0.05);
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px 18px;
        }

        .bt-desc {
          color: rgba(250, 250, 249, 0.82);
          font-size: 13px;
          font-weight: 450;
          line-height: 1.5;
          margin: 0;
        }

        .bt-meta {
          color: rgba(250, 250, 249, 0.26);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        /* ── Evidence ── */

        .ev-item {
          border-bottom: 1px solid rgba(250, 250, 249, 0.05);
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 12px 18px;
        }

        .ev-obs {
          color: rgba(250, 250, 249, 0.72);
          font-size: 12px;
          line-height: 1.5;
          margin: 0;
        }

        .ev-claim {
          border-left: 2px solid rgba(140, 190, 40, 0.35);
          color: rgba(250, 250, 249, 0.48);
          font-size: 11px;
          line-height: 1.45;
          margin: 0;
          padding-left: 8px;
        }

        .ev-meta {
          color: rgba(250, 250, 249, 0.22);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
      `}</style>
    </>
  );
}

// React import needed for styled-jsx in client component
import React from "react";
