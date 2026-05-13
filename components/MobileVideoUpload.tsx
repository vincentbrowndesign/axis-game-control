"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import {
  createAxisSession,
} from "@/lib/axisSessions"

export default function MobileVideoUpload() {
  const router = useRouter()

  const [status, setStatus] = useState("")
  const [progress, setProgress] = useState(0)
  const [playbackId, setPlaybackId] = useState("")

  async function pollAsset(
    assetId: string,
    fileName: string
  ) {
    let ready = false

    while (!ready) {
      try {
        const res = await fetch(
          `/api/mux/asset/${assetId}`
        )

        if (!res.ok) {
          console.error(
            "poll failed",
            res.status
          )

          await new Promise((resolve) =>
            setTimeout(resolve, 2000)
          )

          continue
        }

        const data = await res.json()

        console.log("asset poll", data)

        if (data.status === "ready") {
          ready = true

          setPlaybackId(data.playbackId)

          setStatus("saving session")

          const playbackUrl = `https://stream.mux.com/${data.playbackId}.m3u8`

          const session =
            await createAxisSession({
              videoUrl: playbackUrl,
              fileName,
              title: "Axis Session",
            })

          setStatus("replay ready")

          router.push(
            `/session/${session.id}`
          )

          return
        }

        if (data.status === "errored") {
          setStatus("mux processing failed")
          return
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        )
      } catch (err) {
        console.error(err)

        await new Promise((resolve) =>
          setTimeout(resolve, 2000)
        )
      }
    }
  }

  async function handleFile(file: File) {
    try {
      setPlaybackId("")
      setProgress(0)

      setStatus("creating upload")

      const res = await fetch("/api/upload", {
        method: "POST",
      })

      const data = await res.json()

      console.log("upload response", data)

      if (!data.uploadUrl || !data.uploadId) {
        setStatus("failed creating upload")
        return
      }

      setStatus("uploading")

      const xhr = new XMLHttpRequest()

      xhr.open("PUT", data.uploadUrl, true)

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent =
            (event.loaded / event.total) * 100

          setProgress(percent)
        }
      }

      xhr.onload = async () => {
        if (xhr.status === 200) {
          setStatus("processing replay")

          try {
            let assetId = ""

            while (!assetId) {
              const uploadCheck =
                await fetch(
                  `/api/mux/upload/${data.uploadId}`
                )

              if (!uploadCheck.ok) {
                await new Promise(
                  (resolve) =>
                    setTimeout(
                      resolve,
                      2000
                    )
                )

                continue
              }

              const uploadData =
                await uploadCheck.json()

              console.log(
                "upload lookup",
                uploadData
              )

              assetId =
                uploadData.assetId || ""

              if (!assetId) {
                await new Promise(
                  (resolve) =>
                    setTimeout(
                      resolve,
                      2000
                    )
                )
              }
            }

            await pollAsset(
              assetId,
              file.name
            )
          } catch (err) {
            console.error(err)
            setStatus("asset lookup failed")
          }
        } else {
          console.error(xhr.responseText)

          setStatus("upload failed")
        }
      }

      xhr.onerror = () => {
        setStatus("upload failed")
      }

      xhr.setRequestHeader(
        "Content-Type",
        file.type
      )

      xhr.send(file)
    } catch (err) {
      console.error(err)
      setStatus("error")
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-black p-6 text-white">
      <h1 className="text-center text-5xl font-bold tracking-[0.25em]">
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
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      <p className="uppercase tracking-[0.2em] text-neutral-400">
        {status}
      </p>

      {playbackId && (
        <video
          className="mt-6 w-full max-w-md rounded-xl"
          controls
          playsInline
          src={`https://stream.mux.com/${playbackId}.m3u8`}
        />
      )}
    </div>
  )
}