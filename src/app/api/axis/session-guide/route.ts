import { NextResponse } from "next/server";

type SessionGuideRequest = {
  currentBlock?: {
    instruction?: string;
    name?: string;
    type?: string;
  };
  metricsSummary?: {
    bestStreak?: number;
    currentDrought?: number;
    currentStreak?: number;
    pacePerMinute?: number;
    successRate?: number | null;
    totalReps?: number;
  };
};

export async function POST(request: Request) {
  let body: SessionGuideRequest;

  try {
    body = (await request.json()) as SessionGuideRequest;
  } catch {
    return NextResponse.json({ error: "Invalid session guide request." }, { status: 400 });
  }

  const blockName = body.currentBlock?.name ?? "Current block";
  const metrics = body.metricsSummary ?? {};
  const warning =
    (metrics.currentDrought ?? 0) >= 2
      ? "Drought is building. Reset before the next rep."
      : metrics.successRate !== null && metrics.successRate !== undefined && metrics.successRate < 55 && (metrics.totalReps ?? 0) >= 5
        ? "Accuracy is slipping. Slow the pace and clean it up."
        : "";

  return NextResponse.json({
    blockInstruction: body.currentBlock?.instruction || getFallbackInstruction(blockName),
    coachingCue: warning || "Keep building clean reps.",
    nextAction: getNextAction(blockName),
    warning,
  });
}

function getFallbackInstruction(blockName: string) {
  const lowerName = blockName.toLowerCase();
  if (lowerName.includes("warmup")) return "Get loose and prepare for the benchmark.";
  if (lowerName.includes("starting benchmark")) return "Set the baseline. Do not chase perfection.";
  if (lowerName.includes("final benchmark")) return "Retest the same skill and beat the baseline.";
  if (lowerName.includes("report")) return "Wrap the session and prepare the report.";
  return "Train the focus. Keep the pace honest.";
}

function getNextAction(blockName: string) {
  return blockName.toLowerCase().includes("report") ? "Finish the routine when ready." : "Log the next clean rep.";
}
