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
  signedIn: boolean;
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
  signedIn,
  threads,
}: Props) {
  const label = getSaveLabel(saveState, savedAt, saveAuthRequired);
  const actionLabel = getSaveActionLabel(saveState, saveAuthRequired);
  const canSave = Boolean(actionLabel) && !saveDisabled;

  return (
    <div className={`thread-continuity thread-continuity--${saveState}${saveAuthRequired ? " thread-continuity--auth-required" : ""}`}>
      <details className="thread-picker">
        <summary>
          <span className="thread-picker-label">Threads</span>
          <span className="thread-picker-mobile-label">{saveAuthRequired ? "Local thread" : "Threads"}</span>
        </summary>

        <div className="thread-popover">
          <button className="thread-new" type="button" onClick={onNewThread}>
            New thread
          </button>
          {saveAuthRequired && (
            <p className="thread-save-helper">Axis works locally. Sign in only matters for saving.</p>
          )}

          {!signedIn ? (
            <p className="thread-empty">Sign in to see saved threads.</p>
          ) : threads.length > 0 ? (
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
          color: color-mix(in srgb, var(--axis-ink) 56%, transparent);
          display: flex;
          flex-shrink: 0;
          gap: 7px;
          min-width: 0;
        }

        .thread-picker {
          font-size: 12px;
          position: relative;
          z-index: 4;
        }

        .thread-picker summary {
          align-items: baseline;
          cursor: pointer;
          display: flex;
          gap: 8px;
          list-style: none;
          padding: 2px 0;
          user-select: none;
        }

        .thread-picker-mobile-label {
          display: none;
        }

        .thread-picker summary::-webkit-details-marker {
          display: none;
        }

        .save-status {
          color: color-mix(in srgb, var(--axis-ink) 48%, transparent);
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 11px;
          line-height: 1.1;
          white-space: nowrap;
        }

        .thread-continuity--error .save-status,
        .thread-continuity--unsaved_changes .save-status,
        .thread-continuity--not_saved .save-status {
          color: color-mix(in srgb, var(--axis-ink) 66%, transparent);
        }

        .save-action {
          background: transparent;
          border: 0;
          border-bottom: 1px solid color-mix(in srgb, var(--axis-line) 34%, transparent);
          color: color-mix(in srgb, var(--axis-ink) 62%, transparent);
          cursor: pointer;
          font: inherit;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-size: 11px;
          font-weight: 650;
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

        .thread-save-helper {
          color: color-mix(in srgb, var(--axis-ink) 48%, transparent);
          font-size: 12px;
          line-height: 1.35;
          margin: 8px;
        }

        @media (max-width: 760px) {
          .thread-continuity {
            align-items: center;
            gap: 6px;
          }

          .thread-continuity--auth-required {
            gap: 0;
          }

          .thread-picker-label {
            display: none;
          }

          .thread-picker-mobile-label {
            display: inline;
          }

          .thread-picker summary {
            color: color-mix(in srgb, var(--axis-ink) 58%, transparent);
            font-family: ui-sans-serif, system-ui, sans-serif;
            font-size: 11px;
            min-height: 32px;
            padding: 0;
          }

          .save-status {
            font-size: 10.5px;
          }

          .save-action {
            font-size: 10.5px;
          }

          .thread-continuity--auth-required .save-status {
            display: none;
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
