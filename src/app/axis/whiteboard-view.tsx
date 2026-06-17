"use client";

// Whiteboard is a thread comprehension view. It uses internal primitives to organize
// the Axis conversation thread into a readable board. It is not a separate product,
// blank canvas, manual diagramming surface, hierarchy view, or dashboard.

import { useEffect, useMemo, useState } from "react";

export interface ConvMsg {
  role: "user" | "assistant";
  content: string;
}

interface WBSection {
  label: string;
  items: string[];
}

interface WBConnection {
  from: string;
  to: string;
  label: string;
}

interface WBData {
  title: string;
  summary?: string;
  sections: WBSection[];
  connections?: WBConnection[];
}

interface Props {
  history: ConvMsg[];
}

const sectionAccent: Record<string, string> = {
  QUESTION: "question",
  PATTERN: "pattern",
  INTERVENTION: "intervention",
  OUTCOME: "outcome",
  MISSION: "mission",
  EVIDENCE: "evidence",
};

function sectionKind(label: string) {
  return sectionAccent[label.trim().toUpperCase()] ?? "standard";
}

function itemMark(label: string) {
  switch (label.trim().toUpperCase()) {
    case "QUESTION":
      return "?";
    case "PATTERN":
    case "BEHAVIOR":
      return "->";
    case "INTERVENTION":
    case "OUTCOME":
    case "MISSION":
      return "✓";
    default:
      return "•";
  }
}

