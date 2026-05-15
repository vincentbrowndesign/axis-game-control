export type ExternalSignalSource =
  | "apple_watch"
  | "fitbit"
  | "whoop"
  | "garmin"
  | "phone_camera"
  | "gopro"
  | "insta360"
  | "court_camera"
  | "smart_ball"
  | "manual_import"
  | "unknown"

export type AxisSignalAttachment = {
  replayId?: string
  warmupId?: string
  twinId?: string
  sessionId?: string
}

export type ExternalSignalConfidence = {
  confidence: number
  evidence?: string
}

export type ExternalSignalEnvelope<TSignal> = {
  source: ExternalSignalSource
  receivedAt: number
  attachment: AxisSignalAttachment
  signal: TSignal
}
