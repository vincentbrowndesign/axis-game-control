"use client";

import React from "react";
import type { SidebarThread } from "../../lib/axis-server";

interface DevSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeThreadId: string | null;
  threads: SidebarThread[];
  pinnedThreadIds: string[];
  authLabel: string;
  authType: string;
  isGuest: boolean;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onRenameThread: (id: string, title: string) => Promise<void>;
  onDeleteThread: (id: string) => Promise<void>;
  onTogglePinThread: (id: string) => void;
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
  pinnedThreadIds,
  authLabel,
  authType,
  isGuest,
  onSelectThread,
  onNewThread,
  onRenameThread,
  onDeleteThread,
  onTogglePinThread,
  onSignIn,
  onSignOut,
}: DevSidebarProps) {
  const [query, setQuery] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const pinned = React.useMemo(() => new Set(pinnedThreadIds), [pinnedThreadIds]);
  const visibleThreads = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => {
      const title = thread.title ?? "";
      const subtitle = threadSubtitle(thread) ?? "";
      return `${title} ${subtitle}`.toLowerCase().includes(q);
    });
  }, [query, threads]);

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

        <div className="thread-search-wrap">
          <input
            className="thread-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search threads"
            type="search"
          />
        </div>

        <div className="sidebar-body">
          <ul className="thread-list">
            {visibleThreads.length === 0 && (
              <li className="empty-state">{query.trim() ? "No matching threads." : "No threads yet."}</li>
            )}
            {visibleThreads.map((t) => {
              const subtitle = threadSubtitle(t);
              const isEditing = editingId === t.id;
              const isPinned = pinned.has(t.id);
              return (
                <li key={t.id}>
                  <div className={`thread-item${t.id === activeThreadId ? " thread-item--active" : ""}`}>
                    {isEditing ? (
                      <form
                        className="rename-form"
                        onSubmit={async (event) => {
                          event.preventDefault();
                          const title = editingTitle.trim();
                          if (!title || busyId) return;
                          setBusyId(t.id);
                          await onRenameThread(t.id, title);
                          setBusyId(null);
                          setEditingId(null);
                        }}
                      >
                        <input
                          className="rename-input"
                          value={editingTitle}
                          onChange={(event) => setEditingTitle(event.target.value)}
                          autoFocus
                        />
                        <div className="rename-actions">
                          <button className="thread-action" disabled={busyId === t.id} type="submit">
                            Save
                          </button>
                          <button
                            className="thread-action"
                            type="button"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <button
                          className="thread-main"
                          onClick={() => {
                            onSelectThread(t.id);
                            onClose();
                          }}
                          type="button"
                        >
                          <div className="thread-row-top">
                            <span className="thread-title">
                              {isPinned && <span className="pin-mark">Pinned</span>}
                              {shortTitle(t.title)}
                            </span>
                            <span className="thread-time">{relTime(t.updated_at)}</span>
                          </div>
                          {subtitle && (
                            <span className="thread-subtitle">{subtitle}</span>
                          )}
                        </button>
                        <div className="thread-actions" aria-label={`${shortTitle(t.title)} actions`}>
                          <button className="thread-action" type="button" onClick={() => onTogglePinThread(t.id)}>
                            {isPinned ? "Unpin" : "Pin"}
                          </button>
                          <button
                            className="thread-action"
                            type="button"
                            onClick={() => {
                              setEditingId(t.id);
                              setEditingTitle(t.title ?? "");
                            }}
                          >
                            Rename
                          </button>
                          <button
                            className="thread-action thread-action--delete"
                            disabled={busyId === t.id}
                            type="button"
                            onClick={async () => {
                              setBusyId(t.id);
                              await onDeleteThread(t.id);
                              setBusyId(null);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="account-control">
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
          background: #ffffff;
          border-right: 1px solid rgba(26, 26, 24, 0.08);
          bottom: 0;
          color: #1a1a18;
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
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          display: flex;
          flex-shrink: 0;
          justify-content: space-between;
          padding: 14px 18px;
        }

        .sidebar-wordmark {
          color: rgba(26, 26, 24, 0.3);
          font-size: 11px;
          font-weight: 750;
          letter-spacing: 0.18em;
          text-transform: uppercase;
        }

        .sidebar-close {
          align-items: center;
          background: none;
          border: none;
          color: rgba(26, 26, 24, 0.4);
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
          color: rgba(26, 26, 24, 0.75);
        }

        .new-thread-btn {
          background: none;
          border: none;
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          color: rgba(120, 170, 60, 0.95);
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
          color: rgba(120, 170, 60, 1);
        }

        .sidebar-body {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .thread-search-wrap {
          border-bottom: 1px solid rgba(26, 26, 24, 0.07);
          flex-shrink: 0;
          padding: 10px 18px;
        }

        .thread-search {
          background: rgba(26, 26, 24, 0.035);
          border: 1px solid rgba(26, 26, 24, 0.09);
          border-radius: 8px;
          color: rgba(26, 26, 24, 0.84);
          font: inherit;
          font-size: 13px;
          outline: none;
          padding: 9px 10px;
          width: 100%;
        }

        .thread-search::placeholder {
          color: rgba(26, 26, 24, 0.32);
        }

        .thread-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .empty-state {
          color: rgba(26, 26, 24, 0.3);
          font-size: 12px;
          padding: 24px 18px;
        }

        .thread-item {
          background: none;
          border: none;
          border-bottom: 1px solid rgba(26, 26, 24, 0.05);
          color: inherit;
          display: flex;
          flex-direction: column;
          font: inherit;
          gap: 8px;
          padding: 11px 18px;
          text-align: left;
          transition: background 0.1s;
          width: 100%;
        }

        .thread-item:hover {
          background: rgba(26, 26, 24, 0.035);
        }

        .thread-item--active {
          background: rgba(120, 170, 60, 0.08);
          border-left: 2px solid rgba(120, 170, 60, 0.7);
          padding-left: 16px;
        }

        .thread-main {
          background: none;
          border: 0;
          color: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          font: inherit;
          gap: 4px;
          padding: 0;
          text-align: left;
          width: 100%;
        }

        .thread-row-top {
          align-items: baseline;
          display: flex;
          gap: 8px;
          justify-content: space-between;
          width: 100%;
        }

        .thread-title {
          align-items: center;
          color: rgba(26, 26, 24, 0.9);
          display: flex;
          font-size: 13px;
          font-weight: 520;
          gap: 6px;
          line-height: 1.4;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .pin-mark {
          color: rgba(120, 170, 60, 0.9);
          flex-shrink: 0;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .thread-time {
          color: rgba(26, 26, 24, 0.32);
          flex-shrink: 0;
          font-size: 10px;
          letter-spacing: 0.02em;
        }

        .thread-subtitle {
          color: rgba(26, 26, 24, 0.42);
          font-size: 11px;
          line-height: 1.45;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .thread-actions,
        .rename-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .thread-action {
          background: none;
          border: 0;
          color: rgba(26, 26, 24, 0.42);
          cursor: pointer;
          font: inherit;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 0;
          text-transform: uppercase;
        }

        .thread-action:hover {
          color: rgba(26, 26, 24, 0.75);
        }

        .thread-action:disabled {
          cursor: default;
          opacity: 0.35;
        }

        .thread-action--delete {
          color: rgba(176, 52, 42, 0.58);
        }

        .rename-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .rename-input {
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(120, 170, 60, 0.32);
          border-radius: 7px;
          color: rgba(26, 26, 24, 0.88);
          font: inherit;
          font-size: 13px;
          outline: none;
          padding: 8px 9px;
          width: 100%;
        }

        .account-control {
          border-top: 1px solid rgba(26, 26, 24, 0.07);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          gap: 6px;
          padding: 14px 18px 18px;
        }

        .account-id {
          color: rgba(26, 26, 24, 0.75);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .account-type {
          color: rgba(26, 26, 24, 0.36);
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
          color: rgba(120, 170, 60, 0.9);
        }

        .account-link:hover {
          color: rgba(120, 170, 60, 1);
        }

        .sign-out-btn {
          color: rgba(26, 26, 24, 0.42);
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .sign-out-btn:hover {
          color: rgba(26, 26, 24, 0.75);
        }
      `}</style>
    </>
  );
}
