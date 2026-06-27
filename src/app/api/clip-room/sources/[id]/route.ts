import { tasks } from "@trigger.dev/sdk/v3";
import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { getClipSetup, getClipSource, updateClipSource } from "../../../../../lib/clip-room/db";

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

// Called after upload completes to confirm and start processing.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { id } = await context.params;
  const source = await getClipSource(id);
  if (source.error || !source.record) return Response.json({ error: source.error ?? "not found" }, { status: 404 });
  if (source.record.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });

  await updateClipSource(id, { status: "uploaded", processingProgress: 5 });

  const setup = await getClipSetup(id);

  try {
    await tasks.trigger("clip-room-processing", {
      clipId: id,
      ownerId: auth.userId,
      cloudflareUid: source.record.cloudflareUid!,
      setup: setup.record ?? null,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await updateClipSource(id, { status: "failed", error: reason });
    return Response.json({ error: reason }, { status: 502 });
  }

  await updateClipSource(id, { status: "processing", processingStage: "queued", processingProgress: 8 });

  return Response.json({ status: "processing" });
}
