import { Camera, Download, FileText, RotateCcw, Share2, Upload } from "lucide-react"

export function ControlBar({
  onCamera,
  onUpload,
  onUndo,
  onSave,
  onShare,
  onPdf,
  disabled = false,
}: {
  onCamera: () => void
  onUpload: () => void
  onUndo: () => void
  onSave: () => void
  onShare: () => void
  onPdf: () => void
  disabled?: boolean
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-black/92 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <IconButton label="Camera" onClick={onCamera} disabled={disabled}>
            <Camera className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
          <IconButton label="Upload" onClick={onUpload} disabled={disabled}>
            <Upload className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
          <IconButton label="Undo" onClick={onUndo}>
            <RotateCcw className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
        </div>
        <div className="flex items-center gap-2">
          <IconButton label="Save" onClick={onSave}>
            <Download className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
          <IconButton label="Share" onClick={onShare}>
            <Share2 className="h-5 w-5 stroke-[1.7]" />
          </IconButton>
          <IconButton label="PDF" onClick={onPdf}>
            <FileText className="h-5 w-5 stroke-[1.7]" />
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
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-12 w-12 place-items-center rounded-full border border-zinc-700 bg-zinc-950 text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  )
}
