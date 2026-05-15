"use client"

import { useRef } from "react"

type Props = {
  onFileSelected: (file: File) => void
}

export default function MobileVideoUpload({
  onFileSelected,
}: Props) {
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
        onClick={() => recordRef.current?.click()}
        className="mb-8 w-full border border-zinc-900 p-8 text-left"
      >
        <div className="text-[72px] font-black leading-[0.88] tracking-[-0.08em]">
          RECORD
          <br />
          MEMORY
        </div>

        <div className="mt-8 text-2xl text-lime-300">
          Live basketball capture
        </div>
      </button>

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
