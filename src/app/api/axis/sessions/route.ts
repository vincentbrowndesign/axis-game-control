import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import {
  createAxisSessionDraft,
  listAxisSessionDrafts,
} from "../../../../lib/axis-session-drafts";
import type { AxisSession, AxisSessionDraftCreateRequest } from "../../../../lib/axis/types";

export const runtime = "nodejs";

type CreateSessionBody = {
  createdAt?: unknown;
  durationSeconds?: unknown;
  endedAt?: unknown;
  focus?: unknown;
  moments?: unknown;
  nextSessionCard?: unknown;
  playerId?: unknown;
  playerName?: unknown;
  searchableText?: unknown;
  sessionType?: unknown;
  source?: unknown;
  startedAt?: unknown;
  status?: unknown;
  summary?: unknown;
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
  const startedAt = typeof body.startedAt === "string" && Number.isFinite(Date.parse(body.startedAt))
    ? body.startedAt
    : undefined;
  const endedAt = typeof body.endedAt === "string" && Number.isFinite(Date.parse(body.endedAt))
    ? body.endedAt
    : undefined;
  const durationSeconds = typeof body.durationSeconds === "number" && Number.isFinite(body.durationSeconds)
    ? Math.max(0, Math.floor(body.durationSeconds))
    : undefined;
  const focus = typeof body.focus === "string" && body.focus.trim()
    ? body.focus.trim()
    : undefined;
  const moments = parseMoments(body.moments);
  const nextSessionCard = parsePlainRecord(body.nextSessionCard);
  const playerName = typeof body.playerName === "string" && body.playerName.trim()
    ? body.playerName.trim()
    : undefined;
  const playerId = typeof body.playerId === "string" && body.playerId.trim()
    ? body.playerId.trim()
    : undefined;
  const searchableText = typeof body.searchableText === "string" && body.searchableText.trim()
    ? body.searchableText.trim()
    : undefined;
  const source = isSessionSource(body.source) ? body.source : undefined;
  const status = isSessionStatus(body.status) ? body.status : "draft";
  const summary = typeof body.summary === "string" && body.summary.trim()
    ? body.summary.trim()
    : undefined;

  return {
    ok: true,
    value: {
      createdAt,
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      ...(endedAt ? { endedAt } : {}),
      ...(focus ? { focus } : {}),
      ...(moments ? { moments } : {}),
      ...(nextSessionCard ? { nextSessionCard } : {}),
      ...(playerId ? { playerId } : {}),
      ...(playerName ? { playerName } : {}),
      ...(searchableText ? { searchableText } : {}),
      sessionType: body.sessionType,
      ...(source ? { source } : {}),
      ...(startedAt ? { startedAt } : {}),
      status,
      ...(summary ? { summary } : {}),
      title,
    },
  };
}

function isSessionType(value: unknown): value is AxisSession["sessionType"] {
  return value === "training" || value === "game" || value === "film" || value === "practice" || value === "other";
}

function isSessionStatus(value: unknown): value is AxisSession["status"] {
  return value === "draft" || value === "active" || value === "processing" || value === "complete";
}

function isSessionSource(value: unknown): value is NonNullable<AxisSessionDraftCreateRequest["source"]> {
  return value === "typed" || value === "tap" || value === "mixed";
}

function parseMoments(value: unknown): AxisSessionDraftCreateRequest["moments"] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((moment) => moment && typeof moment === "object" && !Array.isArray(moment)).slice(0, 200) as AxisSessionDraftCreateRequest["moments"];
}

function parsePlainRecord(value: unknown): AxisSessionDraftCreateRequest["nextSessionCard"] | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as AxisSessionDraftCreateRequest["nextSessionCard"];
}
