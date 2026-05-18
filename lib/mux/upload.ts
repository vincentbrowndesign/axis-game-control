export type MuxUploadMemory = {
  playbackId?: string
  assetId?: string
  videoUrl?: string
}

export function muxUploadReady(memory: MuxUploadMemory) {
  return Boolean(memory.playbackId || memory.videoUrl)
}
