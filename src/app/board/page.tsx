"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool =
  | "draw"
  | "player"
  | "defender"
  | "pass"
  | "cut"
  | "screen"
  | "dribble"
  | "zone"
  | "text";

// Coordinates stored as [0..1] fractions of canvas size — survives resize
type Pt = { x: number; y: number };

type BoardObj = {
  id: string;
  type: Tool;
  pts: Pt[];
  color: string;
  text?: string;
};

type AxisReadout = {
  concept: string;
  pattern: string;
  problem: string;
  solution: string;
  rep: string;
  teachingCue: string;
  tags: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TOOL_DEFS: Array<{ id: Tool; label: string }> = [
  { id: "draw", label: "Draw" },
  { id: "player", label: "Player" },
  { id: "defender", label: "Defender" },
  { id: "pass", label: "Pass" },
  { id: "cut", label: "Cut" },
  { id: "screen", label: "Screen" },
  { id: "dribble", label: "Dribble" },
  { id: "zone", label: "Zone" },
  { id: "text", label: "Text" },
];

const COLORS = ["#a8d933", "#4a9eff", "#ff6b4a", "#f4c95d", "#e47fff"];
const LS_KEY = "axis-board-v1";

let _oid = 0;
const nid = () => `o${++_oid}_${Date.now()}`;

// ─── Canvas drawing (pure functions, outside component) ───────────────────────

function px(n: number, w: number) { return n * w; }
function py(n: number, h: number) { return n * h; }

function drawCourt(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pad = Math.min(w * 0.04, h * 0.04, 18);
  const lc = "rgba(255,255,255,0.15)";
  const cw = w - pad * 2;
  const ch = h - pad * 2;
  const cx = w / 2;

  ctx.save();
  ctx.strokeStyle = lc;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Court border
  ctx.strokeRect(pad, pad, cw, ch);

  // Basket (at top, ~11% in from baseline)
  const bx = cx;
  const by = pad + ch * 0.11;

  // Backboard
  ctx.beginPath();
  ctx.moveTo(bx - cw * 0.1, pad + ch * 0.027);
  ctx.lineTo(bx + cw * 0.1, pad + ch * 0.027);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1.5;

  // Hoop (green)
  ctx.beginPath();
  ctx.arc(bx, by, cw * 0.035, 0, Math.PI * 2);
  ctx.strokeStyle = "#a8d933";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = lc;
  ctx.lineWidth = 1.5;

  // Restricted area
  ctx.beginPath();
  ctx.arc(bx, by, cw * 0.065, 0, Math.PI);
  ctx.stroke();

  // Lane rectangle
  const lw = cw * 0.32;
  const lh = ch * 0.43;
  const lx = cx - lw / 2;
  ctx.strokeRect(lx, pad, lw, lh);

  // Free throw circle (top half solid, bottom dashed)
  const ftR = lw * 0.46;
  ctx.beginPath();
  ctx.arc(cx, pad + lh, ftR, Math.PI, 0);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, pad + lh, ftR, 0, Math.PI);
  ctx.stroke();
  ctx.restore();

  // Three-point corner lines and arc
  const tpW = cw * 0.43;
  const tpR = cw * 0.475;
  const cornerY = by + Math.sqrt(Math.max(0, tpR * tpR - tpW * tpW));

  ctx.beginPath();
  ctx.moveTo(cx - tpW, pad);
  ctx.lineTo(cx - tpW, cornerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(cx + tpW, pad);
  ctx.lineTo(cx + tpW, cornerY);
  ctx.stroke();

  const arcStart = Math.PI - Math.acos(tpW / tpR);
  const arcEnd = Math.acos(tpW / tpR);
  ctx.beginPath();
  ctx.arc(bx, by, tpR, arcStart, arcEnd, true);
  ctx.stroke();

  // Half-court line
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

function drawArrow(ctx: CanvasRenderingContext2D, from: Pt, to: Pt, w: number, h: number) {
  const fx = px(from.x, w), fy = py(from.y, h);
  const tx = px(to.x, w), ty = py(to.y, h);
  const dx = tx - fx, dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 4) return;
  const angle = Math.atan2(dy, dx);
  const headLen = Math.min(18, len * 0.28);
  const ha = 0.42;

  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(tx, ty);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(tx - headLen * Math.cos(angle - ha), ty - headLen * Math.sin(angle - ha));
  ctx.lineTo(tx, ty);
  ctx.lineTo(tx - headLen * Math.cos(angle + ha), ty - headLen * Math.sin(angle + ha));
  ctx.stroke();
  ctx.restore();
}

function drawObj(ctx: CanvasRenderingContext2D, obj: BoardObj, w: number, h: number, preview = false) {
  if (obj.pts.length === 0) return;
  ctx.save();
  ctx.globalAlpha = preview ? 0.55 : 1;
  ctx.strokeStyle = obj.color;
  ctx.fillStyle = obj.color;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  switch (obj.type) {
    case "draw": {
      if (obj.pts.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(px(obj.pts[0].x, w), py(obj.pts[0].y, h));
      for (let i = 1; i < obj.pts.length; i++) {
        ctx.lineTo(px(obj.pts[i].x, w), py(obj.pts[i].y, h));
      }
      ctx.stroke();
      break;
    }
    case "player": {
      const p = obj.pts[0];
      const ppx = px(p.x, w), ppy = py(p.y, h);
      ctx.beginPath();
      ctx.arc(ppx, ppy, 15, 0, Math.PI * 2);
      ctx.fillStyle = obj.color + "28";
      ctx.fill();
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = obj.color;
      ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(obj.text ?? "1", ppx, ppy);
      break;
    }
    case "defender": {
      const p = obj.pts[0];
      const ppx = px(p.x, w), ppy = py(p.y, h);
      const s = 9;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ppx - s, ppy - s);
      ctx.lineTo(ppx + s, ppy + s);
      ctx.moveTo(ppx + s, ppy - s);
      ctx.lineTo(ppx - s, ppy + s);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ppx, ppy, 14, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "pass": {
      if (obj.pts.length < 2) break;
      drawArrow(ctx, obj.pts[0], obj.pts[1], w, h);
      break;
    }
    case "cut": {
      if (obj.pts.length < 2) break;
      ctx.setLineDash([9, 6]);
      drawArrow(ctx, obj.pts[0], obj.pts[1], w, h);
      ctx.setLineDash([]);
      break;
    }
    case "screen": {
      const p = obj.pts[0];
      const ppx = px(p.x, w), ppy = py(p.y, h);
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(ppx - 14, ppy);
      ctx.lineTo(ppx + 14, ppy);
      ctx.stroke();
      ctx.lineWidth = 2;
      break;
    }
    case "dribble": {
      if (obj.pts.length < 2) break;
      ctx.setLineDash([2, 8]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px(obj.pts[0].x, w), py(obj.pts[0].y, h));
      for (let i = 1; i < obj.pts.length; i++) {
        ctx.lineTo(px(obj.pts[i].x, w), py(obj.pts[i].y, h));
      }
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < obj.pts.length; i += 12) {
        ctx.beginPath();
        ctx.arc(px(obj.pts[i].x, w), py(obj.pts[i].y, h), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "zone": {
      if (obj.pts.length < 3) break;
      ctx.beginPath();
      ctx.moveTo(px(obj.pts[0].x, w), py(obj.pts[0].y, h));
      for (let i = 1; i < obj.pts.length; i++) {
        ctx.lineTo(px(obj.pts[i].x, w), py(obj.pts[i].y, h));
      }
      ctx.closePath();
      ctx.fillStyle = obj.color + "1e";
      ctx.fill();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case "text": {
      if (!obj.text) break;
      ctx.font = "bold 15px ui-sans-serif, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = obj.color;
      ctx.fillText(obj.text, px(obj.pts[0].x, w), py(obj.pts[0].y, h));
      break;
    }
  }
  ctx.restore();
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  objects: BoardObj[],
  pendingPts: Pt[],
  livePts: Pt[],
  tool: Tool,
  color: string,
) {
  ctx.clearRect(0, 0, w, h);
  drawCourt(ctx, w, h);

  for (const obj of objects) drawObj(ctx, obj, w, h);

  // Live freehand preview
  if (livePts.length > 1) {
    const preview: BoardObj = { id: "_live", type: tool === "dribble" ? "dribble" : "draw", pts: livePts, color };
    drawObj(ctx, preview, w, h, true);
  }

  // Pending point dot(s) for two-click tools
  if (pendingPts.length > 0) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.arc(px(pendingPts[0].x, w), py(pendingPts[0].y, h), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Zone outline preview
  if (tool === "zone" && pendingPts.length > 1) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(px(pendingPts[0].x, w), py(pendingPts[0].y, h));
    for (let i = 1; i < pendingPts.length; i++) {
      ctx.lineTo(px(pendingPts[i].x, w), py(pendingPts[i].y, h));
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BoardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>("player");
  const [objects, setObjects] = useState<BoardObj[]>([]);
  const [pendingPts, setPendingPts] = useState<Pt[]>([]);
  const [livePts, setLivePts] = useState<Pt[]>([]);
  const [colorIdx, setColorIdx] = useState(0);
  const [playerNum, setPlayerNum] = useState(1);
  const [note, setNote] = useState("");
  const [readout, setReadout] = useState<AxisReadout | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [textOverlay, setTextOverlay] = useState<{ screenX: number; screenY: number; normX: number; normY: number } | null>(null);
  const [textVal, setTextVal] = useState("");

  const color = COLORS[colorIdx % COLORS.length];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    renderFrame(ctx, canvas.width, canvas.height, objects, pendingPts, livePts, tool, color);
  }, [objects, pendingPts, livePts, tool, color]);

  // Size canvas to wrapper
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const setSize = () => {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
      redraw();
    };
    setSize();

    const ro = new ResizeObserver(setSize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { redraw(); }, [redraw]);

  // Load from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (Array.isArray(s.objects)) setObjects(s.objects);
      if (typeof s.note === "string") setNote(s.note);
      if (s.readout) setReadout(s.readout);
    } catch {}
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const shortcuts: Record<string, Tool> = {
      d: "draw", p: "player", x: "defender",
      a: "pass", c: "cut", s: "screen",
      b: "dribble", z: "zone", t: "text",
    };
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z") { setObjects((o) => o.slice(0, -1)); return; }
      if (e.key === "Escape") { setPendingPts([]); setLivePts([]); setTextOverlay(null); return; }
      const t = shortcuts[e.key.toLowerCase()];
      if (t) setTool(t);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pointer helpers
  function getNorm(e: React.PointerEvent<HTMLCanvasElement>): Pt {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNorm(e);

    if (tool === "draw" || tool === "dribble") {
      setLivePts([pt]);
      return;
    }
    if (tool === "player") {
      setObjects((o) => [...o, { id: nid(), type: "player", pts: [pt], color, text: String(playerNum) }]);
      setPlayerNum((n) => n + 1);
      return;
    }
    if (tool === "defender") {
      setObjects((o) => [...o, { id: nid(), type: "defender", pts: [pt], color }]);
      return;
    }
    if (tool === "screen") {
      setObjects((o) => [...o, { id: nid(), type: "screen", pts: [pt], color }]);
      return;
    }
    if (tool === "text") {
      const rect = e.currentTarget.getBoundingClientRect();
      setTextOverlay({ screenX: e.clientX - rect.left, screenY: e.clientY - rect.top, normX: pt.x, normY: pt.y });
      setTextVal("");
      return;
    }
    if (tool === "pass" || tool === "cut") {
      if (pendingPts.length === 0) {
        setPendingPts([pt]);
      } else {
        setObjects((o) => [...o, { id: nid(), type: tool, pts: [pendingPts[0], pt], color }]);
        setPendingPts([]);
      }
      return;
    }
    if (tool === "zone") {
      if (pendingPts.length >= 3) {
        const first = pendingPts[0];
        const d = Math.hypot(pt.x - first.x, pt.y - first.y);
        // Close zone if click near start point (within ~20px normalized)
        const canvas = canvasRef.current;
        const threshold = canvas ? 20 / canvas.width : 0.03;
        if (d < threshold) {
          setObjects((o) => [...o, { id: nid(), type: "zone", pts: pendingPts, color }]);
          setPendingPts([]);
          return;
        }
      }
      setPendingPts((p) => [...p, pt]);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if ((tool === "draw" || tool === "dribble") && livePts.length > 0) {
      setLivePts((p) => [...p, getNorm(e)]);
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    if ((tool === "draw" || tool === "dribble") && livePts.length > 1) {
      setObjects((o) => [...o, { id: nid(), type: tool, pts: livePts, color }]);
      setLivePts([]);
    } else {
      setLivePts([]);
    }
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (tool === "zone" && pendingPts.length >= 3) {
      setObjects((o) => [...o, { id: nid(), type: "zone", pts: pendingPts, color }]);
      setPendingPts([]);
    }
  }

  function commitText() {
    const v = textVal.trim();
    if (v && textOverlay) {
      setObjects((o) => [...o, { id: nid(), type: "text", pts: [{ x: textOverlay.normX, y: textOverlay.normY }], color, text: v }]);
    }
    setTextOverlay(null);
    setTextVal("");
  }

  function saveBoard() {
    localStorage.setItem(LS_KEY, JSON.stringify({ objects, note, readout, savedAt: Date.now() }));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function askAxis() {
    if (!note.trim()) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/axis/board/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note,
          objects: objects.map((o) => ({ type: o.type, ptCount: o.pts.length, text: o.text })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.readout) setReadout(data.readout);
    } catch {}
    setAnalyzing(false);
  }

  return (
    <div className="bd-root">
      {/* Toolbar */}
      <div className="bd-toolbar">
        <span className="bd-logo">Axis Board</span>

        <div className="bd-tools">
          {TOOL_DEFS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bd-tool ${tool === t.id ? "bd-tool--on" : ""}`}
              onClick={() => { setTool(t.id); setPendingPts([]); }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bd-toolbar-end">
          <div className="bd-palette">
            {COLORS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${i + 1}`}
                className={`bd-swatch ${i === colorIdx ? "bd-swatch--on" : ""}`}
                style={{ "--swatch-bg": c } as React.CSSProperties}
                onClick={() => setColorIdx(i)}
              />
            ))}
          </div>
          <button type="button" className="bd-act" onClick={() => setObjects((o) => o.slice(0, -1))}>Undo</button>
          <button type="button" className="bd-act" onClick={() => { setObjects([]); setPendingPts([]); setPlayerNum(1); }}>Clear</button>
          <button type="button" className={`bd-act bd-act--save ${saved ? "bd-act--saved" : ""}`} onClick={saveBoard}>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="bd-body">
        {/* Canvas area */}
        <div className="bd-canvas-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            className="bd-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDoubleClick={onDoubleClick}
          />

          {/* Zone close hint */}
          {tool === "zone" && pendingPts.length >= 3 && (
            <div className="bd-hint">Click near the first point to close, or double-click to finish</div>
          )}

          {/* Two-click tool hint */}
          {(tool === "pass" || tool === "cut") && pendingPts.length === 1 && (
            <div className="bd-hint">Click to set the end point</div>
          )}

          {/* Text overlay input */}
          {textOverlay && (
            <input
              type="text"
              className="bd-text-input"
              aria-label="Add text to board"
              placeholder="Type text..."
              style={{ "--tx": `${textOverlay.screenX}px`, "--ty": `${textOverlay.screenY}px` } as React.CSSProperties}
              value={textVal}
              autoFocus
              onChange={(e) => setTextVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitText(); }
                if (e.key === "Escape") { setTextOverlay(null); setTextVal(""); }
              }}
              onBlur={commitText}
            />
          )}
        </div>

        {/* Side panel */}
        <div className="bd-panel">
          <div className="bd-panel-inner">
            <label className="bd-panel-label">What are you trying to solve?</label>
            <textarea
              className="bd-note"
              value={note}
              rows={4}
              placeholder="Describe the play or the problem..."
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  void askAxis();
                }
              }}
            />
            <button
              type="button"
              className="bd-ask"
              disabled={analyzing || !note.trim()}
              onClick={() => void askAxis()}
            >
              {analyzing ? "Axis is thinking..." : "Ask Axis"}
            </button>

            {readout && (
              <div className="bd-readout">
                <ReadoutRow label="Concept" value={readout.concept} />
                <ReadoutRow label="Pattern" value={readout.pattern} />
                <ReadoutRow label="Problem" value={readout.problem} />
                <ReadoutRow label="Solution" value={readout.solution} />
                <ReadoutRow label="Rep" value={readout.rep} />
                <ReadoutRow label="Teaching Cue" value={readout.teachingCue} />
                {readout.tags.length > 0 && (
                  <div className="bd-tags">
                    {readout.tags.map((tag) => (
                      <span key={tag} className="bd-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .bd-root {
          background: var(--axis-bg, #111110);
          color: var(--axis-ink, #f4f4f0);
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, sans-serif;
          height: 100dvh;
          overflow: hidden;
        }

        /* ── Toolbar ─────────────────────────────────────────────── */
        .bd-toolbar {
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-shrink: 0;
          gap: 12px;
          min-height: 52px;
          overflow-x: auto;
          padding: 0 16px;
          scrollbar-width: none;
        }
        .bd-toolbar::-webkit-scrollbar { display: none; }

        .bd-logo {
          color: rgba(255,255,255,0.5);
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .bd-tools {
          display: flex;
          flex: 1;
          gap: 4px;
          justify-content: center;
        }

        .bd-tool {
          background: transparent;
          border: 1px solid transparent;
          border-radius: 6px;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          min-height: 32px;
          padding: 0 10px;
          text-transform: uppercase;
          transition: all 0.1s;
          white-space: nowrap;
        }
        .bd-tool:hover { color: rgba(255,255,255,0.8); }
        .bd-tool--on {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.15);
          color: #f4f4f0;
        }

        .bd-toolbar-end {
          align-items: center;
          display: flex;
          flex-shrink: 0;
          gap: 8px;
        }

        .bd-palette {
          display: flex;
          gap: 4px;
        }

        .bd-swatch {
          background: var(--swatch-bg);
          border: 2px solid transparent;
          border-radius: 50%;
          cursor: pointer;
          height: 18px;
          transition: all 0.1s;
          width: 18px;
        }
        .bd-swatch--on {
          border-color: rgba(255,255,255,0.7);
          transform: scale(1.15);
        }

        .bd-act {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 6px;
          color: rgba(255,255,255,0.55);
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
          min-height: 30px;
          padding: 0 10px;
          text-transform: uppercase;
          transition: all 0.1s;
          white-space: nowrap;
        }
        .bd-act:hover { color: rgba(255,255,255,0.85); }
        .bd-act--save { border-color: rgba(168,217,51,0.25); color: var(--axis-live, #a8d933); }
        .bd-act--saved { background: rgba(168,217,51,0.12); }

        /* ── Body ────────────────────────────────────────────────── */
        .bd-body {
          display: flex;
          flex: 1;
          min-height: 0;
        }

        /* ── Canvas ──────────────────────────────────────────────── */
        .bd-canvas-wrap {
          flex: 1;
          min-width: 0;
          position: relative;
        }

        .bd-canvas {
          display: block;
          height: 100%;
          touch-action: none;
          width: 100%;
        }

        .bd-hint {
          background: rgba(0,0,0,0.7);
          border-radius: 6px;
          bottom: 16px;
          color: rgba(255,255,255,0.5);
          font-size: 11px;
          left: 50%;
          padding: 5px 10px;
          pointer-events: none;
          position: absolute;
          transform: translateX(-50%);
          white-space: nowrap;
        }

        .bd-text-input {
          background: rgba(0,0,0,0.85);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 4px;
          color: #f4f4f0;
          font-family: inherit;
          font-size: 15px;
          font-weight: 700;
          left: var(--tx, 0px);
          min-width: 120px;
          outline: none;
          padding: 4px 8px;
          position: absolute;
          top: var(--ty, 0px);
          transform: translate(-4px, -50%);
        }

        /* ── Panel ───────────────────────────────────────────────── */
        .bd-panel {
          border-left: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          overflow-y: auto;
          width: 300px;
        }

        .bd-panel-inner {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px 16px;
        }

        .bd-panel-label {
          color: rgba(255,255,255,0.4);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .bd-note {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px;
          color: #f4f4f0;
          font-family: inherit;
          font-size: 14px;
          line-height: 1.5;
          outline: none;
          padding: 10px 12px;
          resize: none;
          transition: border-color 0.15s;
          width: 100%;
        }
        .bd-note:focus { border-color: rgba(255,255,255,0.25); }
        .bd-note::placeholder { color: rgba(255,255,255,0.25); }

        .bd-ask {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 8px;
          color: #f4f4f0;
          cursor: pointer;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.03em;
          min-height: 42px;
          transition: all 0.12s;
          width: 100%;
        }
        .bd-ask:hover:not(:disabled) { background: rgba(255,255,255,0.12); }
        .bd-ask:disabled { cursor: default; opacity: 0.4; }

        /* ── Readout ─────────────────────────────────────────────── */
        .bd-readout {
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-top: 16px;
        }

        .bd-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }

        .bd-tag {
          background: rgba(255,255,255,0.07);
          border-radius: 4px;
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 3px 7px;
          text-transform: uppercase;
        }

        /* ── Mobile/iPad bottom panel ────────────────────────────── */
        @media (max-width: 768px) {
          .bd-body { flex-direction: column; }
          .bd-panel {
            border-left: none;
            border-top: 1px solid rgba(255,255,255,0.08);
            max-height: 45vh;
            overflow-y: auto;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ReadoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rr-root">
      <span className="rr-label">{label}</span>
      <span className="rr-value">{value}</span>
      <style jsx>{`
        .rr-root { display: flex; flex-direction: column; gap: 2px; }
        .rr-label { color: rgba(255,255,255,0.35); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
        .rr-value { color: #f4f4f0; font-size: 13px; line-height: 1.45; }
      `}</style>
    </div>
  );
}
