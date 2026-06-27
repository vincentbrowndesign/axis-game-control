import { tasks } from "@trigger.dev/sdk/v3";
import { getAxisVideoJobByCloudflareUid, updateAxisVideoJob } from "../../../../lib/axis-video-jobs";
import { getClipSourceByCloudflareUid, updateClipSource } from "../../../../lib/clip-room/db";

export const runtime = "nodejs";

const axisVideoTriggerTtl = "30m";
const axisVideoTriggerQueue = "axis-video-processing";
const clipRoomTriggerTtl = "30m";
const clipRoomTriggerQueue = "clip-room-processing";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = parsePayload(rawBody);
  if (!payload) return Response.json({ error: "Invalid webhook body." }, { status: 400 });

  if (!isWebhookAllowed(request)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const cloudflareUid = getWebhookUid(payload);
  if (!cloudflareUid) return Response.json({ error: "Cloudflare Stream uid missing." }, { status: 400 });

  const isReady = isReadyPayload(payload);

  // ── Clip Room: clip_sources lookup ──────────────────────────────────────────
  const clipSource = await getClipSourceByCloudflareUid(cloudflareUid);
  if (clipSource.record && !isReady) {
    return Response.json({
      received: true,
      matched: true,
      product: "clip-room",
      clipId: clipSource.record.id,
      ready: false,
    });
  }

  if (clipSource.record && isReady && clipSource.record.status === "uploaded") {
    const src = clipSource.record;
    try {
      const handle = await tasks.trigger("clip-room-processing", {
        clipId: src.id,
        ownerId: src.ownerId,
        cloudflareUid,
      }, {
        queue: clipRoomTriggerQueue,
        ttl: clipRoomTriggerTtl,
      });
      console.log("CLIP_ROOM_TRIGGER_CREATED", { clipId: src.id, cloudflareUid, triggerRunId: handle.id });
      await updateClipSource(src.id, {
        status: "processing",
        processingStage: "queued",
        processingProgress: 5,
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("CLIP_ROOM_TRIGGER_FAILED", { clipId: src.id, cloudflareUid, reason });
      await updateClipSource(src.id, { status: "failed", error: reason });
    }
    return Response.json({ received: true, matched: true, product: "clip-room", clipId: src.id });
  }

  // ── Axis video processing: axis_video_jobs lookup ────────────────────────────
  const job = await getAxisVideoJobByCloudflareUid(cloudflareUid);
  if (job.error) return Response.json({ error: job.error }, { status: 502 });
  if (!job.record) return Response.json({ received: true, matched: false });

  await updateAxisVideoJob(job.record.job_id, {
    error: null,
    progress: isReady ? 20 : 10,
    status: isReady ? "ready_for_axis_processing" : "stream_processing",
    video_ready_at: isReady ? new Date().toISOString() : job.record.video_ready_at,
  });

  if (isReady && !job.record.trigger_run_id) {
    try {
      console.log("AXIS_VIDEO_TRIGGER_REQUEST", {
        cloudflareUid,
        jobId: job.record.job_id,
        queueName: axisVideoTriggerQueue,
        ttl: axisVideoTriggerTtl,
      });
      console.log("AXIS_VIDEO_TRIGGER_RUNTIME", getTriggerRuntimeDiagnostics());
      const handle = await tasks.trigger("axis-video-processing", {
        cloudflareUid,
        jobId: job.record.job_id,
      }, {
        queue: axisVideoTriggerQueue,
        ttl: axisVideoTriggerTtl,
      });
      console.log("AXIS_VIDEO_TRIGGER_CREATED", {
        cloudflareUid,
        jobId: job.record.job_id,
        queueName: axisVideoTriggerQueue,
        triggerRunId: handle.id,
        ttl: axisVideoTriggerTtl,
      });
      await updateAxisVideoJob(job.record.job_id, {
        status: "stream_processing",
        trigger_run_id: handle.id,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error("AXIS_VIDEO_TRIGGER_FAILED", {
        cloudflareUid,
        error: reason,
        jobId: job.record.job_id,
        queueName: axisVideoTriggerQueue,
        ttl: axisVideoTriggerTtl,
      });
      await updateAxisVideoJob(job.record.job_id, {
        error: reason,
        processing_stage: "failed",
        progress: 0,
        status: "failed",
      });
      return Response.json({ error: reason, jobId: job.record.job_id, status: "failed" }, { status: 502 });
    }
  }

  return Response.json({
    cloudflareUid,
    jobId: job.record.job_id,
    matched: true,
    ready: isReady,
    received: true,
  });
}

function parsePayload(rawBody: string) {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isWebhookAllowed(request: Request) {
  const secret = process.env.CLOUDFLARE_STREAM_WEBHOOK_SECRET;
  if (!secret) return true;

  const candidates = [
    request.headers.get("cf-webhook-auth"),
    request.headers.get("x-cloudflare-webhook-secret"),
    request.headers.get("x-axis-webhook-secret"),
  ].filter(Boolean);

  return candidates.includes(secret);
}

function getWebhookUid(payload: Record<string, unknown>) {
  const result = getRecord(payload.result);
  const data = getRecord(payload.data);
  const video = getRecord(payload.video);
  return getString(payload.uid) || getString(result?.uid) || getString(data?.uid) || getString(video?.uid);
}

function isReadyPayload(payload: Record<string, unknown>) {
  const result = getRecord(payload.result);
  const data = getRecord(payload.data);
  const status = getRecord(result?.status) ?? getRecord(data?.status);
  const state = getString(status?.state) || getString(result?.state) || getString(data?.state) || getString(payload.status);
  return payload.readyToStream === true || result?.readyToStream === true || data?.readyToStream === true || state === "ready";
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTriggerRuntimeDiagnostics() {
  const secret = process.env.TRIGGER_SECRET_KEY ?? "";
  const keyType = secret.startsWith("tr_prod_")
    ? "tr_prod_"
    : secret.startsWith("tr_dev_")
      ? "tr_dev_"
      : secret
        ? "other"
        : "missing";

  return {
    TRIGGER_API_URL: process.env.TRIGGER_API_URL ?? "default",
    TRIGGER_DEPLOYMENT_ID: process.env.TRIGGER_DEPLOYMENT_ID ?? "missing",
    TRIGGER_ENV: process.env.TRIGGER_ENV ?? "missing",
    TRIGGER_ENVIRONMENT_TARGET: keyType === "tr_prod_" ? "Production" : keyType === "tr_dev_" ? "Development" : "Unknown",
    TRIGGER_KEY_TYPE: keyType,
    TRIGGER_PROJECT_REF: process.env.TRIGGER_PROJECT_REF ?? "missing",
  };
}
