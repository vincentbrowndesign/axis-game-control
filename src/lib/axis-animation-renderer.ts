"use client";

// ─── Canvas dimensions — 1080×1920 vertical (portrait) ───────────────────────
export const ANIM_W = 1080;
export const ANIM_H = 1920;
export const ANIM_FPS = 30;
export const ANIM_DURATION_MS = 6200;

// ─── Court geometry ───────────────────────────────────────────────────────────
const CX = ANIM_W / 2;
const COURT_L = 60;
const COURT_R = ANIM_W - 60;
const COURT_T = 200;
const COURT_B = 870;
const COURT_W = COURT_R - COURT_L;
const COURT_H = COURT_B - COURT_T;

const RIM_X = CX;
const RIM_Y = COURT_T + 80;
const RIM_R = 24;

const PAINT_L = CX - 190;
const PAINT_R = CX + 190;
const PAINT_T = RIM_Y - 10;
const PAINT_B = RIM_Y + 230;
const FT_R = 190;

const THREE_R = 420;
const CORNER_INSET = 50;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg: "#04050a",
  courtCenter: "#0f130f",
  court: "#0c0f0c",
  courtLine: "#1e261e",
  courtLineDim: "#141a14",
  paint: "#080d08",
  rim: "#cc5500",
  rimGlow: "rgba(204,85,0,0.55)",
  player: "#c8ff00",
  playerCore: "#eaff90",
  playerG1: "rgba(200,255,0,0.06)",
  playerG2: "rgba(200,255,0,0.20)",
  playerG3: "rgba(200,255,0,0.55)",
  trail: "#c8ff00",
  arc: "#ffffff",
  ball: "#e87828",
  ballHigh: "#ffb866",
  ballDark: "#992200",
  ballGlow: "rgba(232,120,40,0.55)",
  make: "#00e864",
  makeGlow: "rgba(0,232,100,0.45)",
  miss: "#ff3344",
  missGlow: "rgba(255,51,68,0.45)",
  label: "#ffffff",
  labelShadow: "rgba(0,0,0,0.85)",
  labelDim: "rgba(255,255,255,0.28)",
  axisWord: "rgba(255,255,255,0.20)",
  flashMake: "rgba(200,255,0,0.15)",
  flashMiss: "rgba(255,51,68,0.12)",
  vignette: "rgba(0,0,2,0.60)",
};

// ─── Types ────────────────────────────────────────────────────────────────────
export type AnimationFact = {
  fact_key: string;
  fact_text_value: string | null;
  fact_value: number;
};

export type AnimationTrack = {
  entity_id: string;
  entity_type: "ball" | "hoop" | "player";
  frame: number;
  x: number;
  y: number;
};

export type AnimationScene = {
  drive: boolean;
  makeMiss: "make" | "miss" | null;
  paintTouch: boolean;
  shotArea: "paint" | "right wing" | "left wing" | "corner" | "top" | null;
  shotAttempt: boolean;
};

export type ReplayTimelineEvent =
  | "drive"
  | "paint_touch"
  | "shot_attempt"
  | "make"
  | "miss"
  | "end_card";

