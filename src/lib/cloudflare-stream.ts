type CloudflareStreamResult<T> = {
  errors?: Array<{ message?: string }>;
  result?: T;
  success?: boolean;
};

type DirectUploadResult = {
  uploadURL?: string;
  uid?: string;
};

type StreamVideoResult = {
  playback?: {
    hls?: string;
  };
  readyToStream?: boolean;
  status?: {
    state?: string;
  };
  uid?: string;
};

type StreamDownloadResult = {
  default?: {
    status?: string;
    url?: string;
  };
};

type StreamUploadResult = {
  uid?: string;
};

export type CloudflareDirectUpload = {
  uploadURL: string;
  uid: string;
};

export function getCloudflareStreamConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_STREAM_API_TOKEN;
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

export async function createCloudflareStreamDirectUpload({
  fileSize,
  filename,
}: {
  fileSize: number;
  filename: string;
}) {
  const config = getCloudflareStreamConfig();
  if (!config) return { error: "cloudflare_stream_not_configured", upload: null };

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/direct_upload`, {
    body: JSON.stringify({
      maxDurationSeconds: 10800,
      meta: {
        axis: "video-processing-v1",
        fileSize: String(fileSize),
        filename,
      },
      requireSignedURLs: false,
    }),
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  const json = (await response.json().catch(() => null)) as CloudflareStreamResult<DirectUploadResult> | null;
  const uploadURL = json?.result?.uploadURL;
  const uid = json?.result?.uid;
  if (!response.ok || !json?.success || !uploadURL || !uid) {
    return { error: getCloudflareError(json) || `cloudflare_direct_upload_failed_${response.status}`, upload: null };
  }

  return { error: null, upload: { uploadURL, uid } satisfies CloudflareDirectUpload };
}

export async function uploadCloudflareStreamVideoFile({
  filePath,
  filename,
}: {
  filePath: string;
  filename: string;
}) {
  const config = getCloudflareStreamConfig();
  if (!config) return { error: "cloudflare_stream_not_configured", uid: null };

  const fs = await import("node:fs");
  const stats = await fs.promises.stat(filePath);
  console.log("CLOUDFLARE_REPLAY_UPLOAD_FILE_START", {
    filePath,
    fileSizeMb: bytesToMb(stats.size),
    memory: getMemorySnapshot(),
  });
  const form = new FormData();
  const fileBlob = await createFileBackedBlob(filePath);
  form.append("file", fileBlob, filename);
  form.append("requireSignedURLs", "false");

  const uploadEndpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream`;
  console.log("CLOUDFLARE_REPLAY_UPLOAD_REQUEST", {
    accountId: config.accountId,
    endpoint: uploadEndpoint,
    headers: getCloudflareAuditHeaders(config.apiToken),
    method: "POST",
    token: getCloudflareTokenAudit(config.apiToken),
  });
  const response = await fetch(uploadEndpoint, {
    body: form,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
    method: "POST",
  });
  const body = await response.text();
  console.log("CLOUDFLARE_REPLAY_UPLOAD_RESPONSE", {
    body,
    filename,
    memory: getMemorySnapshot(),
    status: response.status,
  });
  const json = parseCloudflareJson<StreamUploadResult>(body);
  const uid = json?.result?.uid;
  console.log("CLOUDFLARE_REPLAY_UPLOAD_UID", {
    success: json?.success ?? null,
    uid: uid ?? null,
  });
  if (!response.ok || !json?.success || !uid) {
    return { error: getCloudflareError(json) || `cloudflare_replay_upload_failed_${response.status}`, uid: null };
  }

  return { error: null, uid };
}

async function createFileBackedBlob(filePath: string) {
  const fsModule = await import("node:fs");
  const maybeOpenAsBlob = (fsModule as typeof fsModule & { openAsBlob?: (path: string, options?: { type?: string }) => Promise<Blob> }).openAsBlob;
  if (maybeOpenAsBlob) return maybeOpenAsBlob(filePath, { type: "video/mp4" });

  console.warn("CLOUDFLARE_REPLAY_UPLOAD_FILE_BACKED_BLOB_UNAVAILABLE", {
    fallback: "readFile",
    filePath,
  });
  const bytes = await fsModule.promises.readFile(filePath);
  return new Blob([bytes], { type: "video/mp4" });
}

