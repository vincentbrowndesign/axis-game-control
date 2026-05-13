"use client"

import { useState } from "react"

type Props = {
  onReady: (payload: {
    playbackId: string
    assetId: string
    uploadId: string
  }) => void
}

export default function MobileVideoUpload({
  onReady,
}: Props) {
  const [progress, setProgress] =
    useState(0)

  const [status, setStatus] =
    useState("")

  async function handleFile(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      e.target.files?.[0]

    if (!file) return

    try {
      setStatus("Creating upload...")
      setProgress(10)

      // CREATE DIRECT UPLOAD

      const uploadRes =
        await fetch(
          "/api/mux/upload",
          {
            method: "POST",
          }
        )

      const uploadData =
        await uploadRes.json()

      console.log(
        "UPLOAD DATA:",
        uploadData
      )

      if (!uploadData?.data?.url) {
        console.error(uploadData)

        setStatus(
          "Failed creating upload"
        )

        return
      }

      setStatus("Uploading...")
      setProgress(30)

      // SEND FILE TO MUX

      const upload = await fetch(
        uploadData.data.url,
        {
          method: "PUT",
          body: file,
        }
      )

      if (!upload.ok) {
        setStatus("Upload failed")

        return
      }

      setProgress(70)

      // WAIT FOR ASSET

      let playbackId = ""
      let attempts = 0

      while (
        !playbackId &&
        attempts < 20
      ) {
        attempts++

        await new Promise((r) =>
          setTimeout(r, 3000)
        )

        const statusRes =
          await fetch(
            `/api/mux/upload-status?id=${uploadData.data.id}`
          )

        const statusData =
          await statusRes.json()

        console.log(
          "STATUS:",
          statusData
        )

        playbackId =
          statusData?.playbackId || ""
      }

      if (!playbackId) {
        setStatus(
          "Playback timeout"
        )

        return
      }

      setProgress(100)

      setStatus("Replay ready")

      onReady({
        playbackId,
        assetId:
          uploadData.data.asset_id ||
          "",
        uploadId:
          uploadData.data.id,
      })
    } catch (error) {
      console.error(error)

      setStatus("Upload failed")
    }
  }

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="video/*"
        onChange={handleFile}
        className="block w-full text-white"
      />

      <div className="h-4 overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full bg-green-500 transition-all"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <p className="text-zinc-400">
        {status}
      </p>
    </div>
  )
}