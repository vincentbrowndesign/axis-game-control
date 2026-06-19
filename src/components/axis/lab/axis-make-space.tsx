"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { AXIS_ROOM_COLORS } from "../../../lib/axis-visual-language";
import styles from "./axis-lab.module.css";
import type { MakeSpaceItem, MakeSpaceItemKind } from "./axis-lab-types";

const KIND_ACCENT: Record<MakeSpaceItemKind, string> = {
  keeper: AXIS_ROOM_COLORS.use,
  question: AXIS_ROOM_COLORS.decide,
  proof: AXIS_ROOM_COLORS.proof,
  next_move: AXIS_ROOM_COLORS.use,
};

interface Props {
  threadTitle: string;
  items: readonly MakeSpaceItem[];
  defaultExpandedId?: string;
  priorThought?: string;
}

export default function AxisMakeSpace({ threadTitle, items, defaultExpandedId, priorThought }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(defaultExpandedId ?? null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const close = useCallback((id: string) => {
    setExpandedId(null);
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.focus();
    });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && expandedId !== null) {
        close(expandedId);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expandedId, close]);

  useEffect(() => {
    if (!expandedId) return;
    function onPointer(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpandedId(null);
      }
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [expandedId]);

  return (
    <div className={styles.msColumn} ref={containerRef}>
      {priorThought && (
        <p className={styles.msPriorThought}>{priorThought}</p>
      )}
      <p className={styles.msThreadRef}>{threadTitle}</p>

      <div className={styles.msItems}>
        {items.map((item) => {
          const expanded = expandedId === item.id;
          const accent = KIND_ACCENT[item.kind];
          const detailId = `ms-detail-${item.id}`;

          return (
            <div key={item.id} className={styles.msItem}>
              <button
                type="button"
                ref={(el) => {
                  if (el) rowRefs.current.set(item.id, el);
                  else rowRefs.current.delete(item.id);
                }}
                className={`${styles.msRow}${expanded ? ` ${styles.msRowActive}` : ""}`}
                aria-expanded={expanded}
                aria-controls={detailId}
                style={{ "--item-accent": accent } as CSSProperties}
                onClick={() => {
                  if (expanded) {
                    close(item.id);
                  } else {
                    setExpandedId(item.id);
                  }
                }}
              >
                <span className={styles.msDot} aria-hidden="true" />
                <span className={styles.msKindLabel}>{item.label}</span>
                {!expanded && (
                  <span className={styles.msPreview}>{item.text}</span>
                )}
              </button>

              {expanded && (
                <div
                  id={detailId}
                  className={styles.msDetail}
                  role="region"
                  aria-label={`${item.label} detail`}
                >
                  <div className={styles.msDetailHead}>
                    <span
                      className={styles.msDetailLabel}
                      style={{ "--item-accent": accent } as CSSProperties}
                    >
                      {item.label}
                    </span>
                    <button
                      type="button"
                      className={styles.msCloseBtn}
                      onClick={() => close(item.id)}
                      aria-label={`Close ${item.label}`}
                    >
                      ×
                    </button>
                  </div>
                  <p className={styles.msDetailText}>{item.text}</p>
                  <p className={styles.msDetailReason}>{item.surfacedReason}</p>
                  <time className={styles.msDetailTime}>{item.createdAt}</time>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
