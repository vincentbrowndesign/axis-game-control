export type AxisRoboflowInput = {
  frameId: string
  imageUrl?: string
}

export type AxisRoboflowOutput = {
  frameId: string
  courtZone: string | null
  playerLocations: Array<{
    label: string
    x: number
    y: number
    confidence: number
  }>
}

export type AxisRoboflowAdapter = {
  available: boolean
  detectFrame: (input: AxisRoboflowInput) => Promise<AxisRoboflowOutput>
}

export function createRoboflowAdapter(): AxisRoboflowAdapter {
  return {
    available: Boolean(process.env.ROBOFLOW_API_KEY),
    async detectFrame(input) {
      return {
        frameId: input.frameId,
        courtZone: null,
        playerLocations: [],
      }
    },
  }
}
