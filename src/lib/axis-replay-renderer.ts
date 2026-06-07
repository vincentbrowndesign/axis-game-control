"use client";

import type { AxisEventType, AxisReplayFrame, AxisReplayObject } from "./axis-primitives";

// ─── Canvas / court geometry (matches axis-animation-renderer.ts) ─────────────
export const REPLAY_W = 1080;
export const REPLAY_H = 1920;
export const REPLAY_FPS = 30;

const CX = REPLAY_W / 2;
const COURT_L = 60;
const COURT_R = REPLAY_W - 60;
const COURT_T = 200;
const COURT_B = 870;
const COURT_W = COURT_R - COURT_L;
const COURT_H = COURT_B - COURT_T;

// Fixed rim position (normalized: basket at 0.5, 0.10)
const RIM_NX = 0.5;
const RIM_NY = 0.10;
const RIM_R = 24;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#04050a",
  court: "#0c0f0c",
  courtCenter: "#0f130f",
  courtLine: "#1e261e",
  courtLineDim: "#141a14",
  paint: "#080d08",
  rim: "#cc5500",
  ball: "#e87828",
  ballHigh: "#ffb866",
  ballDark: "#992200",
  ballGlow: "rgba(232,120,40,0.55)",
  player: "#c8ff00",
  playerCore: "#eaff90",
  playerG1: "rgba(200,255,0,0.06)",
  playerG2: "rgba(200,255,0,0.20)",
  playerG3: "rgba(200,255,0,0.55)",
  possession: "rgba(200,255,0,0.35)",
  pressure: "rgba(255,51,68,0.45)",
  spacing: "rgba(200,255,0,0.08)",
  eventDrive: "rgba(200,255,0,0.18)",
  eventShot: "rgba(255,255,255,0.15)",
  label: "#ffffff",
  labelDim: "rgba(255,255,255,0.28)",
  vignette: "rgba(0,0,2,0.60)",
};

// ─── Coordinate conversion ────────────────────────────────────────────────────
// Normalized court coord [0,1] → canvas pixel

function cx(nx: number) { return COURT_L + nx * COURT_W; }
function cy(ny: number) { return COURT_T + ny * COURT_H; }

// ─── Court ────────────────────────────────────────────────────────────────────

function drawCourt(ctx: CanvasRenderingContext2D) {
  const rimPx = { x: cx(RIM_NX), y: cy(RIM_NY) };

  const surf = ctx.createRadialGradient(CX, COURT_T + COURT_H * 0.55, 0, CX, COURT_T + COURT_H * 0.55, COURT_W * 0.7);
  surf.addColorStop(0, C.courtCenter);
  surf.addColorStop(1, C.court);
  ctx.fillStyle = surf;
  ctx.fillRect(COURT_L, COURT_T, COURT_W, COURT_H);

  ctx.strokeStyle = C.courtLine;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(COURT_L, COURT_T, COURT_W, COURT_H);

  // Paint
  const paintL = cx(0.32);
  const paintR = cx(0.68);
  const paintT = cy(RIM_NY - 0.02);
  const paintB = cy(0.42);
  ctx.fillStyle = C.paint;
  ctx.fillRect(paintL, paintT, paintR - paintL, paintB - paintT);
  ctx.strokeStyle = C.courtLineDim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(paintL, paintT, paintR - paintL, paintB - paintT);

  // Three-point arc
  const THREE_R = 420;
  const CORNER_INSET = 50;
  const halfW = COURT_W / 2 - CORNER_INSET;
  const threeAngle = Math.asin(halfW / THREE_R);
  ctx.strokeStyle = C.courtLine;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CX, rimPx.y, THREE_R, Math.PI - threeAngle, threeAngle);
  ctx.stroke();

  // Corner lines
  ctx.beginPath();
  ctx.moveTo(COURT_L + CORNER_INSET, COURT_T);
  ctx.lineTo(COURT_L + CORNER_INSET, rimPx.y);
  ctx.moveTo(COURT_R - CORNER_INSET, COURT_T);
  ctx.lineTo(COURT_R - CORNER_INSET, rimPx.y);
  ctx.stroke();

  // Rim
  ctx.shadowColor = C.rim;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = C.rim;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(rimPx.x, rimPx.y, RIM_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = C.rim;
  ctx.beginPath();
  ctx.arc(rimPx.x, rimPx.y, 5, 0, Math.PI * 2);
  ctx.fill();
}

