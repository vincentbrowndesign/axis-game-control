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

export async function getCloudflareStreamVideo(uid: string) {
  const config = getCloudflareStreamConfig();
  if (!config) return { error: "cloudflare_stream_not_configured", video: null };

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  });
  const responseBody = await response.text();
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

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}/downloads`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
    method: "POST",
  });
  const responseBody = await response.text();
  console.log("PROCESSING_STEP_3_CREATE_RESPONSE", {
    body: responseBody,
    request: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}/downloads`,
    status: response.status,
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

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}/downloads`, {
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
    },
  });
  const responseBody = await response.text();
  console.log("PROCESSING_STEP_3_READ_RESPONSE", {
    body: responseBody,
    request: `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/stream/${encodeURIComponent(uid)}/downloads`,
    status: response.status,
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
  const created = await createCloudflareStreamDownload(uid);
  if (created.error) throw new Error(created.error);

  for (let attempt = 0; attempt < 90; attempt += 1) {
    const result = await getCloudflareStreamDownload(uid);
    if (result.error) throw new Error(result.error);
    const download = result.download?.default;
    if (download?.status === "ready" && download.url) return download.url;
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
