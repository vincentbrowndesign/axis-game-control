import { createClient } from "@supabase/supabase-js";
import type { MissionAttempt } from "./axis-mission-memory";
import { axisServerSupabaseOptions, logAxisSupabaseClientEnv } from "./axis-supabase-server";

export type AxisMissionMemoryReadResult =
  | {
      attempts: MissionAttempt[];
      error: null;
      stored: true;
    }
  | {
      attempts: MissionAttempt[];
      code: "SUPABASE_READ_FAILED" | "SUPABASE_SERVICE_ROLE_MISSING";
      error: string;
      stored: false;
    };

export type AxisMissionMemoryWriteResult =
  | {
      attempts: MissionAttempt[];
      error: null;
      stored: true;
    }
  | {
      attempts: MissionAttempt[];
      code: "SUPABASE_SERVICE_ROLE_MISSING" | "SUPABASE_WRITE_FAILED";
      error: string;
      stored: false;
    };

type AxisMissionRow = {
  id: string;
};

type AxisAttemptRow = {
  audio_context?: unknown;
  axis_context?: unknown;
  camera_context?: unknown;
  constraint?: unknown;
  id?: unknown;
  moment?: unknown;
  notes?: unknown;
  objective?: unknown;
  result?: unknown;
  status?: unknown;
  target?: unknown;
  timestamp?: unknown;
};

export function getAxisMissionMemoryClient() {
  const env = logAxisSupabaseClientEnv("axis_mission_memory");
  if (!env) return null;
  return createClient(env.url, env.key, axisServerSupabaseOptions);
}

export async function listAxisMissionAttempts(userId: string): Promise<AxisMissionMemoryReadResult> {
  const supabase = getAxisMissionMemoryClient();
  if (!supabase) {
    return {
      attempts: [],
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis mission memory reads.",
      stored: false,
    };
  }

  const { data, error } = await supabase
    .from("axis_attempts")
    .select(
      "id, objective, constraint, target, result, status, moment, timestamp, axis_context(audio_context, camera_context, notes)",
    )
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) {
    return {
      attempts: [],
      code: "SUPABASE_READ_FAILED",
      error: error.message,
      stored: false,
    };
  }

  return {
    attempts: (Array.isArray(data) ? data : []).map(mapAttemptRow).filter((attempt): attempt is MissionAttempt => Boolean(attempt)),
    error: null,
    stored: true,
  };
}

export async function saveAxisMissionAttempt(userId: string, attempt: MissionAttempt): Promise<AxisMissionMemoryWriteResult> {
  const supabase = getAxisMissionMemoryClient();
  if (!supabase) {
    return {
      attempts: [],
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis mission memory writes.",
      stored: false,
    };
  }

  const mission = await upsertMission(supabase, userId, attempt);
  if ("error" in mission) return mission.error;

  const attemptWrite = await supabase.from("axis_attempts").upsert(
    {
      constraint: attempt.constraint,
      id: attempt.id,
      mission_id: mission.data.id,
      moment: attempt.moment,
      objective: attempt.objective,
      result: attempt.result,
      status: attempt.status,
      target: attempt.target,
      timestamp: attempt.timestamp,
      user_id: userId,
    },
    { onConflict: "id" },
  );
  if (attemptWrite.error) return writeFailure(attemptWrite.error.message);

  const contextWrite = await supabase.from("axis_context").upsert(
    {
      attempt_id: attempt.id,
      audio_context: attempt.audioContext ?? null,
      camera_context: attempt.cameraContext ?? null,
      constraint: attempt.constraint,
      mission_id: mission.data.id,
      notes: attempt.notes ?? null,
      objective: attempt.objective,
      result: attempt.result,
      timestamp: attempt.timestamp,
      user_id: userId,
    },
    { onConflict: "attempt_id" },
  );
  if (contextWrite.error) return writeFailure(contextWrite.error.message);

  const attemptsResult = await listAxisMissionAttempts(userId);
  if (!attemptsResult.stored) {
    return {
      attempts: [],
      code: "SUPABASE_WRITE_FAILED",
      error: attemptsResult.error,
      stored: false,
    };
  }

  const missionAttempts = attemptsResult.attempts.filter(
    (item) => item.objective === attempt.objective && item.constraint === attempt.constraint,
  );
  const personalBest = missionAttempts.reduce((best, item) => Math.max(best, item.result), 0);
  const streak = getStreak(missionAttempts);
  const recordWrite = await supabase.from("axis_records").upsert(
    {
      constraint: attempt.constraint,
      last_attempt_id: missionAttempts[0]?.id ?? attempt.id,
      mission_id: mission.data.id,
      objective: attempt.objective,
      personal_best: personalBest,
      streak,
      updated_at: new Date().toISOString(),
      user_id: userId,
    },
    { onConflict: "mission_id" },
  );
  if (recordWrite.error) return writeFailure(recordWrite.error.message);

  return {
    attempts: attemptsResult.attempts,
    error: null,
    stored: true,
  };
}

