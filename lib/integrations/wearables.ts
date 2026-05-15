import type {
  AxisSignalAttachment,
  ExternalSignalEnvelope,
  ExternalSignalSource,
} from "./types"

export type WearableSignal = {
  source: ExternalSignalSource
  timestamp: number
  heartRate?: number
  acceleration?: number
  load?: number
  recovery?: number
}

export type WearableSignalProvider = {
  id: string
  label: string
  enabled: boolean
  readSignals: (
    attachment: AxisSignalAttachment
  ) => Promise<ExternalSignalEnvelope<WearableSignal>[]>
}

export type WearableMemoryAttachment = ExternalSignalEnvelope<WearableSignal>

export const wearableProviders: WearableSignalProvider[] = []
