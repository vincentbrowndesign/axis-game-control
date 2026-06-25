import type { FatigueTrend, PreviousComparison, RepEvent, WorkoutReport } from "./types";

export function getTotalReps(reps: RepEvent[]) {
  return reps.length;
}

export function getSuccesses(reps: RepEvent[]) {
  return reps.filter(isSuccessfulRep).length;
}

export function getMissesOrFails(reps: RepEvent[]) {
  return reps.filter((rep) => rep.result === "miss" || rep.result === "fail").length;
}

export function getSuccessRate(reps: RepEvent[]) {
  if (reps.length === 0) return 0;
  return roundRate(getSuccesses(reps) / reps.length);
}

export function getPacePerMinute(totalReps: number, durationSeconds: number) {
  if (durationSeconds <= 0) return 0;
  return roundNumber(totalReps / (durationSeconds / 60));
}

export function getCurrentStreak(reps: RepEvent[]) {
  let streak = 0;
  for (let index = reps.length - 1; index >= 0; index -= 1) {
    if (!isSuccessfulRep(reps[index])) break;
    streak += 1;
  }
  return streak;
}

export function getBestStreak(reps: RepEvent[]) {
  let current = 0;
  let best = 0;
  reps.forEach((rep) => {
    current = isSuccessfulRep(rep) ? current + 1 : 0;
    best = Math.max(best, current);
  });
  return best;
}

export function getCurrentDrought(reps: RepEvent[]) {
  let drought = 0;
  for (let index = reps.length - 1; index >= 0; index -= 1) {
    if (isSuccessfulRep(reps[index])) break;
    drought += 1;
  }
  return drought;
}

export function getLongestDrought(reps: RepEvent[]) {
  let current = 0;
  let longest = 0;
  reps.forEach((rep) => {
    current = isSuccessfulRep(rep) ? 0 : current + 1;
    longest = Math.max(longest, current);
  });
  return longest;
}

export function getFirstHalfSuccessRate(reps: RepEvent[], routineLengthSeconds: number) {
  return getHalfSuccessRate(reps, routineLengthSeconds, "first");
}

export function getSecondHalfSuccessRate(reps: RepEvent[], routineLengthSeconds: number) {
  return getHalfSuccessRate(reps, routineLengthSeconds, "second");
}

export function getFatigueTrend(reps: RepEvent[], routineLengthSeconds: number): FatigueTrend {
  if (reps.length < 4 || routineLengthSeconds <= 0) return "insufficient_data";
  const firstHalf = getFirstHalfSuccessRate(reps, routineLengthSeconds);
  const secondHalf = getSecondHalfSuccessRate(reps, routineLengthSeconds);
  const difference = secondHalf - firstHalf;
  if (difference >= 0.08) return "improving";
  if (difference <= -0.08) return "fading";
  return "steady";
}

export function getBlockComparison(reps: RepEvent[]) {
  const blockIds = Array.from(new Set(reps.map((rep) => rep.blockId)));
  return blockIds.map((blockId) => {
    const blockReps = reps.filter((rep) => rep.blockId === blockId);
    return {
      blockId,
      successRate: getSuccessRate(blockReps),
      totalReps: getTotalReps(blockReps),
    };
  });
}

export function getPreviousSessionComparison(current: WorkoutReport, previous?: WorkoutReport | null): PreviousComparison | null {
  if (!previous) return null;
  return {
    previousRunId: previous.runId,
    successRateChange: roundRate(current.successRate - previous.successRate),
    totalRepsChange: current.totalReps - previous.totalReps,
  };
}

export function getNextSessionRecommendation(report: Pick<WorkoutReport, "fatigueTrend" | "successRate" | "bestStreak">) {
  if (report.fatigueTrend === "fading") return "Repeat the routine and reduce pace in the final block.";
  if (report.successRate < 0.6) return "Keep the same routine and aim for cleaner reps before adding difficulty.";
  if (report.bestStreak >= 5) return "Raise the benchmark slightly next session.";
  return "Repeat the routine and try to beat today's report.";
}

function getHalfSuccessRate(reps: RepEvent[], routineLengthSeconds: number, half: "first" | "second") {
  if (routineLengthSeconds <= 0) return 0;
  const midpoint = routineLengthSeconds / 2;
  const filteredReps = reps.filter((rep) =>
    half === "first" ? rep.secondsIntoSession < midpoint : rep.secondsIntoSession >= midpoint,
  );
  return getSuccessRate(filteredReps);
}

function isSuccessfulRep(rep: RepEvent) {
  return rep.result === "success";
}

function roundRate(value: number) {
  return roundNumber(value);
}

function roundNumber(value: number) {
  return Math.round(value * 1000) / 1000;
}
