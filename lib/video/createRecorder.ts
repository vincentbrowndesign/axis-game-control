import { getSupportedRecordingMime } from "./getSupportedRecordingMime"

export type AxisRecorderState =
  | "inactive"
  | "recording"
  | "stopping"
  | "stopped"
  | "error"

export type AxisRecorder = {
  mimeType: string
  state: () => AxisRecorderState
  start: () => void
  stop: () => Promise<Blob>
  cancel: () => void
}

export type CreateRecorderOptions = {
  stream: MediaStream
  timeslice?: number
}

function createMediaRecorder(stream: MediaStream) {
  const mimeType = getSupportedRecordingMime()

  if (mimeType) {
    try {
      return new MediaRecorder(stream, { mimeType })
    } catch {
      return new MediaRecorder(stream)
    }
  }

  return new MediaRecorder(stream)
}

export function createRecorder({
  stream,
  timeslice,
}: CreateRecorderOptions): AxisRecorder {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder unavailable")
  }

  const recorder = createMediaRecorder(stream)
  const chunks: BlobPart[] = []
  let recorderState: AxisRecorderState = "inactive"
  let stopResolver: ((blob: Blob) => void) | null = null
  let stopRejecter: ((error: Error) => void) | null = null

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data)
    }
  }

  recorder.onerror = () => {
    recorderState = "error"
    stopRejecter?.(new Error("Recording interrupted"))
  }

  recorder.onstop = () => {
    recorderState = "stopped"
    const mimeType = recorder.mimeType || getSupportedRecordingMime()
    const blob = new Blob(chunks, {
      type: mimeType || "video/webm",
    })

    stopResolver?.(blob)
  }

  return {
    mimeType: recorder.mimeType || getSupportedRecordingMime(),
    state: () => recorderState,
    start: () => {
      chunks.length = 0
      recorderState = "recording"
      recorder.start(timeslice)
    },
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        stopResolver = resolve
        stopRejecter = reject

        if (recorder.state === "inactive") {
          recorderState = "stopped"
          resolve(
            new Blob(chunks, {
              type: recorder.mimeType || "video/webm",
            })
          )
          return
        }

        recorderState = "stopping"
        recorder.stop()
      }),
    cancel: () => {
      chunks.length = 0

      if (recorder.state !== "inactive") {
        recorder.stop()
      }

      recorderState = "inactive"
    },
  }
}
