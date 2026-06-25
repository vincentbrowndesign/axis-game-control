import { NextResponse } from "next/server";
import type {
  AxisRoutineToolbarBlock,
  AxisRoutineToolbarSetup,
  AxisRoutineToolbarSuggestion,
} from "../../../../lib/axis/routine/toolbar-types";

type ToolbarRequest = {
  currentBlockPlan?: AxisRoutineToolbarBlock[];
  currentSetup?: Partial<AxisRoutineToolbarSetup>;
  instruction?: string;
  mode?: string;
};

export async function POST(request: Request) {
  let body: ToolbarRequest;

  try {
    body = (await request.json()) as ToolbarRequest;
  } catch {
    return NextResponse.json({ error: "Invalid toolbar request." }, { status: 400 });
  }

  if (body.mode !== "setup") {
    return NextResponse.json({ error: "Axis Toolbar only supports setup mode right now." }, { status: 400 });
  }

  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
  if (!instruction) {
    return NextResponse.json({ error: "Add a routine instruction first." }, { status: 400 });
  }

  return NextResponse.json({
    suggestion: createFallbackSuggestion(instruction, body.currentSetup, body.currentBlockPlan),
  });
}

function createFallbackSuggestion(
  instruction: string,
  currentSetup: Partial<AxisRoutineToolbarSetup> = {},
  currentBlockPlan: AxisRoutineToolbarBlock[] = [],
): AxisRoutineToolbarSuggestion {
  const normalized = instruction.toLowerCase();
  const routineLengthMinutes = inferRoutineLength(normalized, currentSetup.routineLengthMinutes);
  const scoringMethod = inferScoringMethod(normalized, currentSetup.scoringMethod);
  const focus = inferFocus(normalized, currentSetup.focus);
  const benchmarkName = inferBenchmarkName(normalized, currentSetup.benchmarkName, focus);
  const playerOrGroup = inferPlayerOrGroup(instruction, currentSetup.playerOrGroup);
  const blocks = createBlockPlan(routineLengthMinutes, focus, currentBlockPlan);

  return {
    benchmarkName,
    blocks,
    explanation: "Axis built a setup suggestion from your instruction. Review it before applying.",
    focus,
    playerOrGroup,
    routineLengthMinutes,
    scoringMethod,
  };
}

function inferRoutineLength(normalized: string, currentLength?: number) {
  if (/\b30\b/.test(normalized)) return 30;
  if (/\b45\b/.test(normalized)) return 45;
  if (/\b60\b/.test(normalized)) return 60;
  return currentLength === 30 || currentLength === 45 || currentLength === 60 ? currentLength : 60;
}

function inferScoringMethod(normalized: string, currentMethod?: AxisRoutineToolbarSetup["scoringMethod"]) {
  if (normalized.includes("timed")) return "timed_count";
  if (normalized.includes("delta") || normalized.includes("offense")) return "timed_count";
  if (normalized.includes("make miss") || normalized.includes("make/miss") || normalized.includes("shoot")) return "make_miss";
  if (normalized.includes("success") || normalized.includes("fail")) return "success_fail";
  if (normalized.includes("rep count") || normalized.includes("reps")) return "count_only";
  return currentMethod || "make_miss";
}

function inferFocus(normalized: string, currentFocus?: string) {
  if (normalized.includes("delta") || normalized.includes("offense")) return "Delta Offense";
  if (normalized.includes("speed stop")) return "Speed stop";
  if (normalized.includes("shoot")) return "Shooting";
  if (normalized.includes("skill")) return "Skill work";
  if (normalized.includes("finish")) return "Finishing";
  if (normalized.includes("handle") || normalized.includes("dribble")) return "Ball handling";
  return currentFocus?.trim() || "General skill work";
}

function inferBenchmarkName(normalized: string, currentBenchmarkName: string | undefined, focus: string) {
  if (normalized.includes("delta") || normalized.includes("offense")) return "Delta Timing";
  if (normalized.includes("speed stop")) return "Speed Stop";
  if (normalized.includes("shoot")) return "Shooting Benchmark";
  if (currentBenchmarkName?.trim()) return currentBenchmarkName.trim();
  return focus ? `${focus} Benchmark` : "Training Benchmark";
}

function inferPlayerOrGroup(instruction: string, currentPlayerOrGroup?: string) {
  const commaIndex = instruction.indexOf(",");
  if (commaIndex > 0) {
    const possibleName = instruction.slice(0, commaIndex).trim();
    if (possibleName.length > 0 && possibleName.length <= 40) return possibleName;
  }

  return currentPlayerOrGroup?.trim() || "Player";
}

function createBlockPlan(
  routineLengthMinutes: number,
  focus: string,
  currentBlockPlan: AxisRoutineToolbarBlock[],
): AxisRoutineToolbarBlock[] {
  const templates: Record<30 | 45 | 60, Array<Omit<AxisRoutineToolbarBlock, "id">>> = {
    30: [
      { name: "Warmup", order: 1, plannedDurationSeconds: 3 * 60, type: "recovery" },
      { name: "Starting Benchmark", order: 2, plannedDurationSeconds: 5 * 60, type: "benchmark" },
      { name: "Work Block 1", order: 3, plannedDurationSeconds: 7 * 60, type: "skill" },
      { name: "Work Block 2", order: 4, plannedDurationSeconds: 7 * 60, type: "skill" },
      { name: "Final Benchmark", order: 5, plannedDurationSeconds: 5 * 60, type: "benchmark" },
      { name: "Report", order: 6, plannedDurationSeconds: 3 * 60, type: "custom" },
    ],
    45: [
      { name: "Warmup", order: 1, plannedDurationSeconds: 5 * 60, type: "recovery" },
      { name: "Starting Benchmark", order: 2, plannedDurationSeconds: 6 * 60, type: "benchmark" },
      { name: "Work Block 1", order: 3, plannedDurationSeconds: 10 * 60, type: "skill" },
      { name: "Work Block 2", order: 4, plannedDurationSeconds: 10 * 60, type: "skill" },
      { name: "Work Block 3", order: 5, plannedDurationSeconds: 6 * 60, type: "skill" },
      { name: "Final Benchmark", order: 6, plannedDurationSeconds: 5 * 60, type: "benchmark" },
      { name: "Report", order: 7, plannedDurationSeconds: 3 * 60, type: "custom" },
    ],
    60: [
      { name: "Warmup", order: 1, plannedDurationSeconds: 5 * 60, type: "recovery" },
      { name: "Starting Benchmark", order: 2, plannedDurationSeconds: 8 * 60, type: "benchmark" },
      { name: "Work Block 1", order: 3, plannedDurationSeconds: 12 * 60, type: "skill" },
      { name: "Work Block 2", order: 4, plannedDurationSeconds: 12 * 60, type: "skill" },
      { name: "Work Block 3", order: 5, plannedDurationSeconds: 12 * 60, type: "skill" },
      { name: "Final Benchmark", order: 6, plannedDurationSeconds: 8 * 60, type: "benchmark" },
      { name: "Report", order: 7, plannedDurationSeconds: 3 * 60, type: "custom" },
    ],
  };

  const selectedLength = routineLengthMinutes === 30 || routineLengthMinutes === 45 ? routineLengthMinutes : 60;
  const focusName = focus === "General skill work" || focus === "Skill work" ? "Skill" : focus;

  return templates[selectedLength].map((block) => {
    const currentMatch = currentBlockPlan.find((currentBlock) => currentBlock.order === block.order);
    const name = block.type === "skill" ? block.name.replace("Work", focusName) : block.name;
    return {
      ...block,
      id: currentMatch?.id,
      name,
    };
  });
}
