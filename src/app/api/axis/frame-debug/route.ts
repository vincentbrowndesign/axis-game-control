import { getMuxPlaybackUrl, runAxisFrameDebugPass } from "../../../../lib/axis-frame-debug";

export const runtime = "nodejs";
export const maxDuration = 300;

type FrameDebugBody = {
  frameIntervalSeconds?: unknown;
  muxPlaybackId?: unknown;
  sampleEverySeconds?: unknown;
  video_url?: unknown;
  videoUrl?: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getFrameIntervalSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as FrameDebugBody | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const muxPlaybackId = getString(body.muxPlaybackId);
  const videoUrl = getString(body.video_url) || getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  if (!videoUrl) return Response.json({ error: "videoUrl or muxPlaybackId is required." }, { status: 400 });

  try {
    const result = await runAxisFrameDebugPass({
      frameIntervalSeconds: getFrameIntervalSeconds(body.sampleEverySeconds) ?? getFrameIntervalSeconds(body.frameIntervalSeconds),
      muxPlaybackId,
      videoUrl,
    });
    return Response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("FRAME_DEBUG_FAILED", { reason });
    return Response.json(
      {
        BALL_DETECTIONS: 0,
        BALL_TRACK_COUNT: 0,
        BALL_TRACK_CREATED: false,
        BALL_TRACK_FILE_EXISTS: false,
        DEBUG_MP4_CREATED: false,
        FIRST_BALL_FRAME: null,
        LAST_BALL_FRAME: null,
        TOTAL_DETECTIONS: 0,
        TOTAL_FRAMES: 0,
        error: reason,
        exact_failing_step: "FRAME_DEBUG_PASS_FAILED",
      },
      { status: 500 },
    );
  }
}
