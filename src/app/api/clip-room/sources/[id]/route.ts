import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { createClipResult, getClipSource, updateClipSource } from "../../../../../lib/clip-room/db";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { id } = await context.params;
  const result = await getClipSource(id);
  if (result.error) return Response.json({ error: result.error }, { status: 404 });
  if (result.record?.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });

  return Response.json({ clip: result.record });
}

// Called after upload completes. Processing still waits for the Stream-ready webhook.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { id } = await context.params;
  const source = await getClipSource(id);
  if (source.error || !source.record) return Response.json({ error: source.error ?? "not found" }, { status: 404 });
  if (source.record.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });

  await updateClipSource(id, {
    status: "uploaded",
    processingStage: "waiting_for_stream_ready",
    processingProgress: 5,
  });

  await createClipResult({
    clipId: id,
    ownerId: auth.userId,
    isPlayable: false,
    outcome: "pending",
    outcomeReason: "Waiting for Cloudflare Stream to finish processing.",
  });

  return Response.json({ status: "waiting_for_stream_ready" });
}