export type ReplayTimeline = {
  callouts: string[];
  events: ReplayTimelineEvent[];
  finding: string;
  scene: AnimationScene;
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

export function sceneToReplayTimeline(scene: AnimationScene): ReplayTimeline {
  const events: ReplayTimelineEvent[] = [];
  const callouts: string[] = [];

  if (scene.drive) {
    events.push("drive");
    callouts.push("DRIVE");
  }
  if (scene.paintTouch) {
    events.push("paint_touch");
    callouts.push("PAINT TOUCH");
  }
  if (scene.shotAttempt) {
    events.push("shot_attempt");
    callouts.push("SHOT ATTEMPT");
  }
  if (scene.makeMiss === "make") {
    events.push("make");
    callouts.push("MAKE");
  }
  if (scene.makeMiss === "miss") {
    events.push("miss");
    callouts.push("MISS");
  }

  if (events.length) events.push("end_card");

  return {
    callouts,
    events,
    finding: replayFinding(scene),
    scene,
  };
}

export function sceneHasUnderstandingEvent(scene: AnimationScene) {
  return Boolean(
    scene.drive ||
      scene.paintTouch ||
      scene.shotAttempt ||
      scene.makeMiss === "make" ||
      scene.makeMiss === "miss",
  );
}

function replayFinding(scene: AnimationScene) {
  if (scene.drive && scene.paintTouch && scene.makeMiss === "make") {
    return "Pressure created downhill and converted at the rim.";
  }
  if (scene.drive && scene.paintTouch && scene.shotAttempt) {
    return "The attack reached the paint and produced a shot.";
  }
  if (scene.paintTouch && !scene.drive) {
    return "The possession touched the paint without a downhill drive.";
  }
  if (scene.shotAttempt && scene.makeMiss === "make") {
    return "The clip resolves into a made shot.";
  }
  if (scene.shotAttempt && scene.makeMiss === "miss") {
    return "The clip resolves into a missed shot attempt.";
  }
  if (scene.shotAttempt) return "Axis found a shot attempt worth saving.";
  return "Replay Video";
}

// ─── Math ─────────────────────────────────────────────────────────────────────
function clamp(t: number, lo = 0, hi = 1) {
  return Math.max(lo, Math.min(hi, t));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp(t);
}

// Smooth cubic in-out
function easeIO(t: number) {
  const c = clamp(t);
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2;
}

// Exponential snap — feels like a "hit"
function easeOutExp(t: number) {
  const c = clamp(t);
  return c === 1 ? 1 : 1 - 2 ** (-10 * c);
}

// Spring overshoot — feels alive
function easeOutBack(t: number) {
  const c = clamp(t);
  const s = 1.70158;
  return 1 + (s + 1) * (c - 1) ** 3 + s * (c - 1) ** 2;
}

// Phase: returns 0→1 for sub-interval [s,e] using given easer
function ph(
  t: number,
  s: number,
  e: number,
  ease: (v: number) => number = easeIO,
) {
  return ease(clamp((t - s) / Math.max(e - s, 0.0001)));
}

// Stable per-index pseudo-random (does not change between frames)
function stableRand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// Bezier sample
function bez(
  t: number,
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
) {
  const u = 1 - t;
  return { x: u * u * ax + 2 * u * t * bx + t * t * cx, y: u * u * ay + 2 * u * t * by + t * t * cy };
}

// ─── Court position by fact area ─────────────────────────────────────────────
function areaPos(area: AnimationScene["shotArea"]) {
  switch (area) {
    case "paint":      return { x: CX,            y: PAINT_B - 70 };
    case "top":        return { x: CX,            y: COURT_T + COURT_H * 0.50 };
    case "left wing":  return { x: COURT_L + 110, y: COURT_T + COURT_H * 0.38 };
    case "right wing": return { x: COURT_R - 110, y: COURT_T + COURT_H * 0.38 };
    case "corner":     return { x: COURT_L + 56,  y: COURT_B - 90 };
    default:           return { x: CX,            y: COURT_T + COURT_H * 0.52 };
  }
}

// ─── Confetti pool (stable, pre-seeded) ──────────────────────────────────────
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  angle: stableRand(i * 17.3) * Math.PI * 2,
  dist: lerp(55, 210, stableRand(i * 5.1)),
  r: lerp(4, 11, stableRand(i * 3.3)),
  hue: lerp(90, 150, stableRand(i * 11.7)),
}));

// ─── Drawing functions ────────────────────────────────────────────────────────

