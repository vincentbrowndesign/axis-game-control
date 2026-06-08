import { axisOverlayStyleV1, axisRgba } from "./axis-overlay-style";

export type AxisOverlayCoordinateSpace = "normalized" | "video" | "screen";

export type AxisOverlayPlayer = {
  confidence?: number;
  id: string;
  label?: string;
  x: number;
  y: number;
};

export type AxisOverlayBall = {
  confidence?: number;
  timestamp?: number;
  x: number;
  y: number;
};

export type AxisOverlayFrame = {
  ball?: AxisOverlayBall | AxisOverlayBall[];
  coordinateSpace?: AxisOverlayCoordinateSpace;
  players: AxisOverlayPlayer[];
  timestamp: number;
};

export type AxisOverlayAdapter<TInput> = {
  getFrame: (input: TInput) => AxisOverlayFrame;
  id: string;
};

export type AxisOverlayRenderOptions = {
  confidenceThreshold?: number;
  coordinateSpace?: AxisOverlayCoordinateSpace;
  drawCourtEffects?: boolean;
  drawLabels?: boolean;
  fit?: "contain" | "cover" | "screen";
  maxBallHistory?: number;
  sourceHeight: number;
  sourceWidth: number;
};

export type AxisOverlayEngineState = {
  ballHistory: Array<AxisOverlayBall & { timestamp: number }>;
  lastBall?: AxisOverlayBall & { timestamp: number };
  lastPlayers: Map<string, AxisOverlayPlayer & { timestamp: number }>;
  pulses: AxisOverlayPulse[];
};

type AxisOverlayPulse = {
  createdAt: number;
  kind: "ball" | "court" | "player";
  strength: number;
  x: number;
  y: number;
};

type AxisOverlayMapping = {
  offsetX: number;
  offsetY: number;
  scale: number;
};

export type AxisOverlayPoint = {
  x: number;
  y: number;
};

const overlayStyle = axisOverlayStyleV1;
const defaultConfidenceThreshold = overlayStyle.ring.confidenceThreshold;
const defaultMaxBallHistory = overlayStyle.trail.maxHistory;
const movementSpikeDistance = 34;
const pulseLifeMs = 820;

export function createAxisOverlayEngineState(): AxisOverlayEngineState {
  return {
    ballHistory: [],
    lastPlayers: new Map(),
    pulses: [],
  };
}

export function resetAxisOverlayEngineState(state: AxisOverlayEngineState) {
  state.ballHistory = [];
  state.lastBall = undefined;
  state.lastPlayers.clear();
  state.pulses = [];
}

export function renderAxisOverlayFrame({
  canvasHeight,
  canvasWidth,
  ctx,
  frame,
  options,
  state,
}: {
  canvasHeight: number;
  canvasWidth: number;
  ctx: CanvasRenderingContext2D;
  frame: AxisOverlayFrame;
  options: AxisOverlayRenderOptions;
  state: AxisOverlayEngineState;
}) {
  const now = performance.now();
  const threshold = options.confidenceThreshold ?? defaultConfidenceThreshold;
  const coordinateSpace = frame.coordinateSpace ?? options.coordinateSpace ?? "video";
  const mapping = getOverlayMapping(options.sourceWidth, options.sourceHeight, canvasWidth, canvasHeight, options.fit ?? "contain");
  const balls = normalizeBallInput(frame.ball, frame.timestamp).filter((ball) => confidenceValue(ball.confidence) >= threshold);
  const activeBall = balls.at(-1);

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  if (options.drawCourtEffects ?? true) drawCourtEffects(ctx, canvasWidth, canvasHeight, now);

  for (const ball of balls) {
    const point = mapOverlayPoint(ball, coordinateSpace, mapping, options);
    maybeAddBallPulse(state, point, ball, now);
    state.ballHistory.push(ball);
    state.lastBall = ball;
  }

  trimBallHistory(state, options.maxBallHistory ?? defaultMaxBallHistory);

  for (const player of frame.players) {
    if (confidenceValue(player.confidence) < threshold) continue;
    const point = mapOverlayPoint(player, coordinateSpace, mapping, options);
    maybeAddPlayerPulse(state, player, point, frame.timestamp, now);
    state.lastPlayers.set(player.id, { ...player, timestamp: frame.timestamp });
  }

  drawPressurePulses(ctx, state, now);
  drawBallTrail(ctx, state.ballHistory, frame.timestamp, coordinateSpace, mapping, options);
  drawPlayerIndicators(ctx, frame.players, threshold, coordinateSpace, mapping, options);
  if (activeBall) drawBallGlow(ctx, activeBall, coordinateSpace, mapping, options);
}

