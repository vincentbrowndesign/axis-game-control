import { createMuxDirectUpload, getMuxAuthHeader, MuxUploadError, uploadFileToMuxTus } from "../../../../../lib/mux-direct-upload";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  console.log("EXPORT_START", { route: "/api/film/uploads/server", status: "START" });

  try {
    const form = await request.formData();
    const video = form.get("file");

    if (!(video instanceof Blob)) {
      console.error("MUX_UPLOAD_FAILED", {
        reason: "Missing file payload.",
        route: "/api/film/uploads/server",
        status: "FAIL",
      });
      return Response.json({ created: false, error: "file is required" }, { status: 400 });
    }

    const fileName = video instanceof File ? video.name : "axis-replay.mp4";
    const contentType = video.type || "video/mp4";
    const { uploadId, uploadUrl } = await createMuxDirectUpload();

    await uploadFileToMuxTus({
      contentType,
      fileName,
      fileSize: video.size,
      uploadUrl,
      video,
    });
    const ready = await waitForMuxPlayback(uploadId);

    console.log("EXPORT_COMPLETE", {
      playbackId: ready.playbackId,
      route: "/api/film/uploads/server",
      status: "PASS",
      uploadId,
    });

    return Response.json(
      {
        created: true,
        muxAssetId: ready.muxAssetId,
        playbackId: ready.playbackId,
        uploadId,
        videoUrl: ready.playbackId ? `https://stream.mux.com/${ready.playbackId}.m3u8` : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    const status = error instanceof MuxUploadError ? error.status : 502;
    console.error("MUX_UPLOAD_FAILED", {
      reason: error instanceof Error ? error.message : "Unknown Mux upload failure.",
      route: "/api/film/uploads/server",
      status: "FAIL",
    });
    return Response.json({ created: false }, { status });
  }
}

async function waitForMuxPlayback(uploadId: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const ready = await readMuxPlayback(uploadId);
    if (ready.playbackId) return ready;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new MuxUploadError("Video storage was not ready.", 504);
}

async function readMuxPlayback(uploadId: string) {
  const authorization = getMuxAuthHeader();
  if (!authorization) throw new MuxUploadError("Mux credentials missing.", 503);

  const upload = await getMuxJson(`/uploads/${encodeURIComponent(uploadId)}`, authorization);
  const uploadData = upload.result as
    | {
        data?: {
          asset_id?: string;
        };
      }
    | null;

  if (!upload.response.ok) throw new MuxUploadError(`Mux upload read failed HTTP ${upload.response.status}`);
  const muxAssetId = uploadData?.data?.asset_id;
  if (!muxAssetId) return { muxAssetId: undefined, playbackId: undefined };

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

  if (!asset.response.ok) throw new MuxUploadError(`Mux asset read failed HTTP ${asset.response.status}`);
  const playbackId = assetData?.data?.status === "ready" ? assetData.data.playback_ids?.[0]?.id : undefined;
  return { muxAssetId, playbackId };
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
