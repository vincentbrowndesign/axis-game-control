import { Camera, Download, Share2, Upload } from "lucide-react"
import type { ReactNode } from "react"

export function ControlBar({
  onCamera,
  onUpload,
  onSave,
  onShare,
  disabled = false,
}: {
  onCamera: () => void
  onUpload: () => void
  onSave: () => void
  onShare: () => void
  disabled?: boolean
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/92 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton label="Record" onClick={onCamera} disabled={disabled}>
            <Camera className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
          <IconButton label="Choose File" onClick={onUpload} disabled={disabled}>
            <Upload className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Save" onClick={onSave}>
            <Download className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
          <IconButton label="Share" onClick={onShare}>
            <Share2 className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
        </div>
      </div>
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-12 min-w-12 place-items-center rounded-full border border-zinc-700 bg-zinc-950 px-3 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  )
}
