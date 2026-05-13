"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function MobileVideoUpload() {
  const router = useRouter()

  const [status, setStatus] = useState("")
  const [progress, setProgress] = useState(0)

  async function handleFile(file: File) {
    try {
      setStatus("CREATING")
      setProgress(5)

      const createRes = await fetch("/api/upload", {
        method: "POST",
      })

      const createData = await createRes.json()

      const uploadUrl = createData.url
      const uploadId = createData.id

      if (!uploadUrl || !uploadId) {
        throw new Error("UPLOAD_URL_MISSING")
      }

      setStatus("UPLOADING")

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.open("PUT", uploadUrl)

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round(
              (event.loaded / event.total) * 100
            )

            setProgress(percent)
          }
        }

        xhr.onload = () => {
          if (
            xhr.status >= 200 &&
            xhr.status < 300
          ) {
            resolve()
          } else {
            reject()
          }
        }

        xhr.onerror = () => reject()

        xhr.send(file)
      })

      setStatus("PROCESSING")
      setProgress(100)

      let ready = false

      while (!ready) {
        await new Promise((r) =>
          setTimeout(r, 2500)
        )

        const pollRes = await fetch(
          `/api/mux/upload/${uploadId}`
        )

        const pollData = await pollRes.json()

        if (pollData.status === "ready") {
          ready = true

          router.push(
            `/session/${pollData.sessionId}`
          )
        }
      }
    } catch (error) {
      console.error(error)

      setStatus("UPLOAD FAILED")
    }
  }

  return (
    <div className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="text-[72px] font-black leading-[0.9] tracking-[0.35em]">
          AXIS
          <br />
          SESSION
        </h1>

        <div className="mt-10 space-y-6">
          <label className="block rounded-[32px] border border-white/10 p-10">
            <div className="text-[42px] font-bold tracking-[0.35em]">
              CHOOSE
              <br />
              FILE
            </div>

            <input
              type="file"
              accept="video/*,.mov,.mp4"
              className="hidden"
              onChange={(e) => {
                const file =
                  e.target.files?.[0]

                if (file) {
                  handleFile(file)
                }
              }}
            />
          </label>

          <label className="block rounded-[32px] border border-white/10 p-10">
            <div className="text-[42px] font-bold tracking-[0.35em]">
              RECORD
            </div>

            <input
              type="file"
              accept="video/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file =
                  e.target.files?.[0]

                if (file) {
                  handleFile(file)
                }
              }}
            />
          </label>
        </div>

        {!!status && (
          <div className="mt-10">
            <div className="h-6 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-8 text-center text-[56px] tracking-[0.35em] text-white/70">
              {status}
            </div>

            <div className="mt-4 text-center text-4xl text-white/40">
              {progress}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}