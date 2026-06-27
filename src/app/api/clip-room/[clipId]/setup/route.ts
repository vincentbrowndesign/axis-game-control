import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { getClipSource, upsertClipSetup } from "../../../../../lib/clip-room/db";
import type { SaveClipSetupRequest } from "../../../../../lib/clip-room/types";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ clipId: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { clipId } = await context.params;
  const source = await getClipSource(clipId);
  if (source.error || !source.record) return Response.json({ error: "clip not found" }, { status: 404 });
  if (source.record.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as SaveClipSetupRequest | null;
  if (!body) return Response.json({ error: "JSON body required" }, { status: 400 });

  const subjectType = body.subjectType === "player" || body.subjectType === "team" ? body.subjectType : null;
  if (!subjectType) return Response.json({ error: "subjectType must be 'player' or 'team'" }, { status: 400 });

  const subjectName = typeof body.subjectName === "string" ? body.subjectName.trim() : "";
  if (subjectType === "team" && !subjectName) return Response.json({ error: "Enter a team name." }, { status: 400 });

  const sessionType = ["game", "practice", "training"].includes(body.sessionType) ? body.sessionType : null;
  if (!sessionType) return Response.json({ error: "sessionType must be 'game', 'practice', or 'training'" }, { status: 400 });

  const scoreboardVisible = body.scoreboardVisible ?? null;

  const result = await upsertClipSetup({
    clipId,
    ownerId: auth.userId,
    subjectType,
    subjectName: subjectName || null,
    sessionType,
    jerseyColor: typeof body.jerseyColor === "string" ? body.jerseyColor.trim() || null : null,
    scoreboardVisible: scoreboardVisible && ["yes", "no", "not_sure"].includes(scoreboardVisible) ? scoreboardVisible : null,
  });

  if (result.error || !result.record) return Response.json({ error: result.error ?? "upsert failed" }, { status: 502 });

  return Response.json({ setup: result.record }, { status: 201 });
}
