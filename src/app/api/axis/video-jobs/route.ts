import { tasks } from "@trigger.dev/sdk/v3";
import { assertAxisJobOwner, getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { getAxisVideoJob, updateAxisVideoJob } from "../../../../lib/axis-video-jobs";

export const runtime = "nodejs";

const axisVideoTriggerTtl = "30m";
const axisVideoTriggerQueue = "axis-video-processing";

type CreateVideoJobBody = {
  cloudflareUid?: unknown;
  fileSize?: unknown;
  filename?: unknown;
  jobId?: unknown;
};

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason }, { status: 401 });

  const body = (await request.json().catch(() => null)) as CreateVideoJobBody | null;
  if (!body) return Response.json({ error: "JSON body is required." }, { status: 400 });

  const jobId = getString(body.jobId);
  const cloudflareUid = getString(body.cloudflareUid);
  if (!jobId) return Response.json({ error: "jobId is required." }, { status: 400 });
  if (!cloudflareUid) return Response.json({ error: "cloudflareUid is required." }, { status: 400 });

  const existing = await getAxisVideoJob(jobId);
  if (existing.error) return Response.json({ code: existing.code, error: existing.error }, { status: 502 });
  if (!existing.record) return Response.json({ error: "job not found" }, { status: 404 });
  const ownership = assertAxisJobOwner({ recordUserId: existing.record.user_id, requestUserId: auth.userId });
  if (ownership) return Response.json({ code: ownership.code, error: ownership.reason }, { status: 403 });

  try {
    console.log("LOG_BEFORE_JOB_CREATE", {
      cloudflareUid,
      jobId,
      route: "/api/axis/video-jobs",
      step: "mark_uploaded",
    });
    await updateAxisVideoJob(jobId, {
      cloudflare_uid: cloudflareUid,
      error: null,
      file_size: getNumber(body.fileSize) ?? existing.record.file_size,
      filename: getString(body.filename) || existing.record.filename,
      progress: 5,
      status: "uploaded",
    });
    console.log("LOG_AFTER_JOB_CREATE", {
      cloudflareUid,
      jobId,
      route: "/api/axis/video-jobs",
      step: "mark_uploaded",
    });
  } catch (error) {
    console.error("LOG_JOB_CREATE_ERROR", {
      cloudflareUid,
      error: serializeError(error),
      jobId,
      route: "/api/axis/video-jobs",
      step: "mark_uploaded",
    });
    throw error;
  }

  try {
    console.log("AXIS_VIDEO_TRIGGER_REQUEST", {
      cloudflareUid,
      jobId,
      queueName: axisVideoTriggerQueue,
      ttl: axisVideoTriggerTtl,
    });
    console.log("AXIS_VIDEO_TRIGGER_RUNTIME", getTriggerRuntimeDiagnostics());
    console.log("SERVER_LOG_BEFORE_TRIGGER", {
      cloudflareUid,
      jobId,
      queueName: axisVideoTriggerQueue,
      ttl: axisVideoTriggerTtl,
    });
    const handle = await tasks.trigger("axis-video-processing", {
      cloudflareUid,
      jobId,
    }, {
      queue: axisVideoTriggerQueue,
      ttl: axisVideoTriggerTtl,
    });
    console.log("SERVER_LOG_AFTER_TRIGGER", {
      cloudflareUid,
      jobId,
      queueName: axisVideoTriggerQueue,
      triggerRunId: handle.id,
      ttl: axisVideoTriggerTtl,
    });
    console.log("AXIS_VIDEO_TRIGGER_CREATED", {
      cloudflareUid,
      jobId,
      queueName: axisVideoTriggerQueue,
      triggerRunId: handle.id,
      ttl: axisVideoTriggerTtl,
    });
    await updateAxisVideoJob(jobId, {
      status: "stream_processing",
      trigger_run_id: handle.id,
    });

    return Response.json({
      cloudflareUid,
      jobId,
      status: "stream_processing",
      triggerRequested: true,
      triggerResponse: {
        id: handle.id,
      },
      triggerRunId: handle.id,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("AXIS_VIDEO_TRIGGER_FAILED", {
      cloudflareUid,
      errorObject: serializeError(error),
      error: reason,
      jobId,
      queueName: axisVideoTriggerQueue,
      ttl: axisVideoTriggerTtl,
    });
    await updateAxisVideoJob(jobId, {
      error: reason,
      processing_stage: "failed",
      progress: 0,
      status: "failed",
    });
    return Response.json(
      {
        cloudflareUid,
        error: reason,
        errorObject: serializeError(error),
        jobId,
        status: "failed",
        triggerRequested: false,
      },
      { status: 502 },
    );
  }
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

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
