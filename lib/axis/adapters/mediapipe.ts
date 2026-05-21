export type AxisPoseLandmark = {
  x: number
  y: number
  z?: number
  visibility?: number
}

export type AxisMediaPipeInput = {
  frameId: string
  timestamp: number
}

export type AxisMediaPipeOutput = {
  frameId: string
  landmarks: AxisPoseLandmark[]
  shotFormSignal: string | null
}

export type AxisMediaPipeAdapter = {
  available: boolean
  extractPose: (input: AxisMediaPipeInput) => Promise<AxisMediaPipeOutput>
}

export function createMediaPipeAdapter(): AxisMediaPipeAdapter {
  return {
    available: true,
    async extractPose(input) {
      return {
        frameId: input.frameId,
        landmarks: [],
        shotFormSignal: null,
      }
    },
  }
}
