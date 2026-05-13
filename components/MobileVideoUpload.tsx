"use client"

import { useState } from "react"

export default function MobileVideoUpload() {
  const [status, setStatus] = useState("")
  const [progress, setProgress] = useState(0)
  const [playbackId, setPlaybackId] = useState("")

  async function pollAsset(assetId: string) {
    let ready = false

    while (!ready) {
      const res = await fetch(`/api/mux/asset/${assetId}`)

      const data = await res.json()

      if (data.status === "ready") {
        ready = true

        setPlaybackId(data.playbackId)

        setStatus("replay ready")

        return
      }

      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }

  async function handleFile(file: File) {
    try {
      setStatus("creating upload")

      const res = await fetch("/api/upload", {
        method: "POST",
      })

      const data = await res.json()

      if (!data.uploadUrl) {
        setStatus("failed creating upload")
        return
      }

      setStatus("uploading")

      const xhr = new XMLHttpRequest()

      xhr.open("PUT", data.uploadUrl, true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100
          setProgress(percent)
        }
      }

      xhr.onload = async () => {
        if (xhr.status === 200) {
          setStatus("processing replay")

          let assetReady = false
          let assetId = null

          while (!assetReady) {
            const uploadRes = await fetch(
              `https://api.mux.com/video/v1/uploads/${data.uploadId}`,
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

            const uploadData = await uploadRes.json()

            assetId = uploadData.data?.asset_id

            if (assetId) {
              assetReady = true
            } else {
              await new Promise((resolve) =>
                setTimeout(resolve, 2000)
              )
            }
          }

          await pollAsset(assetId)
        } else {
          setStatus("upload failed")
        }
      }

      xhr.onerror = () => {
        setStatus("upload failed")
      }

      xhr.setRequestHeader("Content-Type", file.type)

      xhr.send(file)
    } catch (err) {
      console.error(err)
      setStatus("error")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black p-6 text-white">
      <h1 className="text-5xl font-bold tracking-[0.25em]">
        AXIS SESSION
      </h1>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => {
          const file = e.target.files?.[0]

          if (file) {
            handleFile(file)
          }
        }}
      />

      <div className="h-4 w-full max-w-md overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full bg-green-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="uppercase tracking-[0.2em] text-neutral-400">
        {status}
      </p>

      {playbackId && (
        <video
          className="mt-6 w-full max-w-md rounded-xl"
          controls
          src={`https://stream.mux.com/${playbackId}.m3u8`}
        />
      )}
    </div>
  )
}