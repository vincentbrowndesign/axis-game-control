import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { listAxisMissionAttempts, saveAxisMissionAttempt } from "../../../../lib/axis-mission-persistence";
import type { MissionAttempt } from "../../../../lib/axis-mission-memory";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const result = await listAxisMissionAttempts(auth.userId);
  if (!result.stored) return Response.json({ code: result.code, error: result.error }, { status: 502 });

  return Response.json({
    attempts: result.attempts,
    stored: true,
  });
}

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { attempt?: unknown } | null;
  if (!body || !isMissionAttempt(body.attempt)) return Response.json({ error: "MissionAttempt is required." }, { status: 400 });

  const result = await saveAxisMissionAttempt(auth.userId, body.attempt);
  if (!result.stored) return Response.json({ code: result.code, error: result.error }, { status: 502 });

  return Response.json({
    attempts: result.attempts,
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
  return value === "ACTIVE" || value === "COMPLETE" || value === "FAILED" || value === "READY";
}

function isMoment(value: unknown): value is MissionAttempt["moment"] {
  return value === null || value === "ALMOST" || value === "COMPLETE" || value === "FAILED" || value === "RECORD" || value === "STREAK";
}
