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

  async function wait(ms: number) {
    return new Promise((resolve) =>
      setTimeout(resolve, ms)
    )
  }

  async function waitForAsset(
    uploadId: string
  ) {
    let assetId: string | null = null

    while (!assetId) {
      const res = await fetch(
        `/api/mux/upload/${uploadId}`
      )

      const data = await res.json()

      console.log("UPLOAD STATUS:", data)

      assetId = data.assetId

      if (!assetId) {
        await wait(2000)
      }
    }

    return assetId
  }

  async function waitForPlayback(
    assetId: string
  ) {
    let playbackId: string | null = null

    while (!playbackId) {
      const res = await fetch(
        `/api/mux/asset/${assetId}`
      )

      const data = await res.json()

      console.log("ASSET STATUS:", data)

      playbackId = data.playbackId

      if (!playbackId) {
        await wait(2000)
      }
    }

    return playbackId
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

      setStatus("Uploading video...")

      setProgress(30)

      // DIRECT UPLOAD TO MUX

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

      setStatus("Processing asset...")

      setProgress(60)

      // WAIT FOR ASSET ID

      const assetId = await waitForAsset(
        createData.uploadId
      )

      console.log(
        "ASSET READY:",
        assetId
      )

      setStatus("Generating playback...")

      setProgress(80)

      // WAIT FOR PLAYBACK ID

      const playbackId =
        await waitForPlayback(assetId)

      console.log(
        "PLAYBACK READY:",
        playbackId
      )

      setStatus("Replay ready")

      setProgress(100)

      if (onReady) {
        onReady(playbackId)
      }
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