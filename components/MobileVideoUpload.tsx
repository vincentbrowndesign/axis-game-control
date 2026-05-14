"use client"

import { useRef } from "react"

type Props = {
  onFileSelected: (file: File) => void
}

export default function MobileVideoUpload({
  onFileSelected,
}: Props) {
  const chooseRef = useRef<HTMLInputElement | null>(null)
  const recordRef = useRef<HTMLInputElement | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0]
    if (!file) return

    onFileSelected(file)
    e.target.value = ""
  }

  return (
    <>
      <button
        type="button"
        onClick={() => chooseRef.current?.click()}
        className="mb-6 w-full rounded-[42px] border border-zinc-900 p-8 text-left"
      >
        <div className="text-[72px] font-black leading-[0.88] tracking-[-0.08em]">
          CHOOSE
          <br />
          FILE
        </div>

        <div className="mt-8 text-2xl text-lime-300">
          Choose existing clip
        </div>
      </button>

      <button
        type="button"
        onClick={() => recordRef.current?.click()}
        className="mb-8 w-full rounded-[42px] border border-zinc-900 p-8 text-left"
      >
        <div className="text-[72px] font-black leading-[0.88] tracking-[-0.08em]">
          RECORD
        </div>

        <div className="mt-8 text-2xl text-sky-400">
          Record from camera
        </div>
      </button>

      <input
        ref={chooseRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleChange}
      />

      <input
        ref={recordRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </>
  )
}