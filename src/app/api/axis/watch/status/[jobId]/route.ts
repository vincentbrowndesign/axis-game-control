import { runs } from "@trigger.dev/sdk/v3";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WatchStatus = "failed" | "queued" | "ready" | "sampling" | "watching";

type PollResponse = {
  error?: string;
  result?: unknown;
  status: WatchStatus;
};

function mapTriggerStatus(status: string): WatchStatus {
  switch (status) {
    case "COMPLETED":
      return "ready";
    case "FAILED":
    case "CANCELED":
    case "TIMED_OUT":
    case "EXPIRED":
      return "failed";
    default:
      return "watching";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;

  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "Missing job ID." }, { status: 400 });
  }

  try {
    const run = await runs.retrieve(jobId);
    const status = mapTriggerStatus(run.status);

    const payload: PollResponse = { status };

    if (status === "ready" && run.output !== undefined) {
      payload.result = run.output;
    }

    if (status === "failed") {
      payload.error = "Deep Watch could not process this clip.";
    }

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Could not retrieve job status.", status: "failed" } satisfies PollResponse,
      { status: 500 },
    );
  }
}
