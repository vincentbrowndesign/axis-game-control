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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const artifactId = url.searchParams.get("artifact_id") ?? undefined;
  const entityType = getEntityType(url.searchParams.get("entity_type"));
  const uploadId = url.searchParams.get("upload_id") ?? undefined;
  const limit = getLimit(url.searchParams.get("limit"));
  const history = await getAxisEntityTracks({ artifactId, entityType, limit, uploadId });

  if (history.error) {
    console.error("TRACKS_READ_FAILED", {
      error: history.error,
      uploadId,
    });
    return Response.json({ error: history.error, records: [] }, { status: 502 });
  }
  console.log("TRACKS_READ_COMPLETE", {
    count: history.records.length,
    uploadId,
  });
  return Response.json({ records: history.records });
}
