import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { computeClipStats, getClipEvents, getClipSource } from "../../../../../lib/clip-room/db";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ clipId: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { clipId } = await context.params;
  const source = await getClipSource(clipId);
  if (source.error || !source.record) return Response.json({ error: "clip not found" }, { status: 404 });
  if (source.record.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });

  const eventsResult = await getClipEvents(clipId);
  if (eventsResult.error) return Response.json({ error: eventsResult.error }, { status: 502 });

  const stats = computeClipStats(eventsResult.records);

  return Response.json({ stats });
}
