import type { SessionEnvironment, SessionSource } from "@/types/memory"

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "webm",
  "quicktime",
])

export type ReplayFileLike = {
  name?: string
  type?: string
  size: number
}

export function normalizeReplayFile(file: ReplayFileLike) {
  const originalName =
    typeof file?.name === "string" && file.name.length > 0
      ? file.name
      : "axis_capture"

  const mime =
    typeof file?.type === "string"
      ? file.type.toLowerCase()
      : ""

  const extension = originalName.includes(".")
    ? originalName.split(".").pop()?.toLowerCase() || "bin"
    : mime.includes("quicktime")
      ? "mov"
      : mime.includes("mp4")
        ? "mp4"
        : mime.includes("image/heic")
          ? "heic"
          : "bin"

  const safeBase =
    originalName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60) || "axis_capture"

  const finalName = `${Date.now()}_${safeBase}.${extension}`

  return {
    originalName,
    mime,
    extension,
    safeBase,
    finalName,
  }
}

export function sanitizeFileName(name: string) {
  return normalizeReplayFile({
    name,
    size: 1,
  }).finalName
}

export function getFileExtension(name: string, type?: string) {
  const { extension } = normalizeReplayFile({
    name,
    type,
    size: 1,
  })

  if (extension) return extension

  if (type?.includes("quicktime")) return "mov"
  if (type?.includes("mp4")) return "mp4"
  if (type?.includes("webm")) return "webm"

  return "mp4"
}

export function isSupportedReplayFile(file: {
  name?: string
  type?: string
  size: number
}) {
  if (!file.size) return false

  const { extension, mime } = normalizeReplayFile(file)

  if (mime.startsWith("video/")) return true

  return VIDEO_EXTENSIONS.has(extension)
}

export function createStoragePath({
  userId,
  fileName,
  type,
}: {
  userId: string
  fileName: string
  type?: string
}) {
  const { finalName } = normalizeReplayFile({
    name: fileName,
    type,
    size: 1,
  })

  return `${userId}/${finalName}`
}

export function normalizeSource(value: FormDataEntryValue | null): SessionSource {
  return value === "camera" ? "camera" : "upload"
}

export function normalizeEnvironment(
  value: FormDataEntryValue | null
): SessionEnvironment {
  if (
    value === "game" ||
    value === "mission" ||
    value === "workout"
  ) {
    return value
  }

  return "practice"
}

export function cleanText(
  value: FormDataEntryValue | null,
  fallback: string
) {
  if (typeof value !== "string") return fallback

  const clean = value.trim()

  return clean || fallback
}
