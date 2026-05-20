"use client"

import Link from "next/link"
import { useState } from "react"
import {
  AxisActionGrid,
  AxisButton,
  AxisSurface,
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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {records.map((memory) => (
        <AxisSurface key={memory.id} as="article">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={memory.frame_url}
            alt={`${memory.label} at ${formatClock(memory.replay_time)}`}
            className="aspect-video w-full object-cover grayscale-[10%]"
          />
          <div className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="axis-sync-text text-sm font-bold uppercase tracking-[0.18em]">
                  {memory.label}
                </p>
                <p className="axis-mono axis-sync-muted mt-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                  {compactSessionId(memory.session_id)}
                </p>
              </div>
              <p className="axis-mono axis-sync-text text-[11px] font-black">
                {formatClock(memory.replay_time)}
              </p>
            </div>

            <div className="axis-mono axis-sync-muted flex items-center justify-between text-[9px] font-semibold uppercase tracking-[0.14em]">
              <span>{formatHeldState(memory.roboflow_status)}</span>
              <span>{new Date(memory.created_at).toLocaleDateString()}</span>
            </div>

            <AxisActionGrid className="grid-cols-2">
              <Link
                href={`/retrieve?q=${encodeURIComponent(memory.label)}`}
                className="axis-mono axis-optical-transition axis-retrieval-link px-3 py-3 text-center text-[9px] font-black uppercase tracking-[0.12em] transition"
              >
                Find similar
              </Link>
              <AxisButton
                type="button"
                disabled={busyId === memory.id}
                onClick={() => void sendToRoboflow(memory.id)}
                className="px-3 py-3 text-[9px] tracking-[0.12em] disabled:bg-white/10 disabled:text-zinc-600"
              >
                Save frame
              </AxisButton>
            </AxisActionGrid>
            <AxisButton
              type="button"
              tone="ghost"
              disabled={busyId === memory.id}
              onClick={() => void deleteMemory(memory.id)}
              className="w-full px-3 py-3 text-[9px] tracking-[0.12em] hover:text-zinc-100 disabled:text-zinc-700"
            >
              Remove
            </AxisButton>
          </div>
        </AxisSurface>
      ))}
    </div>
  )
}
