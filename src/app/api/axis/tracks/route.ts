import { getAxisEntityTracks, type AxisEntityTrackRecord } from "../../../../lib/axis-persistence";

export const runtime = "nodejs";

function getLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 500;
  return Number.isFinite(parsed) ? parsed : 500;
}

function getEntityType(value: string | null): AxisEntityTrackRecord["entity_type"] | undefined {
  if (value === "ball" || value === "hoop" || value === "player") return value;
  return undefined;
}

function normalizeReplayUploadId(value: string | undefined) {
  if (!value) return undefined;
  return value.startsWith("replay-") ? value.slice("replay-".length) : value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const artifactId = url.searchParams.get("artifact_id") ?? undefined;
  const entityType = getEntityType(url.searchParams.get("entity_type"));
  const rawUploadId = url.searchParams.get("upload_id") ?? undefined;
  const uploadId = normalizeReplayUploadId(rawUploadId);
  const limit = getLimit(url.searchParams.get("limit"));
  console.log("REPLAY_TRACKS_REQUEST", {
    replay_id: rawUploadId,
    read_upload_id: uploadId,
  });
  const history = await getAxisEntityTracks({ artifactId, entityType, limit, uploadId });

  if (history.error) {
    console.error("TRACKS_READ_FAILED", {
      error: history.error,
      read_upload_id: uploadId,
      replay_id: rawUploadId,
    });
    return Response.json({ error: history.error, records: [] }, { status: 502 });
  }
  console.log("TRACKS_READ_COMPLETE", {
    first_track_point: history.records[0] ?? null,
    read_upload_id: uploadId,
    replay_id: rawUploadId,
    tracks_read_count: history.records.length,
  });
  return Response.json({ records: history.records });
}