export function createMockOverlayAdapter(): AxisOverlayAdapter<{ timestamp: number }> {
  return {
    id: "axis_mock_overlay",
    getFrame: ({ timestamp }) => {
      const t = timestamp;
      return {
        ball: {
          confidence: 1,
          timestamp,
          x: 0.5 + Math.sin(t * 2.8) * 0.26,
          y: 0.38 + Math.cos(t * 1.7) * 0.18,
        },
        coordinateSpace: "normalized",
        players: [
          { confidence: 1, id: "p1", label: "P1", x: 0.28 + Math.sin(t * 0.9) * 0.06, y: 0.72 },
          { confidence: 1, id: "p2", label: "P2", x: 0.62 + Math.cos(t * 0.7) * 0.06, y: 0.62 },
          { confidence: 1, id: "p3", label: "P3", x: 0.76, y: 0.42 + Math.sin(t * 1.1) * 0.05 },
        ],
        timestamp,
      };
    },
  };
}

export function createTrackOverlayAdapter({
  ballTrack,
  playersByTime = [],
}: {
  ballTrack: Array<AxisOverlayBall & { timestamp: number }>;
  playersByTime?: AxisOverlayFrame[];
}): AxisOverlayAdapter<{ timestamp: number }> {
  return {
    id: "axis_track_overlay",
    getFrame: ({ timestamp }) => ({
      ball: nearestBallWindow(ballTrack, timestamp),
      players: nearestPlayers(playersByTime, timestamp),
      timestamp,
    }),
  };
}

export function createCvOverlayAdapter<TInput>({
  getBall,
  getPlayers,
}: {
  getBall?: (input: TInput) => AxisOverlayBall | AxisOverlayBall[] | undefined;
  getPlayers: (input: TInput) => AxisOverlayPlayer[];
}): AxisOverlayAdapter<TInput & { timestamp: number }> {
  return {
    id: "axis_cv_coordinates",
    getFrame: (input) => ({
      ball: getBall?.(input),
      players: getPlayers(input),
      timestamp: input.timestamp,
    }),
  };
}

function drawPlayerIndicators(
  ctx: CanvasRenderingContext2D,
  players: AxisOverlayPlayer[],
  threshold: number,
  coordinateSpace: AxisOverlayCoordinateSpace,
  mapping: AxisOverlayMapping,
  options: AxisOverlayRenderOptions,
) {
  for (const player of players) {
    if (confidenceValue(player.confidence) < threshold) continue;
    const point = mapOverlayPoint(player, coordinateSpace, mapping, options);

    renderPlayerRing(ctx, {
      label: (options.drawLabels ?? true) ? player.label : undefined,
      x: point.x,
      y: point.y,
    });
  }
}

function drawBallTrail(
  ctx: CanvasRenderingContext2D,
  history: Array<AxisOverlayBall & { timestamp: number }>,
  timestamp: number,
  coordinateSpace: AxisOverlayCoordinateSpace,
  mapping: AxisOverlayMapping,
  options: AxisOverlayRenderOptions,
) {
  const recent = history.filter((point) => Math.abs(timestamp - point.timestamp) <= overlayStyle.trail.maxAgeSeconds);
  if (recent.length < 2) return;
  const mapped = recent.map((point) => mapOverlayPoint(point, coordinateSpace, mapping, options));
  renderBallTrail(ctx, mapped);
}

export function renderPlayerRing(ctx: CanvasRenderingContext2D, player: AxisOverlayPoint & { label?: string }) {
  ctx.save();
  ctx.globalAlpha = overlayStyle.fade.ringAlpha;
  ctx.strokeStyle = axisRgba(overlayStyle.ring.neutralColor, 0.96);
  ctx.lineWidth = overlayStyle.ring.strokeWidth;
  ctx.shadowBlur = overlayStyle.glow.ringShadowBlur;
  ctx.shadowColor = axisRgba(overlayStyle.ring.neutralColor, 0.48);
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 5, 22, 8, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = overlayStyle.ring.fillAlpha;
  ctx.fillStyle = axisRgba(overlayStyle.ring.neutralColor, 0.72);
  ctx.beginPath();
  ctx.ellipse(player.x, player.y + 5, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.label) {
    const text = player.label.toUpperCase();
    const labelWidth = Math.max(overlayStyle.label.minWidth, text.length * 8 + overlayStyle.label.paddingX * 2);
    const labelHeight = 18;
    const labelX = player.x - labelWidth / 2;
    const labelY = player.y - 36;

    ctx.globalAlpha = overlayStyle.label.backgroundAlpha;
    ctx.shadowBlur = 10;
    ctx.fillStyle = axisRgba(overlayStyle.colors.black, 0.92);
    roundRect(ctx, labelX, labelY, labelWidth, labelHeight, 7);
    ctx.fill();

    ctx.globalAlpha = overlayStyle.fade.labelAlpha;
    ctx.shadowBlur = 10;
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = axisRgba(overlayStyle.label.textColor, overlayStyle.fade.labelAlpha);
    ctx.fillText(text, player.x, labelY + labelHeight / 2 + 0.5);
  }
  ctx.restore();
}

