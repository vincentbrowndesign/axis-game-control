"use client"

import { useRef, useState } from "react"

type ClipUploaderProps = {
  onSelect: (file: File) => void
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
          "AXIS NON JSON RESPONSE",
          text
        )

        throw new Error(
          "RESPONSE CORRUPTED"
        )
      }

      const data =
        await response.json()

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "MEMORY INGEST FAILED"
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
        error instanceof Error
          ? error.message
          : "SIGNAL INTERRUPTED"
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