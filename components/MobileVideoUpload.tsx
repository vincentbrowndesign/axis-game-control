"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"

export default function MobileVideoUpload() {
  const router = useRouter()

  const fileInputRef = useRef<HTMLInputElement>(null)

  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null)

  async function handleFile(file: File) {
    try {
      setSelectedFile(file)

      setStatus("UPLOADING")
      setProgress(10)

      const createUpload = await fetch("/api/upload", {
        method: "POST",
      })

      const uploadData = await createUpload.json()

      console.log("UPLOAD DATA", uploadData)

      if (!uploadData.url || !uploadData.id) {
        setStatus("UPLOAD FAILED")
        return
      }

      const uploadUrl = uploadData.url
      const uploadId = uploadData.id

      setProgress(20)

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type":
            file.type || "video/quicktime",
        },
        body: file,
      })

      console.log(
        "MUX UPLOAD RESPONSE",
        uploadResponse.status
      )

      if (!uploadResponse.ok) {
        setStatus("UPLOAD FAILED")
        return
      }

      setStatus("PROCESSING")
      setProgress(70)

      let ready = false

      while (!ready) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2500)
        )

        const check = await fetch(
          `/api/mux/upload/${uploadId}`
        )

        const result = await check.json()

        console.log("POLL RESULT", result)

        if (result.status === "ready") {
          ready = true

          setProgress(100)

          setStatus("READY")

          router.push(
            `/session/${result.sessionId}`
          )

          return
        }

        if (
          result.status === "server_error" ||
          result.status === "database_error"
        ) {
          console.log(result)

          setStatus(
            result.error ||
              result.status ||
              "UPLOAD FAILED"
          )

          return
        }
      }
    } catch (err) {
      console.error(err)

      setStatus("UPLOAD FAILED")
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col gap-6 overflow-hidden">
      <div>
        <p className="text-[11px] uppercase tracking-[0.45em] text-zinc-600">
          Axis Session
        </p>

        <h1 className="mt-6 text-[64px] font-black leading-[0.85] tracking-[-0.08em]">
          AXIS
          <br />
          REPLAY
        </h1>

        <p className="mt-8 text-2xl leading-relaxed text-zinc-400">
          Axis remembers how you play.
        </p>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="border border-zinc-900 rounded-[2rem] p-8 text-left"
      >
        <div className="text-5xl tracking-[0.15em] font-semibold">
          CHOOSE
        </div>

        <div className="text-5xl tracking-[0.15em] font-semibold mt-2">
          FILE
        </div>

        <div className="mt-10 text-2xl text-zinc-300 break-all">
          {selectedFile
            ? selectedFile.name
            : "Choose existing clip"}
        </div>
      </button>

      <label className="border border-zinc-900 rounded-[2rem] p-8 block">
        <div className="text-5xl tracking-[0.15em] font-semibold">
          RECORD
        </div>

        <div className="mt-10 text-2xl text-zinc-500">
          Record from camera
        </div>

        <input
          type="file"
          accept="video/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]

            if (file) {
              handleFile(file)
            }
          }}
        />
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]

          if (file) {
            handleFile(file)
          }
        }}
      />

      <div className="w-full h-5 bg-zinc-900 rounded-full overflow-hidden">
        <div
          className="h-full bg-white transition-all duration-500"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="text-center pb-10">
        <div className="text-3xl tracking-[0.25em] text-zinc-400 break-words">
          {status}
        </div>

        <div className="mt-4 text-xl text-zinc-500">
          {progress}%
        </div>
      </div>
    </main>
  )
}