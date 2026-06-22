import type { AxisPoseFrame, AxisPoseLandmark } from "./axis-pose-detector";

export type AxisJumpPhase = "idle" | "standing" | "loading" | "airborne" | "landed";

export type AxisJumpSample = {
  frameId: number;
  timestamp: number;
  hipY: number;
  ankleY: number;
  shoulderY: number;
  confidence: number;
};

export type AxisJumpEvent = {
  rep: number;
  timestamp: number;
  phase: "landed";
};

export type AxisJumpRopeState = {
  reps: number;
  streak: number;
  phase: AxisJumpPhase;
  jumpsPerMinute: number;
  rhythmScore: number;
  confidence: number;
  lastRepAt?: number;
  samples: AxisJumpSample[];
  events: AxisJumpEvent[];
};

type CounterInternals = AxisJumpRopeState & {
  baselineHipY?: number;
  wasAirborneAt?: number;
};

const maxSamples = 120;
const minimumConfidence = 0.48;
const minimumRepGapMs = 260;
const streakGapMs = 2_500;

function findLandmark(frame: AxisPoseFrame, name: string) {
  return frame.landmarks.find((landmark) => landmark.name === name);
}

function midpoint(a?: AxisPoseLandmark, b?: AxisPoseLandmark) {
  if (!a && !b) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateJumpsPerMinute(events: AxisJumpEvent[], timestamp: number) {
  const windowStart = timestamp - 30_000;
  const recent = events.filter((event) => event.timestamp >= windowStart);
  return Math.round(recent.length * 2);
}

function calculateRhythmScore(events: AxisJumpEvent[]) {
  const recent = events.slice(-6);
  if (recent.length < 3) return recent.length === 0 ? 0 : 45;

  const gaps = recent.slice(1).map((event, index) => event.timestamp - recent[index].timestamp);
  const avg = average(gaps);
  const variance = average(gaps.map((gap) => Math.abs(gap - avg)));
  const normalized = Math.max(0, 100 - (variance / Math.max(avg, 1)) * 160);
  return Math.round(Math.min(100, normalized));
}

function cloneState(state: CounterInternals): AxisJumpRopeState {
  return {
    confidence: state.confidence,
    events: [...state.events],
    jumpsPerMinute: state.jumpsPerMinute,
    lastRepAt: state.lastRepAt,
    phase: state.phase,
    reps: state.reps,
    rhythmScore: state.rhythmScore,
    samples: [...state.samples],
    streak: state.streak,
  };
}

function readSample(frame: AxisPoseFrame): AxisJumpSample | null {
  const hip = midpoint(findLandmark(frame, "left_hip"), findLandmark(frame, "right_hip"));
  const ankle = midpoint(findLandmark(frame, "left_ankle"), findLandmark(frame, "right_ankle"));
  const shoulder = midpoint(
    findLandmark(frame, "left_shoulder"),
    findLandmark(frame, "right_shoulder"),
  );

  if (!hip || !ankle || !shoulder) return null;

  return {
    ankleY: ankle.y,
    confidence: frame.confidence,
    frameId: frame.frameId,
    hipY: hip.y,
    shoulderY: shoulder.y,
    timestamp: frame.timestamp,
  };
}

export function createAxisJumpRopeCounter() {
  let state: CounterInternals = {
    confidence: 0,
    events: [],
    jumpsPerMinute: 0,
    phase: "idle",
    reps: 0,
    rhythmScore: 0,
    samples: [],
    streak: 0,
  };

  function reset() {
    state = {
      confidence: 0,
      events: [],
      jumpsPerMinute: 0,
      phase: "idle",
      reps: 0,
      rhythmScore: 0,
      samples: [],
      streak: 0,
    };
    return cloneState(state);
  }

  function update(frame: AxisPoseFrame | null, timestamp: number) {
    if (!frame || frame.confidence < minimumConfidence) {
      state = {
        ...state,
        confidence: frame?.confidence ?? 0,
        phase: state.phase === "idle" ? "idle" : state.phase,
      };
      return cloneState(state);
    }

    const sample = readSample(frame);
    if (!sample) return cloneState(state);

    const samples = [...state.samples, sample].slice(-maxSamples);
    const recent = samples.slice(-8);
    const smoothedHipY = average(recent.map((item) => item.hipY));
    const baselineSeed = samples.slice(-40).map((item) => item.hipY);
    const currentBaseline =
      state.baselineHipY === undefined
        ? smoothedHipY
        : state.baselineHipY * 0.96 + average(baselineSeed) * 0.04;

    const bodySpan = Math.max(0.12, sample.ankleY - sample.shoulderY);
    const loadThreshold = bodySpan * 0.035;
    const airThreshold = bodySpan * 0.028;
    const landedThreshold = bodySpan * 0.016;
    let phase: AxisJumpPhase = state.phase === "idle" ? "standing" : state.phase;

    if (phase === "standing" || phase === "landed") {
      if (smoothedHipY > currentBaseline + loadThreshold) {
        phase = "loading";
      }
    } else if (phase === "loading") {
      if (smoothedHipY < currentBaseline - airThreshold) {
        phase = "airborne";
        state.wasAirborneAt = timestamp;
      }
    } else if (phase === "airborne") {
      if (smoothedHipY >= currentBaseline - landedThreshold) {
        const lastRepAt = state.lastRepAt ?? 0;
        const hasDebounced = timestamp - lastRepAt >= minimumRepGapMs;
        const wasAirborneLongEnough = !state.wasAirborneAt || timestamp - state.wasAirborneAt >= 90;

        if (hasDebounced && wasAirborneLongEnough) {
          const reps = state.reps + 1;
          const event: AxisJumpEvent = { phase: "landed", rep: reps, timestamp };
          const priorRepAt = state.lastRepAt;
          const streak =
            priorRepAt && timestamp - priorRepAt <= streakGapMs ? state.streak + 1 : 1;
          const events = [...state.events, event];

          state = {
            ...state,
            baselineHipY: currentBaseline,
            confidence: frame.confidence,
            events,
            jumpsPerMinute: calculateJumpsPerMinute(events, timestamp),
            lastRepAt: timestamp,
            phase: "landed",
            reps,
            rhythmScore: calculateRhythmScore(events),
            samples,
            streak,
          };
          return cloneState(state);
        }

        phase = "landed";
      }
    }

    state = {
      ...state,
      baselineHipY: currentBaseline,
      confidence: frame.confidence,
      jumpsPerMinute: calculateJumpsPerMinute(state.events, timestamp),
      phase,
      rhythmScore: calculateRhythmScore(state.events),
      samples,
    };

    return cloneState(state);
  }

  return {
    getState() {
      return cloneState(state);
    },
    reset,
    update,
  };
}
