export type AxisObservation = {
  id: string
  text: string
  confidence: number
}

export type AxisPlayer = {
  id: string
  name: string
  jersey?: string
  confidence?: number
}

export type AxisSession = {
  id: string
  createdAt: string
  videoUrl?: string
  environment?: string
  observations: AxisObservation[]
}