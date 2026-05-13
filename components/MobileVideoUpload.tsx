"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function MobileVideoUpload() {
  const router = useRouter()

  const [uploading, setUploading] =
    useState(false)

  const [progress, setProgress] =
    useState(0)

  const [status, setStatus] = useState("")

  async function handleFile(
    file: File
  ) {
    try {
      setUploading(true)
      setStatus("CREATING SESSION")

      const createResponse = await fetch(
        "/api/upload",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: file.name,
          }),
        }
      )

      const createData =
        await createResponse.json()

      if (!createData.uploadUrl) {
        setStatus("FAILED CREATING UPLOAD")
        return
      }

      setStatus("UPLOADING VIDEO")

      await fetch(createData.uploadUrl, {
        method: "PUT",
        body: file,
      })

      setProgress(70)

      let playbackId: string | null =
        null

      setStatus("PROCESSING VIDEO")

      while (!playbackId) {
        await new Promise((resolve) =>
          setTimeout(resolve, 2500)
        )

        const statusResponse =
          await fetch(
            `/api/upload/${createData.uploadId}`
          )

        const statusData =
          await statusResponse.json()

        if (
          statusData.status === "ready"
        ) {
          playbackId =
            statusData.playbackId
        }
      }

      setProgress(100)

      setStatus("SESSION READY")

      router.push(
        `/session/${createData.sessionId}`
      )
    } catch (error) {
      console.error(error)

      setStatus("UPLOAD FAILED")
    } finally {
      setUploading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-xl">
        <h1 className="text-center text-6xl font-black tracking-[0.35em]">
          AXIS SESSION
        </h1>

        <div className="mt-14">
          <input
            type="file"
            accept="video/*"
            capture="environment"
            onChange={(e) => {
              const file =
                e.target.files?.[0]

              if (file) {
                handleFile(file)
              }
            }}
            className="w-full text-xl"
          />
        </div>

        <div className="mt-10 h-5 overflow-hidden rounded-full bg-neutral-900">
          <div
            className="h-full bg-white transition-all duration-500"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <p className="mt-10 text-center text-2xl tracking-[0.3em] text-neutral-500">
          {status}
        </p>

        {uploading && (
          <p className="mt-5 text-center text-neutral-700">
            {progress}%
          </p>
        )}
      </div>
    </main>
  )
}