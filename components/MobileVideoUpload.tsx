"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function MobileVideoUpload() {
  const router = useRouter()

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState("")
  const [fileName, setFileName] = useState("")

  async function handleFile(file: File) {
    try {
      setUploading(true)
      setProgress(0)
      setStatus("CREATING UPLOAD")
      setFileName(file.name)

      /*
        STEP 1
        CREATE DIRECT UPLOAD
      */

      const createRes = await fetch("/api/upload", {
        method: "POST",
      })

      if (!createRes.ok) {
        throw new Error("FAILED_CREATING_UPLOAD")
      }

      const createData = await createRes.json()

      const uploadUrl = createData.url
      const uploadId = createData.id

      if (!uploadUrl || !uploadId) {
        throw new Error("INVALID_UPLOAD_RESPONSE")
      }

      /*
        STEP 2
        UPLOAD FILE TO MUX
      */

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
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`UPLOAD_FAILED_${xhr.status}`))
          }
        }

        xhr.onerror = () => {
          reject(new Error("UPLOAD_NETWORK_ERROR"))
        }

        xhr.send(file)
      })

      /*
        STEP 3
        WAIT FOR MUX PROCESSING
      */

      setStatus("PROCESSING")
      setProgress(100)

      let ready = false
      let sessionId = ""

      while (!ready) {
        await new Promise((r) => setTimeout(r, 2500))

        const pollRes = await fetch(
          `/api/mux/upload/${uploadId}`
        )

        const pollData = await pollRes.json()

        console.log("MUX STATUS", pollData)

        if (pollData.status === "ready") {
          ready = true
          sessionId = pollData.sessionId
        }

        if (pollData.status === "error") {
          throw new Error(
            pollData.error || "MUX_PROCESSING_FAILED"
          )
        }
      }

      /*
        STEP 4
        GO TO REPLAY
      */

      router.push(`/session/${sessionId}`)
    } catch (error) {
      console.error(error)

      setStatus("UPLOAD FAILED")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="mx-auto max-w-xl">
        <h1 className="text-[72px] font-black leading-[0.9] tracking-[0.35em]">
          AXIS
          <br />
          SESSION
        </h1>

        <div className="mt-10 space-y-6">
          <label className="block rounded-[32px] border border-white/10 bg-neutral-950 p-10">
            <div className="text-[42px] font-bold tracking-[0.35em]">
              CHOOSE
              <br />
              FILE
            </div>

            <div className="mt-8 break-all text-4xl text-white">
              {fileName || "Select existing clip"}
            </div>

            <input
              type="file"
              accept="video/*,.mov,.mp4"
              capture={false}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]

                if (file) {
                  handleFile(file)
                }
              }}
            />
          </label>

          <label className="block rounded-[32px] border border-white/10 bg-neutral-950 p-10">
            <div className="text-[42px] font-bold tracking-[0.35em]">
              RECORD
            </div>

            <p className="mt-8 text-3xl text-white/40">
              Record from camera.
            </p>

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
        </div>

        {(uploading || status) && (
          <div className="mt-10">
            <div className="h-8 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>

            <div className="mt-10 text-center">
              <div className="text-[64px] tracking-[0.35em] text-white/70">
                {status}
              </div>

              <div className="mt-6 text-4xl text-white/50">
                {progress}%
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}