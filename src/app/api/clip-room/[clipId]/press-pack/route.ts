import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { computeClipStats, getClipEvents, getClipPressPack, getClipSource } from "../../../../../lib/clip-room/db";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ clipId: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { clipId } = await context.params;
  const source = await getClipSource(clipId);
  if (source.error || !source.record) return Response.json({ error: "clip not found" }, { status: 404 });
  if (source.record.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });

  const packResult = await getClipPressPack(clipId);
  if (packResult.error) return Response.json({ error: packResult.error }, { status: 502 });

  if (!packResult.record) {
    // Return a live-computed pack from current events
    const eventsResult = await getClipEvents(clipId);
    const events = eventsResult.records ?? [];
    const stats = computeClipStats(events);
    const counted = events.filter((e) => e.status === "counted");
    return Response.json({
      pressPack: {
        id: null,
        clipId,
        headline: null,
        summary: null,
        keyMoments: counted
          .filter((e) => e.timestampSeconds !== null)
          .slice(0, 10)
          .map((e) => ({
            timestampSeconds: e.timestampSeconds!,
            description: eventLabel(e.eventType, e.shotZone, e.points),
          })),
        statLines: stats,
        generatedAt: null,
      },
    });
  }

  return Response.json({ pressPack: packResult.record });
}

function eventLabel(type: string, shotZone: string | null, points: number) {
  if (type === "make") {
    if (shotZone === "three_point") return "Three-point make";
    if (shotZone === "free_throw") return "Free throw";
    return "Field goal";
  }
  if (type === "miss") return "Missed shot";
  if (type === "rebound") return "Rebound";
  if (type === "assist") return "Assist";
  if (type === "turnover") return "Turnover";
  if (type === "steal") return "Steal";
  if (type === "block") return "Block";
  if (type === "foul") return "Foul";
  return type;
}