// ─── Objects ──────────────────────────────────────────────────────────────────

function drawBall(ctx: CanvasRenderingContext2D, obj: AxisReplayObject) {
  const px = cx(obj.x);
  const py = cy(obj.y);
  const R = 20;

  ctx.save();
  ctx.globalAlpha = obj.interpolated ? 0.55 : 1.0;

  const g = ctx.createRadialGradient(px - 6, py - 6, 0, px, py, R);
  g.addColorStop(0, C.ballHigh);
  g.addColorStop(0.5, C.ball);
  g.addColorStop(1, C.ballDark);
  ctx.shadowColor = C.ballGlow;
  ctx.shadowBlur = 22;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  obj: AxisReplayObject,
  isPossessor: boolean,
  isDefender: boolean,
) {
  const px = cx(obj.x);
  const py = cy(obj.y);
  const R = 28;

  ctx.save();
  ctx.globalAlpha = obj.interpolated ? 0.5 : 1.0;

  // Ambient glow
  const amb = ctx.createRadialGradient(px, py, 0, px, py, R * 5.5);
  amb.addColorStop(0, C.playerG2);
  amb.addColorStop(0.4, C.playerG1);
  amb.addColorStop(1, "rgba(200,255,0,0)");
  ctx.fillStyle = amb;
  ctx.beginPath();
  ctx.arc(px, py, R * 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const body = ctx.createRadialGradient(px - R * 0.28, py - R * 0.32, 0, px, py, R);
  body.addColorStop(0, C.playerCore);
  body.addColorStop(0.6, C.player);
  body.addColorStop(1, "#88cc00");
  ctx.shadowColor = C.player;
  ctx.shadowBlur = isPossessor ? 36 : 20;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(px, py, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Possession ring
  if (isPossessor) {
    ctx.strokeStyle = C.possession;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, py, R + 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pressure ring (nearest defender to ball handler)
  if (isDefender) {
    ctx.strokeStyle = C.pressure;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(px, py, R + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Label
  if (obj.label) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = C.label;
    ctx.font = "bold 18px 'SF Mono','Roboto Mono',monospace";
    ctx.textAlign = "center";
    ctx.fillText(obj.label.replace("player_", ""), px, py + R + 22);
  }

  ctx.restore();
}

// ─── Spacing convex hull overlay ──────────────────────────────────────────────

function drawSpacingHull(
  ctx: CanvasRenderingContext2D,
  players: AxisReplayObject[],
  area: number,
) {
  if (players.length < 3 || area < 0.02) return;

  // Simple polygon from sorted player positions (approximate — not full hull)
  const pts = players
    .map((p) => ({ x: cx(p.x), y: cy(p.y) }))
    .sort((a, b) => Math.atan2(a.y - cy(0.5), a.x - cx(0.5)) - Math.atan2(b.y - cy(0.5), b.x - cx(0.5)));

  ctx.save();
  ctx.globalAlpha = 0.18 * Math.min(1, area * 4);
  ctx.fillStyle = C.spacing;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = C.player;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// ─── Event overlays ───────────────────────────────────────────────────────────

const EVENT_LABELS: Partial<Record<AxisEventType, string>> = {
  drive: "DRIVE",
  kick: "KICK",
  cut: "CUT",
  closeout: "CLOSEOUT",
  rotation: "ROTATION",
  transition: "TRANSITION",
  shot_attempt: "SHOT",
  shot_made: "MAKE",
  shot_missed: "MISS",
  rebound: "REBOUND",
  pass: "PASS",
};

function drawEventOverlays(
  ctx: CanvasRenderingContext2D,
  frame: AxisReplayFrame,
) {
  if (!frame.active_events.length) return;

  ctx.save();

  const labels = frame.active_events
    .map((e) => EVENT_LABELS[e.type])
    .filter(Boolean) as string[];

  if (!labels.length) { ctx.restore(); return; }

  const y0 = COURT_B + 60;
  ctx.textAlign = "center";

  labels.slice(0, 3).forEach((label, i) => {
    const isResult = label === "MAKE" || label === "MISS";
    const color = label === "MAKE" ? "#00e864" : label === "MISS" ? "#ff3344" : C.player;
    const size = isResult ? 110 : 72;

    ctx.globalAlpha = 0.92;
    ctx.shadowColor = color;
    ctx.shadowBlur = isResult ? 28 : 16;
    ctx.font = `bold ${size}px 'SF Mono','Roboto Mono',monospace`;
    ctx.fillStyle = color;
    ctx.fillText(label, CX, y0 + i * (size + 20));
    ctx.shadowBlur = 0;
  });

  ctx.restore();
}

// ─── HUD: possession + pressure + tallies ────────────────────────────────────

function drawHud(ctx: CanvasRenderingContext2D, frame: AxisReplayFrame) {
  ctx.save();

  const hudY = COURT_B + 260;
  ctx.textAlign = "left";
  ctx.font = "bold 24px 'SF Mono','Roboto Mono',monospace";

  // Pressure bar
  const pressureWidth = 200;
  const filledW = pressureWidth * (1 - frame.pressure.distance);
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(COURT_L, hudY, pressureWidth, 6);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = frame.pressure.distance < 0.25 ? C.pressure : C.player;
  ctx.fillRect(COURT_L, hudY, filledW, 6);

  ctx.globalAlpha = 0.38;
  ctx.fillStyle = C.labelDim;
  ctx.font = "bold 20px 'SF Mono','Roboto Mono',monospace";
  ctx.fillText("PRESSURE", COURT_L, hudY + 26);

  // Tallies
  const tallyCols = frame.tallies.slice(0, 4);
  tallyCols.forEach((t, i) => {
    const tx = COURT_L + i * 200;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = C.label;
    ctx.font = `bold 44px 'SF Mono','Roboto Mono',monospace`;
    ctx.fillText(String(t.value), tx, hudY + 90);
    ctx.globalAlpha = 0.28;
    ctx.font = "bold 18px 'SF Mono','Roboto Mono',monospace";
    ctx.fillStyle = C.labelDim;
    ctx.fillText(t.key.toUpperCase(), tx, hudY + 116);
  });

  ctx.restore();
}

// ─── Vignette ─────────────────────────────────────────────────────────────────

function drawVignette(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const vig = ctx.createRadialGradient(CX, REPLAY_H * 0.40, REPLAY_W * 0.28, CX, REPLAY_H * 0.40, REPLAY_W * 0.95);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, C.vignette);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, REPLAY_W, REPLAY_H);
  ctx.restore();
}

// ─── Main render ──────────────────────────────────────────────────────────────
// Renders a single AxisReplayFrame to canvas. No video required.

export function renderDataFrame(
  ctx: CanvasRenderingContext2D,
  frame: AxisReplayFrame,
): void {
  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, REPLAY_W, REPLAY_H);

  // Court
  drawCourt(ctx);

  const players = frame.objects.filter((o) => o.entity_type === "player");
  const ball = frame.objects.find((o) => o.entity_type === "ball");

  // Spacing hull (behind players)
  drawSpacingHull(ctx, players, frame.spacing.convex_hull_area);

  // Players
  for (const p of players) {
    const isPossessor = frame.possession.track_id === p.track_id;
    const isDefender = frame.pressure.defender_track_id === p.track_id;
    drawPlayer(ctx, p, isPossessor, isDefender);
  }

  // Ball (on top of players)
  if (ball) drawBall(ctx, ball);

  // Vignette
  drawVignette(ctx);

  // Event overlays
  drawEventOverlays(ctx, frame);

  // HUD
  drawHud(ctx, frame);

  // AXIS watermark
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.font = "bold 40px 'SF Mono','Roboto Mono',monospace";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "right";
  ctx.fillText("AXIS", COURT_R, COURT_T - 44);
  ctx.restore();
}
