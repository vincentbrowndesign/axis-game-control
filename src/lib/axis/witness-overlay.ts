/* ============================================================
   AXIS witness overlay — the instrument's eyes, drawn in the
   same broadcast language as the bug and the lower third.

   Draws: corner brackets around the athlete, a skewed lime tag
   with the athlete ID riding the bracket, white bones / lime
   joints with smoothing, and live angle readouts that change
   with the armed test.

   Stays dumb on purpose: it runs the pose loop, draws, and
   emits `axis:pose` events (raw normalized landmarks + computed
   angles). It never makes judgments — the witness pipeline is
   the only consumer of geometry.

   The same paint routine also bakes onto saved evidence: `drawTo`
   re-renders the last tracked pose at 1:1 scale onto any target
   canvas (a captured frame, a composite recording canvas) so
   saved files carry the same overlay the coach saw live.

   External contract (survives any UI rewrite):
     window.AxisWitness.setTest(name | null)
     window.AxisWitness.setAthlete(id | null)
     window "axis:pose" CustomEvent<AxisPoseEventDetail>
============================================================ */

import {
  loadAxisPoseDetector,
  type AxisPoseDetector,
  type AxisPoseFrame,
  type AxisPoseLandmark,
} from "./axis-pose-detector";

export type AxisWitnessStatus = "loading" | "live" | "offline";

export type AxisPoseEventDetail = {
  timestamp: number;
  test: string | null;
  athlete: string | null;
  landmarks: AxisPoseLandmark[];
  angles: Record<string, number>;
};

export type AxisWitnessOverlay = {
  start: () => void;
  stop: () => void;
  setTest: (test: string | null) => void;
  setAthlete: (athlete: string | null) => void;
  /** Bake the last tracked pose onto a target canvas at its native size. No-op if no pose has been tracked yet. */
  drawTo: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
};

declare global {
  interface Window {
    AxisWitness?: {
      setTest: (test: string | null) => void;
      setAthlete: (athlete: string | null) => void;
    };
  }
}

const LIME = "#c8f542";
const INK = "#000";
const INK_SOFT = "rgba(0,0,0,.45)"; // underlay so white strokes survive bright scenes
const WHITE = "#fff";
const SKEW = Math.tan((-12 * Math.PI) / 180); // matches the HUD's skewX(-12deg)

/* angle at joint B between BA and BC, aspect-corrected, degrees */
const ANGLE_JOINTS: Record<string, [string, string, string]> = {
  left_knee: ["left_hip", "left_knee", "left_ankle"],
  right_knee: ["right_hip", "right_knee", "right_ankle"],
  left_hip: ["left_shoulder", "left_hip", "left_knee"],
  right_hip: ["right_shoulder", "right_hip", "right_knee"],
  left_elbow: ["left_shoulder", "left_elbow", "left_wrist"],
  right_elbow: ["right_shoulder", "right_elbow", "right_wrist"],
};

/* which readouts ride which armed test */
const KNEES = ["left_knee", "right_knee"];
const KNEES_HIPS = [...KNEES, "left_hip", "right_hip"];
const ELBOWS = ["left_elbow", "right_elbow"];
const TEST_ANGLES: Record<string, string[]> = {
  JUMP: KNEES,
  SPRINT: KNEES,
  DECEL: KNEES,
  LATERAL: KNEES,
  CMJ: KNEES_HIPS,
  LANDING: KNEES_HIPS,
  "DROP JUMP": KNEES_HIPS,
  SHOOTING: ELBOWS,
};

const BONES: Array<[number, number]> = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], [23, 24], // torso
  [23, 25], [25, 27], // left leg
  [24, 26], [26, 28], // right leg
  [27, 29], [29, 31], [27, 31], // left foot
  [28, 30], [30, 32], [28, 32], // right foot
];

const SMOOTH_ALPHA = 0.35; // EMA so the skeleton doesn't jitter
const MIN_VIS = 0.4;

type Smoothed = { x: number; y: number; visibility: number };

function vis(l: { visibility?: number }): number {
  return typeof l.visibility === "number" ? l.visibility : 1;
}

