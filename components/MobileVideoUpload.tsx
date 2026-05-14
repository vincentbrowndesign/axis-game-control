"use client"

import { useRef, useState } from "react"

export default function MobileVideoUpload() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const handlePick = () => {
    fileInputRef.current?.click()
  }

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0]

    if (!file) return

    try {
      setUploading(true)
      setProgress(10)

      // mock upload feel
      const fake = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) return p
          return p + 10
        })
      }, 300)

      const formData = new FormData()
      formData.append("file", file)

      await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      clearInterval(fake)

      setProgress(100)

      setTimeout(() => {
        window.location.href = "/replay/demo"
      }, 500)
    } catch (err) {
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleUpload}
      />

      <div className="grid grid-cols-1 gap-5">
        <button
          onClick={handlePick}
          className="
            relative
            overflow-hidden
            rounded-[38px]
            border
            border-white/10
            bg-[#0b0b0f]
            p-10
            text-left
            transition-all
            duration-300
            active:scale-[0.98]
          "
        >
          {/* glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#d7ff64]/12 via-transparent to-transparent" />

          <div className="relative z-10">
            <p className="mb-6 text-[60px] font-black leading-[0.88] tracking-[-0.08em] text-[#f5f5f5]">
              CHOOSE
              <br />
              FILE
            </p>

            <p className="text-[20px] text-[#d7ff64]/80">
              Choose existing clip
            </p>
          </div>
        </button>

        <button
          onClick={handlePick}
          className="
            relative
            overflow-hidden
            rounded-[38px]
            border
            border-white/10
            bg-[#0b0b0f]
            p-10
            text-left
            transition-all
            duration-300
            active:scale-[0.98]
          "
        >
          {/* glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#6ae2ff]/12 via-transparent to-transparent" />

          <div className="relative z-10">
            <p className="mb-6 text-[60px] font-black leading-[0.88] tracking-[-0.08em] text-[#f5f5f5]">
              RECORD
            </p>

            <p className="text-[20px] text-[#6ae2ff]/80">
              Record from camera
            </p>
          </div>
        </button>
      </div>

      <div className="space-y-3 px-1">
        <div className="h-5 overflow-hidden rounded-full bg-white/5">
          <div
            className="
              h-full
              rounded-full
              bg-gradient-to-r
              from-[#d7ff64]
              to-[#6ae2ff]
              transition-all
              duration-300
            "
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.3em] text-white/30">
            behavioral memory upload
          </p>

          <p className="text-2xl text-white/50">
            {uploading ? `${progress}%` : "0%"}
          </p>
        </div>
      </div>
    </div>
  )
}