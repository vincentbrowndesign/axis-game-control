export type PlayerTrack = {
  confidence?: number;
  id: string;
  x: number;
  y: number;
};

export type BallTrack = {
  confidence?: number;
  x: number;
  y: number;
};

export type OverlayFrame = {
  ball?: BallTrack;
  players: PlayerTrack[];
  timestamp: number;
};

export type AxisCvOverlayOptions = {
  confidenceThreshold?: number;
  fit?: "contain" | "cover";
  maxBallHistory?: number;
  pulseSpeed?: number;
  videoHeight: number;
  videoWidth: number;
};

export type AxisCvOverlayState = {
  ballHistory: Array<BallTrack & { timestamp: number }>;
  lastBall?: BallTrack & { timestamp: number };
  lastPlayers: Map<string, PlayerTrack & { timestamp: number }>;
  pulses: AxisFloorPulse[];
};

type AxisFloorPulse = {
  createdAt: number;
  strength: number;
  x: number;
  y: number;
};

type AxisMappedPoint = {
  x: number;
  y: number;
};

const defaultConfidenceThreshold = 0.35;
const defaultMaxBallHistory = 28;
const pulseLifeMs = 760;
const movementSpikeDistance = 34;

export function createAxisCvOverlayState(): AxisCvOverlayState {
  return {
    ballHistory: [],
    lastPlayers: new Map(),
    pulses: [],
  };
}

export function drawAxisCvOverlay(
  ctx: CanvasRenderingContext2D,
  frame: OverlayFrame,
  state: AxisCvOverlayState,
  canvasWidth: number,
  canvasHeight: number,
  options: AxisCvOverlayOptions,
) {
  const threshold = options.confidenceThreshold ?? defaultConfidenceThreshold;
  const now = performance.now();
  const mapping = getVideoMapping(options.videoWidth, options.videoHeight, canvasWidth, canvasHeight, options.fit ?? "contain");

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const ball = frame.ball && confidenceValue(frame.ball.confidence) >= threshold ? frame.ball : undefined;
  if (ball) {
    const mappedBall = mapOverlayPoint(ball, mapping, options);
    maybeAddBallPulse(state, mappedBall, ball, frame.timestamp, now);
    state.ballHistory.push({ ...ball, timestamp: frame.timestamp });
    state.lastBall = { ...ball, timestamp: frame.timestamp };
  }

  if (state.ballHistory.length > (options.maxBallHistory ?? defaultMaxBallHistory)) {
    state.ballHistory.splice(0, state.ballHistory.length - (options.maxBallHistory ?? defaultMaxBallHistory));
  }

  for (const player of frame.players) {
    if (confidenceValue(player.confidence) < threshold) continue;
    const mappedPlayer = mapOverlayPoint(player, mapping, options);
    maybeAddPlayerPulse(state, player, mappedPlayer, frame.timestamp, now);
    state.lastPlayers.set(player.id, { ...player, timestamp: frame.timestamp });
  }

  drawFloorPulses(ctx, state, now);
  drawBallTrail(ctx, state.ballHistory, frame.timestamp, mapping, options);
  drawPlayers(ctx, frame.players, threshold, mapping, options);
  if (ball) drawBallGlow(ctx, ball, mapping, options);
}

export function resetAxisCvOverlayState(state: AxisCvOverlayState) {
  state.ballHistory = [];
  state.lastBall = undefined;
  state.lastPlayers.clear();
  state.pulses = [];
}