/* skewed lime chip with ink text — same voice as the score bug */
function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, px: number) {
  ctx.font = `${px}px Anton, Impact, 'Arial Narrow', sans-serif`;
  const w = ctx.measureText(text).width + px * 0.9;
  const h = px * 1.5;
  ctx.save();
  ctx.transform(1, 0, SKEW, 1, x, y);
  ctx.fillStyle = LIME;
  ctx.fillRect(0, -h, w, h);
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.transform(1, 0, -SKEW, 1, 0, 0);
  ctx.fillText(text, px * 0.45 + SKEW * (h / 2) * -1, -h / 2);
  ctx.restore();
}

function angleDeg(
  byName: Map<string, Smoothed>,
  joint: [string, string, string],
  aspect: number,
): number | null {
  const a = byName.get(joint[0]);
  const b = byName.get(joint[1]);
  const c = byName.get(joint[2]);
  if (!a || !b || !c) return null;
  if (a.visibility < MIN_VIS || b.visibility < MIN_VIS || c.visibility < MIN_VIS) return null;
  const bax = (a.x - b.x) * aspect;
  const bay = a.y - b.y;
  const bcx = (c.x - b.x) * aspect;
  const bcy = c.y - b.y;
  const la = Math.hypot(bax, bay);
  const lc = Math.hypot(bcx, bcy);
  if (la === 0 || lc === 0) return null;
  const cos = Math.min(1, Math.max(-1, (bax * bcx + bay * bcy) / (la * lc)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/* the one drawing routine — used for the live overlay and for baking onto saved evidence */
function paintPose(
  ctx: CanvasRenderingContext2D,
  byIndex: Map<number, Smoothed>,
  byName: Map<string, Smoothed>,
  angles: Record<string, number>,
  toX: (nx: number) => number,
  toY: (ny: number) => number,
  scale: number,
  test: string | null,
  athlete: string | null,
) {
  /* corner brackets around the athlete — not a full box */
  const seen = [...byIndex.values()].filter((p) => p.visibility >= MIN_VIS);
  if (seen.length >= 4) {
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const p of seen) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const padX = (maxX - minX) * 0.12 + 0.01;
    const padY = (maxY - minY) * 0.08 + 0.01;
    const x0 = toX(minX - padX);
    const y0 = toY(minY - padY);
    const x1 = toX(maxX + padX);
    const y1 = toY(maxY + padY);
    const arm = Math.min(x1 - x0, y1 - y0) * 0.16;

    ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + arm); ctx.lineTo(x0, y0); ctx.lineTo(x0 + arm, y0);
    ctx.moveTo(x1 - arm, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + arm);
    ctx.moveTo(x1, y1 - arm); ctx.lineTo(x1, y1); ctx.lineTo(x1 - arm, y1);
    ctx.moveTo(x0 + arm, y1); ctx.lineTo(x0, y1); ctx.lineTo(x0, y1 - arm);
    ctx.strokeStyle = INK_SOFT;
    ctx.lineWidth = 5 * scale;
    ctx.stroke();
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 3 * scale;
    ctx.stroke();

    /* athlete tag riding the top-left bracket */
    if (athlete) drawChip(ctx, x0, y0 - 4 * scale, athlete, 13 * scale);
  }

  /* white bones over an ink underlay */
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const [ai, bi] of BONES) {
    const a = byIndex.get(ai);
    const b = byIndex.get(bi);
    if (!a || !b || a.visibility < MIN_VIS || b.visibility < MIN_VIS) continue;
    ctx.moveTo(toX(a.x), toY(a.y));
    ctx.lineTo(toX(b.x), toY(b.y));
  }
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 4 * scale;
  ctx.stroke();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  /* lime joints, ink-ringed */
  ctx.fillStyle = LIME;
  ctx.strokeStyle = INK_SOFT;
  ctx.lineWidth = 1.5 * scale;
  for (const p of byIndex.values()) {
    if (p.visibility < MIN_VIS) continue;
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.y), 3.5 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  /* angle readouts for the armed test */
  const active = test ? (TEST_ANGLES[test] ?? []) : [];
  for (const name of active) {
    if (!(name in angles)) continue;
    const joint = byName.get(ANGLE_JOINTS[name][1]);
    if (!joint) continue;
    const left = name.startsWith("left");
    const jx = toX(joint.x);
    const jy = toY(joint.y);
    drawChip(ctx, jx + (left ? 14 : -58) * scale, jy - 8 * scale, `${Math.round(angles[name])}°`, 12 * scale);
  }
}

