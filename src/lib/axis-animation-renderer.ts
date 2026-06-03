"use client";

// Canvas dimensions — 1080×1920 vertical (portrait)
export const ANIM_W = 1080;
export const ANIM_H = 1920;
export const ANIM_FPS = 30;
export const ANIM_DURATION_MS = 4500;

// ─── Court geometry (pixels, top-down half-court) ────────────────────────────

const CX = ANIM_W / 2; // 540
const COURT_L = 60;
const COURT_R = ANIM_W - 60;
const COURT_T = 200;
const COURT_B = 870;
const COURT_W = COURT_R - COURT_L;
const COURT_H = COURT_B - COURT_T;

// Rim sits near the top of the half-court
const RIM_X = CX;
const RIM_Y = COURT_T + 80;
const RIM_R = 24;

// Paint (key)
const PAINT_L = CX - 190;
const PAINT_R = CX + 190;
const PAINT_T = RIM_Y - 10;
const PAINT_B = RIM_Y + 230;
const FT_R = 190; // free-throw circle radius

// 3-point arc
const THREE_R = 420;
const CORNER_INSET = 50;

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  bg: "#050508",
  court: "#0b0e0b",
  courtStroke: "#191e19",
  paint: "#080d08",
  paintStroke: "#162016",
  rim: "#994400",
  player: "#c8ff00",
  playerGlow: "rgba(200,255,0,0.22)",
  trail: "#c8ff00",
  arc: "rgba(255,255,255,0.82)",
  ball: "#e07020",
  ballDark: "#993300",
  make: "#00e864",
  miss: "#ff3344",
  label: "#ffffff",
  labelDim: "rgba(255,255,255,0.35)",
  axisWatermark: "rgba(255,255,255,0.28)",
  paintPulse: "rgba(0,210,80,",
  paintPulseStroke: "rgba(0,210,80,",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type AnimationFact = {
  fact_key: string;
  fact_text_value: string | null;
  fact_value: number;
};

export type AnimationScene = {
  drive: boolean;
  makeMiss: "make" | "miss" | null;
  paintTouch: boolean;
  shotArea: "paint" | "right wing" | "left wing" | "corner" | "top" | null;
  shotAttempt: boolean;
};

// ─── Fact → Scene ─────────────────────────────────────────────────────────────

const AREA_SET = new Set(["paint", "right wing", "left wing", "corner", "top"]);
const MM_SET = new Set(["make", "miss"]);

export function factsToScene(facts: AnimationFact[]): AnimationScene {
  const m = new Map(facts.map((f) => [f.fact_key, f]));
  const bool = (k: string) => (m.get(k)?.fact_value ?? 0) === 1;
  const text = (k: string) => m.get(k)?.fact_text_value ?? null;
  const rawArea = text("dominant_area_guess");
  const rawMM = text("make_miss");

  return {
    drive: bool("drive"),
    makeMiss: MM_SET.has(rawMM ?? "") ? (rawMM as "make" | "miss") : null,
    paintTouch: bool("paint_touch"),
    shotArea: AREA_SET.has(rawArea ?? "") ? (rawArea as AnimationScene["shotArea"]) : null,
    shotAttempt: bool("shot_attempt"),
  };
}

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clamp(t: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, t));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t);
}

function ease(t: number) {
  const c = clamp(t);
  return c < 0.5 ? 2 * c * c : -1 + (4 - 2 * c) * c;
}

// Returns 0→1 for the sub-interval [s, e] with easing
function ph(t: number, s: number, e: number) {
  return ease(clamp((t - s) / (e - s)));
}

// ─── Court position for each area label ──────────────────────────────────────

function areaPos(area: AnimationScene["shotArea"]): { x: number; y: number } {
  switch (area) {
    case "paint":      return { x: CX,              y: PAINT_B - 70 };
    case "top":        return { x: CX,              y: COURT_T + COURT_H * 0.5 };
    case "left wing":  return { x: COURT_L + 110,   y: COURT_T + COURT_H * 0.38 };
    case "right wing": return { x: COURT_R - 110,   y: COURT_T + COURT_H * 0.38 };
    case "corner":     return { x: COURT_L + 56,    y: COURT_B - 90 };
    default:           return { x: CX,              y: COURT_T + COURT_H * 0.52 };
  }
}

// ─── Drawing primitives ───────────────────────────────────────────────────────

