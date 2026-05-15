import type {
  AxisSignalAttachment,
  ExternalSignalEnvelope,
  ExternalSignalSource,
} from "./types"

export type SmartBallSignal = {
  source: ExternalSignalSource
  timestamp: number
  shotArc?: number
  spin?: number
  releaseSpeed?: number
  dribbleCadence?: number
}

export type SmartBallProvider = {
  id: string
  label: string
  enabled: boolean
  readSignals: (
    attachment: AxisSignalAttachment
  ) => Promise<ExternalSignalEnvelope<SmartBallSignal>[]>
}

export type SmartBallMemoryAttachment =
  ExternalSignalEnvelope<SmartBallSignal>

export const smartBallProviders: SmartBallProvider[] = []
