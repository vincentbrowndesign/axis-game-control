import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { computeClipStats, getClipEvents, getClipPressPack, getClipResult, getClipSource } from "../../../../../lib/clip-room/db";

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
    const result = await getClipResult(clipId);
    const starter = buildPressPackStarter(result.record);
    return Response.json({
      pressPack: {
        id: null,
        clipId,
        headline: starter.headline,
        summary: starter.summary,
        keyMoments: counted
          .filter((e) => e.timestampSeconds !== null)
          .slice(0, 10)
          .map((e) => ({
            timestampSeconds: e.timestampSeconds!,
            description: eventLabel(e.eventType, e.shotZone),
          })),
        statLines: stats,
        generatedAt: null,
      },
    });
  }

  return Response.json({ pressPack: packResult.record });
}

function buildPressPackStarter(result: Awaited<ReturnType<typeof getClipResult>>["record"]) {
  if (!result) {
    return {
      headline: "Clip processing",
      summary: "Axis is preparing a source-linked Press Pack for this clip.",
    };
  }

  if (result.eventsCounted > 0) {
    return {
      headline: "Clip activity counted",
      summary: "Axis created source-linked Activity for this clip. Stats are based on counted Activity only.",
    };
  }

  const quality = result.sourceQuality ? ` Source quality: ${result.sourceQuality}.` : "";
  const review = result.outcome === "no_events"
    ? " A Check Play is ready so the play can be marked without invented stats."
    : "";

  return {
    headline: "Clip ready for review",
    summary: `Axis created a Clip Result for this upload.${quality}${review}`,
  };
}

function eventLabel(type: string, shotZone: string | null) {
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
