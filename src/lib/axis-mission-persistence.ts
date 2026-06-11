import { createClient } from "@supabase/supabase-js";
import type { MissionAttempt, MissionEvent, MissionSession } from "./axis-mission-memory";
import { axisServerSupabaseOptions, logAxisSupabaseClientEnv } from "./axis-supabase-server";

export type AxisMissionMemoryReadResult =
  | {
      attempts: MissionAttempt[];
      sessions: MissionSession[];
      error: null;
      stored: true;
    }
  | {
      attempts: MissionAttempt[];
      sessions: MissionSession[];
      code: "SUPABASE_READ_FAILED" | "SUPABASE_SERVICE_ROLE_MISSING";
      error: string;
      stored: false;
    };

export type AxisMissionMemoryWriteResult =
  | {
      attempts: MissionAttempt[];
      sessions: MissionSession[];
      error: null;
      stored: true;
    }
  | {
      attempts: MissionAttempt[];
      sessions: MissionSession[];
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
  session_id?: unknown;
  status?: unknown;
  target?: unknown;
  timestamp?: unknown;
};

type AxisSessionRow = {
  axis_events?: unknown;
  axis_mission_events?: unknown;
  constraint?: unknown;
  ended_at?: unknown;
  id?: unknown;
  objective?: unknown;
  result?: unknown;
  started_at?: unknown;
  status?: unknown;
  target?: unknown;
};

type AxisEventRow = {
  id?: unknown;
  payload?: unknown;
  timestamp?: unknown;
  type?: unknown;
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
      sessions: [],
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis mission memory reads.",
      stored: false,
    };
  }

  const attemptsQuery = await supabase
    .from("axis_attempts")
    .select(
      "id, session_id, objective, constraint, target, result, status, moment, timestamp, axis_context(audio_context, camera_context, notes)",
    )
    .eq("user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(100);

  if (attemptsQuery.error) {
    return {
      attempts: [],
      sessions: [],
      code: "SUPABASE_READ_FAILED",
      error: attemptsQuery.error.message,
      stored: false,
    };
  }

  const sessionsResult = await listAxisMissionSessions(userId);
  if (!sessionsResult.stored) {
    return {
      attempts: [],
      sessions: [],
      code: sessionsResult.code,
      error: sessionsResult.error,
      stored: false,
    };
  }

  return {
    attempts: (Array.isArray(attemptsQuery.data) ? attemptsQuery.data : [])
      .map(mapAttemptRow)
      .filter((attempt): attempt is MissionAttempt => Boolean(attempt)),
    sessions: sessionsResult.sessions,
    error: null,
    stored: true,
  };
}

export async function saveAxisMissionSession(userId: string, session: MissionSession): Promise<AxisMissionMemoryWriteResult> {
  const supabase = getAxisMissionMemoryClient();
  if (!supabase) {
    return {
      attempts: [],
      sessions: [],
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis mission session writes.",
      stored: false,
    };
  }

  const mission = await upsertMission(supabase, userId, session);
  if ("error" in mission) return mission.error;

  const sessionWrite = await supabase.from("axis_sessions").upsert(
    {
      constraint: session.constraint,
      ended_at: session.endedAt ?? null,
      id: session.id,
      mission_id: mission.data.id,
      objective: session.objective,
      result: session.result,
      started_at: session.startedAt,
      status: session.status,
      target: session.target,
      user_id: userId,
    },
    { onConflict: "id" },
  );
  if (sessionWrite.error) return writeFailure(sessionWrite.error.message);

  const eventWrite = await supabase.from("axis_mission_events").upsert(
    session.events.map((event) => ({
      id: event.id,
      mission_id: mission.data.id,
      payload: event.payload,
      session_id: session.id,
      timestamp: event.timestamp,
      type: event.type,
      user_id: userId,
    })),
    { onConflict: "id" },
  );
  if (eventWrite.error) return writeFailure(eventWrite.error.message);

  const result = await listAxisMissionAttempts(userId);
  if (!result.stored) return writeFailure(result.error);
  return result;
}

