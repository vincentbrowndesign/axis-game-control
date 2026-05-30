export const runtime = "nodejs";

function getMuxAuthHeader() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) return null;

  return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}

async function getMuxJson(path: string, authorization: string) {
  const response = await fetch(`https://api.mux.com/video/v1${path}`, {
    headers: {
      Authorization: authorization,
    },
  });
  const result = await response.json().catch(() => null);

  return { response, result };
}

export async function GET(_request: Request, context: { params: Promise<{ uploadId: string }> }) {
  const authorization = getMuxAuthHeader();
  if (!authorization) return Response.json({ ready: false }, { status: 503 });

  const { uploadId } = await context.params;
  const upload = await getMuxJson(`/uploads/${encodeURIComponent(uploadId)}`, authorization);
  const uploadData = upload.result as
    | {
        data?: {
          asset_id?: string;
          status?: string;
        };
      }
    | null;

  if (!upload.response.ok) {
    console.error("Unable to read Mux upload", { status: upload.response.status });
    return Response.json({ ready: false }, { status: 502 });
  }

  const muxAssetId = uploadData?.data?.asset_id;
  if (!muxAssetId) {
    return Response.json({
      muxAssetId: undefined,
      ready: false,
      status: uploadData?.data?.status ?? "waiting",
    });
  }

  const asset = await getMuxJson(`/assets/${encodeURIComponent(muxAssetId)}`, authorization);
  const assetData = asset.result as
    | {
        data?: {
          playback_ids?: Array<{
            id?: string;
          }>;
          status?: string;
        };
      }
    | null;

  if (!asset.response.ok) {
    console.error("Unable to read Mux asset", { status: asset.response.status });
    return Response.json({ muxAssetId, ready: false }, { status: 502 });
  }

  const playbackId = assetData?.data?.playback_ids?.[0]?.id;

  return Response.json({
    muxAssetId,
    playbackId,
    ready: Boolean(playbackId && assetData?.data?.status === "ready"),
    status: assetData?.data?.status ?? "processing",
    thumbnailUrl: playbackId ? `https://image.mux.com/${playbackId}/thumbnail.jpg` : undefined,
  });
}
