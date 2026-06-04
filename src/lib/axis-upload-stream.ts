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

type MultipartUploadOptions = {
  fieldName?: string;
  limitBytes?: number;
  request: Request;
  videoPath: string;
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

export async function saveMultipartVideoToTempFile({
  fieldName = "video",
  limitBytes = axisMaxUploadBytes,
  request,
  videoPath,
}: MultipartUploadOptions): Promise<AxisUploadedFile> {
  if (!request.body) throw new Error("video upload body is required");

  const boundary = getMultipartBoundary(request.headers.get("content-type"));
  if (!boundary) throw new Error("multipart/form-data boundary is required");

  const declaredSize = getHeaderNumber(request.headers.get("content-length"));
  if (declaredSize !== null && declaredSize > limitBytes + boundary.length + 4096) {
    throw new AxisUploadTooLargeError(limitBytes);
  }

  const boundaryMarker = Buffer.from(`--${boundary}`);
  const partBoundary = Buffer.from(`\r\n--${boundary}`);
  const headerEnd = Buffer.from("\r\n\r\n");
  const reader = request.body.getReader();
  const writer = createWriteStream(videoPath);
  let buffer = Buffer.alloc(0);
  let fileName = "upload.mp4";
  let foundFile = false;
  let headerParsed = false;
  let writtenBytes = 0;
  const holdBackBytes = partBoundary.length + 8;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (!done && value) buffer = Buffer.concat([buffer, Buffer.from(value)]);

      while (buffer.length > 0) {
        if (!foundFile) {
          const firstBoundaryIndex = buffer.indexOf(boundaryMarker);
          if (firstBoundaryIndex === -1) {
            if (done) throw new Error("multipart boundary was not found");
            break;
          }

          const afterBoundary = firstBoundaryIndex + boundaryMarker.length;
          if (buffer.length < afterBoundary + 2) break;
          buffer = buffer.subarray(afterBoundary);
          if (buffer.subarray(0, 2).toString() === "--") {
            throw new Error(`multipart field "${fieldName}" was not found`);
          }
          if (buffer.subarray(0, 2).toString() === "\r\n") buffer = buffer.subarray(2);
          foundFile = true;
        }

        if (!headerParsed) {
          const headerIndex = buffer.indexOf(headerEnd);
          if (headerIndex === -1) {
            if (done) throw new Error("multipart headers were incomplete");
            break;
          }

          const headerText = buffer.subarray(0, headerIndex).toString("utf8");
          const disposition = getMultipartHeader(headerText, "content-disposition");
          const partName = getDispositionValue(disposition, "name");
          if (partName !== fieldName) {
            buffer = buffer.subarray(headerIndex + headerEnd.length);
            foundFile = false;
            continue;
          }

          fileName = getSafeFileName(getDispositionValue(disposition, "filename"));
          headerParsed = true;
          buffer = buffer.subarray(headerIndex + headerEnd.length);
        }

        const boundaryIndex = buffer.indexOf(partBoundary);
        if (boundaryIndex !== -1) {
          const fileChunk = buffer.subarray(0, boundaryIndex);
          writtenBytes += fileChunk.byteLength;
          if (writtenBytes > limitBytes) throw new AxisUploadTooLargeError(limitBytes);
          if (fileChunk.length) await writeChunk(writer, fileChunk);
          return {
            fileName,
            fileSize: writtenBytes,
            fileSizeMB: roundMetric(writtenBytes / 1024 / 1024),
            path: videoPath,
          };
        }

        if (done) throw new Error("multipart upload ended before file boundary");
        if (buffer.length <= holdBackBytes) break;

        const writableLength = buffer.length - holdBackBytes;
        const fileChunk = buffer.subarray(0, writableLength);
        writtenBytes += fileChunk.byteLength;
        if (writtenBytes > limitBytes) throw new AxisUploadTooLargeError(limitBytes);
        await writeChunk(writer, fileChunk);
        buffer = buffer.subarray(writableLength);
      }

      if (done) break;
    }
  } finally {
    reader.releaseLock();
    await closeWriter(writer);
  }

  throw new Error("multipart video upload was not completed");
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

function getMultipartBoundary(contentType: string | null) {
  const match = contentType?.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] ?? match?.[2]?.trim() ?? null;
}

function getMultipartHeader(headerText: string, headerName: string) {
  const lowerHeaderName = headerName.toLowerCase();
  const line = headerText
    .split(/\r\n/)
    .find((entry) => entry.toLowerCase().startsWith(`${lowerHeaderName}:`));
  return line ? line.slice(line.indexOf(":") + 1).trim() : "";
}

function getDispositionValue(disposition: string, key: string) {
  const match = disposition.match(new RegExp(`${key}="([^"]*)"`, "i"));
  return match?.[1] ?? null;
}

function roundMetric(value: number) {
  return Math.round(value * 100) / 100;
}
