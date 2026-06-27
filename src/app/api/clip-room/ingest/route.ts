import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { tasks } from "@trigger.dev/sdk/v3";

import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { createClipSource, getClipSetup, updateClipSource, upsertClipSetup } from "../../../../lib/clip-room/db";
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
  const subjectType = formData.get("subjectType");
  const validSubjectType = subjectType === "team" ? "team" : "player";
  const subjectName = getString(formData.get("subjectName"));
  const sessionType = formData.get("sessionType");
  const validSessionType = sessionType === "game" || sessionType === "training" ? sessionType : "practice";
  const jerseyColor = getString(formData.get("jerseyColor"));
  const scoreboardVisible = formData.get("scoreboardVisible");
  const validScoreboard =
    scoreboardVisible === "yes" || scoreboardVisible === "no" || scoreboardVisible === "not_sure"
      ? scoreboardVisible
      : null;

  const filename = videoEntry.name || "clip.mp4";
  const fileSize = videoEntry.size;

  // Write video to a temp file so we can upload it to Cloudflare
  let tmpPath: string | null = null;
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "clip-ingest-"));
    tmpPath = path.join(tmpDir, filename);
    const buffer = Buffer.from(await videoEntry.arrayBuffer());
    await fs.writeFile(tmpPath, buffer);

    // Upload to Cloudflare Stream
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
      videoUrl: playbackUrl,
    });

    if (created.error || !created.record) {
      console.error("CLIP_INGEST_DB_ERROR", { error: created.error });
      return Response.json({ error: "Upload could not start. Please choose a video and try again." }, { status: 502 });
    }

    const clipId = created.record.id;

    // Save setup
    await upsertClipSetup({
      clipId,
      ownerId: auth.userId,
      subjectType: validSubjectType,
      subjectName: subjectName || null,
      sessionType: validSessionType,
      jerseyColor: jerseyColor || null,
      scoreboardVisible: validScoreboard,
    });

    // Start processing
    const setup = await getClipSetup(clipId);
    try {
      await tasks.trigger("clip-room-processing", {
        clipId,
        ownerId: auth.userId,
        cloudflareUid,
        setup: setup.record ?? null,
      });
      await updateClipSource(clipId, {
        status: "processing",
        processingStage: "queued",
        processingProgress: 8,
      });
    } catch (triggerErr) {
      console.error("CLIP_INGEST_TRIGGER_ERROR", { error: String(triggerErr), clipId });
      // Non-fatal: clip source exists, user can still see the detail page
      await updateClipSource(clipId, { status: "uploaded" });
    }

    return Response.json({ clipId }, { status: 201 });

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

function getString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
