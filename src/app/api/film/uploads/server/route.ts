import { createMuxDirectUpload, MuxUploadError, uploadFileToMuxTus } from "../../../../../lib/mux-direct-upload";

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

    console.log("EXPORT_COMPLETE", {
      route: "/api/film/uploads/server",
      status: "PASS",
      uploadId,
    });

    return Response.json({ created: true, uploadId }, { status: 201 });
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
