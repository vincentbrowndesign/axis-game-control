export async function sampleFrames(
  video: HTMLVideoElement,
  interval = 500
) {
  const frames: number[] = []

  const duration = video.duration * 1000

  for (let ms = 0; ms < duration; ms += interval) {
    frames.push(ms)
  }

  return frames
}