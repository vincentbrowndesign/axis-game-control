"use client";

import type { CSSProperties, RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AXIS_ROOM_COLORS, AXIS_STATUS_STYLES } from "../../../lib/axis-visual-language";
import AxisLabComposer from "./axis-lab-composer";
import { axisLabThread } from "./axis-lab-mock-data";
import type { AxisLabDetail, AxisLabMark, AxisLabPreviewState } from "./axis-lab-types";
import styles from "./axis-lab.module.css";

const VALID_STATES: AxisLabPreviewState[] = ["empty", "active", "expanded"];

function parsePreviewState(value: string | null): AxisLabPreviewState {
  return VALID_STATES.includes(value as AxisLabPreviewState)
    ? (value as AxisLabPreviewState)
    : "active";
}

export default function AxisLabPreview() {
  const searchParams = useSearchParams();
  const previewState = parsePreviewState(searchParams.get("state"));

  return <AxisLabPreviewBody key={previewState} previewState={previewState} />;
}

function AxisLabPreviewBody({ previewState }: { previewState: AxisLabPreviewState }) {
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [localThoughts, setLocalThoughts] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(
    previewState === "expanded" ? axisLabThread.proofMark?.id ?? null : null,
  );

  const closeDetail = useCallback(() => {
    setExpandedId(null);
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!expandedId) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeDetail();
    }

    function onPointerDown(event: PointerEvent) {
      if (!detailRef.current) return;
      if (event.target instanceof Node && !detailRef.current.contains(event.target)) {
        closeDetail();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [closeDetail, expandedId]);

  const marks = [
    axisLabThread.proofMark,
    axisLabThread.nextMoveMark,
    axisLabThread.recentSourceMark,
  ].filter((mark): mark is AxisLabMark => Boolean(mark));
  const expandedMark = marks.find((mark) => mark.id === expandedId) ?? null;
  const expandedDetail = expandedMark?.detail ?? null;

  function handleComposerSubmit(text: string) {
    setLocalThoughts((current) => [...current, text]);
  }

  return (
    <main
      className={styles.labRoot}
      style={{
        "--lab-action": AXIS_STATUS_STYLES.use.accent,
        "--lab-context": AXIS_ROOM_COLORS.parked,
        "--lab-grid": AXIS_ROOM_COLORS.grid,
        "--lab-ink": AXIS_ROOM_COLORS.ink,
        "--lab-line": AXIS_ROOM_COLORS.line,
        "--lab-paper": AXIS_ROOM_COLORS.paper,
        "--lab-proof": AXIS_STATUS_STYLES.proof.accent,
        "--lab-room": AXIS_ROOM_COLORS.room,
      } as CSSProperties}
      aria-label="Axis Lab UI preview"
    >
      <header className={styles.labHeader}>
        <span className={styles.wordmark}>Axis</span>
        <span className={styles.labLabel}>Axis Lab / UI Preview</span>
      </header>

      <section className={styles.workSurface} aria-labelledby="axis-lab-work-title">
        {previewState === "empty" ? (
          <div className={styles.emptyWork}>
            <h1 id="axis-lab-work-title">What are we working on?</h1>
            <p>Bring the rough version.</p>
          </div>
        ) : (
          <div className={styles.currentWork}>
            <time className={styles.timeMark} dateTime="2026-06-19T08:31:00-05:00">
              {axisLabThread.sessionTime}
            </time>

            <p className={styles.threadTitle}>{axisLabThread.context.threadTitle}</p>
            <span className={styles.previewStatus}>
              {axisLabThread.context.savedPreviewStatus === "saved_preview" ? "Saved preview" : "Local preview"}
            </span>
            <article className={styles.contextObject} aria-labelledby="axis-lab-work-title">
              <p className={styles.contextLabel}>{axisLabThread.context.label}</p>
              <h1 id="axis-lab-work-title">{axisLabThread.context.statement}</h1>
              <p className={styles.axisSentence}>{axisLabThread.context.axisSentence}</p>
            </article>

            <div className={styles.markLayer} aria-label="Context surface marks">
              {marks.map((mark) => (
                <AxisLabMarkView
                  key={mark.id}
                  mark={mark}
                  expanded={expandedId === mark.id}
                  onExpand={(button) => {
                    openerRef.current = button;
                    setExpandedId(mark.id);
                  }}
                />
              ))}
            </div>

            {expandedDetail && (
              <AxisLabDetailView
                detail={expandedDetail}
                onClose={closeDetail}
                surfaceRef={detailRef}
              />
            )}

            {localThoughts.length > 0 && (
              <div className={styles.localThoughts} aria-label="Local preview additions">
                <span className={styles.localThoughtsLabel}>Next rough thought</span>
                {localThoughts.map((thought, index) => (
                  <p key={`${thought}-${index}`}>{thought}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <AxisLabComposer onSubmit={handleComposerSubmit} />
    </main>
  );
}

function AxisLabMarkView({
  expanded = false,
  mark,
  onExpand,
}: {
  expanded?: boolean;
  mark: AxisLabMark;
  onExpand?: (button: HTMLButtonElement) => void;
}) {
  const content = (
    <>
      <span className={styles.markAccent} aria-hidden="true" />
      <span className={styles.markLabel}>{mark.label}</span>
      <span className={styles.markText}>{mark.text}</span>
    </>
  );

  if (!mark.detail || !onExpand) {
    return (
      <div className={`${styles.mark} ${styles[`mark-${mark.accent}`]}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      className={`${styles.mark} ${styles.markButton} ${styles[`mark-${mark.accent}`]}`}
      type="button"
      aria-expanded={expanded}
      onClick={(event) => onExpand(event.currentTarget)}
    >
      {content}
    </button>
  );
}

const AxisLabDetailView = ({
  detail,
  onClose,
  surfaceRef,
}: {
  detail: AxisLabDetail;
  onClose: () => void;
  surfaceRef: RefObject<HTMLDivElement | null>;
}) => (
  <div className={styles.detailWrap}>
    <div className={styles.detailSurface} role="dialog" aria-label={detail.title} ref={surfaceRef}>
      <button className={styles.detailClose} type="button" onClick={onClose} aria-label="Close detail">
        Close
      </button>
      <p className={styles.detailKicker}>{detail.title}</p>
      {detail.source && <p>{detail.source}</p>}
      {detail.confidence && <p>{detail.confidence}</p>}
      {detail.relatedNotes && detail.relatedNotes.length > 0 && (
        <ul>
          {detail.relatedNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      {detail.action && <p className={styles.detailAction}>{detail.action}</p>}
    </div>
  </div>
);