export function renderBallTrail(ctx: CanvasRenderingContext2D, points: AxisOverlayPoint[]) {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let index = 1; index < points.length; index += 1) {
    const fade = index / Math.max(1, points.length - 1);
    const from = points[index - 1];
    const to = points[index];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    ctx.globalAlpha = fade * 0.74;
    ctx.strokeStyle = axisRgba(overlayStyle.colors.ball, 0.92);
    ctx.lineWidth = 2 + fade * 5;
    ctx.shadowBlur = 10 + fade * 14;
    ctx.shadowColor = axisRgba(overlayStyle.colors.ball, 0.7);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();

    ctx.globalAlpha = fade * 0.38;
    ctx.strokeStyle = axisRgba(overlayStyle.trail.highlightColor, 0.86);
    ctx.lineWidth = 1 + fade * 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = axisRgba(overlayStyle.trail.highlightColor, 0.62);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderPressurePulse(
  ctx: CanvasRenderingContext2D,
  pulse: AxisOverlayPoint & { age?: number; kind?: "ball" | "court" | "player"; strength?: number },
) {
  const age = Math.max(0, Math.min(1, pulse.age ?? 0));
  const strength = pulse.strength ?? 1;
  const alpha = (1 - age) * 0.42 * strength;
  const radius = 12 + age * 72 * strength;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = pulse.kind === "player" ? axisRgba(overlayStyle.colors.white, 0.85) : axisRgba(overlayStyle.colors.lime, 0.9);
  ctx.lineWidth = 2;
  ctx.shadowBlur = overlayStyle.glow.pulseShadowBlur;
  ctx.shadowColor = pulse.kind === "player" ? axisRgba(overlayStyle.colors.white, 0.5) : axisRgba(overlayStyle.colors.lime, 0.72);
  ctx.beginPath();
  ctx.ellipse(pulse.x, pulse.y + 5, radius, radius * 0.36, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBallGlow(
  ctx: CanvasRenderingContext2D,
  ball: AxisOverlayBall,
  coordinateSpace: AxisOverlayCoordinateSpace,
  mapping: AxisOverlayMapping,
  options: AxisOverlayRenderOptions,
) {
  const point = mapOverlayPoint(ball, coordinateSpace, mapping, options);
  const confidence = confidenceValue(ball.confidence);

  ctx.save();
  ctx.globalAlpha = Math.max(0.3, confidence * 0.78);
  ctx.shadowColor = axisRgba(overlayStyle.trail.highlightColor, 1);
  ctx.shadowBlur = overlayStyle.glow.ballShadowBlur;
  ctx.fillStyle = axisRgba(overlayStyle.trail.highlightColor, 0.3);
  ctx.beginPath();
  ctx.arc(point.x, point.y, overlayStyle.glow.ballBloomRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.max(0.76, confidence);
  ctx.shadowBlur = 18;
  ctx.fillStyle = axisRgba(overlayStyle.trail.highlightColor, 1);
  ctx.beginPath();
  ctx.arc(point.x, point.y, overlayStyle.glow.ballCoreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPressurePulses(ctx: CanvasRenderingContext2D, state: AxisOverlayEngineState, now: number) {
  state.pulses = state.pulses.filter((pulse) => now - pulse.createdAt <= pulseLifeMs);

  for (const pulse of state.pulses) {
    const age = Math.max(0, Math.min(1, (now - pulse.createdAt) / pulseLifeMs));
    renderPressurePulse(ctx, { age, kind: pulse.kind, strength: pulse.strength, x: pulse.x, y: pulse.y });
  }
}

function drawCourtEffects(ctx: CanvasRenderingContext2D, width: number, height: number, now: number) {
  const sweep = ((now / 2200) % 1) * height;
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = axisRgba(overlayStyle.colors.lime, 0.42);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, sweep);
  ctx.lineTo(width, sweep);
  ctx.stroke();

  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = axisRgba(overlayStyle.colors.white, 0.35);
  for (let x = width / 4; x < width; x += width / 4) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.restore();
}

function maybeAddBallPulse(
  state: AxisOverlayEngineState,
  point: { x: number; y: number },
  ball: AxisOverlayBall & { timestamp: number },
  now: number,
) {
  const previous = state.lastBall;
  if (!previous) return;
  const distance = Math.hypot(ball.x - previous.x, ball.y - previous.y);
  const elapsed = Math.max(0.001, ball.timestamp - previous.timestamp);
  const speed = distance / elapsed;
  if (speed < movementSpikeDistance) return;
  state.pulses.push({ createdAt: now, kind: "ball", strength: Math.min(1.25, speed / 180), x: point.x, y: point.y });
}

function maybeAddPlayerPulse(
  state: AxisOverlayEngineState,
  player: AxisOverlayPlayer,
  point: { x: number; y: number },
  timestamp: number,
  now: number,
) {
  const previous = state.lastPlayers.get(player.id);
  if (!previous) return;
  const distance = Math.hypot(player.x - previous.x, player.y - previous.y);
  const elapsed = Math.max(0.001, timestamp - previous.timestamp);
  const speed = distance / elapsed;
  if (speed < movementSpikeDistance * 1.35) return;
  state.pulses.push({ createdAt: now, kind: "player", strength: Math.min(1, speed / 220), x: point.x, y: point.y });
}

function normalizeBallInput(ball: AxisOverlayFrame["ball"], timestamp: number) {
  const balls = Array.isArray(ball) ? ball : ball ? [ball] : [];
  return balls
    .map((point) => ({ ...point, timestamp: point.timestamp ?? timestamp }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function nearestBallWindow(ballTrack: Array<AxisOverlayBall & { timestamp: number }>, timestamp: number) {
  return ballTrack.filter((point) => point.timestamp <= timestamp && timestamp - point.timestamp <= 1.25);
}

function nearestPlayers(frames: AxisOverlayFrame[], timestamp: number) {
  let best: AxisOverlayFrame | null = null;
  for (const frame of frames) {
    const distance = Math.abs(frame.timestamp - timestamp);
    if (!best || distance < Math.abs(best.timestamp - timestamp)) best = frame;
  }
  return best?.players ?? [];
}

function trimBallHistory(state: AxisOverlayEngineState, maxBallHistory: number) {
  if (state.ballHistory.length <= maxBallHistory) return;
  state.ballHistory.splice(0, state.ballHistory.length - maxBallHistory);
}

function mapOverlayPoint(
  point: Pick<AxisOverlayPlayer | AxisOverlayBall, "x" | "y">,
  coordinateSpace: AxisOverlayCoordinateSpace,
  mapping: AxisOverlayMapping,
  options: AxisOverlayRenderOptions,
) {
  if (coordinateSpace === "screen") return { x: point.x, y: point.y };
  const sourceX = coordinateSpace === "normalized" ? point.x * options.sourceWidth : point.x;
  const sourceY = coordinateSpace === "normalized" ? point.y * options.sourceHeight : point.y;
  return {
    x: mapping.offsetX + sourceX * mapping.scale,
    y: mapping.offsetY + sourceY * mapping.scale,
  };
}

function getOverlayMapping(sourceWidth: number, sourceHeight: number, canvasWidth: number, canvasHeight: number, fit: "contain" | "cover" | "screen") {
  if (fit === "screen") return { offsetX: 0, offsetY: 0, scale: 1 };
  const safeSourceWidth = sourceWidth || canvasWidth || 1;
  const safeSourceHeight = sourceHeight || canvasHeight || 1;
  const scale =
    fit === "cover"
      ? Math.max(canvasWidth / safeSourceWidth, canvasHeight / safeSourceHeight)
      : Math.min(canvasWidth / safeSourceWidth, canvasHeight / safeSourceHeight);
  const drawWidth = safeSourceWidth * scale;
  const drawHeight = safeSourceHeight * scale;
  return {
    offsetX: (canvasWidth - drawWidth) / 2,
    offsetY: (canvasHeight - drawHeight) / 2,
    scale,
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function confidenceValue(confidence: number | undefined) {
  if (confidence === undefined) return 1;
  return confidence > 1 ? confidence / 100 : confidence;
}
