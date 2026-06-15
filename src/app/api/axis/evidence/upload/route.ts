export const runtime = "nodejs";

import { createSupabaseFromRequest } from "../../../../../lib/axis-server";

export async function POST(req: Request) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const threadId = formData.get("threadId");
  const sb = createSupabaseFromRequest(req);

  const {
    data: { user },
  } = await sb.auth.getUser();
  const userId = user?.id ?? "guest";

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const segment = typeof threadId === "string" && threadId ? threadId : "new";
  const path = `${userId}/${segment}/${ts}-${safeName}`;

  const buffer = await file.arrayBuffer();
  const { data, error } = await sb.storage
    .from("axis-evidence")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[axis/evidence/upload]", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = sb.storage.from("axis-evidence").getPublicUrl(data.path);

  return Response.json({
    attachmentUrl: publicUrl,
    attachmentPath: data.path,
    mimeType: file.type,
    fileName: file.name,
  });
}
