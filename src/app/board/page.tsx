"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

type BoardMark =
  | { id: string; type: "O"; label: string; x: number; y: number }
  | { id: string; type: "X"; label: string; x: number; y: number }
  | { id: string; type: "pass"; from: Point; to: Point; label?: string }
  | { id: string; type: "cut"; from: Point; to: Point; label?: string }
  | { id: string; type: "draw"; points: Point[] };

type Tool = "move" | "draw" | "erase" | "O" | "X" | "pass" | "cut";

type CoachingSection = {
  label: string;
  text: string;
};

type AxisBoardResponse = {
  intent?: "reason" | "populate" | "adjust";
  boardMarks?: BoardMark[];
  sections?: CoachingSection[];
};

const TOOL_LABELS: Array<{ id: Tool; label: string }> = [
  { id: "move", label: "Move" },
  { id: "draw", label: "Draw" },
  { id: "erase", label: "Erase" },
  { id: "O", label: "O" },
  { id: "X", label: "X" },
  { id: "pass", label: "Pass" },
  { id: "cut", label: "Cut" },
];

function nid() {
  return Math.random().toString(36).slice(2, 10);
}

function nextPlayerLabel(type: "O" | "X", marks: BoardMark[]) {
  const next = marks.filter((mark) => mark.type === type).length + 1;
  return type === "O" ? String(next) : `X${next}`;
}

