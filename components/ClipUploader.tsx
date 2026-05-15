"use client"

import { useRef, useState } from "react"

type ClipUploaderProps = {
  onSelect: (file: File) => void
}

function statusFromUploadFailure(data: {
  error?: string
  stage?: string
}) {
  if (data.stage === "auth") {
    return "AUTH FAILURE"
  }

  if (
    data.stage === "file-validation" ||
    data.stage === "form-data" ||
    data.stage === "array-buffer"
  ) {
    return "INVALID FILE"
  }

  if (
    data.stage === "storage-upload" ||
    data.stage === "signed-url"
  ) {
    return "STORAGE FAILURE"
  }

  if (
    data.stage === "db-session-create" ||
    data.stage === "db-upload-record"
  ) {
    return "DATABASE FAILURE"
  }

  return data.error || "MEMORY INGEST FAILED"
}

function statusFromCaughtError(error: unknown) {
  if (!(error instanceof Error)) {
    return "SIGNAL INTERRUPTED"
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

  if (error.message === "RESPONSE CORRUPTED") {
    return "RESPONSE CORRUPTED"
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
        "MEMORY INGEST STARTED"
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

        throw new Error(
          "RESPONSE CORRUPTED"
        )
      }

      const text =
        await response.text()

      console.log(
        "AXIS RESPONSE TEXT",
        text
      )

      let data: {
        ok?: boolean
        error?: string
        stage?: string
        detail?: string
      }

      try {
        data = JSON.parse(text)
      } catch (error) {
        console.error(
          "AXIS JSON PARSE FAILURE",
          error
        )

        throw new Error(
          "RESPONSE CORRUPTED"
        )
      }

      console.log(
        "AXIS PARSED JSON",
        data
      )

      if (!response.ok) {
        console.error(
          "AXIS FAILURE STAGE",
          data?.stage || "unknown"
        )

        throw new Error(
          statusFromUploadFailure(data)
        )
      }

      console.log(
        "SIGNAL PATH VERIFIED",
        data
      )

      setProgress(100)

      setStatus("MEMORY STORED")

      onSelect(selectedFile)
    } catch (error) {
      console.error(
        "MEMORY INGEST FAILED",
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
          <div className="text-5xl font-black leading-none text-white">
            CHOOSE
            <br />
            FILE
          </div>

          <div className="mt-3 text-2xl text-lime-300">
            Attach existing clip
          </div>
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mov,.mp4,.m4v"
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
          Behavioral Memory Upload
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
