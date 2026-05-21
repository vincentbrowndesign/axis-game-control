export type AxisMuxMetadataInput = {
  assetId?: string
  playbackId?: string
}

export type AxisMuxMetadataOutput = {
  assetId: string | null
  playbackId: string | null
  duration: number | null
  ready: boolean
}

export type AxisMuxAdapter = {
  available: boolean
  readMetadata: (input: AxisMuxMetadataInput) => Promise<AxisMuxMetadataOutput>
}

export function createMuxAdapter(): AxisMuxAdapter {
  return {
    available: Boolean(process.env.MUX_TOKEN_ID || process.env.MUX_TOKEN_SECRET),
    async readMetadata(input) {
      return {
        assetId: input.assetId ?? null,
        playbackId: input.playbackId ?? null,
        duration: null,
        ready: false,
      }
    },
  }
}
