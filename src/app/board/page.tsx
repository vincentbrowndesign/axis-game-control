"use client";

import { useEffect, useRef, useState } from "react";

type DrawMode = "draw" | "O" | "X";

type CoachingSection = {
  label: string;
  text: string;
};

// ─── Canvas utilities ─────────────────────────────────────────────────────────

function drawCourt(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pad = Math.min(w * 0.05, h * 0.04, 22);
  const line = "rgba(255,255,255,0.15)";
  const cw = w - pad * 2;
  const ch = h - pad * 2;
  const cx = w / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeRect(pad, pad, cw, ch);

  const bx = cx;
  const by = pad + ch * 0.11;

  // Backboard
  ctx.beginPath();
  ctx.moveTo(bx - cw * 0.1, pad + ch * 0.027);
  ctx.lineTo(bx + cw * 0.1, pad + ch * 0.027);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1.5;

  // Hoop
  ctx.beginPath();
  ctx.arc(bx, by, cw * 0.035, 0, Math.PI * 2);
  ctx.strokeStyle = "#a8d933";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;

  // Restricted area
  ctx.beginPath();
  ctx.arc(bx, by, cw * 0.065, 0, Math.PI);
  ctx.stroke();

  // Lane
  const lw = cw * 0.32;
  const lh = ch * 0.43;
  ctx.strokeRect(cx - lw / 2, pad, lw, lh);

  // FT circle
  const ftR = lw * 0.46;
  ctx.beginPath();
  ctx.arc(cx, pad + lh, ftR, Math.PI, 0);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, pad + lh, ftR, 0, Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Three-point
  const tpW = cw * 0.43;
  const tpR = cw * 0.475;
  const cY = by + Math.sqrt(Math.max(0, tpR * tpR - tpW * tpW));
  ctx.beginPath();
  ctx.moveTo(cx - tpW, pad);
  ctx.lineTo(cx - tpW, cY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + tpW, pad);
  ctx.lineTo(cx + tpW, cY);
  ctx.stroke();
  const a1 = Math.PI - Math.acos(tpW / tpR);
  const a2 = Math.acos(tpW / tpR);
  ctx.beginPath();
  ctx.arc(bx, by, tpR, a1, a2, true);
  ctx.stroke();

  // Half-court
  ctx.beginPath();
  ctx.moveTo(pad, pad + ch / 2);
  ctx.lineTo(pad + cw, pad + ch / 2);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(cx, pad + ch / 2, lw * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function stampO(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.strokeStyle = "#4a9eff";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function stampX(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const s = 11;
  ctx.save();
  ctx.strokeStyle = "#ff6b4a";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
  ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const isDrawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  const [mode, setMode] = useState<DrawMode>("draw");
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<CoachingSection[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const init = () => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctxRef.current = ctx;
      drawCourt(ctx, canvas.width, canvas.height);
    };

    init();
    const ro = new ResizeObserver(init);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  function getXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { x, y } = getXY(e);
    if (mode === "O") { stampO(ctx, x, y); return; }
    if (mode === "X") { stampX(ctx, x, y); return; }
    isDrawing.current = true;
    lastPt.current = { x, y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if (!isDrawing.current || mode !== "draw") return;
    const ctx = ctxRef.current;
    if (!ctx || !lastPt.current) return;
    const { x, y } = getXY(e);
    ctx.save();
    ctx.strokeStyle = "rgba(244,244,240,0.92)";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();
    lastPt.current = { x, y };
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDrawing.current = false;
    lastPt.current = null;
  }

  function clearBoard() {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    drawCourt(ctx, canvas.width, canvas.height);
    setSections(null);
  }

  async function askAxis() {
    if (!query.trim() || analyzing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setAnalyzing(true);
    setSections(null);
    const imageData = canvas.toDataURL("image/jpeg", 0.85);
    try {
      const res = await fetch("/api/axis/board/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: query.trim(), imageData }),
      });
      const data = await res.json().catch(() => null) as { sections?: CoachingSection[] } | null;
      if (data?.sections) setSections(data.sections);
    } catch {}
    setAnalyzing(false);
  }

  return (
    <main className="root">
      <header className="header">
        <h1 className="title">Draw it. Ask Axis.</h1>
        <p className="sub">Use the court like a whiteboard. Axis helps you reason through the play.</p>
      </header>

      <div className={`canvas-wrap canvas-wrap--${mode}`} ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="bottom">
        <div className="tools-row">
          <button
            type="button"
            className={`tool ${mode === "draw" ? "tool--on" : ""}`}
            onClick={() => setMode("draw")}
            aria-label="Freehand draw"
          >
            Draw
          </button>
          <button
            type="button"
            className={`tool tool--o ${mode === "O" ? "tool--on" : ""}`}
            onClick={() => setMode("O")}
            aria-label="Place offensive player"
          >
            O
          </button>
          <button
            type="button"
            className={`tool tool--x ${mode === "X" ? "tool--on" : ""}`}
            onClick={() => setMode("X")}
            aria-label="Place defender"
          >
            X
          </button>
          <div className="spacer" />
          <button type="button" className="clear" onClick={clearBoard}>Clear</button>
        </div>

        <div className="query-row">
          <textarea
            className="query"
            rows={2}
            value={query}
            placeholder="What are you trying to solve?"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void askAxis();
              }
            }}
          />
          <button
            type="button"
            className="ask"
            disabled={analyzing || !query.trim()}
            onClick={() => void askAxis()}
          >
            {analyzing ? "Thinking..." : "Ask Axis"}
          </button>
        </div>

        {sections && (
          <div className="coaching">
            {sections.map((s) => (
              <div key={s.label} className="section">
                <span className="section-label">{s.label}</span>
                <span className="section-text">{s.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .root {
          background: #111110;
          color: #f4f4f0;
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, sans-serif;
          height: 100dvh;
          overflow: hidden;
        }

        .header {
          flex-shrink: 0;
          padding: 14px 20px 8px;
        }

        .title {
          font-size: 15px;
          font-weight: 700;
          letter-spacing: -0.01em;
          margin: 0 0 2px;
        }

        .sub {
          color: rgba(255,255,255,0.35);
          font-size: 11px;
          margin: 0;
        }

        .canvas-wrap {
          flex: 1;
          min-height: 0;
          position: relative;
        }

        .canvas-wrap--draw .canvas { cursor: crosshair; }
        .canvas-wrap--O .canvas,
        .canvas-wrap--X .canvas { cursor: cell; }

        .canvas {
          display: block;
          height: 100%;
          touch-action: none;
          width: 100%;
        }

        .bottom {
          border-top: 1px solid rgba(255,255,255,0.08);
          flex-shrink: 0;
          max-height: 48vh;
          overflow-y: auto;
        }

        .tools-row {
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          gap: 6px;
          padding: 10px 16px;
        }

        .tool {
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          color: rgba(255,255,255,0.45);
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          min-height: 36px;
          padding: 0 16px;
          text-transform: uppercase;
          transition: all 0.1s;
        }

        .tool:hover { color: rgba(255,255,255,0.8); }

        .tool--on {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.22);
          color: #f4f4f0;
        }

        .tool--o { color: rgba(74,158,255,0.7); border-color: rgba(74,158,255,0.2); }
        .tool--o.tool--on { background: rgba(74,158,255,0.1); border-color: #4a9eff; color: #4a9eff; }

        .tool--x { color: rgba(255,107,74,0.7); border-color: rgba(255,107,74,0.2); }
        .tool--x.tool--on { background: rgba(255,107,74,0.1); border-color: #ff6b4a; color: #ff6b4a; }

        .spacer { flex: 1; }

        .clear {
          background: transparent;
          border: 1.5px solid rgba(255,255,255,0.09);
          border-radius: 6px;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          min-height: 36px;
          padding: 0 16px;
          text-transform: uppercase;
          transition: all 0.1s;
        }

        .clear:hover { color: rgba(255,255,255,0.65); }

        .query-row {
          display: flex;
          gap: 10px;
          padding: 12px 16px;
        }

        .query {
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #f4f4f0;
          flex: 1;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          outline: none;
          padding: 8px 12px;
          resize: none;
          transition: border-color 0.15s;
        }

        .query:focus { border-color: rgba(255,255,255,0.22); }
        .query::placeholder { color: rgba(255,255,255,0.22); }

        .ask {
          align-self: flex-end;
          background: rgba(255,255,255,0.07);
          border: 1.5px solid rgba(255,255,255,0.13);
          border-radius: 8px;
          color: #f4f4f0;
          cursor: pointer;
          flex-shrink: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          min-height: 42px;
          padding: 0 20px;
          transition: all 0.12s;
          white-space: nowrap;
        }

        .ask:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
        .ask:disabled { cursor: default; opacity: 0.4; }

        .coaching {
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 16px 16px 24px;
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .section-label {
          color: rgba(255,255,255,0.32);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .section-text {
          color: #f4f4f0;
          font-size: 14px;
          line-height: 1.55;
        }
      `}</style>
    </main>
  );
}
