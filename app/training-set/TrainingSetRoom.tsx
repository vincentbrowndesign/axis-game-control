"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AxisButton,
} from "@/components/axis/AxisPrimitives"

type TrainingMemory = {
  id: string
  session_id: string
  label: string
  frame_url: string
  video_url: string | null
  replay_time: number
  event_type: string | null
  roboflow_status: string
  created_at: string
}

function formatClock(totalSeconds: number | null | undefined) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0)
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = Math.floor(safeSeconds % 60)
  const centiseconds = Math.floor((safeSeconds % 1) * 100)

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`
}

function compactSessionId(sessionId: string) {
  const compact = sessionId.replace(/[^a-z0-9]/gi, "").toUpperCase()
  return `AXS-${compact.slice(-4) || "0000"}`
}

function formatHeldState(value: string) {
  const normalized = value.toLowerCase()

  if (normalized.includes("complete") || normalized.includes("uploaded")) return "saved"
  if (normalized.includes("pending") || normalized.includes("queued")) return "warming"
  if (normalized.includes("error") || normalized.includes("failed")) return "unresolved"

  return "saved"
}

export function TrainingSetRoom({ memories }: { memories: TrainingMemory[] }) {
  const [records, setRecords] = useState(memories)
  const [busyId, setBusyId] = useState<string | null>(null)

  const sendToRoboflow = async (id: string) => {
    setBusyId(id)
    try {
      const response = await fetch("/api/roboflow/upload-training-frame", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          training_memory_id: id,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (payload.memory) {
        setRecords((current) =>
          current.map((record) => (record.id === id ? payload.memory : record))
        )
      }
    } finally {
      setBusyId(null)
    }
  }

  const deleteMemory = async (id: string) => {
    setBusyId(id)
    try {
      const response = await fetch(`/api/training-memory/${id}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setRecords((current) => current.filter((record) => record.id !== id))
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="grid gap-1">
      {records.map((memory) => (
        <article
          key={memory.id}
          className="grid gap-4 border-t border-white/[0.07] py-4 transition hover:bg-white/[0.018] sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]"
        >
          <div className="overflow-hidden bg-black/38">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={memory.frame_url}
              alt={`${memory.label} at ${formatClock(memory.replay_time)}`}
              className="aspect-video w-full object-cover opacity-75"
            />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-baseline gap-3">
              <p className="truncate text-2xl font-black uppercase leading-none tracking-normal text-white/84">
                {memory.label}
              </p>
              <p className="axis-mono shrink-0 text-[10px] font-black uppercase tracking-[0.16em] text-white/34">
                {formatClock(memory.replay_time)}
              </p>
            </div>
            <div className="axis-mono mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/34">
              <span>{compactSessionId(memory.session_id)}</span>
              <span>{formatHeldState(memory.roboflow_status)}</span>
              <span>{new Date(memory.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          <div className="axis-mono flex flex-wrap items-center gap-3 text-[9px] font-black uppercase tracking-[0.12em] sm:justify-end">
              <Link
                href={`/retrieve?q=${encodeURIComponent(memory.label)}`}
                className="text-white/38 transition hover:text-white/72"
              >
                Find similar
              </Link>
              <AxisButton
                type="button"
                disabled={busyId === memory.id}
                onClick={() => void sendToRoboflow(memory.id)}
                tone="ghost"
                className="px-0 py-0 text-white/38 disabled:text-zinc-600"
              >
                Save
              </AxisButton>
            <AxisButton
              type="button"
              tone="ghost"
              disabled={busyId === memory.id}
              onClick={() => void deleteMemory(memory.id)}
              className="px-0 py-0 text-white/26 hover:text-zinc-100 disabled:text-zinc-700"
            >
              Remove
            </AxisButton>
          </div>
        </article>
      ))}
    </div>
  )
}
