import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { createClipResult, createClipSource } from "../../../../lib/clip-room/db";
import { saveOriginalClipForAnalysis } from "../../../../lib/clip-room/original-storage";
import { uploadCloudflareStreamVideoFile } from "../../../../lib/cloudflare-stream";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 400 });
  }

  const videoEntry = formData.get("video");
  if (!(videoEntry instanceof File) || videoEntry.size === 0) {
    return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 400 });
  }

  const origin = formData.get("origin");
  const validOrigin = origin === "recorded" || origin === "uploaded" ? origin : "uploaded";
  const filename = videoEntry.name || "clip.mp4";
  const fileSize = videoEntry.size;
  const contentType = videoEntry.type || "video/mp4";

  // Write once locally, then preserve the original for analysis before creating the playback copy.
  let tmpPath: string | null = null;
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "clip-ingest-"));
    tmpPath = path.join(tmpDir, filename);
    const buffer = Buffer.from(await videoEntry.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);

    const original = await saveOriginalClipForAnalysis({
      contentType,
      filename,
      filePath: tmpPath,
      ownerId: auth.userId,
    });
    if (original.error || !original.uri) {
      console.error("CLIP_INGEST_ORIGINAL_SAVE_ERROR", { error: original.error, filename, fileSize });
      return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 502 });
    }

    // Cloudflare Stream is the playback copy. Analysis waits for Stream-ready, then reads the original.
    const upload = await uploadCloudflareStreamVideoFile({ filePath: tmpPath, filename });
    if (upload.error || !upload.uid) {
      console.error("CLIP_INGEST_CLOUDFLARE_ERROR", { error: upload.error, filename, fileSize });
      return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 502 });
    }

    const cloudflareUid = upload.uid;
    const playbackUrl = upload.playbackUrl ?? null;

    // Create clip source
    const created = await createClipSource({
      ownerId: auth.userId,
      origin: validOrigin,
      filename,
      fileSize,
      cloudflareUid,
      status: "pending",
      processingStage: "setup",
      uploadUrl: original.uri,
      videoUrl: playbackUrl,
    });

    if (created.error || !created.record) {
      console.error("CLIP_INGEST_DB_ERROR", { error: created.error });
      return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 502 });
    }

    const clipId = created.record.id;

    // Create the result shell now, but do not analyze until the Stream-ready webhook fires.
    await createClipResult({
      clipId,
      ownerId: auth.userId,
      isPlayable: false,
      outcome: "pending",
      outcomeReason: "Waiting for Cloudflare Stream to finish processing.",
    });

    // Processing is triggered by the Cloudflare Stream webhook when the video is ready.
    return Response.json({
      clipId,
      clipSourceId: clipId,
      fileName: filename,
      fileSize,
      streamVideoId: cloudflareUid,
    }, { status: 201 });

  } catch (err) {
    console.error("CLIP_INGEST_ERROR", { error: String(err), filename, fileSize });
    return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 500 });
  } finally {
    if (tmpPath) {
      const tmpDir = path.dirname(tmpPath);
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => null);
    }
  }
}
