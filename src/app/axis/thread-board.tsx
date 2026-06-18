"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

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

interface BoardSectionRuntime {
  position: BoardSectionObject["position"];
  updatedAt: number;
}

interface BoardRuntimeState {
  boardKey: string;
  values: Record<string, BoardSectionRuntime>;
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

function clampDelta(delta: number, min: number, max: number) {
  if (min > max) return 0;
  return Math.min(Math.max(delta, min), max);
}

function supportsSectionMovement(containerWidth: number) {
  if (typeof window === "undefined") return false;

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const landscape = window.matchMedia("(orientation: landscape)").matches;
  const wideTouchSurface = coarsePointer && landscape && window.innerWidth >= 900;

  return containerWidth >= 680 && (!coarsePointer || wideTouchSurface);
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
  const boardKey = useMemo(
    () =>
      [
        board?.title ?? "",
        board?.summary ?? "",
        ...sections.map((section) => `${section.type}:${section.label}`),
      ].join("|"),
    [board?.summary, board?.title, sections],
  );
  const [runtimeState, setRuntimeState] = useState<BoardRuntimeState>({
    boardKey: "",
    values: {},
  });
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [canMoveSections, setCanMoveSections] = useState(false);
  const sectionsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origin: BoardSectionObject["position"];
    startRect: DOMRect;
    containerRect: DOMRect;
  } | null>(null);

  const objects = useMemo<BoardSectionObject[]>(
    () => {
      const runtimeById = runtimeState.boardKey === boardKey ? runtimeState.values : {};

      return sections.map((section) => {
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
      });
    },
    [boardKey, runtimeState, sections],
  );

