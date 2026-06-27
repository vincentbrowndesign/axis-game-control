import { tasks } from "@trigger.dev/sdk/v3";
import { getAxisRequestUser } from "../../../../../lib/axis-request-auth";
import { createClipResult, getClipSource, updateClipSource } from "../../../../../lib/clip-room/db";
import { getCloudflareStreamVideo } from "../../../../../lib/cloudflare-stream";

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

const clipRoomTriggerTtl = "30m";
const clipRoomTriggerQueue = "clip-room-processing";

// Called after setup is saved. Processing waits for Stream-ready; if Stream is already ready, queue now.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const { id } = await context.params;
  const source = await getClipSource(id);
  if (source.error || !source.record) return Response.json({ error: source.error ?? "not found" }, { status: 404 });
  if (source.record.ownerId !== auth.userId) return Response.json({ error: "forbidden" }, { status: 403 });
  if (!source.record.cloudflareUid) return Response.json({ error: "stream video missing" }, { status: 400 });

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

  const stream = await getCloudflareStreamVideo(source.record.cloudflareUid).catch((err: unknown) => ({
    error: err instanceof Error ? err.message : String(err),
    video: null,
  }));

  const isReady = Boolean(stream.video?.readyToStream || stream.video?.status?.state === "ready");
  if (!isReady) return Response.json({ status: "waiting_for_stream_ready" });

  try {
    const handle = await tasks.trigger("clip-room-processing", {
      clipId: id,
      ownerId: auth.userId,
      cloudflareUid: source.record.cloudflareUid,
      originalStorageUri: source.record.uploadUrl,
    }, {
      queue: clipRoomTriggerQueue,
      ttl: clipRoomTriggerTtl,
    });

    await updateClipSource(id, {
      status: "processing",
      processingStage: "queued",
      processingProgress: 8,
      error: null,
    });

    return Response.json({ status: "processing", triggerRunId: handle.id });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await updateClipSource(id, { status: "failed", error: reason });
    return Response.json({ error: reason }, { status: 502 });
  }
}