function drawCourt(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Surface
  ctx.fillStyle = C.court;
  ctx.fillRect(COURT_L, COURT_T, COURT_W, COURT_H);

  // Boundary
  ctx.strokeStyle = C.courtStroke;
  ctx.lineWidth = 3;
  ctx.strokeRect(COURT_L, COURT_T, COURT_W, COURT_H);

  // Paint
  ctx.fillStyle = C.paint;
  ctx.fillRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);
  ctx.strokeStyle = C.paintStroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);

  // Free-throw arc (solid upper)
  ctx.beginPath();
  ctx.arc(CX, PAINT_B, FT_R, Math.PI, 0);
  ctx.strokeStyle = C.paintStroke;
  ctx.stroke();

  // Free-throw arc (dashed lower)
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.arc(CX, PAINT_B, FT_R, 0, Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3-point arc
  ctx.strokeStyle = C.courtStroke;
  ctx.lineWidth = 2.5;
  const halfW = COURT_W / 2 - CORNER_INSET;
  const threeAngle = Math.asin(halfW / THREE_R);
  ctx.beginPath();
  ctx.arc(CX, RIM_Y, THREE_R, Math.PI - threeAngle, threeAngle);
  ctx.stroke();

  // Corner lines (sides of 3-point zone)
  ctx.beginPath();
  ctx.moveTo(COURT_L + CORNER_INSET, COURT_T);
  ctx.lineTo(COURT_L + CORNER_INSET, RIM_Y);
  ctx.moveTo(COURT_R - CORNER_INSET, COURT_T);
  ctx.lineTo(COURT_R - CORNER_INSET, RIM_Y);
  ctx.stroke();

  // Rim circle
  ctx.beginPath();
  ctx.arc(RIM_X, RIM_Y, RIM_R, 0, Math.PI * 2);
  ctx.strokeStyle = C.rim;
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // Rim dot
  ctx.beginPath();
  ctx.arc(RIM_X, RIM_Y, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.rim;
  ctx.fill();

  ctx.restore();
}

function drawPlayerOrb(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number) {
  const R = 30;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Outer glow
  const glow = ctx.createRadialGradient(x, y, 0, x, y, R * 3.5);
  glow.addColorStop(0, C.playerGlow);
  glow.addColorStop(1, "rgba(200,255,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, R * 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Orb body
  const body = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R);
  body.addColorStop(0, "#e6ff80");
  body.addColorStop(1, C.player);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  alpha: number,
) {
  ctx.save();

  // Main trail line
  const lineGrad = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  lineGrad.addColorStop(0, "rgba(200,255,0,0)");
  lineGrad.addColorStop(0.5, "rgba(200,255,0,0.35)");
  lineGrad.addColorStop(1, "rgba(200,255,0,0.75)");

  ctx.globalAlpha = alpha * 0.7;
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  // Ghost dots along trail
  const DOT_COUNT = 6;
  for (let i = 0; i < DOT_COUNT; i++) {
    const t = i / DOT_COUNT;
    const px = lerp(from.x, to.x, t);
    const py = lerp(from.y, to.y, t);
    const r = lerp(3, 9, t);
    ctx.globalAlpha = alpha * t * 0.55;
    ctx.fillStyle = C.trail;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPaintPulse(ctx: CanvasRenderingContext2D, t: number) {
  const pulse = Math.sin(t * Math.PI);
  ctx.save();

  ctx.fillStyle = `${C.paintPulse}${(0.14 * pulse).toFixed(3)})`;
  ctx.fillRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);

  ctx.strokeStyle = `${C.paintPulseStroke}${(0.55 * pulse).toFixed(3)})`;
  ctx.lineWidth = 3;
  ctx.strokeRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);

  ctx.restore();
}

function drawShotArc(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  progress: number,
) {
  const to = { x: RIM_X, y: RIM_Y };
  const cpX = (from.x + to.x) / 2;
  const cpY = Math.min(from.y, to.y) - 220;

  ctx.save();
  ctx.strokeStyle = C.arc;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.setLineDash([16, 10]);
  ctx.globalAlpha = 0.82;

  ctx.beginPath();
  const steps = Math.ceil(progress * 50);
  for (let i = 0; i <= steps; i++) {
    const tt = (i / 50) * progress;
    const bx = (1 - tt) ** 2 * from.x + 2 * (1 - tt) * tt * cpX + tt ** 2 * to.x;
    const by = (1 - tt) ** 2 * from.y + 2 * (1 - tt) * tt * cpY + tt ** 2 * to.y;
    i === 0 ? ctx.moveTo(bx, by) : ctx.lineTo(bx, by);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Ball orb at arc tip
  if (progress > 0.04) {
    const tt = progress;
    const bx = (1 - tt) ** 2 * from.x + 2 * (1 - tt) * tt * cpX + tt ** 2 * to.x;
    const by = (1 - tt) ** 2 * from.y + 2 * (1 - tt) * tt * cpY + tt ** 2 * to.y;
    ctx.globalAlpha = 1;
    const ballGrad = ctx.createRadialGradient(bx - 5, by - 5, 0, bx, by, 20);
    ballGrad.addColorStop(0, "#ff9844");
    ballGrad.addColorStop(1, C.ballDark);
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(bx, by, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawResultPulse(
  ctx: CanvasRenderingContext2D,
  result: "make" | "miss",
  t: number,
) {
  const color = result === "make" ? C.make : C.miss;
  ctx.save();

  // Three expanding rings, offset in time
  for (let i = 0; i < 3; i++) {
    const delay = i * 0.25;
    const rt = clamp((t - delay) / 0.75);
    if (rt <= 0) continue;
    const radius = lerp(RIM_R, RIM_R * 10, rt);
    ctx.globalAlpha = lerp(0.85, 0, rt);
    ctx.strokeStyle = color;
    ctx.lineWidth = lerp(5, 1, rt);
    ctx.beginPath();
    ctx.arc(RIM_X, RIM_Y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Flash fill on rim
  if (t < 0.22) {
    ctx.globalAlpha = lerp(0.9, 0, t / 0.22);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(RIM_X, RIM_Y, RIM_R + 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: AnimationScene, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";

  const lines: Array<{ text: string; color: string; size: number }> = [];

  if (scene.drive) lines.push({ text: "DRIVE", color: C.player, size: 88 });
  if (scene.paintTouch && !scene.drive) lines.push({ text: "PAINT TOUCH", color: C.label, size: 72 });
  if (scene.shotAttempt) lines.push({ text: "SHOT ATTEMPT", color: C.label, size: 72 });
  if (scene.makeMiss === "make") lines.push({ text: "MAKE", color: C.make, size: 148 });
  if (scene.makeMiss === "miss") lines.push({ text: "MISS", color: C.miss, size: 148 });

  if (!lines.length) {
    ctx.font = "bold 72px monospace";
    ctx.fillStyle = C.labelDim;
    ctx.fillText("AXIS", CX, COURT_B + 260);
    ctx.restore();
    return;
  }

  // Stack labels from top of label zone
  let y = COURT_B + 140;
  for (const line of lines) {
    ctx.font = `bold ${line.size}px 'SF Mono', 'Roboto Mono', monospace`;
    ctx.fillStyle = line.color;
    ctx.letterSpacing = "0.08em";
    ctx.fillText(line.text, CX, y);
    y += line.size + 20;
  }

  ctx.restore();
}

function drawAxisMark(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.38;
  ctx.font = "bold 48px 'SF Mono', 'Roboto Mono', monospace";
  ctx.fillStyle = C.axisWatermark;
  ctx.textAlign = "right";
  ctx.fillText("AXIS", ANIM_W - 60, COURT_T - 44);
  ctx.restore();
}

// ─── Main render function ─────────────────────────────────────────────────────
// t: normalized time 0→1 over the full animation duration

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scene: AnimationScene,
  t: number,
): void {
  // Black background — always full opacity
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, ANIM_W, ANIM_H);

  const start = areaPos(scene.shotArea);

  // Player position tracks drive animation
  const driveEnd = { x: CX, y: PAINT_B - 60 };
  let px = start.x;
  let py = start.y;

  if (scene.drive) {
    const driveT = ph(t, 0.22, 0.52);
    px = lerp(start.x, driveEnd.x, driveT);
    py = lerp(start.y, driveEnd.y, driveT);
  }

  // Court fades in first
  const courtAlpha = ph(t, 0, 0.16);
  drawCourt(ctx, courtAlpha);

  // Drive trail
  if (scene.drive && t > 0.22) {
    const driveT = ph(t, 0.22, 0.52);
    drawTrail(ctx, start, { x: px, y: py }, driveT);
  }

  // Player orb
  const playerAlpha = ph(t, 0.10, 0.24);
  if (playerAlpha > 0) {
    drawPlayerOrb(ctx, px, py, playerAlpha);
  }

  // Paint touch pulse (starts when player enters paint during drive)
  if (scene.paintTouch && t > 0.48) {
    drawPaintPulse(ctx, clamp((t - 0.48) / 0.20));
  }

  // Shot arc
  if (scene.shotAttempt) {
    const arcStart = scene.drive ? 0.54 : 0.28;
    const arcT = clamp((t - arcStart) / 0.26);
    if (arcT > 0) {
      drawShotArc(ctx, { x: px, y: py }, arcT);
    }
  }

  // Result pulse
  if (scene.makeMiss && t > 0.76) {
    drawResultPulse(ctx, scene.makeMiss, clamp((t - 0.76) / 0.22));
  }

  // Event labels
  const labelAlpha = ph(t, 0.82, 0.92);
  if (labelAlpha > 0) {
    drawLabels(ctx, scene, labelAlpha);
  }

  // Watermark
  drawAxisMark(ctx, courtAlpha);
}
