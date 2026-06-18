"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";

export type ThreadBoardSectionType =
  | "observation"
  | "pattern"
  | "relationship"
  | "question"
  | "hypothesis"
  | "intervention"
  | "outcome";

export interface ThreadBoardSection {
  type: ThreadBoardSectionType;
  label: string;
  items: string[];
}

export interface ThreadBoardData {
  title: string;
  summary: string;
  sections: ThreadBoardSection[];
}

interface Props {
  board?: ThreadBoardData | null;
}

interface BoardSectionObject {
  id: string;
  sectionType: ThreadBoardSectionType;
  label: string;
  items: string[];
  position: {
    x: number;
    y: number;
  };
  size?: {
    width?: number;
    height?: number;
  };
  isPinned?: boolean;
  isCollapsed?: boolean;
  createdFromThreadMessageId?: string;
  updatedAt: number;
}

function sectionToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sectionObjectId(section: Pick<ThreadBoardSection, "type" | "label">) {
  return `${sectionToken(section.type)}-${sectionToken(section.label)}`;
}

export default function ThreadBoard({ board }: Props) {
  const sections = useMemo(
    () =>
      Array.isArray(board?.sections)
        ? board.sections
            .map((section) => ({
              ...section,
              items: Array.isArray(section.items)
                ? section.items
                    .filter((item) => typeof item === "string" && item.trim())
                    .slice(0, 4)
                : [],
            }))
            .filter(
              (section) =>
                typeof section.label === "string" &&
                section.label.trim() &&
                section.items.length > 0,
            )
        : [],
    [board],
  );
  const [runtimeById, setRuntimeById] = useState<
    Record<string, Pick<BoardSectionObject, "position" | "updatedAt">>
  >({});
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origin: BoardSectionObject["position"];
  } | null>(null);

  const objects = useMemo<BoardSectionObject[]>(
    () =>
      sections.map((section) => {
        const id = sectionObjectId(section);
        const runtime = runtimeById[id];

        return {
          id,
          sectionType: section.type,
          label: section.label,
          items: section.items,
          position: runtime?.position ?? { x: 0, y: 0 },
          updatedAt: runtime?.updatedAt ?? 0,
        };
      }),
    [runtimeById, sections],
  );

  if (!board || typeof board.title !== "string") return null;

  if (!board.title.trim() && !board.summary?.trim() && sections.length === 0) {
    return null;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, object: BoardSectionObject) {
    if (event.button !== 0 || window.innerWidth <= 760) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: object.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: object.position,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    const nextPosition = {
      x: drag.origin.x + event.clientX - drag.startX,
      y: drag.origin.y + event.clientY - drag.startY,
    };

    setRuntimeById((currentRuntime) => ({
      ...currentRuntime,
      [drag.id]: {
        position: nextPosition,
        updatedAt: Date.now(),
      },
    }));
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  }

  return (
    <section className="thread-board" aria-label="Thread Board">
      <div className="thread-board-anchor">
        {board.title.trim() && <h3 className="thread-board-title">{board.title}</h3>}
        {typeof board.summary === "string" && board.summary.trim() && (
          <p className="thread-board-summary">{board.summary}</p>
        )}
      </div>

      {sections.length > 0 && (
        <div className="thread-board-sections">
          {objects.map((object, index) => {
            const labelToken = sectionToken(object.label);
            const typeToken = sectionToken(object.sectionType);

            return (
              <section
                key={`${object.id}-${index}`}
                className={`thread-board-section thread-board-section--${typeToken} thread-board-section--${labelToken}`}
                style={{
                  transform: `translate3d(${object.position.x}px, ${object.position.y}px, 0)`,
                }}
                data-section-type={typeToken}
                data-section-label={labelToken}
              >
                <h4 className="thread-board-label">
                  <button
                    aria-label={`Move ${object.label}`}
                    className="thread-board-handle"
                    type="button"
                    onPointerDown={(event) => handlePointerDown(event, object)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerEnd}
                    onPointerCancel={handlePointerEnd}
                  >
                    {object.label}
                  </button>
                </h4>
                <ul className="thread-board-items">
                  {object.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .thread-board {
          display: grid;
          gap: clamp(22px, 3vw, 42px);
          grid-template-columns: minmax(0, 0.92fr) minmax(260px, 1.08fr);
          margin: 0;
          max-width: 980px;
          min-height: min(640px, calc(100dvh - 180px));
          padding: 0;
          width: 100%;
        }

        .thread-board-anchor {
          align-self: start;
          border-top: 2px solid rgba(25, 24, 21, 0.78);
          max-width: 34rem;
          padding-top: clamp(14px, 2vw, 24px);
        }

        .thread-board-title {
          color: rgba(25, 24, 21, 0.86);
          font-size: clamp(34px, 5.2vw, 72px);
          font-weight: 600;
          line-height: 0.98;
          margin: 0 0 14px;
        }

        .thread-board-summary {
          color: rgba(25, 24, 21, 0.62);
          font-size: clamp(17px, 1.55vw, 22px);
          line-height: 1.42;
          margin: 0;
          max-width: 38ch;
        }

        .thread-board-sections {
          display: grid;
          gap: clamp(16px, 2vw, 28px);
          grid-auto-rows: minmax(110px, auto);
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .thread-board-section {
          align-self: start;
          background: rgba(255, 254, 251, 0.82);
          border: 1px solid rgba(25, 24, 21, 0.16);
          border-radius: 2px;
          box-shadow: 0 1px 0 rgba(25, 24, 21, 0.06);
          min-width: 0;
          padding: clamp(12px, 1.35vw, 18px);
          position: relative;
          transition: box-shadow 0.12s ease;
          will-change: transform;
        }

        .thread-board-section::before {
          background: rgba(25, 24, 21, 0.54);
          content: "";
          height: 1px;
          left: clamp(12px, 1.35vw, 18px);
          position: absolute;
          right: clamp(12px, 1.35vw, 18px);
          top: 9px;
        }

        .thread-board-section:nth-child(2n) {
          margin-top: clamp(18px, 4vw, 52px);
        }

        .thread-board-section:nth-child(3n) {
          grid-column: span 2;
          max-width: 82%;
        }

        .thread-board-section--outcome,
        .thread-board-section--intervention,
        .thread-board-section--gameplan,
        .thread-board-section--known,
        .thread-board-section--timeout_call,
        .thread-board-section--player_rule,
        .thread-board-section--adjustment_trigger {
          border-color: rgba(25, 24, 21, 0.28);
        }

        .thread-board-section--question,
        .thread-board-section--need_next,
        .thread-board-section--watch_next {
          background: rgba(255, 254, 251, 0.78);
        }

        .thread-board-section--hypothesis,
        .thread-board-section--pattern,
        .thread-board-section--assumed {
          border-style: dashed;
        }

        .thread-board-section--relationship {
          background: rgba(251, 250, 247, 0.72);
        }

        .thread-board-label {
          margin: 0 0 10px;
          padding-top: 10px;
        }

        .thread-board-handle {
          background: transparent;
          border: 0;
          color: rgba(25, 24, 21, 0.5);
          cursor: grab;
          display: block;
          font-family: inherit;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.05em;
          margin: 0;
          padding: 0;
          text-align: left;
          text-transform: uppercase;
          touch-action: none;
          width: 100%;
        }

        .thread-board-handle:active {
          cursor: grabbing;
        }

        .thread-board-items {
          color: rgba(25, 24, 21, 0.78);
          font-size: clamp(15px, 1.25vw, 18px);
          line-height: 1.38;
          margin: 0;
          padding-left: 18px;
        }

        .thread-board-items li + li {
          margin-top: 8px;
        }

        @media (max-width: 980px) {
          .thread-board {
            grid-template-columns: 1fr;
            min-height: 0;
          }

          .thread-board-anchor {
            max-width: 48rem;
          }

          .thread-board-sections {
            max-width: 100%;
          }
        }

        @media (max-width: 640px) {
          .thread-board {
            gap: 7px;
            padding-bottom: 0;
            padding-top: 3px;
          }

          .thread-board-title {
            font-size: 18px;
            line-height: 1.03;
            margin-bottom: 3px;
          }

          .thread-board-summary {
            font-size: 12px;
            line-height: 1.26;
          }

          .thread-board-items {
            font-size: 12.5px;
            line-height: 1.26;
          }

          .thread-board-sections {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .thread-board-anchor {
            border-top-width: 1px;
            padding-top: 5px;
          }

          .thread-board-label {
            margin-bottom: 3px;
            padding-top: 6px;
          }

          .thread-board-handle {
            cursor: default;
            font-size: 9.5px;
            touch-action: auto;
          }

          .thread-board-section {
            padding: 7px 8px;
            transform: none !important;
            will-change: auto;
          }

          .thread-board-section::before {
            left: 8px;
            right: 8px;
            top: 6px;
          }

          .thread-board-items li + li {
            margin-top: 2px;
          }

          .thread-board-section,
          .thread-board-section:nth-child(2n),
          .thread-board-section:nth-child(3n) {
            grid-column: auto;
            margin-top: 0;
            max-width: none;
          }
        }
      `}</style>
    </section>
  );
}
