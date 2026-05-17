"use client"

type Props = {
  noteId: string
  src: string
}

export default function LandmarkAudio({ noteId, src }: Props) {
  async function trackReplay() {
    try {
      await fetch("/api/practice/replay-event", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          noteId,
          eventType: "play",
        }),
      })
    } catch (error) {
      console.error("REPLAY EVENT FAILED", error)
    }
  }

  return (
    <audio
      src={src}
      controls
      className="w-full"
      onPlay={trackReplay}
    />
  )
}
