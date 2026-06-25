export type RoutineSchemaVersion = "axis-routine-v0";

export type RoutineCalculationVersion = "axis-routine-calculations-v0";

export type RoutineCueRulesVersion = "axis-routine-cue-rules-v0";

export type RoutinePromptVersion = "none" | "axis-routine-insight-v0";

export type RoutineScoringMethod = "make_miss" | "success_fail" | "count_only";

export type RoutineRunStatus = "planned" | "running" | "completed" | "abandoned";

export type RoutineBlockType = "benchmark" | "skill" | "conditioning" | "recovery" | "custom";

export type RepResult = "success" | "miss" | "fail" | "neutral";

export type FatigueTrend = "improving" | "steady" | "fading" | "insufficient_data";

export type EvidenceAttachmentType = "video" | "image" | "note" | "audio";

export type EvidenceAttachmentSource = "manual" | "local_camera" | "upload" | "future_vision";

export type VisionEventType =
  | "player_lock"
  | "rim_set"
  | "ball_event"
  | "shot_attempt"
  | "rep_candidate"
  | "other";

export type RoutineBlockPlan = {
  name: string;
  order: number;
  plannedDurationSeconds: number;
  type: RoutineBlockType;
};

export type RoutineTemplate = {
  benchmarkName: string;
  blockStructure: RoutineBlockPlan[];
  constraints: string[];
  createdAt: string;
  focus: string;
  playerOrGroup: string;
  routineLengthSeconds: number;
  schemaVersion: RoutineSchemaVersion;
  scoringMethod: RoutineScoringMethod;
  templateId: string;
  updatedAt: string;
};

export type RoutineRun = {
  calculationVersion: RoutineCalculationVersion;
  finishedAt: string | null;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  startedAt: string;
  status: RoutineRunStatus;
  templateId: string;
  totalDurationSeconds: number;
};

export type RoutineBlock = {
  blockId: string;
  finishedAt: string | null;
  name: string;
  order: number;
  plannedDurationSeconds: number;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  startedAt: string;
  type: RoutineBlockType;
};

export type RepEvent = {
  blockId: string;
  currentDroughtAfterRep: number;
  currentStreakAfterRep: number;
  repId: string;
  repNumber: number;
  result: RepResult;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  secondsIntoBlock: number;
  secondsIntoSession: number;
  timestamp: string;
};

export type MetricsSnapshot = {
  bestStreak: number;
  calculationVersion: RoutineCalculationVersion;
  createdAt: string;
  fatigueTrend: FatigueTrend;
  firstHalfSuccessRate: number;
  longestDrought: number;
  missesOrFails: number;
  pacePerMinute: number;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  secondHalfSuccessRate: number;
  successRate: number;
  successes: number;
  totalReps: number;
};

export type PreviousComparison = {
  previousRunId?: string;
  successRateChange: number;
  totalRepsChange: number;
};

export type WorkoutReport = {
  bestStreak: number;
  calculationVersion: RoutineCalculationVersion;
  createdAt: string;
  fatigueTrend: FatigueTrend;
  finalBenchmarkResult: number;
  firstHalfSuccessRate: number;
  focus: string;
  improvementAmount: number;
  improvementPercentage: number;
  longestDrought: number;
  missesOrFails: number;
  nextSessionRecommendation: string;
  pacePerMinute: number;
  playerOrGroup: string;
  previousComparison: PreviousComparison | null;
  reportId: string;
  routineLengthSeconds: number;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  scoringMethod: RoutineScoringMethod;
  secondHalfSuccessRate: number;
  startingBenchmarkResult: number;
  successRate: number;
  successes: number;
  templateId: string;
  totalReps: number;
};

export type AxisInsight = {
  cueRulesVersion: RoutineCueRulesVersion;
  insightId: string;
  promptVersion: RoutinePromptVersion;
  reportId: string;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  summary: string;
};

export type EvidenceAttachment = {
  blockId?: string;
  createdAt: string;
  durationSeconds: number;
  evidenceId: string;
  localUrl?: string;
  repId?: string;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  source: EvidenceAttachmentSource;
  startedAt: string;
  storageUrl?: string;
  type: EvidenceAttachmentType;
};

export type VisionEvent = {
  blockId?: string;
  confidence: number;
  createdAt: string;
  eventType: VisionEventType;
  evidenceId: string;
  needsReview: boolean;
  repId?: string;
  runId: string;
  schemaVersion: RoutineSchemaVersion;
  timestamp: string;
  videoTimeSeconds?: number;
  visionEventId: string;
};
