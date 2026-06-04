import { decodeAndPersistRealityFacts, getMuxPlaybackUrl } from "../../../../lib/axis-reality-decoder";

export const runtime = "nodejs";

type DecodeVideoBody = {
  artifact_id?: unknown;
  muxPlaybackId?: unknown;
  sourceClipCount?: unknown;
  upload_id?: unknown;
  uploadId?: unknown;
  video_url?: unknown;
  videoUrl?: unknown;
};

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getSourceClipCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, value) : 1;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as DecodeVideoBody | null;
  if (!body) return Response.json({ error: "Invalid request." }, { status: 400 });

  const uploadId = getString(body.upload_id) || getString(body.uploadId);
  if (!uploadId) return Response.json({ error: "upload_id is required." }, { status: 400 });

  const artifactId = getString(body.artifact_id, `decode-${uploadId}`);
  const muxPlaybackId = getString(body.muxPlaybackId);
  const videoUrl = getString(body.video_url) || getString(body.videoUrl) || getMuxPlaybackUrl(muxPlaybackId);
  const sourceClipCount = getSourceClipCount(body.sourceClipCount);

  try {
    console.log("DECODE_STARTED", {
      artifactId,
      hasMuxPlaybackId: Boolean(muxPlaybackId),
      hasVideoUrl: Boolean(videoUrl),
      uploadId,
    });
    const result = await decodeAndPersistRealityFacts({
      artifactId,
      muxPlaybackId,
      sourceClipCount,
      uploadId,
      videoUrl,
    });

    console.log("DECODE_COMPLETE", {
      factCount: result.facts.length,
      stored: result.persistence.stored,
      uploadId,
    });

    return Response.json({
      facts: result.facts,
      raw_class_names: result.debug?.roboflow?.raw_class_names ?? [],
      raw_detection_count: result.debug?.roboflow?.raw_detection_count ?? 0,
      ball_detection_count: result.debug?.roboflow?.ball_detection_count ?? 0,
      first_20_detections: result.debug?.roboflow?.first_20_detections ?? [],
      stored: result.persistence.stored,
      tracks: result.tracks,
      tracks_stored: result.trackPersistence.stored,
    });
  } catch (error) {
    console.error("DECODE_COMPLETE", {
      reason: error instanceof Error ? error.message : String(error),
      status: "FAIL",
      uploadId,
    });
    console.error("Axis video decode failed", error);
    return Response.json({ facts: [], stored: false });
  }
}
