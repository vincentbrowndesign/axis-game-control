import { createMuxDirectUpload, MuxUploadError } from "../../../../lib/mux-direct-upload";

export const runtime = "nodejs";

export async function POST() {
  console.log("EXPORT_START", { route: "/api/film/uploads", status: "START" });

  try {
    const upload = await createMuxDirectUpload();
    console.log("EXPORT_COMPLETE", {
      expiresAt: upload.expiresAt,
      route: "/api/film/uploads",
      status: "PASS",
      uploadId: upload.uploadId,
      uploadUrl: upload.uploadUrl,
    });

    return Response.json(
      {
        created: true,
        expiresAt: upload.expiresAt,
        uploadId: upload.uploadId,
        uploadUrl: upload.uploadUrl,
      },
      { status: 201 },
    );
  } catch (error) {
    const status = error instanceof MuxUploadError ? error.status : 502;
    const failure = serializeFailure("mux_upload_create", error);
    console.error("MUX_UPLOAD_FAILED", {
      ...failure,
      route: "/api/film/uploads",
      status: "FAIL",
    });
    return Response.json(
      {
        created: false,
        ...failure,
      },
      { status },
    );
  }
}

function serializeFailure(stage: string, error: unknown) {
  return {
    error: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack ?? null : null,
    stage,
  };
}
