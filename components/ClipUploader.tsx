"use client"

import { useRef, useState } from "react"
import {
  type AxisUploadResponse,
  parseUploadResponseText,
} from "@/lib/uploadResponse"

type ClipUploaderProps = {
  onSelect: (file: File) => void
}

function statusFromUploadFailure(data: AxisUploadResponse) {
  return data.error || data.detail || "UPLOAD FAILED"
}

function statusFromCaughtError(error: unknown) {
  if (!(error instanceof Error)) {
    return "UPLOAD WAITING"
  }

  if (
    error.message === "NO FILE SELECTED" ||
    error.message === "INVALID FILE OBJECT" ||
    error.message === "EMPTY FILE"
  ) {
    return "INVALID FILE"
  }

  if (
    error.message.includes("Failed to fetch") ||
    error.message.includes("Load failed") ||
    error.message.includes("NetworkError")
  ) {
    return "ROUTE UNREACHABLE"
  }

  return error.message
}

export default function ClipUploader({
  onSelect,
}: ClipUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const [status, setStatus] = useState("IDLE")
  const [progress, setProgress] = useState(0)

  async function handleFileChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    try {
      const selectedFile =
        event.target.files?.[0]

      console.log(
        "AXIS RAW FILE",
        selectedFile
      )

      if (!selectedFile) {
        throw new Error(
          "NO FILE SELECTED"
        )
      }

      if (
        !(selectedFile instanceof File)
      ) {
        throw new Error(
          "INVALID FILE OBJECT"
        )
      }

      if (selectedFile.size <= 0) {
        throw new Error("EMPTY FILE")
      }

      console.log(
        "AXIS NAME",
        selectedFile.name
      )

      console.log(
        "AXIS TYPE",
        selectedFile.type
      )

      console.log(
        "AXIS SIZE",
        selectedFile.size
      )

      console.log(
        "AXIS UPLOAD START",
        {
          name: selectedFile.name,
          type: selectedFile.type,
          size: selectedFile.size,
        }
      )

      setStatus(
        "SIGNAL PATH VERIFIED"
      )

      const formData = new FormData()

      formData.append(
        "file",
        selectedFile
      )

      setStatus(
        "UPLOAD STARTED"
      )

      setProgress(25)

      const response = await fetch(
        "/api/upload",
        {
          method: "POST",
          body: formData,
        }
      )

      console.log(
        "AXIS RESPONSE STATUS",
        response.status
      )

      const contentType =
        response.headers.get(
          "content-type"
        ) || ""

      console.log(
        "AXIS CONTENT TYPE",
        contentType
      )

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text()

        console.error(
          "AXIS NON JSON RESPONSE TEXT",
          text
        )
        console.log("UPLOAD_RESPONSE_RAW", text)

        throw new Error(
          "UPLOAD PROCESSING"
        )
      }

      const text =
        await response.text()

      console.log(
        "AXIS RESPONSE TEXT",
        text
      )
      console.log("UPLOAD_RESPONSE_RAW", text)

      let data: AxisUploadResponse

      try {
        data = parseUploadResponseText(text)
      } catch (error) {
        console.error(
          "AXIS JSON PARSE FAILURE",
          error
        )

        throw new Error(
          "UPLOAD PROCESSING"
        )
      }

      console.log(
        "AXIS PARSED JSON",
        data
      )

      if (!response.ok || !data.ok) {
        console.error(
          "AXIS UPLOAD FAILURE",
          data?.error || data?.detail || "unknown"
        )

        throw new Error(
          statusFromUploadFailure(data)
        )
      }

      if (!data.replayId || !data.videoUrl || !data.createdAt) {
        throw new Error("UPLOAD FAILED")
      }

      console.log(
        "SIGNAL PATH VERIFIED",
        data
      )

      setProgress(100)

      setStatus("SESSION SAVED")

      onSelect(selectedFile)
    } catch (error) {
      console.error(
        "UPLOAD FAILED",
        error
      )

      setProgress(0)

      setStatus(
        statusFromCaughtError(error)
      )
    }
  }

  return (
    <section className="border border-white/10 bg-black p-8">
      <div className="mb-8">
        <button
          type="button"
          onClick={() =>
            inputRef.current?.click()
          }
          className="w-full border border-white/10 bg-black p-8 text-left transition-opacity hover:opacity-80"
        >
          <div className="text-3xl font-black leading-none text-white">
            RECORD
            <br />
            CLIP
          </div>

          <div className="mt-3 text-2xl text-lime-300">
            Live basketball capture
          </div>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="h-4 w-full bg-white/10">
        <div
          className="h-full bg-lime-300 transition-all duration-300"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="mt-6">
        <div className="text-xs uppercase tracking-[0.4em] text-white/30">
          Basketball Clip Capture
        </div>

        <div className="mt-4 text-5xl font-black leading-none text-white">
          {status}
        </div>

        <div className="mt-6 text-8xl font-black text-white/20">
          {progress}%
        </div>
      </div>
    </section>
  )
}
