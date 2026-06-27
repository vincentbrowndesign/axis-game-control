import { getAxisRequestUser } from "../../../../lib/axis-request-auth";
import { createClipSource, listClipSources } from "../../../../lib/clip-room/db";
import { createCloudflareStreamDirectUpload } from "../../../../lib/cloudflare-stream";
import type { CreateClipSourceRequest } from "../../../../lib/clip-room/types";

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

  const body = (await request.json().catch(() => null)) as CreateClipSourceRequest | null;
  if (!body) return Response.json({ error: "JSON body required" }, { status: 400 });

  const origin = body.origin === "recorded" || body.origin === "uploaded" ? body.origin : null;
  if (!origin) return Response.json({ error: "origin must be 'recorded' or 'uploaded'" }, { status: 400 });

  const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim() : "clip.mp4";
  const fileSize = typeof body.fileSize === "number" && body.fileSize > 0 ? body.fileSize : 0;
  if (fileSize <= 0) return Response.json({ error: "fileSize is required" }, { status: 400 });

  const direct = await createCloudflareStreamDirectUpload({ filename, fileSize });
  if (direct.error || !direct.upload) {
    return Response.json({ error: direct.error ?? "upload url creation failed" }, { status: 502 });
  }

  const created = await createClipSource({
    ownerId: auth.userId,
    origin,
    filename,
    fileSize,
    cloudflareUid: direct.upload.uid,
  });

  if (created.error || !created.record) {
    return Response.json({ error: created.error ?? "db write failed" }, { status: 502 });
  }

  return Response.json({
    clipId: created.record.id,
    uploadUrl: direct.upload.uploadURL,
    cloudflareUid: direct.upload.uid,
  }, { status: 201 });
}
