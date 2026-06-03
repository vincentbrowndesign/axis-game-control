import { getAxisDecoderTests } from "../../../../lib/axis-persistence";

export const runtime = "nodejs";

function getLimit(value: string | null) {
  const parsed = value ? Number.parseInt(value, 10) : 25;
  return Number.isFinite(parsed) ? parsed : 25;
}

function getPass(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("upload_id") ?? undefined;
  const pass = getPass(url.searchParams.get("pass"));
  const limit = getLimit(url.searchParams.get("limit"));
  const tests = await getAxisDecoderTests({ limit, pass, uploadId });

  if (tests.error) return Response.json({ error: tests.error, records: [] }, { status: 502 });
  return Response.json({ records: tests.records });
}
