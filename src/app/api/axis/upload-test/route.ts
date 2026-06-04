import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  AxisUploadTooLargeError,
  axisMaxUploadBytes,
  getSafeFileName,
  saveRequestVideoToTempFile,
} from "../../../../lib/axis-upload-stream";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "axis-upload-test-"));
  const fileName = getSafeFileName(request.headers.get("x-axis-file-name"));
  const videoPath = path.join(workDir, fileName);

  try {
    const upload = await saveRequestVideoToTempFile({
      limitBytes: axisMaxUploadBytes,
      request,
      videoPath,
    });

    return Response.json({
      fileName: upload.fileName,
      fileSizeMB: upload.fileSizeMB,
      uploadSuccess: true,
    });
  } catch (error) {
    const isTooLarge = error instanceof AxisUploadTooLargeError;
    return Response.json(
      {
        error: error instanceof Error ? error.message : String(error),
        fileName,
        fileSizeMB: 0,
        uploadSuccess: false,
      },
      { status: isTooLarge ? 413 : 500 },
    );
  } finally {
    await fs.rm(workDir, { force: true, recursive: true }).catch(() => null);
  }
}
