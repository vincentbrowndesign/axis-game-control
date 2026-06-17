"use client";

import { useEffect, useState } from "react";

interface WBNode {
  id: string;
  number: number;
  type: "question" | "answer" | "understanding" | "next_move" | "observation" | "evidence";
  content: string;
}

interface WBEdge {
  from: string;
  to: string;
}

interface WBData {
  title: string;
  nodes: WBNode[];
  edges: WBEdge[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ConvMsg {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  history: ConvMsg[];
}

const CARD_W = 234;
const COL_L = 56;
const COL_R = 350;
const START_Y = 16;
const ROW_GAP = 44;
const CHARS_PER_LINE = 25;
const LINE_H = 26;
const CARD_PADDING = 58; // pin area + bottom

function cardH(content: string): number {
  const lines = Math.ceil(content.length / CHARS_PER_LINE);
  return Math.max(84, Math.min(196, lines * LINE_H + CARD_PADDING));
}

function layout(nodes: WBNode[]): Map<string, Rect> {
  const map = new Map<string, Rect>();
  let rowY = START_Y;

  for (let i = 0; i < nodes.length; i += 2) {
    const l = nodes[i];
    const r = nodes[i + 1];
    const lH = cardH(l.content);
    const rH = r ? cardH(r.content) : 0;
    const rowH = Math.max(lH, rH);

    map.set(l.id, {
      x: COL_L,
      y: rowY + Math.round((rowH - lH) / 2),
      w: r ? CARD_W : CARD_W + 120,
      h: lH,
    });

    if (r) {
      map.set(r.id, {
        x: COL_R,
        y: rowY + Math.round((rowH - rH) / 2),
        w: CARD_W,
        h: rH,
      });
    }

    rowY += rowH + ROW_GAP;
  }

  return map;
}

function bounds(rects: Map<string, Rect>): { w: number; h: number } {
  let mx = 0, my = 0;
  rects.forEach(({ x, y, w, h }) => {
    mx = Math.max(mx, x + w);
    my = Math.max(my, y + h);
  });
  return { w: mx + 72, h: my + 56 };
}

function arrow(f: Rect, t: Rect): string {
  const fCy = f.y + f.h / 2;
  const tCy = t.y + t.h / 2;
  const fCx = f.x + f.w / 2;
  const tCx = t.x + t.w / 2;
  const sameRow = Math.abs(fCy - tCy) < 56;

  if (sameRow || tCx > fCx - 24) {
    // Horizontal: right edge → left edge
    const x1 = f.x + f.w, y1 = fCy;
    const x2 = t.x, y2 = tCy;
    const mid = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
  }

  // Down-left sweep: right col → left col, next row
  const x1 = f.x + f.w * 0.65, y1 = f.y + f.h;
  const x2 = t.x + t.w * 0.28, y2 = t.y;
  return `M ${x1} ${y1} C ${x1} ${y1 + (y2 - y1) * 0.52}, ${x2} ${y2 - 28}, ${x2} ${y2}`;
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
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => {
        if (!cancelled) setError("Could not generate map.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rects = data ? layout(data.nodes) : new Map<string, Rect>();
  const cvs = data ? bounds(rects) : { w: 0, h: 0 };
  const paths = data
    ? data.edges
        .map((e) => {
          const f = rects.get(e.from);
          const t = rects.get(e.to);
          return f && t ? { d: arrow(f, t), k: `${e.from}-${e.to}` } : null;
        })
        .filter(Boolean as unknown as <T>(x: T | null) => x is T)
    : [];

  return (
    <>
      <div className="wb">
        {loading && (
          <div className="wb-center">
            <span className="wb-dot" />
            <span className="wb-dot" />
            <span className="wb-dot" />
          </div>
        )}

        {!loading && error && <p className="wb-center wb-err">{error}</p>}

        {!loading && !error && !data && history.length < 2 && (
          <p className="wb-center wb-empty">Start a conversation to build the map.</p>
        )}

        {data && (
          <div className="wb-scroll">
            <h2 className="wb-title">{data.title}</h2>
            <div
              className="wb-canvas"
              style={{ width: cvs.w, height: cvs.h }}
            >
              <svg
                className="wb-svg"
                width={cvs.w}
                height={cvs.h}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="wb-ah"
                    markerWidth="7"
                    markerHeight="5"
                    refX="6.5"
                    refY="2.5"
                    orient="auto"
                  >
                    <path d="M0,0 L7,2.5 L0,5 Z" fill="rgba(25,24,21,0.42)" />
                  </marker>
                </defs>
                {paths.map(
                  (p) =>
                    p && (
                      <path
                        key={p.k}
                        d={p.d}
                        fill="none"
                        stroke="rgba(25,24,21,0.38)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        markerEnd="url(#wb-ah)"
                      />
                    ),
                )}
              </svg>

              {data.nodes.map((node) => {
                const r = rects.get(node.id);
                if (!r) return null;
                return (
                  <div
                    key={node.id}
                    className={`wb-card wb-card--${node.type}`}
                    style={{ left: r.x, top: r.y, width: r.w }}
                  >
                    <span className="wb-pin" aria-hidden="true" />
                    <span className="wb-num" aria-label={`Card ${node.number}`}>
                      {node.number}
                    </span>
                    <p className="wb-text">{node.content}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Kalam:wght@300;400&display=swap');
      `}</style>

      <style jsx>{`
        .wb {
          display: flex;
          flex: 1;
          flex-direction: column;
          overflow: hidden;
        }

        .wb-center {
          align-items: center;
          color: rgba(25, 24, 21, 0.32);
          display: flex;
          flex: 1;
          font-size: 14px;
          gap: 5px;
          justify-content: center;
          letter-spacing: 0.01em;
        }

        .wb-err { color: rgba(110, 38, 28, 0.62); }
        .wb-empty { }

        .wb-dot {
          animation: wbpulse 1.1s ease-in-out infinite;
          background: rgba(25, 24, 21, 0.28);
          border-radius: 999px;
          display: block;
          height: 4px;
          width: 4px;
        }

        .wb-dot:nth-child(2) { animation-delay: 0.18s; }
        .wb-dot:nth-child(3) { animation-delay: 0.36s; }

        @keyframes wbpulse {
          0%, 80%, 100% { opacity: 0.18; }
          40% { opacity: 1; }
        }

        .wb-scroll {
          background-image: radial-gradient(
            circle,
            rgba(25, 24, 21, 0.08) 1px,
            transparent 1px
          );
          background-size: 22px 22px;
          flex: 1;
          overflow: auto;
          padding: 24px clamp(16px, 5vw, 60px) 80px;
        }

        .wb-title {
          color: rgba(25, 24, 21, 0.9);
          font-family: 'Kalam', 'Comic Sans MS', cursive;
          font-size: 36px;
          font-weight: 400;
          letter-spacing: -0.01em;
          margin: 0 0 28px;
          text-align: center;
        }

        .wb-canvas {
          margin: 0 auto;
          position: relative;
        }

        .wb-svg {
          left: 0;
          pointer-events: none;
          position: absolute;
          top: 0;
        }

        .wb-card {
          background: #fefefe;
          border: 1px solid rgba(25, 24, 21, 0.1);
          border-radius: 6px;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.04),
            0 3px 10px rgba(0, 0, 0, 0.06);
          min-height: 80px;
          padding: 30px 14px 14px;
          position: absolute;
        }

        .wb-pin {
          background: rgba(25, 24, 21, 0.72);
          border-radius: 50%;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.22);
          display: block;
          height: 9px;
          left: 50%;
          position: absolute;
          top: -4px;
          transform: translateX(-50%);
          width: 9px;
        }

        .wb-num {
          align-items: center;
          border: 1px solid rgba(25, 24, 21, 0.45);
          border-radius: 50%;
          color: rgba(25, 24, 21, 0.6);
          display: inline-flex;
          font-family: "Iowan Old Style", Georgia, serif;
          font-size: 10px;
          height: 18px;
          justify-content: center;
          left: 10px;
          line-height: 1;
          position: absolute;
          top: 8px;
          width: 18px;
        }

        .wb-text {
          color: rgba(25, 24, 21, 0.88);
          font-family: 'Kalam', 'Comic Sans MS', cursive;
          font-size: 15px;
          line-height: 1.56;
          margin: 0;
        }

        /* understanding cards get a subtle left rule */
        .wb-card--understanding .wb-text,
        .wb-card--next_move .wb-text {
          border-left: 2px solid rgba(25, 24, 21, 0.12);
          padding-left: 10px;
        }
      `}</style>
    </>
  );
}
