import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { listAxisMissionAttempts, saveAxisMissionAttempt, saveAxisMissionSession } from "../../../../lib/axis-mission-persistence";
import type { MissionAttempt, MissionEvent, MissionSession } from "../../../../lib/axis-mission-memory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const result = await listAxisMissionAttempts(auth.userId);
  if (!result.stored) return Response.json({ code: result.code, error: result.error }, { status: 502 });

  return Response.json({
    attempts: result.attempts,
    sessions: result.sessions,
    stored: true,
  });
}

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { attempt?: unknown; session?: unknown } | null;
  if (!body) return Response.json({ error: "Mission session or attempt is required." }, { status: 400 });

  if (isMissionSession(body.session)) {
    const result = await saveAxisMissionSession(auth.userId, body.session);
    if (!result.stored) return Response.json({ code: result.code, error: result.error }, { status: 502 });

    return Response.json({
      attempts: result.attempts,
      sessions: result.sessions,
      stored: true,
    });
  }

  if (!isMissionAttempt(body.attempt)) return Response.json({ error: "Mission session or attempt is required." }, { status: 400 });

  const result = await saveAxisMissionAttempt(auth.userId, body.attempt);
  if (!result.stored) return Response.json({ code: result.code, error: result.error }, { status: 502 });

  return Response.json({
    attempts: result.attempts,
    sessions: result.sessions,
    stored: true,
  });
}

function isMissionAttempt(value: unknown): value is MissionAttempt {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.objective === "string" &&
    typeof record.constraint === "string" &&
    typeof record.target === "number" &&
    typeof record.result === "number" &&
    typeof record.timestamp === "string" &&
    isStatus(record.status) &&
    isMoment(record.moment)
  );
}

function isStatus(value: unknown): value is MissionAttempt["status"] {
  return value === "ACTIVE" || value === "ENDED" || value === "EVALUATED" || value === "PAUSED";
}

function isMoment(value: unknown): value is MissionAttempt["moment"] {
  return value === null || value === "ALMOST" || value === "COMPLETE" || value === "FAILED" || value === "RECORD" || value === "STREAK";
}

function isMissionSession(value: unknown): value is MissionSession {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.objective === "string" &&
    typeof record.constraint === "string" &&
    typeof record.target === "number" &&
    typeof record.result === "number" &&
    typeof record.startedAt === "string" &&
    isStatus(record.status) &&
    Array.isArray(record.events) &&
    record.events.every(isMissionEvent)
  );
}

function isMissionEvent(value: unknown): value is MissionEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.timestamp === "string" &&
    isEventType(record.type) &&
    Boolean(record.payload) &&
    typeof record.payload === "object" &&
    !Array.isArray(record.payload)
  );
}

function isEventType(value: unknown): value is MissionEvent["type"] {
  return (
    value === "BREAK" ||
    value === "COACH_NOTE" ||
    value === "CORRECTION" ||
    value === "FINISHED" ||
    value === "PROGRESS_UPDATE" ||
    value === "SESSION_STARTED"
  );
}
