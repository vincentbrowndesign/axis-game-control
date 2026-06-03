import { getAxisExportHistory } from "../../../../lib/axis-persistence";

export const runtime = "nodejs";

function getLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 50;
  return Number.isFinite(parsed) ? parsed : 50;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const artifactId = url.searchParams.get("artifact_id") ?? undefined;
  const exportId = url.searchParams.get("export_id") ?? undefined;
  const limit = getLimit(url.searchParams.get("limit"));
  const history = await getAxisExportHistory({ artifactId, exportId, limit });

  if (history.error) return Response.json({ error: history.error, records: [] }, { status: 502 });
  return Response.json({ records: history.records });
}