function drawCourt(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // Court surface with radial depth gradient
  const surf = ctx.createRadialGradient(
    CX, COURT_T + COURT_H * 0.55, 0,
    CX, COURT_T + COURT_H * 0.55, COURT_W * 0.7,
  );
  surf.addColorStop(0, C.courtCenter);
  surf.addColorStop(1, C.court);
  ctx.fillStyle = surf;
  ctx.fillRect(COURT_L, COURT_T, COURT_W, COURT_H);

  // Court border
  ctx.strokeStyle = C.courtLine;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(COURT_L, COURT_T, COURT_W, COURT_H);

  // Paint key — slightly lighter surface + very faint green ambient
  ctx.fillStyle = C.paint;
  ctx.fillRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);
  const paintAmb = ctx.createRadialGradient(CX, (PAINT_T + PAINT_B) / 2, 0, CX, (PAINT_T + PAINT_B) / 2, 260);
  paintAmb.addColorStop(0, "rgba(0,200,80,0.05)");
  paintAmb.addColorStop(1, "rgba(0,200,80,0)");
  ctx.fillStyle = paintAmb;
  ctx.fillRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);
  ctx.strokeStyle = C.courtLineDim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);

  // Free-throw arc — upper solid
  ctx.beginPath();
  ctx.arc(CX, PAINT_B, FT_R, Math.PI, 0);
  ctx.strokeStyle = C.courtLineDim;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Free-throw arc — lower dashed
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(CX, PAINT_B, FT_R, 0, Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3-point arc
  ctx.strokeStyle = C.courtLine;
  ctx.lineWidth = 2;
  const halfW = COURT_W / 2 - CORNER_INSET;
  const threeAngle = Math.asin(halfW / THREE_R);
  ctx.beginPath();
  ctx.arc(CX, RIM_Y, THREE_R, Math.PI - threeAngle, threeAngle);
  ctx.stroke();

  // Corner lines
  ctx.beginPath();
  ctx.moveTo(COURT_L + CORNER_INSET, COURT_T);
  ctx.lineTo(COURT_L + CORNER_INSET, RIM_Y);
  ctx.moveTo(COURT_R - CORNER_INSET, COURT_T);
  ctx.lineTo(COURT_R - CORNER_INSET, RIM_Y);
  ctx.stroke();

  // Rim glow (layered radial gradients — no shadowBlur on large area)
  for (let layer = 3; layer >= 0; layer--) {
    const scale = 2.0 + layer * 1.3;
    const rimGrad = ctx.createRadialGradient(RIM_X, RIM_Y, RIM_R * 0.4, RIM_X, RIM_Y, RIM_R * scale);
    rimGrad.addColorStop(0, `rgba(204,85,0,${0.10 - layer * 0.022})`);
    rimGrad.addColorStop(1, "rgba(204,85,0,0)");
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(RIM_X, RIM_Y, RIM_R * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rim ring — shadowBlur only on small shape
  ctx.shadowColor = C.rim;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = C.rim;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(RIM_X, RIM_Y, RIM_R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Rim center dot
  ctx.fillStyle = C.rim;
  ctx.beginPath();
  ctx.arc(RIM_X, RIM_Y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayerOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alpha: number,
  scale: number,
) {
  const R = 30 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Ambient glow — large, dim
  const amb = ctx.createRadialGradient(x, y, 0, x, y, R * 5.5);
  amb.addColorStop(0, C.playerG2);
  amb.addColorStop(0.4, C.playerG1);
  amb.addColorStop(1, "rgba(200,255,0,0)");
  ctx.fillStyle = amb;
  ctx.beginPath();
  ctx.arc(x, y, R * 5.5, 0, Math.PI * 2);
  ctx.fill();

  // Halo ring — medium
  const halo = ctx.createRadialGradient(x, y, R * 0.9, x, y, R * 2.4);
  halo.addColorStop(0, C.playerG3);
  halo.addColorStop(0.5, C.playerG2);
  halo.addColorStop(1, "rgba(200,255,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, R * 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const body = ctx.createRadialGradient(x - R * 0.28, y - R * 0.32, 0, x, y, R);
  body.addColorStop(0, C.playerCore);
  body.addColorStop(0.6, C.player);
  body.addColorStop(1, "#88cc00");
  ctx.shadowColor = C.player;
  ctx.shadowBlur = 28;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Specular highlight
  ctx.globalAlpha = alpha * 0.65;
  const spec = ctx.createRadialGradient(x - R * 0.32, y - R * 0.38, 0, x - R * 0.15, y - R * 0.18, R * 0.58);
  spec.addColorStop(0, "rgba(255,255,255,0.80)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  progress: number,
) {
  if (progress < 0.02) return;
  ctx.save();

  // Wide ambient glow
  const wideG = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  wideG.addColorStop(0, "rgba(200,255,0,0)");
  wideG.addColorStop(0.35, "rgba(200,255,0,0.04)");
  wideG.addColorStop(1, "rgba(200,255,0,0.14)");
  ctx.globalAlpha = progress;
  ctx.strokeStyle = wideG;
  ctx.lineWidth = 36;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  // Mid glow
  const midG = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  midG.addColorStop(0, "rgba(200,255,0,0)");
  midG.addColorStop(0.4, "rgba(200,255,0,0.22)");
  midG.addColorStop(1, "rgba(200,255,0,0.65)");
  ctx.strokeStyle = midG;
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  // Core bright line
  const coreG = ctx.createLinearGradient(from.x, from.y, to.x, to.y);
  coreG.addColorStop(0, "rgba(200,255,0,0)");
  coreG.addColorStop(0.5, "rgba(220,255,80,0.55)");
  coreG.addColorStop(1, "rgba(240,255,100,0.98)");
  ctx.shadowColor = C.player;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = coreG;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Particle dots — stable seeded positions
  const DOTS = 9;
  for (let i = 0; i < DOTS; i++) {
    const tPos = (i + 1) / (DOTS + 1);
    const px = lerp(from.x, to.x, tPos);
    const py = lerp(from.y, to.y, tPos);
    const ox = (stableRand(i * 7.3) - 0.5) * 16;
    const oy = (stableRand(i * 3.7) - 0.5) * 16;
    const r = lerp(2.5, 9, tPos);
    ctx.globalAlpha = progress * tPos * 0.70;
    ctx.shadowColor = C.player;
    ctx.shadowBlur = 8;
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(px + ox, py + oy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  ctx.restore();
}

// Lime flash when player drives into the paint — advantage signal
function drawAdvantageFlash(ctx: CanvasRenderingContext2D, intensity: number) {
  if (intensity <= 0) return;
  ctx.save();

  // Paint zone flash
  ctx.globalAlpha = intensity * 0.40;
  ctx.fillStyle = C.player;
  ctx.fillRect(PAINT_L - 16, PAINT_T, PAINT_R - PAINT_L + 32, PAINT_B - PAINT_T);

  // Whole-canvas dim wash
  ctx.globalAlpha = intensity * 0.07;
  ctx.fillRect(0, 0, ANIM_W, ANIM_H);

  // Rim brightens in sympathy
  ctx.globalAlpha = intensity * 0.25;
  ctx.fillStyle = C.rim;
  ctx.beginPath();
  ctx.arc(RIM_X, RIM_Y, RIM_R * 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Expanding pressure rings from player position when entering paint
function drawPressurePulse(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.save();
  for (let ring = 0; ring < 3; ring++) {
    const delay = ring * 0.26;
    const rt = clamp((t - delay) / 0.74);
    if (rt <= 0) continue;
    const radius = lerp(38, 170, easeOutExp(rt));
    ctx.globalAlpha = lerp(0.65, 0, rt) * 0.85;
    ctx.strokeStyle = C.player;
    ctx.lineWidth = lerp(4.5, 0.5, rt);
    ctx.shadowColor = C.player;
    ctx.shadowBlur = lerp(12, 0, rt);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawPaintPulse(ctx: CanvasRenderingContext2D, t: number) {
  const pulse = Math.sin(t * Math.PI);
  ctx.save();

  // Fill wash
  ctx.globalAlpha = 0.17 * pulse;
  ctx.fillStyle = C.make;
  ctx.fillRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);

  // Glowing border
  ctx.globalAlpha = 0.7 * pulse;
  ctx.strokeStyle = C.make;
  ctx.lineWidth = 3;
  ctx.shadowColor = C.make;
  ctx.shadowBlur = 18;
  ctx.strokeRect(PAINT_L, PAINT_T, PAINT_R - PAINT_L, PAINT_B - PAINT_T);
  ctx.shadowBlur = 0;

  // Corner flares
  const FL = 44 * pulse;
  const corners = [[PAINT_L, PAINT_T], [PAINT_R, PAINT_T], [PAINT_L, PAINT_B], [PAINT_R, PAINT_B]] as const;
  for (const [cx, cy] of corners) {
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, FL * 1.6);
    cg.addColorStop(0, "rgba(0,232,100,0.65)");
    cg.addColorStop(1, "rgba(0,232,100,0)");
    ctx.globalAlpha = 0.55 * pulse;
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, FL * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawShotArc(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  progress: number,
) {
  const cpX = (from.x + RIM_X) / 2;
  const cpY = Math.min(from.y, RIM_Y) - 250;
  const STEPS = 64;

  ctx.save();

  // Shadow under-layer (wide, faint)
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 20;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= Math.ceil(progress * STEPS); i++) {
    const tt = (i / STEPS) * progress;
    const p = bez(tt, from.x, from.y, cpX, cpY, RIM_X, RIM_Y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();

  // Glow layer
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 10;
  ctx.shadowColor = "rgba(255,255,255,0.5)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i <= Math.ceil(progress * STEPS); i++) {
    const tt = (i / STEPS) * progress;
    const p = bez(tt, from.x, from.y, cpX, cpY, RIM_X, RIM_Y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Main arc — dashed white
  ctx.globalAlpha = 0.88;
  ctx.strokeStyle = C.arc;
  ctx.lineWidth = 3.5;
  ctx.setLineDash([20, 12]);
  ctx.beginPath();
  for (let i = 0; i <= Math.ceil(progress * STEPS); i++) {
    const tt = (i / STEPS) * progress;
    const p = bez(tt, from.x, from.y, cpX, cpY, RIM_X, RIM_Y);
    i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Comet ball at arc tip
  if (progress > 0.03) {
    const ball = bez(progress, from.x, from.y, cpX, cpY, RIM_X, RIM_Y);

    // Comet tail — fading previous positions
    for (let i = 10; i >= 1; i--) {
      const tt = Math.max(0, progress - i * 0.016);
      const tail = bez(tt, from.x, from.y, cpX, cpY, RIM_X, RIM_Y);
      ctx.globalAlpha = (1 - i / 10) * 0.55;
      ctx.fillStyle = C.ball;
      ctx.beginPath();
      ctx.arc(tail.x, tail.y, lerp(4, 14, 1 - i / 10), 0, Math.PI * 2);
      ctx.fill();
    }

    // Ball body
    ctx.globalAlpha = 1;
    ctx.shadowColor = C.ballGlow;
    ctx.shadowBlur = 24;
    const bGrad = ctx.createRadialGradient(ball.x - 6, ball.y - 6, 0, ball.x, ball.y, 23);
    bGrad.addColorStop(0, C.ballHigh);
    bGrad.addColorStop(0.5, C.ball);
    bGrad.addColorStop(1, C.ballDark);
    ctx.fillStyle = bGrad;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 23, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawResultPulse(ctx: CanvasRenderingContext2D, result: "make" | "miss", t: number) {
  const isMake = result === "make";
  const color = isMake ? C.make : C.miss;
  const glow = isMake ? C.makeGlow : C.missGlow;
  const flashColor = isMake ? C.flashMake : C.flashMiss;
  const RINGS = isMake ? 5 : 3;

  ctx.save();

  // Screen-wide flash on first frame
  if (t < 0.20) {
    ctx.globalAlpha = lerp(isMake ? 0.14 : 0.11, 0, t / 0.20);
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, ANIM_W, ANIM_H);
  }

  // Expanding rings — staggered
  for (let i = 0; i < RINGS; i++) {
    const delay = i * (isMake ? 0.15 : 0.20);
    const rt = clamp((t - delay) / 0.85);
    if (rt <= 0) continue;
    const radius = lerp(RIM_R, RIM_R * (isMake ? 13 : 9), easeOutExp(rt));
    const lineA = lerp(isMake ? 0.92 : 1.0, 0, rt ** (isMake ? 1.1 : 0.85));
    ctx.globalAlpha = lineA;
    ctx.strokeStyle = color;
    ctx.lineWidth = lerp(isMake ? 5.5 : 7, 0.5, rt);
    ctx.shadowColor = glow;
    ctx.shadowBlur = lerp(22, 0, rt);
    ctx.beginPath();
    ctx.arc(RIM_X, RIM_Y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Rim flash fill
  if (t < 0.16) {
    ctx.globalAlpha = lerp(1, 0, t / 0.16);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 36;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(RIM_X, RIM_Y, RIM_R + 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Make: confetti burst from rim
  if (isMake && t > 0.06) {
    const ct = clamp((t - 0.06) / 0.94);
    ctx.restore();
    ctx.save();
    for (const p of CONFETTI) {
      const dist = p.dist * easeOutExp(ct);
      const px = RIM_X + Math.cos(p.angle) * dist;
      const py = RIM_Y + Math.sin(p.angle) * dist;
      ctx.globalAlpha = lerp(1, 0, ct * ct) * 0.95;
      ctx.shadowColor = `hsl(${p.hue},100%,62%)`;
      ctx.shadowBlur = 8;
      ctx.fillStyle = `hsl(${p.hue},100%,62%)`;
      ctx.beginPath();
      ctx.arc(px, py, p.r * (1 - ct * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

function drawLabels(ctx: CanvasRenderingContext2D, scene: AnimationScene, t: number) {
  type Label = { text: string; color: string; size: number };
  const lines: Label[] = [];
  if (scene.drive) lines.push({ text: "DRIVE", color: C.player, size: 94 });
  if (scene.paintTouch && !scene.drive) lines.push({ text: "PAINT TOUCH", color: C.label, size: 78 });
  if (scene.shotAttempt) lines.push({ text: "SHOT ATTEMPT", color: C.label, size: 78 });
  if (scene.makeMiss === "make") lines.push({ text: "MAKE", color: C.make, size: 164 });
  if (scene.makeMiss === "miss") lines.push({ text: "MISS", color: C.miss, size: 164 });

  ctx.save();
  ctx.textAlign = "center";

  if (!lines.length) {
    ctx.globalAlpha = clamp(t * 2);
    ctx.font = "bold 60px monospace";
    ctx.fillStyle = C.labelDim;
    ctx.fillText("AXIS", CX, COURT_B + 220);
    ctx.restore();
    return;
  }

  const ZONE_TOP = COURT_B + 120;
  let y = ZONE_TOP;

  lines.forEach((line, i) => {
    const delay = i * 0.13;
    const lt = ph(t, delay, delay + 0.38, easeOutBack);
    if (lt <= 0) { y += line.size + 28; return; }

    const slideY = lerp(50, 0, lt);
    const alpha = clamp(lt * 3);
    const scale = lerp(0.80, 1, lt);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(CX, y + slideY);
    ctx.scale(scale, scale);

    // Drop shadow pass
    ctx.shadowColor = C.labelShadow;
    ctx.shadowBlur = 28;
    ctx.font = `bold ${line.size}px 'SF Mono','Roboto Mono',monospace`;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillText(line.text, 4, 4);
    ctx.shadowBlur = 0;

    // Glow for colored labels
    if (line.color !== C.label) {
      ctx.shadowColor = line.color;
      ctx.shadowBlur = 32;
    }

    // Main text
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 0, 0);
    ctx.shadowBlur = 0;

    // Accent underline
    ctx.globalAlpha = alpha * 0.38;
    ctx.fillStyle = line.color;
    ctx.fillRect(-72, 12, 144, 2);

    ctx.restore();
    y += line.size + 28;
  });

  ctx.restore();
}

function drawAxisMark(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.28;
  ctx.font = "bold 44px 'SF Mono','Roboto Mono',monospace";
  ctx.fillStyle = C.axisWord;
  ctx.textAlign = "right";
  ctx.fillText("AXIS", ANIM_W - 60, COURT_T - 48);
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = "";
  let lineY = y;

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }

  if (line) ctx.fillText(line, x, lineY);
}

function drawEndCard(ctx: CanvasRenderingContext2D, scene: AnimationScene, t: number) {
  const alpha = ph(t, 0.88, 1, easeOutExp);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;

  const panelTop = ANIM_H - 460;
  const grad = ctx.createLinearGradient(0, panelTop - 180, 0, ANIM_H);
  grad.addColorStop(0, "rgba(4,5,10,0)");
  grad.addColorStop(0.38, "rgba(4,5,10,0.86)");
  grad.addColorStop(1, "rgba(4,5,10,0.98)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, panelTop - 180, ANIM_W, 640);

  ctx.textAlign = "left";
  ctx.fillStyle = C.axisWord;
  ctx.font = "bold 42px 'SF Mono','Roboto Mono',monospace";
  ctx.fillText("AXIS", 72, panelTop);

  ctx.fillStyle = C.labelDim;
  ctx.font = "bold 30px 'SF Mono','Roboto Mono',monospace";
  ctx.fillText("WHAT WE FOUND", 72, panelTop + 76);

  ctx.fillStyle = C.label;
  ctx.font = "bold 58px 'SF Mono','Roboto Mono',monospace";
  drawWrappedText(ctx, replayFinding(scene), 72, panelTop + 154, ANIM_W - 144, 70);

  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const vig = ctx.createRadialGradient(CX, ANIM_H * 0.40, ANIM_W * 0.28, CX, ANIM_H * 0.40, ANIM_W * 0.95);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, C.vignette);
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, ANIM_W, ANIM_H);
  ctx.restore();
}

// ─── Main render function ─────────────────────────────────────────────────────
// t: normalized time 0→1 over ANIM_DURATION_MS

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  scene: AnimationScene,
  t: number,
): void {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, ANIM_W, ANIM_H);

  const start = areaPos(scene.shotArea);
  const driveEnd = { x: CX, y: PAINT_B - 60 };

  // Player position — eased drive movement
  let px = start.x;
  let py = start.y;
  if (scene.drive) {
    const dt = ph(t, 0.22, 0.54);
    px = lerp(start.x, driveEnd.x, dt);
    py = lerp(start.y, driveEnd.y, dt);
  }

  // ── Court ─────────────────────────────────────────────────────────────────
  const courtAlpha = ph(t, 0, 0.18, easeOutExp);
  drawCourt(ctx, courtAlpha);

  // ── Advantage flash — drive entering paint ────────────────────────────────
  if (scene.drive) {
    const ramp = ph(t, 0.36, 0.43, easeOutExp);
    const fall = ph(t, 0.43, 0.56);
    drawAdvantageFlash(ctx, (ramp - fall) * courtAlpha);
  }

  // ── Drive trail ───────────────────────────────────────────────────────────
  if (scene.drive && t > 0.22) {
    drawTrail(ctx, start, { x: px, y: py }, ph(t, 0.22, 0.54));
  }

  // ── Player orb — spring in ────────────────────────────────────────────────
  const pAlpha = ph(t, 0.10, 0.26, easeOutExp);
  const pScale = ph(t, 0.10, 0.30, easeOutBack);
  if (pAlpha > 0) drawPlayerOrb(ctx, px, py, pAlpha, lerp(0.45, 1, pScale));

  // ── Pressure pulse — rings when entering paint ────────────────────────────
  if (scene.paintTouch && t > 0.46 && t < 0.72) {
    drawPressurePulse(ctx, px, py, clamp((t - 0.46) / 0.26));
  }

  // ── Paint area glow ───────────────────────────────────────────────────────
  if (scene.paintTouch && t > 0.50) {
    drawPaintPulse(ctx, clamp((t - 0.50) / 0.24));
  }

  // ── Shot arc ──────────────────────────────────────────────────────────────
  if (scene.shotAttempt) {
    const arcStart = scene.drive ? 0.56 : 0.28;
    const arcT = ph(t, arcStart, arcStart + 0.28);
    if (arcT > 0) drawShotArc(ctx, { x: px, y: py }, arcT);
  }

  // ── Result pulse ──────────────────────────────────────────────────────────
  if (scene.makeMiss && t > 0.78) {
    drawResultPulse(ctx, scene.makeMiss, clamp((t - 0.78) / 0.22));
  }

  // ── Vignette always on top of court content ───────────────────────────────
  drawVignette(ctx);

  // ── Labels — staggered spring entrance ───────────────────────────────────
  if (t > 0.82) drawLabels(ctx, scene, clamp((t - 0.82) / 0.18));
  drawEndCard(ctx, scene, t);

  // ── AXIS watermark ────────────────────────────────────────────────────────
  drawAxisMark(ctx, courtAlpha);
}