function drawPlayers(
  ctx: CanvasRenderingContext2D,
  players: PlayerTrack[],
  threshold: number,
  mapping: ReturnType<typeof getVideoMapping>,
  options: AxisCvOverlayOptions,
) {
  for (const player of players) {
    if (confidenceValue(player.confidence) < threshold) continue;
    const point = mapOverlayPoint(player, mapping, options);

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = "rgba(245,248,239,0.95)";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(245,248,239,0.45)";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 4, 21, 8, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = 0.22;
    ctx.fillStyle = "rgba(245,248,239,0.7)";
    ctx.beginPath();
    ctx.ellipse(point.x, point.y + 4, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawBallTrail(
  ctx: CanvasRenderingContext2D,
  history: Array<BallTrack & { timestamp: number }>,
  timestamp: number,
  mapping: ReturnType<typeof getVideoMapping>,
  options: AxisCvOverlayOptions,
) {
  const recent = history.filter((point) => Math.abs(timestamp - point.timestamp) <= 1.2);
  if (recent.length < 2) return;

  const mapped = recent.map((point) => mapOverlayPoint(point, mapping, options));

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (let index = 1; index < mapped.length; index += 1) {
    const fade = index / Math.max(1, mapped.length - 1);
    const from = mapped[index - 1];
    const to = mapped[index];
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;

    ctx.globalAlpha = fade * 0.74;
    ctx.strokeStyle = "rgba(174,255,78,0.96)";
    ctx.lineWidth = 3 + fade * 5;
    ctx.shadowBlur = 12 + fade * 20;
    ctx.shadowColor = "rgba(174,255,78,0.9)";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(midX, midY, to.x, to.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawBallGlow(
  ctx: CanvasRenderingContext2D,
  ball: BallTrack,
  mapping: ReturnType<typeof getVideoMapping>,
  options: AxisCvOverlayOptions,
) {
  const point = mapOverlayPoint(ball, mapping, options);
  const confidence = confidenceValue(ball.confidence);

  ctx.save();
  ctx.globalAlpha = Math.max(0.3, confidence * 0.78);
  ctx.shadowColor = "rgba(174,255,78,1)";
  ctx.shadowBlur = 46;
  ctx.fillStyle = "rgba(174,255,78,0.3)";
  ctx.beginPath();
  ctx.arc(point.x, point.y, 26, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = Math.max(0.76, confidence);
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(174,255,78,1)";
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFloorPulses(ctx: CanvasRenderingContext2D, state: AxisCvOverlayState, now: number) {
  state.pulses = state.pulses.filter((pulse) => now - pulse.createdAt <= pulseLifeMs);

  for (const pulse of state.pulses) {
    const age = Math.max(0, Math.min(1, (now - pulse.createdAt) / pulseLifeMs));
    const alpha = (1 - age) * 0.42 * pulse.strength;
    const radius = 12 + age * 72 * pulse.strength;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(174,255,78,0.9)";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 22;
    ctx.shadowColor = "rgba(174,255,78,0.72)";
    ctx.beginPath();
    ctx.ellipse(pulse.x, pulse.y + 4, radius, radius * 0.36, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function maybeAddBallPulse(
  state: AxisCvOverlayState,
  point: AxisMappedPoint,
  ball: BallTrack,
  timestamp: number,
  now: number,
) {
  const previous = state.lastBall;
  if (!previous) return;
  const distance = Math.hypot(ball.x - previous.x, ball.y - previous.y);
  const elapsed = Math.max(0.001, timestamp - previous.timestamp);
  const speed = distance / elapsed;
  if (speed < movementSpikeDistance) return;
  state.pulses.push({ createdAt: now, strength: Math.min(1.25, speed / 180), x: point.x, y: point.y });
}

function maybeAddPlayerPulse(
  state: AxisCvOverlayState,
  player: PlayerTrack,
  point: AxisMappedPoint,
  timestamp: number,
  now: number,
) {
  const previous = state.lastPlayers.get(player.id);
  if (!previous) return;
  const distance = Math.hypot(player.x - previous.x, player.y - previous.y);
  const elapsed = Math.max(0.001, timestamp - previous.timestamp);
  const speed = distance / elapsed;
  if (speed < movementSpikeDistance * 1.35) return;
  state.pulses.push({ createdAt: now, strength: Math.min(1, speed / 220), x: point.x, y: point.y });
}

function mapOverlayPoint(
  point: Pick<PlayerTrack | BallTrack, "x" | "y">,
  mapping: ReturnType<typeof getVideoMapping>,
  options: AxisCvOverlayOptions,
) {
  const videoX = Math.abs(point.x) <= 1 ? point.x * options.videoWidth : point.x;
  const videoY = Math.abs(point.y) <= 1 ? point.y * options.videoHeight : point.y;
  return {
    x: mapping.offsetX + videoX * mapping.scale,
    y: mapping.offsetY + videoY * mapping.scale,
  };
}

function getVideoMapping(videoWidth: number, videoHeight: number, canvasWidth: number, canvasHeight: number, fit: "contain" | "cover") {
  const safeVideoWidth = videoWidth || canvasWidth || 1;
  const safeVideoHeight = videoHeight || canvasHeight || 1;
  const scale =
    fit === "cover"
      ? Math.max(canvasWidth / safeVideoWidth, canvasHeight / safeVideoHeight)
      : Math.min(canvasWidth / safeVideoWidth, canvasHeight / safeVideoHeight);
  const drawWidth = safeVideoWidth * scale;
  const drawHeight = safeVideoHeight * scale;

  return {
    offsetX: (canvasWidth - drawWidth) / 2,
    offsetY: (canvasHeight - drawHeight) / 2,
    scale,
  };
}

function confidenceValue(confidence: number | undefined) {
  if (confidence === undefined) return 1;
  return confidence > 1 ? confidence / 100 : confidence;
}
