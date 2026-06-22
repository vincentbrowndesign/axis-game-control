import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import {
  createAxisSessionDraft,
  listAxisSessionDrafts,
} from "../../../../lib/axis-session-drafts";
import type { AxisSession, AxisSessionDraftCreateRequest } from "../../../../lib/axis/types";

export const runtime = "nodejs";

type CreateSessionBody = {
  createdAt?: unknown;
  playerId?: unknown;
  playerName?: unknown;
  sessionType?: unknown;
  title?: unknown;
};

export async function GET(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason, sessions: [] }, { status: 401 });

  const result = await listAxisSessionDrafts(auth.userId);
  if (!result.ok) return Response.json({ error: result.error, sessions: [] }, { status: 502 });

  return Response.json({ ok: true, sessions: result.value });
}

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CreateSessionBody | null;
  const parsed = parseCreateSessionBody(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const result = await createAxisSessionDraft({
    ownerId: auth.userId,
    session: parsed.value,
  });
  if (!result.ok) return Response.json({ error: result.error }, { status: 502 });

  return Response.json({ ok: true, session: result.value });
}

function parseCreateSessionBody(
  body: CreateSessionBody | null,
): { ok: true; value: AxisSessionDraftCreateRequest } | { error: string; ok: false } {
  if (!body) return { error: "JSON body is required.", ok: false };

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return { error: "Session title is required.", ok: false };

  if (!isSessionType(body.sessionType)) {
    return { error: "Session type is not supported.", ok: false };
  }

  const createdAt = typeof body.createdAt === "string" && Number.isFinite(Date.parse(body.createdAt))
    ? body.createdAt
    : new Date().toISOString();
  const playerName = typeof body.playerName === "string" && body.playerName.trim()
    ? body.playerName.trim()
    : undefined;
  const playerId = typeof body.playerId === "string" && body.playerId.trim()
    ? body.playerId.trim()
    : undefined;

  return {
    ok: true,
    value: {
      createdAt,
      ...(playerId ? { playerId } : {}),
      ...(playerName ? { playerName } : {}),
      sessionType: body.sessionType,
      status: "draft",
      title,
    },
  };
}

function isSessionType(value: unknown): value is AxisSession["sessionType"] {
  return value === "training" || value === "game" || value === "film" || value === "practice" || value === "other";
}
