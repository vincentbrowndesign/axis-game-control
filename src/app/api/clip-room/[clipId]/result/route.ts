import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { getClipResult, getClipSource } from "../../../../../lib/clip-room/db";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clipId: string }> },
) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { clipId } = await params;

  const source = await getClipSource(clipId);
  if (source.error || !source.record) {
    return Response.json({ error: "Clip not found." }, { status: 404 });
  }
  if (source.record.ownerId !== auth.userId) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const result = await getClipResult(clipId);
  if (result.error) return Response.json({ error: result.error }, { status: 502 });

  return Response.json({ result: result.record });
}
