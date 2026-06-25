import { NextResponse } from "next/server";

type ReportRequest = {
  elapsedSeconds?: number;
  focus?: string;
  playerOrGroup?: string;
  metrics?: {
    bestStreak?: number;
    longestDrought?: number;
    pacePerMinute?: number;
    successRate?: number | null;
    totalReps?: number;
  };
  startingBenchmarkResult?: number;
  finalBenchmarkResult?: number;
};

export async function POST(request: Request) {
  let body: ReportRequest;

  try {
    body = (await request.json()) as ReportRequest;
  } catch {
    return NextResponse.json({ error: "Invalid report request." }, { status: 400 });
  }

  const player = body.playerOrGroup?.trim() || "Player";
  const focus = body.focus?.trim() || "the focus";
  const totalReps = body.metrics?.totalReps ?? 0;
  const successRate = body.metrics?.successRate;
  const pace = body.metrics?.pacePerMinute ?? 0;
  const start = body.startingBenchmarkResult ?? 0;
  const final = body.finalBenchmarkResult ?? 0;
  const change = final - start;

  return NextResponse.json({
    coachNote:
      totalReps > 0
        ? `${player} logged ${totalReps} reps on ${focus}. Keep the next session tied to the same benchmark.`
        : `${player} completed the routine structure for ${focus}. Add rep logging next time for a stronger report.`,
    keyPattern:
      successRate === null || successRate === undefined
        ? `Pace finished at ${pace.toFixed(1)} reps per minute.`
        : `Success rate finished at ${Math.round(successRate)}% with ${pace.toFixed(1)} reps per minute.`,
    nextSessionRecommendation:
      change > 0
        ? "Start next time by trying to beat the final benchmark."
        : "Start next time by cleaning up the baseline before adding speed.",
    playerMessage:
      change > 0 ? "You improved from start to finish. Bring that same pace back next session." : "You built a baseline. Next session is about cleaner reps.",
    progressNote: `Benchmark change: ${change >= 0 ? "+" : ""}${change}.`,
    summary: `${player} finished a ${focus} routine with ${totalReps} logged reps.`,
  });
}
