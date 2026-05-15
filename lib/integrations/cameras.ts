import type {
  AxisSignalAttachment,
  ExternalSignalConfidence,
  ExternalSignalEnvelope,
  ExternalSignalSource,
} from "./types"

export type ExternalCameraSignal = ExternalSignalConfidence & {
  source: ExternalSignalSource
  timestamp: number
  angle: string
  videoUrl?: string
}

export type ExternalCameraProvider = {
  id: string
  label: string
  enabled: boolean
  readSignals: (
    attachment: AxisSignalAttachment
  ) => Promise<ExternalSignalEnvelope<ExternalCameraSignal>[]>
}

export type ExternalCameraMemoryAttachment =
  ExternalSignalEnvelope<ExternalCameraSignal>

export const externalCameraProviders: ExternalCameraProvider[] = []
