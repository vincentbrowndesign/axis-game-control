"use client";

// Whiteboard is a thread comprehension view. Axis organizes the current
// conversation thread into sections on a readable board.

import { useEffect, useMemo, useState } from "react";

export interface ConvMsg {
  role: "user" | "assistant";
  content: string;
}

interface WBSection {
  label: string;
  items: string[];
}

interface WBData {
  title: string;
  summary?: string;
  sections: WBSection[];
}

interface Props {
  history: ConvMsg[];
}

const sectionAccent: Record<string, string> = {
  QUESTION: "question",
  PATTERN: "pattern",
  UNDERSTANDING: "understanding",
  INTERVENTION: "intervention",
  OUTCOME: "outcome",
  MISSION: "mission",
  EVIDENCE: "evidence",
  "ACTION ITEMS": "action",
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
    case "UNDERSTANDING":
    case "ACTION ITEMS":
      return "\u2713";
    default:
      return "\u2022";
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
  const hasThreadContent = history.length >= 1;

  useEffect(() => {
    if (!hasThreadContent) return;

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
  }, [hasThreadContent, historyKey]);

  const showEmpty = !hasThreadContent || (!loading && !error && !data);
  const sections = (data?.sections ?? []).filter((s) => s.items?.length > 0);

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

        {hasThreadContent && data && (
          <section className="wb-board" aria-label="Axis whiteboard">
            <header className="wb-heading">
              <p className="wb-kicker">THREAD</p>
              <h2 className="wb-title">{data.title}</h2>
              {data.summary && <p className="wb-summary">{data.summary}</p>}
            </header>

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
                      {section.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="wb-item">
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

          </section>
        )}
      </div>

      <style jsx global>{`
        @import url("https://fonts.googleapis.com/css2?family=Kalam:wght@300;400;700&display=swap");
      `}</style>

      <style jsx>{`
        .wb {
          background:
            linear-gradient(rgba(255, 255, 252, 0.86), rgba(255, 255, 252, 0.86)),
            radial-gradient(circle, rgba(25, 24, 21, 0.055) 1px, transparent 1px);
          background-size: auto, 24px 24px;
          flex: 1 0 auto;
          min-height: calc(100svh - 48px);
          padding: 24px clamp(18px, 4vw, 72px) 180px;
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
          width: 100%;
        }

        .wb-heading {
          border-bottom: 5px double rgba(25, 24, 21, 0.58);
          margin-bottom: 32px;
          padding-bottom: 16px;
        }

        .wb-kicker {
          color: rgba(25, 24, 21, 0.38);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 13px;
          font-weight: 700;
          line-height: 1;
          margin: 0 0 4px;
        }

        .wb-title {
          color: rgba(25, 24, 21, 0.92);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: clamp(36px, 6vw, 76px);
          font-weight: 700;
          letter-spacing: 0;
          line-height: 0.98;
          margin: 0;
          max-width: 920px;
          text-decoration: underline;
          text-decoration-color: rgba(218, 82, 54, 0.42);
          text-decoration-thickness: 8px;
          text-underline-offset: -5px;
        }

        .wb-summary {
          color: rgba(25, 24, 21, 0.56);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 19px;
          line-height: 1.35;
          margin: 14px 0 0;
          max-width: 880px;
        }

        .wb-sections {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }

        .wb-section {
          position: relative;
        }

        .wb-section::before {
          background: rgba(25, 24, 21, 0.48);
          content: "";
          height: 2px;
          left: 0;
          position: absolute;
          right: 0;
          top: 33px;
        }

        .wb-section--question::after,
        .wb-section--understanding::after,
        .wb-section--intervention::after,
        .wb-section--action::after {
          border: 2px solid rgba(218, 82, 54, 0.38);
          border-radius: 50%;
          content: "";
          height: calc(100% - 14px);
          left: -14px;
          pointer-events: none;
          position: absolute;
          top: 22px;
          transform: rotate(-1.4deg);
          width: min(100%, 640px);
        }

        .wb-section--pattern .wb-item span:last-child,
        .wb-section--understanding .wb-item span:last-child,
        .wb-section--outcome .wb-item span:last-child {
          background: linear-gradient(
            transparent 58%,
            rgba(244, 196, 78, 0.4) 58%
          );
        }

        .wb-section-label {
          color: rgba(25, 24, 21, 0.86);
          display: inline-block;
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 23px;
          font-weight: 700;
          letter-spacing: 0.02em;
          line-height: 1.2;
          margin: 0 0 14px;
          padding-right: 14px;
          position: relative;
          text-transform: uppercase;
          z-index: 1;
        }

        .wb-section-label::after {
          border: 2px solid rgba(25, 24, 21, 0.2);
          content: "";
          inset: -1px -8px 0 -5px;
          position: absolute;
          transform: rotate(-0.5deg);
          z-index: -1;
        }

        .wb-items {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .wb-item {
          align-items: baseline;
          color: rgba(25, 24, 21, 0.9);
          display: grid;
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 20px;
          gap: 11px;
          grid-template-columns: 32px minmax(0, 1fr);
          line-height: 1.36;
          padding: 4px 0;
        }

        .wb-mark {
          color: rgba(25, 24, 21, 0.58);
          font-weight: 700;
          text-align: center;
        }

        @media (max-width: 760px) {
          .wb {
            padding: 22px 14px 180px;
          }

          .wb-title {
            font-size: 38px;
          }

          .wb-summary,
          .wb-item {
            font-size: 17px;
          }

          .wb-section-label {
            font-size: 20px;
          }
        }
      `}</style>
    </>
  );
}
