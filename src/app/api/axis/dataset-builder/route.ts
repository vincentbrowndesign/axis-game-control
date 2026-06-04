import { buildAxisDataset } from "../../../../lib/axis-dataset-builder";

export const runtime = "nodejs";
export const maxDuration = 300;

type DatasetBuilderBody = {
  muxPlaybackId?: unknown;
  sampleEverySeconds?: unknown;
  targetFrameCount?: unknown;
  videoId?: unknown;
  videoUrl?: unknown;
  video_url?: unknown;
  videos?: unknown;
};

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeVideos(body: DatasetBuilderBody) {
  if (Array.isArray(body.videos)) {
    return body.videos
      .map((video) => {
        if (!video || typeof video !== "object" || Array.isArray(video)) return null;
        const record = video as Record<string, unknown>;
        return {
          muxPlaybackId: getString(record.muxPlaybackId),
          videoId: getString(record.videoId) || getString(record.video_id),
          videoUrl: getString(record.videoUrl) || getString(record.video_url),
        };
      })
      .filter((video): video is { muxPlaybackId: string; videoId: string; videoUrl: string } => Boolean(video));
  }

  return [
    {
      muxPlaybackId: getString(body.muxPlaybackId),
      videoId: getString(body.videoId),
      videoUrl: getString(body.videoUrl) || getString(body.video_url),
    },
  ];
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DatasetBuilderBody | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  try {
    const result = await buildAxisDataset({
      sampleEverySeconds: getNumber(body.sampleEverySeconds),
      targetFrameCount: getNumber(body.targetFrameCount),
      videos: normalizeVideos(body),
    });
    return Response.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("DATASET_BUILDER_FAILED", { reason });
    return Response.json({ error: reason, frame_count: 0 }, { status: 500 });
  }
}
