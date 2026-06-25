import type { AxisInsight, WorkoutReport } from "./types";

export type CueRuleInput = Pick<
  WorkoutReport,
  | "bestStreak"
  | "fatigueTrend"
  | "firstHalfSuccessRate"
  | "longestDrought"
  | "pacePerMinute"
  | "runId"
  | "secondHalfSuccessRate"
  | "successRate"
>;

export function getBestStreakCue(input: CueRuleInput) {
  if (input.bestStreak < 4) return null;
  return `Best streak: ${input.bestStreak}. Keep the same trigger and repeat it under fatigue.`;
}

export function getMissFailClusterCue(input: CueRuleInput) {
  if (input.longestDrought < 3) return null;
  return `Miss/fail cluster: ${input.longestDrought} in a row. Slow the next block down and reset the cue.`;
}

export function getPaceUpAccuracyDownCue(current: CueRuleInput, previous?: CueRuleInput | null) {
  if (!previous) return null;
  const paceUp = current.pacePerMinute > previous.pacePerMinute;
  const accuracyDown = current.successRate < previous.successRate;
  return paceUp && accuracyDown ? "Pace went up, but accuracy dropped. Keep speed only if form stays clean." : null;
}

export function getFadingLateCue(input: CueRuleInput) {
  if (input.fatigueTrend !== "fading") return null;
  return "Fading late. Repeat the routine and protect the final block.";
}

export function getBlockImprovingCue(input: CueRuleInput) {
  if (input.secondHalfSuccessRate <= input.firstHalfSuccessRate) return null;
  return "Block trend improved. Keep the same structure and start the next session with that rhythm.";
}

export function getNoClearCue() {
  return "No clear cue. Repeat the routine once more and look for a stronger pattern.";
}

export function getDeterministicCue(current: CueRuleInput, previous?: CueRuleInput | null) {
  return (
    getPaceUpAccuracyDownCue(current, previous) ??
    getFadingLateCue(current) ??
    getMissFailClusterCue(current) ??
    getBestStreakCue(current) ??
    getBlockImprovingCue(current) ??
    getNoClearCue()
  );
}

export function createAxisInsightFromCue(report: WorkoutReport, previous?: WorkoutReport | null): AxisInsight {
  return {
    cueRulesVersion: "axis-routine-cue-rules-v0",
    insightId: `${report.reportId}-cue`,
    promptVersion: "none",
    reportId: report.reportId,
    runId: report.runId,
    schemaVersion: "axis-routine-v0",
    summary: getDeterministicCue(report, previous),
  };
}
