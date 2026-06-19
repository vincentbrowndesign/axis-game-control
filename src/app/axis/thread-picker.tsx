"use client";

export type AxisThreadListItem = {
  id: string;
  lastOpenedAt?: string | null;
  latestPreview: string;
  title: string;
  updatedAt: string;
};

type AxisThreadSaveStatus =
  | "not_saved"
  | "saving"
  | "saved"
  | "unsaved_changes"
  | "error";

type Props = {
  activeThreadId: string | null;
  onNewThread: () => void;
  onOpenThread: (threadId: string) => void;
  onSave: () => void;
  saveAuthRequired: boolean;
  saveDisabled: boolean;
  savedAt: string | null;
  saveState: AxisThreadSaveStatus;
  threads: AxisThreadListItem[];
};

export default function ThreadPicker({
  activeThreadId,
  onNewThread,
  onOpenThread,
  onSave,
  saveAuthRequired,
  saveDisabled,
  savedAt,
  saveState,
  threads,
}: Props) {
  const label = getSaveLabel(saveState, savedAt, saveAuthRequired);
  const actionLabel = getSaveActionLabel(saveState, saveAuthRequired);
  const canSave = Boolean(actionLabel) && !saveDisabled;

  return (
    <div className="thread-continuity">
      <details className="thread-picker">
        <summary>
          <span>Threads</span>
        </summary>

        <div className="thread-popover">
          <button className="thread-new" type="button" onClick={onNewThread}>
            New thread
          </button>

          {threads.length > 0 ? (
            <div className="thread-list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  className={`thread-item${thread.id === activeThreadId ? " thread-item--active" : ""}`}
                  type="button"
                  onClick={() => onOpenThread(thread.id)}
                >
                  <span>{thread.title}</span>
                  <time
                    dateTime={thread.updatedAt}
                    title={formatFullDateTime(thread.updatedAt)}
                  >
                    {formatThreadTime(thread.updatedAt)}
                  </time>
                  {thread.latestPreview && <em>{thread.latestPreview}</em>}
                </button>
              ))}
            </div>
          ) : (
            <p className="thread-empty">No saved threads yet.</p>
          )}
        </div>
      </details>

      <span className="save-status">
        {saveState === "saved" && savedAt ? (
          <time
            dateTime={savedAt}
            title={formatFullDateTime(savedAt)}
            aria-label={formatFullDateTime(savedAt)}
          >
            {label}
          </time>
        ) : (
          label
        )}
      </span>

      {actionLabel && (
        <button
          className="save-action"
          type="button"
          disabled={!canSave}
          onClick={onSave}
        >
          {actionLabel}
        </button>
      )}

      <style jsx>{`
        .thread-continuity {
          align-items: baseline;
          color: color-mix(in srgb, var(--axis-ink) 38%, transparent);
          display: flex;
          flex-shrink: 0;
          gap: 8px;
          min-width: 0;
        }

        .thread-picker {
          font-size: 11px;
          position: relative;
          z-index: 4;
        }

        .thread-picker summary {
          align-items: baseline;
          cursor: pointer;
          display: flex;
          gap: 8px;
          list-style: none;
          user-select: none;
        }

        .thread-picker summary::-webkit-details-marker {
          display: none;
        }

        .save-status {
          color: color-mix(in srgb, var(--axis-ink) 28%, transparent);
          font-size: 10px;
          white-space: nowrap;
        }

        .save-action {
          background: transparent;
          border: 0;
          border-bottom: 1px solid color-mix(in srgb, var(--axis-line) 24%, transparent);
          color: color-mix(in srgb, var(--axis-ink) 42%, transparent);
          cursor: pointer;
          font: inherit;
          font-size: 10px;
          padding: 0 0 1px;
          white-space: nowrap;
        }

        .save-action:disabled {
          cursor: default;
          opacity: 0.34;
        }

        .thread-popover {
          background: var(--axis-paper);
          border: 1px solid color-mix(in srgb, var(--axis-line) 18%, transparent);
          box-shadow: 0 14px 40px color-mix(in srgb, var(--axis-line) 10%, transparent);
          left: 0;
          margin-top: 10px;
          max-height: min(460px, 70dvh);
          min-width: min(320px, calc(100vw - 32px));
          overflow-y: auto;
          padding: 10px;
          position: absolute;
          top: 100%;
        }

        .thread-new,
        .thread-item {
          background: transparent;
          border: 0;
          color: color-mix(in srgb, var(--axis-ink) 76%, transparent);
          cursor: pointer;
          display: block;
          font: inherit;
          padding: 8px;
          text-align: left;
          width: 100%;
        }

        .thread-new {
          border-bottom: 1px solid color-mix(in srgb, var(--axis-line) 10%, transparent);
          margin-bottom: 4px;
        }

        .thread-item {
          border-left: 2px solid transparent;
        }

        .thread-item--active {
          border-left-color: color-mix(in srgb, var(--axis-line) 70%, transparent);
        }

        .thread-item span,
        .thread-item time,
        .thread-item em {
          display: block;
        }

        .thread-item span {
          color: color-mix(in srgb, var(--axis-ink) 86%, transparent);
          font-size: 12px;
          line-height: 1.2;
        }

        .thread-item em {
          color: color-mix(in srgb, var(--axis-ink) 42%, transparent);
          font-size: 11px;
          font-style: normal;
          line-height: 1.3;
          margin-top: 3px;
          max-width: 32ch;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .thread-item time {
          color: color-mix(in srgb, var(--axis-ink) 34%, transparent);
          font-size: 10.5px;
          line-height: 1.2;
          margin-top: 2px;
        }

        .thread-empty {
          color: color-mix(in srgb, var(--axis-ink) 38%, transparent);
          font-size: 12px;
          margin: 8px;
        }

        @media (max-width: 760px) {
          .thread-continuity {
            gap: 7px;
          }

          .thread-popover {
            left: auto;
            max-height: min(360px, 64dvh);
            right: 0;
          }
        }
      `}</style>
    </div>
  );
}

function getSaveLabel(
  saveState: AxisThreadSaveStatus,
  savedAt: string | null,
  authRequired: boolean,
) {
  if (authRequired) return "Sign in to save";
  if (saveState === "saving") return "Saving...";
  if (saveState === "saved") {
    return savedAt ? `Saved ${formatShortTime(savedAt)}` : "Saved";
  }
  if (saveState === "unsaved_changes") return "Unsaved changes";
  if (saveState === "error") return "Save failed";
  return "Not saved";
}

function getSaveActionLabel(
  saveState: AxisThreadSaveStatus,
  authRequired: boolean,
) {
  if (authRequired) return "";
  if (saveState === "not_saved") return "Save";
  if (saveState === "unsaved_changes") return "Save";
  if (saveState === "error") return "Retry save";
  return "";
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function formatShortTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatFullDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
