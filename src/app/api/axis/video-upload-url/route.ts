import { createAxisVideoJob } from "../../../../lib/axis-video-jobs";
import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { createCloudflareStreamDirectUpload } from "../../../../lib/cloudflare-stream";

export const runtime = "nodejs";

type CreateUploadUrlBody = {
  contentType?: unknown;
  fileSize?: unknown;
  filename?: unknown;
  organizationId?: unknown;
  organization_id?: unknown;
  sessionId?: unknown;
  session_id?: unknown;
  videoId?: unknown;
  video_id?: unknown;
};

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CreateUploadUrlBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const filename = getString(body.filename) || "axis-video.mp4";
  const fileSize = getNumber(body.fileSize) ?? 0;
  if (fileSize <= 0) return Response.json({ error: "fileSize is required." }, { status: 400 });

  let direct: Awaited<ReturnType<typeof createCloudflareStreamDirectUpload>>;
  try {
    console.log("LOG_BEFORE_UPLOAD_URL", {
      fileSize,
      filename,
      route: "/api/axis/video-upload-url",
    });
    direct = await createCloudflareStreamDirectUpload({ fileSize, filename });
    console.log("LOG_AFTER_UPLOAD_URL", {
      cloudflareUid: direct.upload?.uid ?? null,
      error: direct.error ?? null,
      uploadUrlPresent: Boolean(direct.upload?.uploadURL),
    });
  } catch (error) {
    console.error("LOG_UPLOAD_URL_ERROR", serializeError(error));
    throw error;
  }
  if (direct.error || !direct.upload) return Response.json({ error: direct.error }, { status: 502 });

  const now = new Date().toISOString();
  const jobId = `axis-video-${crypto.randomUUID()}`;
  let created: Awaited<ReturnType<typeof createAxisVideoJob>>;
  try {
    console.log("LOG_BEFORE_JOB_CREATE", {
      cloudflareUid: direct.upload.uid,
      jobId,
      route: "/api/axis/video-upload-url",
    });
    created = await createAxisVideoJob({
      asset_id: direct.upload.uid,
      ball_track: [],
      ball_track_count: 0,
      cloudflare_uid: direct.upload.uid,
      detection_count: 0,
      error: null,
      file_size: fileSize,
      filename,
      focus_player_track_id: null,
      frame_count: 0,
      job_id: jobId,
      mp4_ready_at: null,
      mux_playback_id: null,
      mux_upload_id: null,
      organization_id: getUuid(body.organization_id) || getUuid(body.organizationId),
      player_track: [],
      player_track_count: 0,
      processing_stage: "uploading",
      progress: 0,
      session_id: getString(body.session_id) || getString(body.sessionId) || null,
      status: "uploading",
      storage_path: `cloudflare:${direct.upload.uid}`,
      storage_provider: "cloudflare",
      trigger_run_id: null,
      upload_url_created_at: now,
      user_id: auth.userId,
      video_ready_at: null,
      video_id: getString(body.video_id) || getString(body.videoId) || direct.upload.uid,
      video_url: `cloudflare-stream://${direct.upload.uid}`,
    });
    console.log("LOG_AFTER_JOB_CREATE", {
      cloudflareUid: direct.upload.uid,
      jobId,
      stored: created.stored,
    });
  } catch (error) {
    console.error("LOG_JOB_CREATE_ERROR", serializeError(error));
    throw error;
  }

  if (!created.stored) return Response.json({ error: created.reason }, { status: 502 });

  return Response.json({
    cloudflareUid: direct.upload.uid,
    contentType: getString(body.contentType) || "video/mp4",
    filename,
    fileSize,
    jobId,
    uploadURL: direct.upload.uploadURL,
  });
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getUuid(value: unknown) {
  const text = getString(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      cause: error.cause,
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }
  return {
    error,
    message: String(error),
    type: typeof error,
  };
}
