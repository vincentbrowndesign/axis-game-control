// components/MobileVideoUpload.tsx

"use client"

import { useState } from "react"

type Props = {
  onReady?: (playbackId: string) => void
}

export default function MobileVideoUpload({
  onReady,
}: Props) {
  const [uploading, setUploading] =
    useState(false)

  const [status, setStatus] =
    useState("")

  const [progress, setProgress] =
    useState(0)

  async function pollForPlayback(
    assetId: string
  ) {
    let ready = false

    while (!ready) {
      const res = await fetch(
        `/api/mux/asset/${assetId}`
      )

      const data = await res.json()

      console.log(data)

      if (
        data.status === "ready" &&
        data.playbackId
      ) {
        ready = true

        return data.playbackId
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 2000)
      )
    }
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    try {
      setUploading(true)

      setStatus("Creating upload...")

      setProgress(10)

      // CREATE MUX UPLOAD

      const createRes = await fetch(
        "/api/mux/upload",
        {
          method: "POST",
        }
      )

      const createData =
        await createRes.json()

      if (!createData.success) {
        throw new Error(
          "Failed to create upload"
        )
      }

      // DIRECT UPLOAD TO MUX

      setStatus("Uploading video...")

      setProgress(30)

      const uploadRes = await fetch(
        createData.uploadUrl,
        {
          method: "PUT",

          body: file,

          headers: {
            "Content-Type": file.type,
          },
        }
      )

      if (!uploadRes.ok) {
        throw new Error("Upload failed")
      }

      setStatus("Processing video...")

      setProgress(70)

      // WAIT FOR ASSET

      let assetId = createData.assetId

      // sometimes asset not immediately attached

      while (!assetId) {
        const uploadCheck =
          await fetch(
            `https://api.mux.com/video/v1/uploads/${createData.uploadId}`,
            {
              headers: {
                Authorization:
                  "Basic " +
                  btoa(
                    `${process.env.NEXT_PUBLIC_MUX_TOKEN_ID}:${process.env.NEXT_PUBLIC_MUX_TOKEN_SECRET}`
                  ),
              },
            }
          )

        const uploadData =
          await uploadCheck.json()

        assetId =
          uploadData.data.asset_id

        await new Promise((r) =>
          setTimeout(r, 2000)
        )
      }

      const playbackId =
        await pollForPlayback(assetId)

      setProgress(100)

      setStatus("Video ready")

      if (onReady) {
        onReady(playbackId)
      }

      console.log(
        "PLAYBACK READY:",
        playbackId
      )
    } catch (error) {
      console.error(error)

      setStatus("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleUpload}
      />

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded bg-zinc-800">
          <div
            className="h-full bg-green-500 transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <p className="text-sm text-zinc-400">
          {status}
        </p>
      </div>
    </div>
  )
}