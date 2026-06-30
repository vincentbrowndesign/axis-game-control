import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { createClipResult, createClipSource } from "../../../../lib/clip-room/db";
import { createCloudflareStreamDirectUpload } from "../../../../lib/cloudflare-stream";

export const runtime = "nodejs";

// Accepts JSON { filename, fileSize, origin }
// Returns { clipId, clipSourceId, uploadURL, streamVideoId }
// Video is NOT sent through this route — client uploads directly to Cloudflare.
export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    filename?: unknown;
    fileSize?: unknown;
    origin?: unknown;
  } | null;

  if (!body) {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }

  const filename = typeof body.filename === "string" && body.filename ? body.filename : "clip.mp4";
  const fileSize = typeof body.fileSize === "number" && body.fileSize > 0 ? Math.round(body.fileSize) : 0;
  const origin = body.origin === "recorded" ? "recorded" : "uploaded";

  const cfUpload = await createCloudflareStreamDirectUpload({ fileSize, filename });
  if (cfUpload.error || !cfUpload.upload) {
    console.error("CLIP_INGEST_CF_DIRECT_UPLOAD_ERROR", { error: cfUpload.error, filename, fileSize });
    return Response.json({ error: "Video upload could not be started. Please try again." }, { status: 502 });
  }

  const { uploadURL, uid: cloudflareUid } = cfUpload.upload;

  const created = await createClipSource({
    ownerId: auth.userId,
    origin,
    filename,
    fileSize,
    cloudflareUid,
    status: "pending",
    processingStage: "awaiting_upload",
    uploadUrl: null,
    videoUrl: null,
  });

  if (created.error || !created.record) {
    console.error("CLIP_INGEST_DB_ERROR", { error: created.error });
    return Response.json({ error: "Video upload could not be started. Please try again." }, { status: 502 });
  }

  const clipId = created.record.id;

  await createClipResult({
    clipId,
    ownerId: auth.userId,
    isPlayable: false,
    outcome: "pending",
    outcomeReason: "Video is being uploaded.",
  });

  return Response.json({
    clipId,
    clipSourceId: clipId,
    uploadURL,
    streamVideoId: cloudflareUid,
    fileName: filename,
    fileSize,
  }, { status: 201 });
}
