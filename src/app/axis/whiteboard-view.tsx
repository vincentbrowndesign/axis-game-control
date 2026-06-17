"use client";

// Whiteboard is a thread comprehension view. It uses internal primitives to organize
// the Axis conversation thread into a readable board. It is not a separate product,
// blank canvas, manual diagramming surface, hierarchy view, or dashboard.

import { useEffect, useState } from "react";

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

export default function WhiteboardView({ history }: Props) {
  const [data, setData] = useState<WBData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (history.length < 2) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);

    fetch("/api/axis/whiteboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history }),
    })
      .then((r) => r.json())
      .then((d: WBData & { error?: string }) => {
        if (cancelled) return;
        if (d.error) {
          if (d.error !== "not_enough") setError(d.error);
        } else {
          setData(d);
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not build whiteboard.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showEmpty = !loading && !error && !data;
  const sections = (data?.sections ?? []).filter((s) => s.items?.length > 0);
  const connections = (data?.connections ?? []).filter(
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

        {data && (
          <div className="wb-page">
            <h2 className="wb-title">{data.title}</h2>
            {data.summary && <p className="wb-summary">{data.summary}</p>}

            <div className="wb-sections">
              {sections.map((section) => (
                <div
                  key={section.label}
                  className={`wb-section${
                    section.label === "Main Idea" ? " wb-section--main" : ""
                  }${
                    section.label === "Next Move" ? " wb-section--next" : ""
                  }`}
                >
                  <span className="wb-section-label">{section.label}</span>
                  <ul className="wb-items">
                    {section.items.map((item, i) => (
                      <li key={i} className="wb-item">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {connections.length > 0 && (
              <div className="wb-connections">
                {connections.map((c, i) => (
                  <p key={i} className="wb-connection">
                    {c.from}
                    <span className="wb-arr"> → </span>
                    {c.label}
                    <span className="wb-arr"> → </span>
                    {c.to}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap');
      `}</style>

      <style jsx>{`
        .wb {
          background-image: radial-gradient(
            circle,
            rgba(25, 24, 21, 0.06) 1px,
            transparent 1px
          );
          background-size: 22px 22px;
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 0 clamp(20px, 5vw, 60px) 180px;
        }

        .wb-state {
          color: rgba(25, 24, 21, 0.35);
          display: flex;
          font-size: 14px;
          font-style: normal;
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

        .wb-page {
          margin: 0 auto;
          max-width: 680px;
          padding: 32px 0 0;
        }

        .wb-title {
          color: rgba(25, 24, 21, 0.9);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 30px;
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0 0 6px;
          text-align: center;
        }

        .wb-summary {
          color: rgba(25, 24, 21, 0.48);
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 14px;
          font-style: italic;
          line-height: 1.55;
          margin: 0 0 32px;
          text-align: center;
        }

        .wb-sections {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .wb-section {
          background: #ffffff;
          border: 1px solid rgba(25, 24, 21, 0.09);
          border-radius: 5px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
          padding: 14px 18px 16px;
        }

        .wb-section--main {
          border-color: rgba(25, 24, 21, 0.13);
          box-shadow: 0 1px 5px rgba(0, 0, 0, 0.06);
        }

        .wb-section--next {
          background: rgba(25, 24, 21, 0.025);
        }

        .wb-section-label {
          color: rgba(25, 24, 21, 0.32);
          display: block;
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 10px;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .wb-items {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .wb-item {
          color: rgba(25, 24, 21, 0.88);
          font-family: "Kalam", "Comic Sans MS", cursive;
          font-size: 16px;
          line-height: 1.55;
          padding: 2px 0;
        }

        .wb-item + .wb-item {
          border-top: 1px solid rgba(25, 24, 21, 0.05);
          margin-top: 3px;
          padding-top: 5px;
        }

        .wb-connections {
          border-top: 1px solid rgba(25, 24, 21, 0.08);
          margin-top: 22px;
          padding-top: 16px;
        }

        .wb-connection {
          color: rgba(25, 24, 21, 0.4);
          font-family: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
          font-size: 13px;
          letter-spacing: 0.01em;
          line-height: 1.5;
          margin: 0 0 7px;
        }

        .wb-arr {
          color: rgba(25, 24, 21, 0.22);
        }

        @media (min-width: 580px) {
          .wb-sections {
            display: grid;
            gap: 12px;
            grid-template-columns: 1fr 1fr;
          }

          .wb-section--main,
          .wb-section--next {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </>
  );
}
