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

      if (!uploadData.url || !uploadData.id) {
        setStatus("UPLOAD FAILED")
        return
      }

      const uploadUrl = uploadData.url
      const uploadId = uploadData.id

      setProgress(20)

      await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "video/quicktime",
        },
        body: file,
      })

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

        console.log(result)

        if (result.status === "ready") {
          ready = true
          setProgress(100)

          router.push(
            `/session/${result.sessionId}`
          )

          return
        }

        if (
          result.status === "server_error" ||
          result.status === "database_error"
        ) {
          setStatus("UPLOAD FAILED")
          return
        }
      }
    } catch (err) {
      console.error(err)
      setStatus("UPLOAD FAILED")
    }
  }

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-7xl font-bold tracking-[0.35em] leading-none">
          AXIS
        </h1>

        <h1 className="text-7xl font-bold tracking-[0.35em] leading-none">
          SESSION
        </h1>
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        className="border border-zinc-900 rounded-[2rem] p-8 text-left"
      >
        <div className="text-5xl tracking-[0.35em] font-semibold">
          CHOOSE
        </div>

        <div className="text-5xl tracking-[0.35em] font-semibold mt-2">
          FILE
        </div>

        <div className="mt-10 text-2xl text-zinc-300 break-all">
          {selectedFile
            ? selectedFile.name
            : "Choose existing clip"}
        </div>
      </button>

      <label className="border border-zinc-900 rounded-[2rem] p-8 block">
        <div className="text-5xl tracking-[0.35em] font-semibold">
          RECORD
        </div>

        <div className="mt-10 text-2xl text-zinc-500">
          Record from camera.
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
          className="h-full bg-white transition-all"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <div className="text-center">
        <div className="text-7xl tracking-[0.35em] text-zinc-400">
          {status}
        </div>

        <div className="mt-6 text-4xl text-zinc-500">
          {progress}%
        </div>
      </div>
    </main>
  )
}