export function createAxisWitnessOverlay(opts: {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  onStatus?: (status: AxisWitnessStatus) => void;
}): AxisWitnessOverlay {
  const { video, canvas, onStatus } = opts;
  const ctx = canvas.getContext("2d");

  let running = false;
  let raf = 0;
  let detector: AxisPoseDetector | null = null;
  let test: string | null = null;
  let athlete: string | null = null;
  let lastTs = -1;
  let announcedLive = false;
  let detectErrors = 0;
  const smoothed = new Map<number, Smoothed>();

  /* last tracked pose — reused by drawTo to bake the overlay onto saved evidence */
  let lastByIndex = new Map<number, Smoothed>();
  let lastByName = new Map<string, Smoothed>();
  let lastAngles: Record<string, number> = {};

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!ctx || !detector) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;

    const ts = performance.now();
    if (ts <= lastTs) return; // detectForVideo needs monotonic timestamps
    lastTs = ts;

    /* size canvas to its CSS box, map normalized coords through object-fit: cover */
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let result: AxisPoseFrame | null = null;
    try {
      result = detector.detect(video, ts);
      detectErrors = 0;
    } catch {
      detectErrors++;
      if (detectErrors === 90 && !announcedLive) onStatus?.("offline"); // ~3s of failures
      return;
    }

    if (!result) {
      smoothed.clear();
      return;
    }

    if (!announcedLive) {
      announcedLive = true;
      onStatus?.("live");
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(cw / vw, ch / vh);
    const ox = (cw - vw * scale) / 2;
    const oy = (ch - vh * scale) / 2;
    const toX = (nx: number) => (nx * vw * scale + ox) * dpr;
    const toY = (ny: number) => (ny * vh * scale + oy) * dpr;

    /* smooth */
    const byIndex = new Map<number, Smoothed>();
    const byName = new Map<string, Smoothed>();
    for (const l of result.landmarks) {
      const prev = smoothed.get(l.index);
      const next: Smoothed = prev
        ? {
            x: prev.x + (l.x - prev.x) * SMOOTH_ALPHA,
            y: prev.y + (l.y - prev.y) * SMOOTH_ALPHA,
            visibility: prev.visibility + (vis(l) - prev.visibility) * SMOOTH_ALPHA,
          }
        : { x: l.x, y: l.y, visibility: vis(l) };
      smoothed.set(l.index, next);
      byIndex.set(l.index, next);
      byName.set(l.name, next);
    }

    /* angle readouts */
    const aspect = vw / vh;
    const angles: Record<string, number> = {};
    for (const name of Object.keys(ANGLE_JOINTS)) {
      const deg = angleDeg(byName, ANGLE_JOINTS[name], aspect);
      if (deg !== null) angles[name] = Math.round(deg * 10) / 10;
    }

    paintPose(ctx, byIndex, byName, angles, toX, toY, dpr, test, athlete);

    lastByIndex = byIndex;
    lastByName = byName;
    lastAngles = angles;

    /* >>> AXIS-CORE: the witness pipeline consumes this — geometry out, no judgments */
    window.dispatchEvent(
      new CustomEvent<AxisPoseEventDetail>("axis:pose", {
        detail: { timestamp: ts, test, athlete, landmarks: result.landmarks, angles },
      }),
    );
  }

  const overlay: AxisWitnessOverlay = {
    start() {
      if (running) return;
      running = true;
      window.AxisWitness = { setTest: overlay.setTest, setAthlete: overlay.setAthlete };
      onStatus?.("loading");
      loadAxisPoseDetector()
        .then((d) => {
          if (!running) return;
          detector = d;
        })
        .catch(() => {
          /* stays dumb about geometry, but reports its own health */
          if (running) onStatus?.("offline");
        });
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      smoothed.clear();
      if (window.AxisWitness?.setTest === overlay.setTest) delete window.AxisWitness;
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
    setTest(next) {
      test = next;
    },
    setAthlete(next) {
      athlete = next;
    },
    drawTo(targetCtx, width, height) {
      if (lastByIndex.size === 0) return;
      const toX = (nx: number) => nx * width;
      const toY = (ny: number) => ny * height;
      const scale = Math.max(1, width / 960); // proportionate strokes at capture/record resolution
      paintPose(targetCtx, lastByIndex, lastByName, lastAngles, toX, toY, scale, test, athlete);
    },
  };

  return overlay;
}
