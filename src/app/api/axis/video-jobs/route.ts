import { tasks } from "@trigger.dev/sdk/v3";
import { getAxisVideoJob, updateAxisVideoJob } from "../../../../lib/axis-video-jobs";

export const runtime = "nodejs";

type CreateVideoJobBody = {
  cloudflareUid?: unknown;
  fileSize?: unknown;
  filename?: unknown;
  jobId?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateVideoJobBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const jobId = getString(body.jobId);
  const cloudflareUid = getString(body.cloudflareUid);
  if (!jobId) return Response.json({ error: "jobId is required." }, { status: 400 });
  if (!cloudflareUid) return Response.json({ error: "cloudflareUid is required." }, { status: 400 });

  const existing = await getAxisVideoJob(jobId);
  if (existing.error) return Response.json({ error: existing.error }, { status: 502 });
  if (!existing.record) return Response.json({ error: "job not found" }, { status: 404 });

  await updateAxisVideoJob(jobId, {
    cloudflare_uid: cloudflareUid,
    error: null,
    file_size: getNumber(body.fileSize) ?? existing.record.file_size,
    filename: getString(body.filename) || existing.record.filename,
    progress: 5,
    status: "uploaded",
  });

  try {
    const handle = await tasks.trigger("axis-video-processing", {
      cloudflareUid,
      jobId,
    });
    await updateAxisVideoJob(jobId, {
      status: "stream_processing",
      trigger_run_id: handle.id,
    });

    return Response.json({
      cloudflareUid,
      jobId,
      status: "stream_processing",
      triggerRunId: handle.id,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    await updateAxisVideoJob(jobId, {
      error: reason,
      processing_stage: "failed",
      progress: 0,
      status: "failed",
    });
    return Response.json({ error: reason, jobId, status: "failed" }, { status: 502 });
  }
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
