"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function MobileVideoUpload() {
  const router = useRouter()

  const [status, setStatus] = useState("SELECT CLIP")
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)

  async function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setProgress(0)
      setStatus("CREATING UPLOAD")

      const createRes = await fetch("/api/upload", {
        method: "POST",
      })

      const createData = await createRes.json()

      if (!createRes.ok || !createData.uploadUrl || !createData.uploadId) {
        console.error(createData)
        setStatus("FAILED CREATING UPLOAD")
        setUploading(false)
        return
      }

      setStatus("UPLOADING")
      setProgress(5)

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.open("PUT", createData.uploadUrl)

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return

          const pct = Math.round((event.loaded / event.total) * 80)
          setProgress(Math.max(5, pct))
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error("Mux upload failed"))
          }
        }

        xhr.onerror = () => reject(new Error("Mux upload error"))

        xhr.setRequestHeader("Content-Type", file.type || "video/mp4")
        xhr.send(file)
      })

      setStatus("PROCESSING")
      setProgress(85)

      let sessionId: string | null = null

      while (!sessionId) {
        await sleep(2500)

        const pollRes = await fetch(`/api/mux/upload/${createData.uploadId}`)
        const pollData = await pollRes.json()

        console.log("pollData", pollData)

        if (pollData.status === "ready" && pollData.sessionId) {
          sessionId = pollData.sessionId
        }
      }

      setProgress(100)
      setStatus("OPENING")

      router.push(`/session/${sessionId}`)
    } catch (error) {
      console.error(error)
      setStatus("UPLOAD FAILED")
      setUploading(false)
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-12 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-[72px] font-black leading-[0.9] tracking-[0.25em]">
          AXIS
          <br />
          SESSION
        </h1>

        <div className="mt-12 rounded-[32px] border border-white/10 bg-neutral-950 p-8">
          <input
            type="file"
            accept="video/*"
            onChange={handleFile}
            className="w-full text-xl"
          />

          <p className="mt-6 text-white/40">
            Choose an existing clip or record from your phone.
          </p>
        </div>

        <div className="mt-8 h-3 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p className="mt-6 text-center text-[24px] tracking-[0.35em] text-white/60">
          {status}
        </p>

        {uploading && (
          <p className="mt-3 text-center text-white/30">{progress}%</p>
        )}
      </div>
    </main>
  )
}