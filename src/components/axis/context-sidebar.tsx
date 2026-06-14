"use client";

import { type ContextSummary } from "../../lib/context-model";

// ---------------------------------------------------------------------------
// Capability thumbnail
// ---------------------------------------------------------------------------

function capabilityMark(capability?: string): string {
  if (!capability) return "AX";
  const map: Record<string, string> = {
    basketball: "🏀",
    music: "🎵",
    build: "🏗",
    research: "📚",
    film: "🎬",
    writing: "✍",
  };
  return map[capability.toLowerCase()] ?? capability.slice(0, 2).toUpperCase();
}

// ---------------------------------------------------------------------------
// Relative time
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  contexts: ContextSummary[];
  activeId?: string;
  isOpen: boolean;
  onSelect: (ctx: ContextSummary) => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function ContextSidebar({ contexts, activeId, isOpen, onSelect, onClose }: Props) {
  return (
    <>
      {/* Mobile backdrop — closes on tap */}
      {isOpen && <div className="backdrop" onClick={onClose} aria-hidden />}

      <aside className={`sidebar${isOpen ? " open" : ""}`} aria-label="Development contexts">

        {/* Header */}
        <div className="sidebar-hd">
          <span className="sidebar-label">Contexts</span>
          <button className="close-btn" onClick={onClose} aria-label="Close contexts" type="button">
            ×
          </button>
        </div>

        {/* List */}
        <div className="ctx-list">
          {contexts.length === 0 ? (
            <div className="empty">
              <p className="empty-q">What are you working on?</p>
              <p className="empty-sub">Your first context will appear here.</p>
            </div>
          ) : (
            contexts.map((ctx) => (
              <button
                key={ctx.id}
                className={`ctx-row${ctx.id === activeId ? " active" : ""}`}
                onClick={() => onSelect(ctx)}
                type="button"
              >
                <span className="ctx-top">
                  <span className="ctx-thumb" aria-hidden>
                    {capabilityMark(ctx.capability)}
                  </span>
                  <span className="ctx-copy">
                    <span className="ctx-title">{ctx.title}</span>
                    <span className="ctx-time">{relativeTime(ctx.updatedAt)}</span>
                  </span>
                </span>
                <span className="ctx-history">
                  {ctx.lastInsight ? (
                    <span className="ctx-line">Insight: {ctx.lastInsight}</span>
                  ) : null}
                  {ctx.lastExperiment ? (
                    <span className="ctx-line">Experiment: {ctx.lastExperiment}</span>
                  ) : null}
                </span>
              </button>
            ))
          )}
        </div>

      </aside>

      <style jsx>{`
        /* Mobile backdrop */
        .backdrop {
          background: rgba(0, 0, 0, 0.55);
          bottom: 0;
          left: 0;
          position: fixed;
          right: 0;
          top: 0;
          z-index: 40;
        }

        /* Sidebar panel */
        .sidebar {
          background: #0d0d0a;
          border-right: 1px solid rgba(247, 247, 242, 0.06);
          bottom: 0;
          display: flex;
          flex-direction: column;
          left: 0;
          position: fixed;
          top: 0;
          transform: translateX(-100%);
          transition: transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          width: 256px;
          z-index: 50;
        }

        /* Mobile: slides in */
        .sidebar.open {
          transform: translateX(0);
        }

        /* Desktop: always visible, no transform needed */
        @media (min-width: 768px) {
          .backdrop {
            display: none;
          }
          .sidebar {
            transform: translateX(0);
          }
        }

        /* Header */
        .sidebar-hd {
          align-items: center;
          border-bottom: 1px solid rgba(247, 247, 242, 0.05);
          display: flex;
          flex-shrink: 0;
          justify-content: space-between;
          padding: 16px 14px 13px;
        }

        .sidebar-label {
          color: rgba(247, 247, 242, 0.24);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        /* Close — mobile only */
        .close-btn {
          align-items: center;
          background: transparent;
          border: 0;
          color: rgba(247, 247, 242, 0.2);
          cursor: pointer;
          display: flex;
          font-size: 22px;
          height: 36px;
          justify-content: center;
          line-height: 1;
          padding: 0;
          width: 36px;
        }

        .close-btn:hover {
          color: rgba(247, 247, 242, 0.5);
        }

        @media (min-width: 768px) {
          .close-btn {
            display: none;
          }
        }

        /* Context list */
        .ctx-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0 16px;
        }

        .ctx-list::-webkit-scrollbar {
          display: none;
        }

        /* Empty state */
        .empty {
          padding: 36px 16px;
          text-align: center;
        }

        .empty-q {
          color: rgba(247, 247, 242, 0.25);
          font-size: 14px;
          font-weight: 500;
          margin: 0;
        }

        .empty-sub {
          color: rgba(247, 247, 242, 0.12);
          font-size: 12px;
          margin: 6px 0 0;
        }

        /* Context row */
        .ctx-row {
          background: transparent;
          border: 0;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 7px;
          padding: 11px 12px;
          text-align: left;
          transition: background 0.1s;
          width: 100%;
          min-height: 64px;
        }

        .ctx-row:hover {
          background: rgba(247, 247, 242, 0.04);
        }

        .ctx-row.active {
          background: rgba(247, 247, 242, 0.06);
        }

        .ctx-top {
          align-items: center;
          display: grid;
          gap: 9px;
          grid-template-columns: 32px minmax(0, 1fr);
        }

        .ctx-thumb {
          align-items: center;
          background: rgba(189, 255, 91, 0.08);
          border: 1px solid rgba(189, 255, 91, 0.18);
          color: rgba(189, 255, 91, 0.72);
          display: flex;
          font-size: 15px;
          font-weight: 800;
          height: 32px;
          justify-content: center;
          letter-spacing: 0;
          width: 32px;
        }

        .ctx-copy {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        /* Title — largest, readable */
        .ctx-title {
          color: rgba(247, 247, 242, 0.72);
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ctx-row.active .ctx-title {
          color: #f7f7f2;
        }

        .ctx-history {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding-left: 41px;
        }

        /* Learning record — small, muted */
        .ctx-line {
          color: rgba(247, 247, 242, 0.32);
          font-size: 12px;
          font-weight: 400;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Updated time — archival */
        .ctx-time {
          color: rgba(247, 247, 242, 0.18);
          font-size: 11px;
          font-weight: 400;
          margin-top: 1px;
        }
      `}</style>
    </>
  );
}