export async function getCloudflareStreamVideo(uid: string) {
  const config = getCloudflareStreamConfig();
  if (!config) return { error: "cloudflare_stream_not_configured", video: null };

  console.log("CLOUDFLARE_ACCOUNT_ID_EXISTS", config.accountId ? "exists" : "missing");
  console.log("CLOUDFLARE_STREAM_API_TOKEN_EXISTS", config.apiToken ? "exists" : "missing");
  console.log("CLOUDFLARE_STREAM_API_TOKEN_LENGTH", config.apiToken.length);

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  });
  const responseBody = await response.text();
  console.log("CLOUDFLARE_RESPONSE_STATUS", response.status);
  console.log("CLOUDFLARE_RESPONSE_BODY", responseBody);
  console.log("PROCESSING_STEP_2_RESPONSE", {
    body: responseBody,
    env: {
      CLOUDFLARE_ACCOUNT_ID: {
        empty: !config.accountId.trim(),
        exists: Boolean(config.accountId),
      },
      CLOUDFLARE_STREAM_API_TOKEN: {
        empty: !config.apiToken.trim(),
        exists: Boolean(config.apiToken),
      },
    },
    request: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}`,
    status: response.status,
  });
  const json = parseCloudflareJson<StreamVideoResult>(responseBody);
  if (!response.ok || !json?.success || !json.result) {
    return { error: getCloudflareError(json) || `cloudflare_video_read_failed_${response.status}`, video: null };
  }

  return { error: null, video: json.result };
}

export async function createCloudflareStreamDownload(uid: string) {
  const config = getCloudflareStreamConfig();
  if (!config) return { error: "cloudflare_stream_not_configured" };

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}/downloads`;
  console.log("CLOUDFLARE_MP4_DOWNLOAD_CREATE_REQUEST", {
    accountId: config.accountId,
    endpoint,
    headers: getCloudflareAuditHeaders(config.apiToken),
    method: "POST",
    requestBody: null,
    token: getCloudflareTokenAudit(config.apiToken),
    uid,
  });
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
    method: "POST",
  });
  const responseBody = await response.text();
  console.log("CLOUDFLARE_MP4_DOWNLOAD_CREATE_RESPONSE", {
    body: responseBody,
    endpoint,
    method: "POST",
    status: response.status,
    uid,
  });
  const json = parseCloudflareJson<unknown>(responseBody);
  if (!response.ok || json?.success === false) {
    return { error: getCloudflareError(json) || `cloudflare_download_create_failed_${response.status}` };
  }

  return { error: null };
}

export async function getCloudflareStreamDownload(uid: string) {
  const config = getCloudflareStreamConfig();
  if (!config) return { download: null, error: "cloudflare_stream_not_configured" };

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}/downloads`;
  console.log("CLOUDFLARE_MP4_DOWNLOAD_POLL_REQUEST", {
    accountId: config.accountId,
    endpoint,
    headers: getCloudflareAuditHeaders(config.apiToken),
    method: "GET",
    token: getCloudflareTokenAudit(config.apiToken),
    uid,
  });
  const response = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  });
  const responseBody = await response.text();
  console.log("CLOUDFLARE_MP4_DOWNLOAD_POLL_RESPONSE", {
    body: responseBody,
    endpoint,
    method: "GET",
    status: response.status,
    uid,
  });
  const json = parseCloudflareJson<StreamDownloadResult>(responseBody);
  if (!response.ok || !json?.success || !json.result) {
    return { download: null, error: getCloudflareError(json) || `cloudflare_download_read_failed_${response.status}` };
  }

  return { download: json.result, error: null };
}

export async function waitForCloudflareStreamReady(uid: string) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = await getCloudflareStreamVideo(uid);
    if (result.error) throw new Error(result.error);
    if (result.video?.readyToStream || result.video?.status?.state === "ready") return result.video;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("cloudflare_stream_not_ready");
}

export async function waitForCloudflareMp4Download(uid: string) {
  console.log("CLOUDFLARE_MP4_DOWNLOAD_WAIT_START", {
    uid,
  });
  const created = await createCloudflareStreamDownload(uid);
  if (created.error) throw new Error(created.error);

  for (let attempt = 0; attempt < 90; attempt += 1) {
    console.log("CLOUDFLARE_MP4_DOWNLOAD_WAIT_ATTEMPT", {
      attempt: attempt + 1,
      uid,
    });
    const result = await getCloudflareStreamDownload(uid);
    if (result.error) throw new Error(result.error);
    const download = result.download?.default;
    console.log("CLOUDFLARE_MP4_DOWNLOAD_STATUS", {
      attempt: attempt + 1,
      status: download?.status ?? null,
      uid,
      urlPresent: Boolean(download?.url),
    });
    if (download?.status === "ready" && download.url) {
      console.log("CLOUDFLARE_MP4_DOWNLOAD_READY", {
        attempt: attempt + 1,
        uid,
        url: download.url,
      });
      return download.url;
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error("cloudflare_mp4_not_ready");
}

function getCloudflareError(json: CloudflareStreamResult<unknown> | null) {
  return json?.errors?.map((error) => error.message).filter(Boolean).join("; ") || "";
}

function parseCloudflareJson<T>(body: string) {
  try {
    return JSON.parse(body) as CloudflareStreamResult<T>;
  } catch {
    return null;
  }
}

function getCloudflareAuditHeaders(apiToken: string) {
  return {
    Authorization: apiToken ? "Bearer <redacted>" : "missing",
  };
}

function getCloudflareTokenAudit(apiToken: string) {
  return {
    exists: Boolean(apiToken),
    length: apiToken.length,
  };
}

function getMemorySnapshot() {
  const memory = process.memoryUsage();
  return {
    external: memory.external,
    heapTotal: memory.heapTotal,
    heapUsed: memory.heapUsed,
    rss: memory.rss,
  };
}

function bytesToMb(value: number) {
  return Math.round((value / 1024 / 1024) * 100) / 100;
}