function drawCourt(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pad = Math.min(w * 0.05, h * 0.04, 22);
  const line = "#c9ced6";
  const cw = w - pad * 2;
  const ch = h - pad * 2;
  const cx = w / 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#f2f4f7";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeRect(pad, pad, cw, ch);

  const bx = cx;
  const by = pad + ch * 0.11;

  ctx.beginPath();
  ctx.moveTo(bx - cw * 0.1, pad + ch * 0.027);
  ctx.lineTo(bx + cw * 0.1, pad + ch * 0.027);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(bx, by, cw * 0.035, 0, Math.PI * 2);
  ctx.strokeStyle = "#4a5568";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = line;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(bx, by, cw * 0.065, 0, Math.PI);
  ctx.stroke();

  const laneW = cw * 0.32;
  const laneH = ch * 0.43;
  ctx.strokeRect(cx - laneW / 2, pad, laneW, laneH);

  const ftR = laneW * 0.46;
  ctx.beginPath();
  ctx.arc(cx, pad + laneH, ftR, Math.PI, 0);
  ctx.stroke();
  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, pad + laneH, ftR, 0, Math.PI);
  ctx.stroke();
  ctx.restore();

  const wingX = cw * 0.43;
  const arcR = cw * 0.475;
  const cornerY = by + Math.sqrt(Math.max(0, arcR * arcR - wingX * wingX));
  ctx.beginPath();
  ctx.moveTo(cx - wingX, pad);
  ctx.lineTo(cx - wingX, cornerY);
  ctx.moveTo(cx + wingX, pad);
  ctx.lineTo(cx + wingX, cornerY);
  ctx.stroke();

  const a1 = Math.PI - Math.acos(wingX / arcR);
  const a2 = Math.acos(wingX / arcR);
  ctx.beginPath();
  ctx.arc(bx, by, arcR, a1, a2, true);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(pad, pad + ch / 2);
  ctx.lineTo(pad + cw, pad + ch / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, pad + ch / 2, laneW * 0.38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer(ctx: CanvasRenderingContext2D, mark: Extract<BoardMark, { type: "O" | "X" }>, w: number, h: number) {
  const x = mark.x * w;
  const y = mark.y * h;

  ctx.save();
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (mark.type === "O") {
    ctx.strokeStyle = "#4a9eff";
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#1557b8";
  } else {
    const s = 11;
    ctx.strokeStyle = "#d7372f";
    ctx.beginPath();
    ctx.moveTo(x - s, y - s);
    ctx.lineTo(x + s, y + s);
    ctx.moveTo(x + s, y - s);
    ctx.lineTo(x - s, y + s);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#b42318";
  }

  ctx.font = "700 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(mark.label, x, y + (mark.type === "O" ? 0 : 1));

  ctx.restore();
}

function drawArrow(ctx: CanvasRenderingContext2D, from: Point, to: Point, w: number, h: number, dashed: boolean) {
  const sx = from.x * w;
  const sy = from.y * h;
  const ex = to.x * w;
  const ey = to.y * h;
  const angle = Math.atan2(ey - sy, ex - sx);
  const head = 13;

  ctx.save();
  ctx.strokeStyle = dashed ? "#555f6f" : "#1f2937";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (dashed) ctx.setLineDash([8, 7]);

  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(ex - head * Math.cos(angle - Math.PI / 6), ey - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(ex - head * Math.cos(angle + Math.PI / 6), ey - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawArrowMark(ctx: CanvasRenderingContext2D, mark: Extract<BoardMark, { type: "pass" | "cut" }>, w: number, h: number) {
  drawArrow(ctx, mark.from, mark.to, w, h, mark.type === "cut");
  if (!mark.label) return;

  const x = ((mark.from.x + mark.to.x) / 2) * w;
  const y = ((mark.from.y + mark.to.y) / 2) * h;
  ctx.save();
  ctx.fillStyle = mark.type === "cut" ? "#555f6f" : "#1f2937";
  ctx.font = "700 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText(mark.label, x, y - 5);
  ctx.restore();
}

function drawFreehand(ctx: CanvasRenderingContext2D, points: Point[], w: number, h: number) {
  if (points.length < 2) return;

  ctx.save();
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x * w, points[0].y * h);
  for (const point of points.slice(1)) ctx.lineTo(point.x * w, point.y * h);
  ctx.stroke();
  ctx.restore();
}

function sameMarks(a: BoardMark[], b: BoardMark[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function distancePointToSegment(point: Point, from: Point, to: Point, w: number, h: number) {
  const px = point.x * w;
  const py = point.y * h;
  const ax = from.x * w;
  const ay = from.y * h;
  const bx = to.x * w;
  const by = to.y * h;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function markContainsPoint(mark: BoardMark, point: Point, w: number, h: number) {
  if (mark.type === "O" || mark.type === "X") {
    return Math.hypot(mark.x * w - point.x * w, mark.y * h - point.y * h) <= 24;
  }

  if (mark.type === "pass" || mark.type === "cut") {
    return distancePointToSegment(point, mark.from, mark.to, w, h) <= 18;
  }

  for (let i = 1; i < mark.points.length; i += 1) {
    if (distancePointToSegment(point, mark.points[i - 1], mark.points[i], w, h) <= 18) return true;
  }

  return false;
}

function renderBoard(ctx: CanvasRenderingContext2D, w: number, h: number, marks: BoardMark[], draft: BoardMark | null) {
  drawCourt(ctx, w, h);
  for (const mark of [...marks, ...(draft ? [draft] : [])]) {
    if (mark.type === "O" || mark.type === "X") drawPlayer(ctx, mark, w, h);
    if (mark.type === "pass" || mark.type === "cut") drawArrowMark(ctx, mark, w, h);
    if (mark.type === "draw") drawFreehand(ctx, mark.points, w, h);
  }
}

function describeMarks(marks: BoardMark[]) {
  const counts = marks.reduce<Record<string, number>>((acc, mark) => {
    acc[mark.type] = (acc[mark.type] ?? 0) + 1;
    return acc;
  }, {});
  return `${counts.O ?? 0} offense, ${counts.X ?? 0} defenders, ${counts.pass ?? 0} passes, ${counts.cut ?? 0} cuts, ${counts.draw ?? 0} drawn lines`;
}

export default function BoardPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const marksRef = useRef<BoardMark[]>([]);
  const draftRef = useRef<BoardMark | null>(null);
  const historyRef = useRef<BoardMark[][]>([]);
  const dragRef = useRef<
    | { kind: "draw"; points: Point[] }
    | { kind: "move"; id: string; before: BoardMark[] }
    | { kind: "erase"; before: BoardMark[] }
    | { kind: "arrow"; type: "pass" | "cut"; from: Point; to: Point }
    | null
  >(null);

  const [tool, setTool] = useState<Tool>("move");
  const [boardMarks, setBoardMarks] = useState<BoardMark[]>([]);
  const [query, setQuery] = useState("");
  const [sections, setSections] = useState<CoachingSection[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [historyDepth, setHistoryDepth] = useState(0);

  useEffect(() => {
    marksRef.current = boardMarks;
    redraw();
  }, [boardMarks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderBoard(ctx, width, height, marksRef.current, draftRef.current);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  function redraw(draft: BoardMark | null = draftRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    if (!ctx || rect.width <= 0 || rect.height <= 0) return;
    renderBoard(ctx, rect.width, rect.height, marksRef.current, draft);
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }

  function hitPlayer(point: Point) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const hitRadius = 24;

    for (const mark of [...marksRef.current].reverse()) {
      if (mark.type !== "O" && mark.type !== "X") continue;
      const dx = mark.x * rect.width - point.x * rect.width;
      const dy = mark.y * rect.height - point.y * rect.height;
      if (Math.hypot(dx, dy) <= hitRadius) return mark;
    }

    return null;
  }

  function hitMark(point: Point) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    for (const mark of [...marksRef.current].reverse()) {
      if (markContainsPoint(mark, point, rect.width, rect.height)) return mark;
    }
    return null;
  }

  function setMarks(next: BoardMark[]) {
    marksRef.current = next;
    setBoardMarks(next);
  }

  function commitMarks(next: BoardMark[], before = marksRef.current) {
    if (sameMarks(before, next)) return;
    historyRef.current = [...historyRef.current, before].slice(-80);
    setHistoryDepth(historyRef.current.length);
    setMarks(next);
  }

  function undoBoardAction() {
    const previous = historyRef.current.at(-1);
    if (!previous) return;
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryDepth(historyRef.current.length);
    dragRef.current = null;
    draftRef.current = null;
    setMarks(previous);
  }

  function eraseAt(point: Point) {
    const hit = hitMark(point);
    if (!hit) return false;
    setMarks(marksRef.current.filter((mark) => mark.id !== hit.id));
    return true;
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getPoint(e);

    if (tool === "O" || tool === "X") {
      commitMarks([...marksRef.current, {
        id: nid(),
        type: tool,
        label: nextPlayerLabel(tool, marksRef.current),
        x: point.x,
        y: point.y,
      }]);
      return;
    }

    if (tool === "move") {
      const hit = hitPlayer(point);
      if (hit) dragRef.current = { kind: "move", id: hit.id, before: marksRef.current };
      return;
    }

    if (tool === "erase") {
      dragRef.current = { kind: "erase", before: marksRef.current };
      eraseAt(point);
      return;
    }

    if (tool === "draw") {
      dragRef.current = { kind: "draw", points: [point] };
      draftRef.current = { id: "draft", type: "draw", points: [point] };
      redraw();
      return;
    }

    dragRef.current = { kind: "arrow", type: tool, from: point, to: point };
    draftRef.current = { id: "draft", type: tool, from: point, to: point };
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const active = dragRef.current;
    if (!active) return;
    const point = getPoint(e);

    if (active.kind === "move") {
      setMarks(marksRef.current.map((mark) => {
        if (mark.id !== active.id || (mark.type !== "O" && mark.type !== "X")) return mark;
        return { ...mark, x: point.x, y: point.y };
      }));
      return;
    }

    if (active.kind === "erase") {
      eraseAt(point);
      return;
    }

    if (active.kind === "draw") {
      active.points = [...active.points, point];
      draftRef.current = { id: "draft", type: "draw", points: active.points };
      redraw();
      return;
    }

    active.to = point;
    draftRef.current = { id: "draft", type: active.type, from: active.from, to: active.to };
    redraw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const active = dragRef.current;
    dragRef.current = null;

    if (active?.kind === "draw" && active.points.length > 1) {
      commitMarks([...marksRef.current, { id: nid(), type: "draw", points: active.points }]);
    }

    if (active?.kind === "move") {
      commitMarks(marksRef.current, active.before);
    }

    if (active?.kind === "erase") {
      commitMarks(marksRef.current, active.before);
    }

    if (active?.kind === "arrow") {
      const distance = Math.hypot(active.to.x - active.from.x, active.to.y - active.from.y);
      if (distance > 0.015) {
        commitMarks([...marksRef.current, { id: nid(), type: active.type, from: active.from, to: active.to }]);
      }
    }

    draftRef.current = null;
    redraw(null);
  }

  function clearBoard() {
    dragRef.current = null;
    draftRef.current = null;
    commitMarks([]);
  }

  async function askAxis() {
    if (!query.trim() || analyzing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    setAnalyzing(true);
    redraw(null);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const imageData = canvas.toDataURL("image/jpeg", 0.88);

    try {
      const res = await fetch("/api/axis/board/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          note: query.trim(),
          imageData,
          boardMarks,
        }),
      });
      const data = await res.json().catch(() => null) as AxisBoardResponse | null;
      if (data?.boardMarks && (data.intent === "populate" || data.intent === "adjust")) {
        commitMarks(data.boardMarks);
      }
      if (data?.sections) setSections(data.sections);
    } catch {
      // Keep the existing board and answer visible if the request fails.
    } finally {
      setAnalyzing(false);
    }
  }

  const blockBoardInteraction = (e: React.SyntheticEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const boardBlockHandlers = {
    onContextMenu: blockBoardInteraction,
    onSelectStart: blockBoardInteraction,
    onCopy: blockBoardInteraction,
    onCut: blockBoardInteraction,
    onPaste: blockBoardInteraction,
  } as React.HTMLAttributes<HTMLDivElement> & {
    onSelectStart: (e: React.SyntheticEvent<HTMLDivElement>) => void;
  };

  return (
    <main className="root">
      <header className="header">
        <h1 className="title">Draw the play. Find the solution.</h1>
        <p className="sub">{describeMarks(boardMarks)}</p>
      </header>

      <div
        className={`canvas-wrap canvas-wrap--${tool}`}
        ref={wrapRef}
        {...boardBlockHandlers}
      >
        <canvas
          ref={canvasRef}
          className="canvas"
          draggable={false}
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
            className="tool tool--undo"
            disabled={historyDepth === 0}
            onClick={undoBoardAction}
          >
            Undo
          </button>
          {TOOL_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`tool tool--${item.id} ${tool === item.id ? "tool--on" : ""}`}
              onClick={() => setTool(item.id)}
            >
              {item.label}
            </button>
          ))}
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
            {sections.map((section) => (
              <div key={section.label} className="section">
                <span className="section-label">{section.label}</span>
                <span className="section-text">{section.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .root {
          background: #ffffff;
          color: #111827;
          display: flex;
          flex-direction: column;
          font-family: ui-sans-serif, system-ui, sans-serif;
          height: 100dvh;
          overflow: hidden;
        }

        .header {
          flex-shrink: 0;
          padding: 16px 22px 10px;
        }

        .title {
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0;
          margin: 0 0 4px;
        }

        .sub {
          color: #667085;
          font-size: 13px;
          margin: 0;
        }

        .canvas-wrap {
          background: #f2f4f7;
          border: 1px solid #d9dee7;
          border-radius: 10px;
          flex: 1;
          margin: 0 16px;
          min-height: 0;
          overflow: hidden;
          position: relative;
          touch-action: none;
          user-select: none;
          -webkit-touch-callout: none;
          -webkit-user-drag: none;
          -webkit-user-select: none;
        }

        .canvas-wrap--draw .canvas { cursor: crosshair; }
        .canvas-wrap--erase .canvas { cursor: not-allowed; }
        .canvas-wrap--O .canvas,
        .canvas-wrap--X .canvas { cursor: cell; }
        .canvas-wrap--move .canvas { cursor: grab; }
        .canvas-wrap--pass .canvas,
        .canvas-wrap--cut .canvas { cursor: alias; }

        .canvas {
          display: block;
          height: 100%;
          touch-action: none;
          user-select: none;
          width: 100%;
          -webkit-touch-callout: none;
          -webkit-user-drag: none;
          -webkit-user-select: none;
        }

        .bottom {
          background: #ffffff;
          flex-shrink: 0;
          max-height: 46vh;
          overflow-y: auto;
        }

        .tools-row {
          align-items: center;
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 12px 16px 10px;
        }

        .tool,
        .clear {
          background: #ffffff;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          color: #344054;
          cursor: pointer;
          flex-shrink: 0;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          min-height: 40px;
          padding: 0 15px;
          transition: background 0.12s, border-color 0.12s, color 0.12s;
        }

        .tool:hover,
        .clear:hover {
          background: #f9fafb;
          border-color: #98a2b3;
          color: #101828;
        }

        .tool:disabled {
          background: #f2f4f7;
          color: #98a2b3;
          cursor: default;
        }

        .tool--on {
          background: #eef4ff;
          border-color: #2f80ed;
          color: #174ea6;
        }

        .tool--O { color: #1557b8; border-color: #b2ccff; }
        .tool--O.tool--on { background: #e8f1ff; border-color: #1557b8; color: #1557b8; }

        .tool--X { color: #b42318; border-color: #fecdca; }
        .tool--X.tool--on { background: #fff1f0; border-color: #d7372f; color: #b42318; }

        .tool--erase.tool--on { background: #fff7ed; border-color: #f97316; color: #9a3412; }

        .spacer { flex: 1; min-width: 2px; }

        .clear {
          color: #667085;
        }

        .query-row {
          display: flex;
          gap: 10px;
          padding: 10px 16px 12px;
        }

        .query {
          background: #ffffff;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          color: #101828;
          flex: 1;
          font-family: inherit;
          font-size: 15px;
          line-height: 1.5;
          outline: none;
          padding: 10px 12px;
          resize: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .query:focus {
          border-color: #2f80ed;
          box-shadow: 0 0 0 3px rgba(47,128,237,0.14);
        }
        .query::placeholder { color: #98a2b3; }

        .ask {
          align-self: flex-end;
          background: #111827;
          border: 1px solid #111827;
          border-radius: 8px;
          color: #ffffff;
          cursor: pointer;
          flex-shrink: 0;
          font-family: inherit;
          font-size: 14px;
          font-weight: 700;
          min-height: 46px;
          padding: 0 22px;
          transition: all 0.12s;
          white-space: nowrap;
        }

        .ask:hover:not(:disabled) { background: #344054; border-color: #344054; }
        .ask:disabled { cursor: default; opacity: 0.4; }

        .coaching {
          border-top: 1px solid #eaecf0;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px 16px 24px;
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .section-label {
          color: #667085;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .section-text {
          color: #101828;
          font-size: 15px;
          line-height: 1.45;
        }

        @media (max-width: 640px) {
          .header { padding-inline: 14px; }
          .canvas-wrap { margin-inline: 10px; }
          .tools-row,
          .query-row { padding-inline: 12px; }
          .query-row { flex-direction: column; }
          .ask { align-self: stretch; }
        }
      `}</style>
    </main>
  );
}
