import { getAxisExportHistory } from "../../../../lib/axis-persistence";
import { getAxisRequestUser } from "../../../../lib/axis-request-auth";

export const runtime = "nodejs";

function getLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 50;
  return Number.isFinite(parsed) ? parsed : 50;
}

export async function GET(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ code: auth.code, error: auth.reason, records: [] }, { status: 401 });

  const url = new URL(request.url);
  const artifactId = url.searchParams.get("artifact_id") ?? undefined;
  const exportId = url.searchParams.get("export_id") ?? undefined;
  const limit = getLimit(url.searchParams.get("limit"));
  const history = await getAxisExportHistory({ artifactId, exportId, limit, userId: auth.userId });

  if (history.error) return Response.json({ code: history.code, error: history.error, records: [] }, { status: 502 });
  return Response.json({ records: history.records });
}
