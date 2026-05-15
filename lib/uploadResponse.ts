export type AxisUploadResponse = {
  ok: boolean
  replayId?: string
  videoUrl?: string
  createdAt?: number
  error?: string
  detail?: string
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0
    ? value
    : undefined
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined
}

export function normalizeUploadResponse(
  value: unknown
): AxisUploadResponse {
  const record = asRecord(value)

  return {
    ok: record.ok === true,
    replayId: asString(record.replayId),
    videoUrl: asString(record.videoUrl),
    createdAt: asNumber(record.createdAt),
    error: asString(record.error),
    detail: asString(record.detail),
  }
}

export function parseUploadResponseText(text: string) {
  return normalizeUploadResponse(JSON.parse(text))
}
