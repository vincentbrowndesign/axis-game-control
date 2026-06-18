"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  getAxisStatusStyle,
  resolveAxisSectionStatus,
  type AxisCardStatus,
} from "../../lib/axis-visual-language";

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
  status?: AxisCardStatus;
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
  order: string[];
}

type BoardInteractionMode = "none" | "reorder" | "spatial";

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

function getBoardInteractionMode(containerWidth: number): BoardInteractionMode {
  if (typeof window === "undefined") return "none";

  if (window.innerWidth < 640) return "none";
  if (window.innerWidth < 900) return "reorder";

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const landscape = window.matchMedia("(orientation: landscape)").matches;
  const wideTouchSurface = coarsePointer && landscape && window.innerWidth >= 900;

  return containerWidth >= 680 && (!coarsePointer || wideTouchSurface)
    ? "spatial"
    : "reorder";
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
    order: [],
  });
  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<BoardInteractionMode>("none");
  const sectionsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    mode: BoardInteractionMode;
    startX: number;
    startY: number;
    origin: BoardSectionObject["position"];
    startRect: DOMRect;
    containerRect: DOMRect;
  } | null>(null);

  const objects = useMemo<BoardSectionObject[]>(
    () => {
      const runtimeById = runtimeState.boardKey === boardKey ? runtimeState.values : {};
      const order =
        runtimeState.boardKey === boardKey && runtimeState.order.length > 0
          ? runtimeState.order
          : [];
      const orderIndex = new Map(order.map((id, index) => [id, index]));

      const generatedObjects = sections
        .map((section, index) => {
          const id = sectionObjectId(section);
          const runtime = runtimeById[id];

          return {
            id,
            sectionType: section.type,
            label: section.label,
            items: section.items,
            position: runtime?.position ?? { x: 0, y: 0 },
            status: resolveAxisSectionStatus(section.label),
            updatedAt: runtime?.updatedAt ?? 0,
            generatedIndex: index,
          };
        })
        .sort((a, b) => {
          const aOrder = orderIndex.get(a.id);
          const bOrder = orderIndex.get(b.id);

          if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
          if (aOrder !== undefined) return -1;
          if (bOrder !== undefined) return 1;
          return a.generatedIndex - b.generatedIndex;
        });

      return generatedObjects.map((object) => ({
        id: object.id,
        sectionType: object.sectionType,
        label: object.label,
        items: object.items,
        position: object.position,
        status: object.status,
        updatedAt: object.updatedAt,
      }));
    },
    [boardKey, runtimeState, sections],
  );

  const hasLocalArrangement =
    runtimeState.boardKey === boardKey &&
    (runtimeState.order.length > 0 || Object.keys(runtimeState.values).length > 0);

  useEffect(() => {
    const container = sectionsRef.current;
    if (!container) return;
    const measuredContainer = container;

    function clampCurrentLayout() {
      const nextInteractionMode = getBoardInteractionMode(measuredContainer.clientWidth);
      setInteractionMode(nextInteractionMode);

      setRuntimeState((currentRuntime) => {
        if (currentRuntime.boardKey !== boardKey) {
          return { boardKey, values: {}, order: [] };
        }

        if (nextInteractionMode !== "spatial") return currentRuntime;

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

        return changed ? { ...currentRuntime, values: nextValues } : currentRuntime;
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

  function resetArrangement() {
    setRuntimeState({ boardKey, values: {}, order: [] });
    dragRef.current = null;
    setActiveObjectId(null);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>, object: BoardSectionObject) {
    if (event.button !== 0 || interactionMode === "none") return;

    const sectionElement = event.currentTarget.closest(".thread-board-section");
    const containerElement = sectionsRef.current;
    if (!(sectionElement instanceof HTMLElement) || !containerElement) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setActiveObjectId(object.id);
    dragRef.current = {
      id: object.id,
      mode: interactionMode,
      startX: event.clientX,
      startY: event.clientY,
      origin: object.position,
      startRect: sectionElement.getBoundingClientRect(),
      containerRect: containerElement.getBoundingClientRect(),
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.mode === "reorder") {
      const containerElement = sectionsRef.current;
      if (!containerElement) return;

      const sectionElements = Array.from(
        containerElement.querySelectorAll<HTMLElement>("[data-section-object-id]"),
      );
      const hasActiveElement = sectionElements.some(
        (sectionElement) => sectionElement.dataset.sectionObjectId === drag.id,
      );
      if (!hasActiveElement) return;

      const sortedSections = sectionElements
        .filter((sectionElement) => sectionElement.dataset.sectionObjectId !== drag.id)
        .map((sectionElement) => ({
          id: sectionElement.dataset.sectionObjectId ?? "",
          midpoint:
            sectionElement.getBoundingClientRect().top +
            sectionElement.getBoundingClientRect().height / 2,
        }))
        .filter((section) => section.id)
        .sort((a, b) => a.midpoint - b.midpoint);
      const pointerY = event.clientY;
      let targetIndex = sortedSections.findIndex(
        (section) => pointerY < section.midpoint,
      );
      if (targetIndex === -1) targetIndex = sortedSections.length;

      setRuntimeState((currentRuntime) => {
        const currentOrder =
          currentRuntime.boardKey === boardKey && currentRuntime.order.length > 0
            ? currentRuntime.order
            : objects.map((object) => object.id);
        const nextOrder = currentOrder.filter((id) => id !== drag.id);
        nextOrder.splice(targetIndex, 0, drag.id);

        if (nextOrder.join("|") === currentOrder.join("|")) return currentRuntime;

        return {
          boardKey,
          values: currentRuntime.boardKey === boardKey ? currentRuntime.values : {},
          order: nextOrder,
        };
      });
      return;
    }

    if (drag.mode !== "spatial") return;

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
        order: currentRuntime.boardKey === boardKey ? currentRuntime.order : [],
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
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
    dragRef.current = null;
    setActiveObjectId(null);
  }

  return (
    <section
      className="thread-board"
      aria-label="Thread Board"
      data-interaction-mode={interactionMode}
    >
      <div className="thread-board-anchor">
        {board.title.trim() && <h3 className="thread-board-title">{board.title}</h3>}
        {typeof board.summary === "string" && board.summary.trim() && (
          <p className="thread-board-summary">{board.summary}</p>
        )}
        {hasLocalArrangement && (
          <button
            className="thread-board-reset"
            type="button"
            onClick={resetArrangement}
          >
            Reset arrangement
          </button>
        )}
      </div>

      {sections.length > 0 && (
        <div className="thread-board-sections" ref={sectionsRef}>
          {objects.map((object, index) => {
            const labelToken = sectionToken(object.label);
            const typeToken = sectionToken(object.sectionType);
            const statusStyle = getAxisStatusStyle(object.status);

            return (
              <section
                key={`${object.id}-${index}`}
                className={`thread-board-section thread-board-section--${typeToken} thread-board-section--${labelToken}${activeObjectId === object.id ? " thread-board-section--active" : ""}`}
                style={{
                  transform: interactionMode === "spatial"
                    ? `translate3d(${object.position.x}px, ${object.position.y}px, 0)`
                    : "none",
                  "--axis-section-accent": statusStyle.accent,
                  "--axis-section-paper": statusStyle.background,
                  "--axis-section-border": statusStyle.border,
                  "--axis-section-text": statusStyle.text,
                  "--axis-section-muted": statusStyle.mutedText,
                } as CSSProperties}
                data-axis-status={object.status}
                data-section-type={typeToken}
                data-section-label={labelToken}
                data-section-object-id={object.id}
              >
                <h4 className="thread-board-label">
                  <button
                    aria-label={`Move ${object.label}`}
                    className={`thread-board-handle${interactionMode === "none" ? " thread-board-handle--static" : ""}`}
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
          border-top: 2px solid color-mix(in srgb, var(--axis-line) 78%, transparent);
          max-width: 34rem;
          min-width: 0;
          padding-top: clamp(14px, 2vw, 24px);
        }

        .thread-board-title {
          color: color-mix(in srgb, var(--axis-ink) 86%, transparent);
          font-size: clamp(34px, 5.2vw, 72px);
          font-weight: 600;
          line-height: 0.98;
          margin: 0 0 14px;
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .thread-board-summary {
          color: color-mix(in srgb, var(--axis-ink) 62%, transparent);
          font-size: clamp(17px, 1.55vw, 22px);
          line-height: 1.42;
          margin: 0;
          max-width: 38ch;
          overflow-wrap: anywhere;
        }

        .thread-board-reset {
          background: transparent;
          border: 0;
          border-bottom: 1px solid color-mix(in srgb, var(--axis-line) 30%, transparent);
          color: color-mix(in srgb, var(--axis-ink) 54%, transparent);
          cursor: pointer;
          display: inline-block;
          font-family: inherit;
          font-size: 12px;
          margin: 18px 0 0;
          padding: 0 0 2px;
        }

        .thread-board-reset:hover {
          color: color-mix(in srgb, var(--axis-ink) 78%, transparent);
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
          background: color-mix(in srgb, var(--axis-section-paper) 82%, transparent);
          border: 1px solid color-mix(in srgb, var(--axis-section-border) 72%, transparent);
          border-radius: 2px;
          box-shadow: 0 1px 0 color-mix(in srgb, var(--axis-line) 6%, transparent);
          color: var(--axis-section-text);
          min-width: min(240px, 100%);
          overflow-wrap: anywhere;
          padding: clamp(12px, 1.35vw, 18px);
          position: relative;
          transition: box-shadow 0.12s ease;
          will-change: transform;
          z-index: 1;
        }

        .thread-board-section--active {
          box-shadow: 0 8px 22px color-mix(in srgb, var(--axis-line) 12%, transparent);
          z-index: 10;
        }

        .thread-board-section::before {
          background: color-mix(in srgb, var(--axis-section-accent) 72%, transparent);
          content: "";
          height: 3px;
          left: clamp(12px, 1.35vw, 18px);
          position: absolute;
          right: clamp(12px, 1.35vw, 18px);
          top: 9px;
        }

        .thread-board-section::after {
          background: var(--axis-section-accent);
          border-radius: 999px;
          content: "";
          height: 6px;
          opacity: 0.72;
          position: absolute;
          right: clamp(12px, 1.35vw, 18px);
          top: 19px;
          width: 6px;
        }

        .thread-board-section:nth-child(2n) {
          margin-top: clamp(18px, 4vw, 52px);
        }

        .thread-board-section:nth-child(3n) {
          grid-column: span 2;
          max-width: 82%;
        }

        .thread-board-section--hypothesis,
        .thread-board-section--pattern,
        .thread-board-section--assumed {
          border-style: dashed;
        }

        .thread-board-section--relationship {
          background: color-mix(in srgb, var(--axis-section-paper) 72%, transparent);
        }

        .thread-board-label {
          margin: 0 0 10px;
          padding-top: 10px;
        }

        .thread-board-handle {
          background: transparent;
          border: 0;
          color: color-mix(in srgb, var(--axis-section-muted) 76%, transparent);
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
          color: color-mix(in srgb, var(--axis-section-text) 78%, transparent);
          font-size: clamp(15px, 1.25vw, 18px);
          line-height: 1.38;
          margin: 0;
          padding-left: 18px;
        }

        .thread-board-items li + li {
          margin-top: 8px;
        }

        .thread-board[data-interaction-mode="reorder"] .thread-board-sections {
          grid-template-columns: 1fr;
          max-width: 100%;
          overflow: visible;
          padding: 0;
        }

        .thread-board[data-interaction-mode="reorder"] .thread-board-section,
        .thread-board[data-interaction-mode="reorder"] .thread-board-section:nth-child(2n),
        .thread-board[data-interaction-mode="reorder"] .thread-board-section:nth-child(3n) {
          grid-column: auto;
          margin-top: 0;
          max-width: none;
          min-width: 0;
          transform: none !important;
          will-change: auto;
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
            height: 2px;
            top: 6px;
          }

          .thread-board-section::after {
            height: 5px;
            right: 8px;
            top: 13px;
            width: 5px;
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