  useEffect(() => {
    const container = sectionsRef.current;
    if (!container) return;
    const measuredContainer = container;

    function clampCurrentLayout() {
      const nextCanMove = supportsSectionMovement(measuredContainer.clientWidth);
      setCanMoveSections(nextCanMove);

      setRuntimeState((currentRuntime) => {
        if (currentRuntime.boardKey !== boardKey) {
          return { boardKey, values: {} };
        }

        const containerRect = measuredContainer.getBoundingClientRect();
        let changed = false;
        const nextValues = { ...currentRuntime.values };

        Object.entries(currentRuntime.values).forEach(([id, runtime]) => {
          const sectionElement = measuredContainer.querySelector<HTMLElement>(
            `[data-section-object-id="${id}"]`,
          );
          if (!sectionElement) return;

          const rect = sectionElement.getBoundingClientRect();
          const nudgedX =
            rect.left < containerRect.left
              ? containerRect.left - rect.left
              : rect.right > containerRect.right
                ? containerRect.right - rect.right
                : 0;
          const nudgedY =
            rect.top < containerRect.top
              ? containerRect.top - rect.top
              : rect.bottom > containerRect.bottom
                ? containerRect.bottom - rect.bottom
                : 0;

          if (nudgedX || nudgedY) {
            changed = true;
            nextValues[id] = {
              position: {
                x: runtime.position.x + nudgedX,
                y: runtime.position.y + nudgedY,
              },
              updatedAt: Date.now(),
            };
          }
        });

        return changed ? { boardKey, values: nextValues } : currentRuntime;
      });
    }

    const frame = window.requestAnimationFrame(clampCurrentLayout);
    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(clampCurrentLayout);
    });
    observer.observe(container);
    window.addEventListener("orientationchange", clampCurrentLayout);
    window.addEventListener("resize", clampCurrentLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("orientationchange", clampCurrentLayout);
      window.removeEventListener("resize", clampCurrentLayout);
    };
  }, [boardKey]);

  if (!board || typeof board.title !== "string") return null;

  if (!board.title.trim() && !board.summary?.trim() && sections.length === 0) {
    return null;
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, object: BoardSectionObject) {
    if (event.button !== 0 || !canMoveSections) return;

    const sectionElement = event.currentTarget.closest(".thread-board-section");
    const containerElement = sectionsRef.current;
    if (!(sectionElement instanceof HTMLElement) || !containerElement) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveObjectId(object.id);
    dragRef.current = {
      id: object.id,
      startX: event.clientX,
      startY: event.clientY,
      origin: object.position,
      startRect: sectionElement.getBoundingClientRect(),
      containerRect: containerElement.getBoundingClientRect(),
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || !canMoveSections) return;

    const rawDeltaX = event.clientX - drag.startX;
    const rawDeltaY = event.clientY - drag.startY;
    const deltaX = clampDelta(
      rawDeltaX,
      drag.containerRect.left - drag.startRect.left,
      drag.containerRect.right - drag.startRect.right,
    );
    const deltaY = clampDelta(
      rawDeltaY,
      drag.containerRect.top - drag.startRect.top,
      drag.containerRect.bottom - drag.startRect.bottom,
    );
    const nextPosition = {
      x: drag.origin.x + deltaX,
      y: drag.origin.y + deltaY,
    };

    setRuntimeState((currentRuntime) => {
      const currentValues = currentRuntime.boardKey === boardKey ? currentRuntime.values : {};

      return {
        boardKey,
        values: {
          ...currentValues,
          [drag.id]: {
            position: nextPosition,
            updatedAt: Date.now(),
          },
        },
      };
    });
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (dragRef.current) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setActiveObjectId(null);
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
        <div className="thread-board-sections" ref={sectionsRef}>
          {objects.map((object, index) => {
            const labelToken = sectionToken(object.label);
            const typeToken = sectionToken(object.sectionType);

            return (
              <section
                key={`${object.id}-${index}`}
                className={`thread-board-section thread-board-section--${typeToken} thread-board-section--${labelToken}${activeObjectId === object.id ? " thread-board-section--active" : ""}`}
                style={{
                  transform: canMoveSections
                    ? `translate3d(${object.position.x}px, ${object.position.y}px, 0)`
                    : "none",
                }}
                data-section-type={typeToken}
                data-section-label={labelToken}
                data-section-object-id={object.id}
              >
                <h4 className="thread-board-label">
                  <button
                    aria-label={`Move ${object.label}`}
                    className={`thread-board-handle${canMoveSections ? "" : " thread-board-handle--static"}`}
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
          min-width: 0;
          overflow-x: clip;
          padding: 0;
          width: 100%;
        }

        .thread-board-anchor {
          align-self: start;
          border-top: 2px solid rgba(25, 24, 21, 0.78);
          max-width: 34rem;
          min-width: 0;
          padding-top: clamp(14px, 2vw, 24px);
        }

        .thread-board-title {
          color: rgba(25, 24, 21, 0.86);
          font-size: clamp(34px, 5.2vw, 72px);
          font-weight: 600;
          line-height: 0.98;
          margin: 0 0 14px;
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .thread-board-summary {
          color: rgba(25, 24, 21, 0.62);
          font-size: clamp(17px, 1.55vw, 22px);
          line-height: 1.42;
          margin: 0;
          max-width: 38ch;
          overflow-wrap: anywhere;
        }

        .thread-board-sections {
          display: grid;
          gap: clamp(16px, 2vw, 28px);
          grid-auto-rows: minmax(110px, auto);
          grid-template-columns: repeat(2, minmax(0, 1fr));
          overflow: hidden;
          padding: 2px;
          position: relative;
        }

        .thread-board-section {
          align-self: start;
          background: rgba(255, 254, 251, 0.82);
          border: 1px solid rgba(25, 24, 21, 0.16);
          border-radius: 2px;
          box-shadow: 0 1px 0 rgba(25, 24, 21, 0.06);
          min-width: min(240px, 100%);
          overflow-wrap: anywhere;
          padding: clamp(12px, 1.35vw, 18px);
          position: relative;
          transition: box-shadow 0.12s ease;
          will-change: transform;
          z-index: 1;
        }

        .thread-board-section--active {
          box-shadow: 0 8px 22px rgba(25, 24, 21, 0.12);
          z-index: 10;
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

        .thread-board-handle--static {
          cursor: default;
          touch-action: auto;
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
            max-width: 100%;
          }

          .thread-board-anchor {
            max-width: 48rem;
          }

          .thread-board-sections {
            grid-template-columns: 1fr;
            max-width: 100%;
            overflow: visible;
            padding: 0;
          }

          .thread-board-section {
            min-width: 0;
            transform: none !important;
            will-change: auto;
          }

          .thread-board-section,
          .thread-board-section:nth-child(2n),
          .thread-board-section:nth-child(3n) {
            grid-column: auto;
            margin-top: 0;
            max-width: none;
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
            overflow: visible;
            padding: 0;
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
            min-width: 0;
            padding: 7px 8px;
            transform: none !important;
            will-change: auto;
            z-index: 1;
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
