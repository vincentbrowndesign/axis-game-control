// components/MobileVideoUpload.tsx

"use client"

import { useState } from "react"

type UploadReadyPayload = {
  playbackId: string
  assetId: string
  uploadId: string
}

type Props = {
  onReady?: (
    payload: UploadReadyPayload
  ) => void
}

export default function MobileVideoUpload({
  onReady,
}: Props) {
  const [status, setStatus] =
    useState("")

  const [progress, setProgress] =
    useState(0)

  const [uploading, setUploading] =
    useState(false)

  function wait(ms: number) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    )
  }

  // WAIT FOR ASSET ID

  async function waitForAsset(
    uploadId: string
  ) {
    while (true) {
      const res = await fetch(
        `/api/mux/upload/${uploadId}`
      )

      const data = await res.json()

      console.log(
        "UPLOAD STATUS:",
        data
      )

      if (data.assetId) {
        return data.assetId as string
      }

      await wait(2000)
    }
  }

  // WAIT FOR PLAYBACK + READY STATUS

  async function waitForPlayback(
    assetId: string
  ) {
    while (true) {
      const res = await fetch(
        `/api/mux/asset/${assetId}`
      )

      const data = await res.json()

      console.log(
        "ASSET STATUS:",
        data
      )

      // IMPORTANT:
      // wait until fully ready

      if (
        data.status === "ready" &&
        data.playbackId
      ) {
        return data.playbackId as string
      }

      await wait(2000)
    }
  }

  async function handleUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]

    if (!file) return

    try {
      setUploading(true)

      setProgress(10)

      setStatus("Creating upload...")

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

      setProgress(35)

      setStatus("Uploading video...")

      const uploadRes = await fetch(
        createData.uploadUrl,
        {
          method: "PUT",

          body: file,

          headers: {
            "Content-Type":
              file.type ||
              "video/quicktime",
          },
        }
      )

      if (!uploadRes.ok) {
        throw new Error(
          "Mux upload failed"
        )
      }

      // WAIT FOR ASSET

      setProgress(60)

      setStatus(
        "Processing asset..."
      )

      const assetId =
        await waitForAsset(
          createData.uploadId
        )

      console.log(
        "ASSET READY:",
        assetId
      )

      // WAIT FOR PLAYBACK

      setProgress(80)

      setStatus(
        "Preparing replay..."
      )

      const playbackId =
        await waitForPlayback(
          assetId
        )

      console.log(
        "PLAYBACK READY:",
        playbackId
      )

      setProgress(100)

      setStatus("Replay ready")

      onReady?.({
        playbackId,
        assetId,
        uploadId:
          createData.uploadId,
      })
    } catch (error) {
      console.error(error)

      setStatus("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleUpload}
        className="text-white"
      />

      <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-green-500 transition-all"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      {status && (
        <p className="text-sm text-zinc-400">
          {status}
        </p>
      )}
    </div>
  )
}