async function upsertMission(
  supabase: NonNullable<ReturnType<typeof getAxisMissionMemoryClient>>,
  userId: string,
  attempt: MissionAttempt,
): Promise<
  | { data: AxisMissionRow }
  | {
      error: AxisMissionMemoryWriteResult;
    }
> {
  const { data, error } = await supabase
    .from("axis_missions")
    .upsert(
      {
        constraint: attempt.constraint,
        objective: attempt.objective,
        status: attempt.status,
        target: attempt.target,
        updated_at: new Date().toISOString(),
        user_id: userId,
      },
      { onConflict: "user_id,objective,constraint" },
    )
    .select("id")
    .single();

  const missionId = (data as { id?: unknown } | null)?.id;
  if (error || typeof missionId !== "string") {
    return { error: writeFailure(error?.message ?? "Mission upsert did not return an id.") };
  }

  return { data: { id: missionId } };
}

function mapAttemptRow(row: AxisAttemptRow): MissionAttempt | null {
  const context = Array.isArray(row.axis_context) ? row.axis_context[0] : null;
  if (
    typeof row.id !== "string" ||
    typeof row.objective !== "string" ||
    typeof row.constraint !== "string" ||
    typeof row.target !== "number" ||
    typeof row.result !== "number" ||
    typeof row.timestamp !== "string" ||
    !isStatus(row.status) ||
    !isMoment(row.moment)
  ) {
    return null;
  }

  return {
    audioContext: getContextValue(context, "audio_context"),
    cameraContext: getContextValue(context, "camera_context"),
    constraint: row.constraint,
    id: row.id,
    moment: row.moment,
    notes: getContextNotes(context),
    objective: row.objective,
    result: row.result,
    status: row.status,
    target: row.target,
    timestamp: row.timestamp,
  };
}

function getContextValue(context: unknown, key: "audio_context" | "camera_context") {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const value = (context as Record<string, unknown>)[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function getContextNotes(context: unknown) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const value = (context as Record<string, unknown>).notes;
  return typeof value === "string" ? value : null;
}

function getStreak(attempts: MissionAttempt[]) {
  let streak = 0;
  for (const attempt of attempts) {
    if (attempt.status !== "COMPLETE") break;
    streak += 1;
  }
  return streak;
}

function isStatus(value: unknown): value is MissionAttempt["status"] {
  return value === "ACTIVE" || value === "COMPLETE" || value === "FAILED" || value === "READY";
}

function isMoment(value: unknown): value is MissionAttempt["moment"] {
  return value === null || value === "ALMOST" || value === "COMPLETE" || value === "FAILED" || value === "RECORD" || value === "STREAK";
}

function writeFailure(error: string): AxisMissionMemoryWriteResult {
  return {
    attempts: [],
    code: "SUPABASE_WRITE_FAILED",
    error,
    stored: false,
  };
}