export async function saveAxisMissionAttempt(userId: string, attempt: MissionAttempt): Promise<AxisMissionMemoryWriteResult> {
  const supabase = getAxisMissionMemoryClient();
  if (!supabase) {
    return {
      attempts: [],
      sessions: [],
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
      session_id: attempt.sessionId ?? null,
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
      session_id: attempt.sessionId ?? null,
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
      sessions: [],
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
    sessions: attemptsResult.sessions,
    error: null,
    stored: true,
  };
}

async function upsertMission(
  supabase: NonNullable<ReturnType<typeof getAxisMissionMemoryClient>>,
  userId: string,
  source: MissionAttempt | MissionSession,
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
        constraint: source.constraint,
        objective: source.objective,
        status: source.status,
        target: source.target,
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
    ...(typeof row.session_id === "string" ? { sessionId: row.session_id } : {}),
    status: row.status,
    target: row.target,
    timestamp: row.timestamp,
  };
}

async function listAxisMissionSessions(userId: string): Promise<AxisMissionMemoryReadResult> {
  const supabase = getAxisMissionMemoryClient();
  if (!supabase) {
    return {
      attempts: [],
      sessions: [],
      code: "SUPABASE_SERVICE_ROLE_MISSING",
      error: "SUPABASE_SERVICE_ROLE_KEY is required for Axis mission session reads.",
      stored: false,
    };
  }

  const { data, error } = await supabase
    .from("axis_sessions")
    .select("id, objective, constraint, target, result, status, started_at, ended_at, axis_mission_events(id, type, payload, timestamp)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error) {
    return {
      attempts: [],
      sessions: [],
      code: "SUPABASE_READ_FAILED",
      error: error.message,
      stored: false,
    };
  }

  return {
    attempts: [],
    sessions: (Array.isArray(data) ? data : []).map(mapSessionRow).filter((session): session is MissionSession => Boolean(session)),
    error: null,
    stored: true,
  };
}

function mapSessionRow(row: AxisSessionRow): MissionSession | null {
  if (
    typeof row.id !== "string" ||
    typeof row.objective !== "string" ||
    typeof row.constraint !== "string" ||
    typeof row.target !== "number" ||
    typeof row.result !== "number" ||
    typeof row.started_at !== "string" ||
    !isStatus(row.status)
  ) {
    return null;
  }

  const events = Array.isArray(row.axis_mission_events)
    ? row.axis_mission_events.map(mapEventRow).filter((event): event is MissionEvent => Boolean(event))
    : [];

  return {
    constraint: row.constraint,
    ...(typeof row.ended_at === "string" ? { endedAt: row.ended_at } : {}),
    events: events.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)),
    id: row.id,
    objective: row.objective,
    result: row.result,
    startedAt: row.started_at,
    status: row.status,
    target: row.target,
  };
}

function mapEventRow(row: AxisEventRow): MissionEvent | null {
  if (
    typeof row.id !== "string" ||
    typeof row.timestamp !== "string" ||
    !isEventType(row.type) ||
    !row.payload ||
    typeof row.payload !== "object" ||
    Array.isArray(row.payload)
  ) {
    return null;
  }

  return {
    id: row.id,
    payload: row.payload as Record<string, unknown>,
    timestamp: row.timestamp,
    type: row.type,
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
    if (attempt.moment !== "COMPLETE" && attempt.moment !== "RECORD" && attempt.moment !== "STREAK") break;
    streak += 1;
  }
  return streak;
}

function isStatus(value: unknown): value is MissionAttempt["status"] {
  return value === "ACTIVE" || value === "ENDED" || value === "EVALUATED" || value === "PAUSED" || value === "READY";
}

function isEventType(value: unknown): value is MissionEvent["type"] {
  return (
    value === "COMMAND" ||
    value === "COUNT_RECORDED" ||
    value === "MISSION_PAUSED" ||
    value === "MISSION_RESUMED" ||
    value === "RESULT_RECORDED" ||
    value === "SESSION_ENDED" ||
    value === "SESSION_EVALUATED" ||
    value === "SESSION_STARTED"
  );
}

function isMoment(value: unknown): value is MissionAttempt["moment"] {
  return value === null || value === "ALMOST" || value === "COMPLETE" || value === "FAILED" || value === "RECORD" || value === "STREAK";
}

function writeFailure(error: string): AxisMissionMemoryWriteResult {
  return {
    attempts: [],
    sessions: [],
    code: "SUPABASE_WRITE_FAILED",
    error,
    stored: false,
  };
}
