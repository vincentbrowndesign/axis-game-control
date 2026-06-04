import { createWriteStream } from "node:fs";

export const axisMaxUploadBytes = 500 * 1024 * 1024;

export class AxisUploadTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`Video is too large. Limit is ${Math.round(limitBytes / 1024 / 1024)}MB.`);
    this.name = "AxisUploadTooLargeError";
  }
}

export type AxisUploadedFile = {
  fileName: string;
  fileSize: number;
  fileSizeMB: number;
  path: string;
};

export async function saveRequestVideoToTempFile({
  limitBytes = axisMaxUploadBytes,
  request,
  videoPath,
}: {
  limitBytes?: number;
  request: Request;
  videoPath: string;
}): Promise<AxisUploadedFile> {
  if (!request.body) throw new Error("video upload body is required");

  const fileName = getSafeFileName(request.headers.get("x-axis-file-name"));
  const declaredSize = getHeaderNumber(request.headers.get("x-axis-file-size"));
  if (declaredSize !== null && declaredSize > limitBytes) {
    throw new AxisUploadTooLargeError(limitBytes);
  }

  let writtenBytes = 0;
  const reader = request.body.getReader();
  const writer = createWriteStream(videoPath);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value);
      writtenBytes += chunk.byteLength;
      if (writtenBytes > limitBytes) throw new AxisUploadTooLargeError(limitBytes);
      await writeChunk(writer, chunk);
    }
  } finally {
    reader.releaseLock();
    await closeWriter(writer);
  }

  return {
    fileName,
    fileSize: writtenBytes,
    fileSizeMB: roundMetric(writtenBytes / 1024 / 1024),
    path: videoPath,
  };
}

export function getDeclaredUploadSize(request: Request) {
  return getHeaderNumber(request.headers.get("x-axis-file-size"));
}

export function getSafeFileName(value: string | null) {
  const fallback = "upload.mp4";
  if (!value) return fallback;
  const clean = decodeURIComponent(value)
    .replace(/[\\/]/g, "")
    .replace(/[^\w .-]/g, "")
    .trim();
  return clean || fallback;
}

function writeChunk(writer: ReturnType<typeof createWriteStream>, chunk: Buffer) {
  return new Promise<void>((resolve, reject) => {
    writer.write(chunk, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function closeWriter(writer: ReturnType<typeof createWriteStream>) {
  return new Promise<void>((resolve, reject) => {
    writer.end((error?: Error | null) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

function getHeaderNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}