export default function WhiteboardView({ history }: Props) {
  const [data, setData] = useState<WBData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const historyKey = useMemo(
    () => history.map((m) => `${m.role}:${m.content}`).join("\n"),
    [history],
  );
  const hasEnoughThread = history.length >= 2;

  useEffect(() => {
    if (!hasEnoughThread) return;

    let cancelled = false;
    async function buildBoard() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/axis/whiteboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ history }),
        });
        const nextData = (await response.json()) as WBData & { error?: string };

        if (cancelled) return;
        if (nextData.error) {
          setData(null);
          if (nextData.error !== "not_enough") setError(nextData.error);
        } else {
          setData(nextData);
        }
      } catch {
        if (!cancelled) setError("Could not build whiteboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void Promise.resolve().then(buildBoard);

    return () => {
      cancelled = true;
    };
    // historyKey is the stable content dependency; the parent creates a new
    // history array on render, including while typing in the composer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEnoughThread, historyKey]);

  const showEmpty = !hasEnoughThread || (!loading && !error && !data);
  const sections = (data?.sections ?? []).filter((s) => s.items?.length > 0);
  const annotations = (data?.connections ?? []).filter(
    (c) => c.from && c.to && c.label,
  );

  return (
    <>
      <div className="wb">
        {loading && (
          <div className="wb-state wb-loading">
            <span className="wb-dot" />
            <span className="wb-dot" />
            <span className="wb-dot" />
          </div>
        )}

        {!loading && error && <p className="wb-state wb-err">{error}</p>}

        {showEmpty && (
          <p className="wb-state wb-empty">
            Keep the conversation going. Whiteboard organizes the thread once
            there is something to understand.
          </p>
        )}

        {hasEnoughThread && data && (
          <section className="wb-board" aria-label="Axis whiteboard">
            <div className="wb-heading">
              <p className="wb-kicker">THREAD</p>
              <h2 className="wb-title">{data.title}</h2>
              {data.summary && <p className="wb-summary">{data.summary}</p>}
            </div>

            <div className="wb-body">
              <div className="wb-sections">
                {sections.map((section, index) => {
                  const kind = sectionKind(section.label);
                  const mark = itemMark(section.label);
                  return (
                    <section
                      key={`${section.label}-${index}`}
                      className={`wb-section wb-section--${kind}`}
                    >
                      <h3 className="wb-section-label">{section.label}</h3>
                      <ul className="wb-items">
                        {section.items.map((item, i) => (
                          <li key={i} className="wb-item">
                            <span className="wb-mark" aria-hidden="true">
                              {mark}
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>

              {annotations.length > 0 && (
                <aside className="wb-notes" aria-label="Whiteboard notes">
                  {annotations.map((note, i) => (
                    <p key={i} className="wb-note">
                      <span>{note.from}</span>
                      <b aria-hidden="true">{"->"}</b>
                      <span>{note.label}</span>
                      <b aria-hidden="true">{"->"}</b>
                      <span>{note.to}</span>
                    </p>
                  ))}
                </aside>
              )}
            </div>
          </section>
        )}
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap");
      `}</style>

      <style jsx>{`
        .wb {
          background:
            linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)),
            radial-gradient(circle, rgba(25, 24, 21, 0.06) 1px, transparent 1px);
          background-size: auto, 24px 24px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 18px clamp(18px, 4vw, 54px) 180px;
        }

        .wb-state {
          color: rgba(25, 24, 21, 0.35);
          display: flex;
          font-size: 14px;
          gap: 5px;
          justify-content: center;
          line-height: 1.6;
          margin: 0 auto;
          max-width: 520px;
          padding: 60px 0;
          text-align: center;
        }

        .wb-loading {
          align-items: center;
        }

        .wb-err {
          color: rgba(110, 38, 28, 0.62);
        }

        .wb-empty {
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
        }

        .wb-dot {
          animation: wbpulse 1.1s ease-in-out infinite;
          background: rgba(25, 24, 21, 0.28);
          border-radius: 999px;
          display: block;
          flex-shrink: 0;
          height: 4px;
          width: 4px;
        }

        .wb-dot:nth-child(2) {
          animation-delay: 0.18s;
        }

        .wb-dot:nth-child(3) {
          animation-delay: 0.36s;
        }

        @keyframes wbpulse {
          0%,
          80%,
          100% {
            opacity: 0.18;
          }
          40% {
            opacity: 1;
          }
        }

        .wb-board {
          background: rgba(255, 255, 252, 0.9);
          border: 1px solid rgba(25, 24, 21, 0.12);
          box-shadow:
            inset 0 0 0 1px rgba(255, 255, 255, 0.8),
            0 18px 48px rgba(25, 24, 21, 0.08);
          margin: 0 auto;
          max-width: 1120px;
          min-height: min(680px, calc(100svh - 230px));
          padding: clamp(24px, 4vw, 44px);
        }

        .wb-heading {
          border-bottom: 3px double rgba(25, 24, 21, 0.56);
          margin-bottom: 26px;
          padding-bottom: 14px;
        }

        .wb-kicker {
          color: rgba(25, 24, 21, 0.36);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          margin: 0 0 3px;
        }

        .wb-title {
          color: rgba(25, 24, 21, 0.92);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: clamp(34px, 5vw, 64px);
          font-weight: 700;
          letter-spacing: 0;
          line-height: 0.98;
          margin: 0;
          max-width: 860px;
          text-decoration: underline;
          text-decoration-color: rgba(218, 82, 54, 0.42);
          text-decoration-thickness: 7px;
          text-underline-offset: -4px;
        }

        .wb-summary {
          color: rgba(25, 24, 21, 0.54);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 18px;
          line-height: 1.35;
          margin: 12px 0 0;
          max-width: 720px;
        }

        .wb-body {
          display: grid;
          gap: 28px;
          grid-template-columns: minmax(0, 1fr) minmax(160px, 220px);
        }

        .wb-sections {
          column-gap: clamp(24px, 4vw, 48px);
          columns: 2 300px;
        }

        .wb-section {
          break-inside: avoid;
          margin: 0 0 28px;
          padding: 0 0 4px;
          position: relative;
        }

        .wb-section::before {
          background: rgba(25, 24, 21, 0.42);
          content: "";
          height: 2px;
          left: 0;
          position: absolute;
          right: 0;
          top: 31px;
        }

        .wb-section--question::after,
        .wb-section--intervention::after,
        .wb-section--mission::after {
          border: 2px solid rgba(218, 82, 54, 0.36);
          border-radius: 50%;
          content: "";
          height: 68%;
          left: -10px;
          pointer-events: none;
          position: absolute;
          top: 20px;
          transform: rotate(-1.5deg);
          width: min(100%, 420px);
        }

        .wb-section--pattern .wb-item span:last-child,
        .wb-section--outcome .wb-item span:last-child {
          background: linear-gradient(
            transparent 58%,
            rgba(244, 196, 78, 0.36) 58%
          );
        }

        .wb-section-label {
          color: rgba(25, 24, 21, 0.84);
          display: inline-block;
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1.2;
          margin: 0 0 13px;
          padding-right: 12px;
          position: relative;
          text-transform: uppercase;
          z-index: 1;
        }

        .wb-section-label::after {
          border: 2px solid rgba(25, 24, 21, 0.18);
          border-radius: 2px;
          content: "";
          inset: -1px -7px 0 -4px;
          position: absolute;
          transform: rotate(-0.6deg);
          z-index: -1;
        }

        .wb-items {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .wb-item {
          align-items: baseline;
          color: rgba(25, 24, 21, 0.88);
          display: grid;
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 18px;
          gap: 9px;
          grid-template-columns: 26px minmax(0, 1fr);
          line-height: 1.38;
          padding: 3px 0;
        }

        .wb-mark {
          color: rgba(25, 24, 21, 0.56);
          font-weight: 700;
          text-align: center;
        }

        .wb-notes {
          border-left: 2px solid rgba(25, 24, 21, 0.16);
          min-width: 0;
          padding-left: 18px;
        }

        .wb-note {
          color: rgba(25, 24, 21, 0.44);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 15px;
          line-height: 1.25;
          margin: 0 0 18px;
          transform: rotate(-1deg);
        }

        .wb-note b {
          color: rgba(218, 82, 54, 0.55);
          display: block;
          font-weight: 700;
          margin: 2px 0;
        }

        @media (max-width: 760px) {
          .wb {
            padding-inline: 12px;
          }

          .wb-board {
            min-height: calc(100svh - 220px);
            padding: 22px 18px 28px;
          }

          .wb-body {
            display: block;
          }

          .wb-sections {
            columns: 1;
          }

          .wb-notes {
            border-left: 0;
            border-top: 2px solid rgba(25, 24, 21, 0.16);
            margin-top: 16px;
            padding: 16px 0 0;
          }

          .wb-title {
            font-size: 36px;
          }

          .wb-summary,
          .wb-item {
            font-size: 17px;
          }
        }
      `}</style>
    </>
  );
}
