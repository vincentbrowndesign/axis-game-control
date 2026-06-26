import { NextResponse } from "next/server";

type WatchFrame = {
  imageDataUrl?: string;
  timestampSeconds: number;
};

type WatchRequest = {
  frames?: WatchFrame[];
  query?: string;
};

export async function POST(request: Request) {
  let body: WatchRequest;

  try {
    body = (await request.json()) as WatchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid watch request." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const frames = Array.isArray(body.frames) ? body.frames.slice(0, 60) : [];

  if (!query || frames.length === 0) {
    return NextResponse.json({ error: "Add a clip and query before watching." }, { status: 400 });
  }

  return NextResponse.json({
    candidates: createCandidateMoments(query, frames),
    frameCount: frames.length,
  });
}

function createCandidateMoments(query: string, frames: WatchFrame[]) {
  const normalized = query.toLowerCase();
  const duration = frames[frames.length - 1]?.timestampSeconds ?? frames.length;
  const timestamps = pickCandidateTimes(duration, frames);

  if (normalized.includes("spacing") || normalized.includes("delta") || normalized.includes("offense")) {
    return timestamps.map((timestampSeconds, index) => ({
      id: `candidate-${index + 1}`,
      note:
        index === 0
          ? "Check spacing before the action starts. Look for players standing on the same line."
          : index === 1
            ? "Review the timing of the second option. The advantage may be late."
            : "Check the reset after the action. This may be the cleanest correction point.",
      timestampSeconds,
      title: index === 0 ? "Spacing setup" : index === 1 ? "Timing read" : "Reset moment",
    }));
  }

  if (normalized.includes("transition")) {
    return timestamps.map((timestampSeconds, index) => ({
      id: `candidate-${index + 1}`,
      note: "Review lane spacing and early decisions before the defense gets set.",
      timestampSeconds,
      title: index === 0 ? "Early lane spacing" : "Transition decision",
    }));
  }

  return timestamps.map((timestampSeconds, index) => ({
    id: `candidate-${index + 1}`,
    note: "Review this stretch as a possible coachable moment.",
    timestampSeconds,
    title: index === 0 ? "Candidate moment" : `Candidate moment ${index + 1}`,
  }));
}

function pickCandidateTimes(duration: number, frames: WatchFrame[]) {
  if (frames.length <= 3) return frames.map((frame) => frame.timestampSeconds);
  const safeDuration = Math.max(duration, 1);
  return [safeDuration * 0.25, safeDuration * 0.5, safeDuration * 0.75].map((time) => Number(time.toFixed(1)));
}
