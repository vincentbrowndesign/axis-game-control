export const runtime = "nodejs";

function getMuxAuthHeader() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) return null;

  return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}

export async function POST() {
  const authorization = getMuxAuthHeader();
  if (!authorization) {
    console.error("UPLOAD_COMPLETE", { reason: "Mux credentials missing", status: "FAIL" });
    return Response.json({ created: false }, { status: 503 });
  }

  const response = await fetch("https://api.mux.com/video/v1/uploads", {
    body: JSON.stringify({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
      },
    }),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as
    | {
        data?: {
          id?: string;
          url?: string;
        };
      }
    | null;

  if (!response.ok || !result?.data?.id || !result.data.url) {
    console.error("Unable to create Mux upload", { status: response.status });
    console.error("UPLOAD_COMPLETE", { reason: `Mux upload create failed HTTP ${response.status}`, status: "FAIL" });
    return Response.json({ created: false }, { status: 502 });
  }

  console.log("UPLOAD_COMPLETE", { status: "PASS", uploadId: result.data.id });

  return Response.json(
    {
      created: true,
      uploadId: result.data.id,
      uploadUrl: result.data.url,
    },
    { status: 201 },
  );
}
