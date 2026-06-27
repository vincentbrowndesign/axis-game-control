import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { listClipSources } from "../../../../lib/clip-room/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  const result = await listClipSources(auth.userId);
  if (result.error) return Response.json({ error: result.error }, { status: 502 });

  return Response.json({ clips: result.records });
}

export async function POST(request: Request) {
  const auth = await getAxisRequestUser(request);
  if (auth.code) return Response.json({ error: auth.reason }, { status: 401 });

  return Response.json({
    error: "Use clip ingest so the original video is saved before playback processing.",
  }, { status: 410 });
}
