type MuxUploadCreateResult = {
  expiresAt: string | null;
  uploadId: string;
  uploadUrl: string;
};

export class MuxUploadError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "MuxUploadError";
    this.status = status;
  }
}

export function getMuxAuthHeader() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) return null;

  return `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64")}`;
}

export async function createMuxDirectUpload(corsOrigin = "*"): Promise<MuxUploadCreateResult> {
  const authorization = getMuxAuthHeader();
  if (!authorization) throw new MuxUploadError("Mux credentials missing.", 503);

  console.log("MUX_UPLOAD_CREATE_START", {
    endpoint: "https://api.mux.com/video/v1/uploads",
    hasAuthorization: Boolean(authorization),
    method: "POST",
    route: "server",
  });
  const response = await fetch("https://api.mux.com/video/v1/uploads", {
    body: JSON.stringify({
      cors_origin: corsOrigin,
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
  const responseHeaders = headersToObject(response.headers);
  const result = (await response.json().catch(() => null)) as
    | {
        data?: {
          id?: string;
          timeout?: number;
          url?: string;
        };
      }
    | null;

  console.log("MUX_UPLOAD_CREATE_RESPONSE", {
    body: scrubMuxUploadBody(result),
    headers: responseHeaders,
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok || !result?.data?.id || !result.data.url) {
    console.error("MUX_UPLOAD_FAILED", {
      body: scrubMuxUploadBody(result),
      headers: responseHeaders,
      reason: `Mux upload create failed HTTP ${response.status}`,
      status: "FAIL",
    });
    throw new MuxUploadError(`Mux upload create failed HTTP ${response.status}`);
  }

  const expiresAt = getMuxUploadExpiration(result.data.timeout);
  console.log("MUX_UPLOAD_CREATED", {
    expiresAt,
    uploadId: result.data.id,
  });
  console.log("MUX_UPLOAD_ID", result.data.id);
  console.log("MUX_UPLOAD_URL", {
    expiresAt,
    status: "PASS",
    uploadId: result.data.id,
    uploadUrl: result.data.url,
  });

  return {
    expiresAt,
    uploadId: result.data.id,
    uploadUrl: result.data.url,
  };
}

export async function uploadFileToMuxTus({
  contentType,
  fileName,
  fileSize,
  uploadUrl,
  video,
}: {
  contentType: string;
  fileName: string;
  fileSize: number;
  uploadUrl: string;
  video: Blob;
}) {
  const metadata = [
    `filename ${Buffer.from(fileName || "axis-video").toString("base64")}`,
    `filetype ${Buffer.from(contentType || "video/mp4").toString("base64")}`,
  ].join(",");

  const createResponse = await fetch(uploadUrl, {
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(fileSize),
      "Upload-Metadata": metadata,
    },
    method: "POST",
  });

  const location = createResponse.headers.get("Location");
  if (!createResponse.ok || !location) {
    console.error("MUX_UPLOAD_FAILED", {
      reason: `Mux TUS create failed HTTP ${createResponse.status}`,
      status: "FAIL",
    });
    throw new MuxUploadError(`Mux TUS create failed HTTP ${createResponse.status}`);
  }

  const patchUrl = new URL(location, uploadUrl).toString();
  const patchResponse = await fetch(patchUrl, {
    body: video,
    headers: {
      "Content-Type": "application/offset+octet-stream",
      "Tus-Resumable": "1.0.0",
      "Upload-Offset": "0",
    },
    method: "PATCH",
  });

  if (!patchResponse.ok) {
    console.error("MUX_UPLOAD_FAILED", {
      reason: `Mux TUS upload failed HTTP ${patchResponse.status}`,
      status: "FAIL",
    });
    throw new MuxUploadError(`Mux TUS upload failed HTTP ${patchResponse.status}`);
  }
}

function headersToObject(headers: Headers) {
  return Object.fromEntries(headers.entries());
}

function scrubMuxUploadBody(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  const record = result as Record<string, unknown>;
  const data = record.data && typeof record.data === "object" && !Array.isArray(record.data)
    ? { ...(record.data as Record<string, unknown>) }
    : undefined;
  return data ? { ...record, data } : record;
}

function getMuxUploadExpiration(timeout: unknown) {
  if (typeof timeout !== "number" || !Number.isFinite(timeout)) return null;
  return new Date(Date.now() + timeout * 1000).toISOString();
}
