const RECORDING_MIME_CANDIDATES = [
  "video/mp4;codecs=h264,aac",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
] as const

export type SupportedRecordingMime =
  (typeof RECORDING_MIME_CANDIDATES)[number]

export function getSupportedRecordingMime(): SupportedRecordingMime | "" {
  if (
    typeof window === "undefined" ||
    typeof MediaRecorder === "undefined" ||
    typeof MediaRecorder.isTypeSupported !== "function"
  ) {
    return ""
  }

  return (
    RECORDING_MIME_CANDIDATES.find((mimeType) =>
      MediaRecorder.isTypeSupported(mimeType)
    ) || ""
  )
}

export { RECORDING_MIME_CANDIDATES }
