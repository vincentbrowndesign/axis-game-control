export async function captureVideoFrameBlob(
  videoElement: HTMLVideoElement
): Promise<Blob | null> {
  const width = videoElement.videoWidth
  const height = videoElement.videoHeight

  if (!width || !height) return null

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext("2d")
  if (!context) return null

  context.drawImage(videoElement, 0, 0, width, height)

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        resolve(blob)
      },
      "image/jpeg",
      0.85
    )
  })
}
