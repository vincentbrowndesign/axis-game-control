# Axis Routine Data Model

Status: CONTRACT

The Axis Routine Loop stores enough structure to turn a training session into a repeatable benchmark, rep timeline, and Workout Report.

## Version Fields

Records that calculate, explain, or generate output must carry version fields:

- `schemaVersion`
- `calculationVersion`
- `cueRulesVersion`
- `promptVersion` where applicable

## Core Records

### RoutineTemplate

Defines the repeatable routine:

- `templateId`
- `playerOrGroup`
- `focus`
- `routineLengthSeconds`
- `scoringMethod`
- `benchmarkName`
- `blockStructure`
- `constraints`
- `createdAt`
- `updatedAt`

### RoutineRun

Represents one completed or in-progress execution:

- `runId`
- `templateId`
- `startedAt`
- `finishedAt`
- `status`
- `totalDurationSeconds`

### RoutineBlock

Breaks the run into planned training sections:

- `blockId`
- `runId`
- `name`
- `type`
- `order`
- `plannedDurationSeconds`
- `startedAt`
- `finishedAt`

### RepEvent

Rep timeline source of truth:

- `repId`
- `runId`
- `blockId`
- `repNumber`
- `result`
- `timestamp`
- `secondsIntoSession`
- `secondsIntoBlock`
- `currentStreakAfterRep`
- `currentDroughtAfterRep`

### MetricsSnapshot

Calculated summary at a point in time:

- total reps
- successes
- misses or fails
- success rate
- pace per minute
- best streak
- longest drought
- first half success rate
- second half success rate
- fatigue trend

### WorkoutReport

Market-facing deliverable:

- `reportId`
- `runId`
- `templateId`
- `playerOrGroup`
- `focus`
- `scoringMethod`
- `routineLengthSeconds`
- `totalReps`
- `successes`
- `missesOrFails`
- `successRate`
- `pacePerMinute`
- `bestStreak`
- `longestDrought`
- `firstHalfSuccessRate`
- `secondHalfSuccessRate`
- `fatigueTrend`
- `startingBenchmarkResult`
- `finalBenchmarkResult`
- `improvementAmount`
- `improvementPercentage`
- `previousComparison`
- `nextSessionRecommendation`
- `createdAt`

### AxisInsight

Optional explanatory layer. It can help the user understand the report, but it must not overwrite calculated results.

### EvidenceAttachment

Designed for later video or image support:

- `evidenceId`
- `runId`
- optional `blockId`
- optional `repId`
- `type`
- `source`
- `startedAt`
- `durationSeconds`
- optional `localUrl`
- optional `storageUrl`
- `createdAt`

### VisionEvent

Designed for later reviewed vision output:

- `visionEventId`
- `evidenceId`
- `runId`
- optional `blockId`
- optional `repId`
- `eventType`
- `confidence`
- `needsReview`
- `timestamp`
- optional `videoTimeSeconds`
- `createdAt`

## Rules

- Calculated fields come from deterministic calculations first.
- AI insight is optional and secondary.
- Video and vision evidence attach later; they do not define the routine.
- No raw JSON is user-facing.
- No persistence is required by this contract yet.
