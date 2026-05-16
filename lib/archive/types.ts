import type { ReplayMarker } from "@/lib/replay/types"
import type { SegmentedMemory } from "@/lib/segments/types"
import type { ExtractedReplaySignals } from "@/lib/signals/types"
import type { ReplaySessionView } from "@/types/memory"

export type ArchiveQualificationAction =
  | "keep"
  | "discard"
  | "mark_useful"

export type ArchiveQualificationReason =
  | "memory_exists"
  | "warmup_memory"
  | "signal_recorded"
  | "rhythm_found"
  | "reset_found"
  | "continuity_found"
  | "too_short"
  | "low_signal"

export type ArchiveQualification = {
  action: ArchiveQualificationAction
  confidence: number
  reasons: ArchiveQualificationReason[]
  label: "Keep Memory" | "Discard Memory" | "Mark Useful"
}

export type MemoryArchiveItem = {
  session: ReplaySessionView
  signals?: ExtractedReplaySignals | null
  segmentedMemory?: SegmentedMemory | null
  markers?: ReplayMarker[]
  twinId?: string | null
  warmupId?: string | null
}
