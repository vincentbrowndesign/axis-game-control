import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { computeClipStats, getClipEvents, getClipSource, resolveClipPlay, updateClipEvent, upsertClipPressPack } from "../../../../../lib/clip-room/db";
import type { ResolveClipPlayRequest } from "../../../../../lib/clip-room/types";

export const runtime = "nodejs";

// Resolve a check play. Updates the linked event status and regenerates stats.
export async function PATCH(request: Request, context: { params: Promise<{ playId: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { playId } = await context.params;

  const body = (await request.json().catch(() => null)) as ResolveClipPlayRequest | null;
  if (!body || typeof body.resolution !== "string") {
    return Response.json({ error: "resolution is required" }, { status: 400 });
  }

  const resolved = await resolveClipPlay(playId, body.resolution);
  if (resolved.error || !resolved.record) {
    return Response.json({ error: resolved.error ?? "play not found" }, { status: 404 });
  }

  const play = resolved.record;
  const source = await getClipSource(play.clipId);
  if (!source.record || source.record.ownerId !== auth.userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Apply resolution to linked event
  if (play.eventId) {
    const newStatus = body.resolution === "skipped" ? "skipped" : "counted";
    await updateClipEvent(play.eventId, { status: newStatus });
  }

  // Recompute stats and update press pack
  const eventsResult = await getClipEvents(play.clipId);
  const stats = computeClipStats(eventsResult.records);

  await upsertClipPressPack({
    clipId: play.clipId,
    ownerId: auth.userId,
    headline: null,
    summary: null,
    keyMoments: eventsResult.records
      .filter((e) => e.status === "counted" && e.timestampSeconds !== null)
      .slice(0, 10)
      .map((e) => ({
        timestampSeconds: e.timestampSeconds!,
        description: simpleEventLabel(e.eventType),
      })),
    statLines: stats,
  });

  return Response.json({ play, stats });
}

function simpleEventLabel(type: string) {
  const labels: Record<string, string> = {
    make: "Field goal",
    miss: "Missed shot",
    rebound: "Rebound",
    assist: "Assist",
    turnover: "Turnover",
    steal: "Steal",
    block: "Block",
    foul: "Foul",
    free_throw: "Free throw",
  };
  return labels[type] ?? type;
}
