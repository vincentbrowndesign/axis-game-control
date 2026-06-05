import { tasks } from "@trigger.dev/sdk/v3";
import { getAxisVideoJobByCloudflareUid, updateAxisVideoJob } from "../../../../lib/axis-video-jobs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const payload = parsePayload(rawBody);
  if (!payload) return Response.json({ error: "Invalid webhook body." }, { status: 400 });

  if (!isWebhookAllowed(request)) {
    return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  const cloudflareUid = getWebhookUid(payload);
  if (!cloudflareUid) return Response.json({ error: "Cloudflare Stream uid missing." }, { status: 400 });

  const job = await getAxisVideoJobByCloudflareUid(cloudflareUid);
  if (job.error) return Response.json({ error: job.error }, { status: 502 });
  if (!job.record) return Response.json({ received: true, matched: false });

  const isReady = isReadyPayload(payload);
  await updateAxisVideoJob(job.record.job_id, {
    error: null,
    progress: isReady ? 20 : 10,
    status: isReady ? "ready_for_axis_processing" : "stream_processing",
    video_ready_at: isReady ? new Date().toISOString() : job.record.video_ready_at,
  });

  if (isReady && !job.record.trigger_run_id) {
    const handle = await tasks.trigger("axis-video-processing", {
      cloudflareUid,
      jobId: job.record.job_id,
    });
    await updateAxisVideoJob(job.record.job_id, {
      status: "stream_processing",
      trigger_run_id: handle.id,
    });
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
