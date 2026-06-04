import { createMuxDirectUpload, MuxUploadError } from "../../../../lib/mux-direct-upload";

export const runtime = "nodejs";

export async function POST() {
  console.log("EXPORT_START", { route: "/api/film/uploads", status: "START" });

  try {
    const upload = await createMuxDirectUpload();
    console.log("EXPORT_COMPLETE", { route: "/api/film/uploads", status: "PASS", uploadId: upload.uploadId });

    return Response.json(
      {
        created: true,
        uploadId: upload.uploadId,
        uploadUrl: upload.uploadUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    const status = error instanceof MuxUploadError ? error.status : 502;
    console.error("MUX_UPLOAD_FAILED", {
      reason: error instanceof Error ? error.message : "Unknown Mux upload failure.",
      route: "/api/film/uploads",
      status: "FAIL",
    });
    return Response.json({ created: false }, { status });
  }
}
