export type CandidateReplayLandmark = {
  id: string
  timestampSeconds: number
  timestamp: string
  title: string
  caption: string
  detail: string
}

const LANDMARKS = [
  {
    title: "Land balanced",
    caption: "LAND BALANCED",
    detail: "Watch the landing and base.",
  },
  {
    title: "Stay low",
    caption: "STAY LOW",
    detail: "Look for body level through the move.",
  },
  {
    title: "Sprint back",
    caption: "SPRINT BACK",
    detail: "Replay the first three steps after the change.",
  },
  {
    title: "Spread your feet",
    caption: "SPREAD YOUR FEET",
    detail: "Check balance before the next action.",
  },
  {
    title: "Beat him there",
    caption: "BEAT HIM THERE",
    detail: "Find the moment where the angle is won or lost.",
  },
]

function formatTimestamp(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

function landmarkTime({
  index,
  durationSeconds,
}: {
  index: number
  durationSeconds: number
}) {
  if (!durationSeconds || durationSeconds < 20) return index * 8

  const spacing = durationSeconds / (LANDMARKS.length + 1)

  return Math.max(4, Math.round(spacing * (index + 1)))
}

export function extractReplayLandmarks({
  durationSeconds,
}: {
  durationSeconds: number
}): CandidateReplayLandmark[] {
  return LANDMARKS.map((landmark, index) => {
    const timestampSeconds = landmarkTime({
      index,
      durationSeconds,
    })

    return {
      id: `${landmark.caption.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
      timestampSeconds,
      timestamp: formatTimestamp(timestampSeconds),
      title: landmark.title,
      caption: landmark.caption,
      detail: landmark.detail,
    }
  })
}
