"use client";

export type AxisThreadListItem = {
  id: string;
  latestPreview: string;
  title: string;
  updatedAt: string;
};

type SaveState = "idle" | "saving" | "saved" | "not-saved";

type Props = {
  activeThreadId: string | null;
  onNewThread: () => void;
  onOpenThread: (threadId: string) => void;
  saveState: SaveState;
  threads: AxisThreadListItem[];
};

export default function ThreadPicker({
  activeThreadId,
  onNewThread,
  onOpenThread,
  saveState,
  threads,
}: Props) {
  const label =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : saveState === "not-saved"
          ? "Not saved"
          : "";

  return (
    <details className="thread-picker">
      <summary>
        <span>Threads</span>
        {label && <small>{label}</small>}
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
                <small>{formatThreadTime(thread.updatedAt)}</small>
                {thread.latestPreview && <em>{thread.latestPreview}</em>}
              </button>
            ))}
          </div>
        ) : (
          <p className="thread-empty">No saved threads yet.</p>
        )}
      </div>

      <style jsx>{`
        .thread-picker {
          color: color-mix(in srgb, var(--axis-ink) 38%, transparent);
          flex-shrink: 0;
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

        .thread-picker small {
          color: color-mix(in srgb, var(--axis-ink) 28%, transparent);
          font-size: 10px;
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
        .thread-item small,
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

        .thread-empty {
          color: color-mix(in srgb, var(--axis-ink) 38%, transparent);
          font-size: 12px;
          margin: 8px;
        }

        @media (max-width: 760px) {
          .thread-popover {
            left: auto;
            max-height: min(360px, 64dvh);
            right: 0;
          }
        }
      `}</style>
    </details>
  );
}

function formatThreadTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}
