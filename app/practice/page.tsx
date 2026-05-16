import ContinuityWorld from "@/components/ContinuityWorld"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"

export default function PracticePage() {
  const firstMemorySource = getCalibrationMissions()[0]

  return (
    <ContinuityWorld
      eyebrow="Practice"
      title="Player continuity"
      line="Return to the player thread already moving."
      primaryHref={firstMemorySource ? `/?warmup=${firstMemorySource.id}` : "/"}
      primaryLabel="Continue"
      preferredWarmupId={firstMemorySource?.id}
      identityName="Local Player"
      links={[
        {
          href: "/archive",
          label: "Archive",
          line: "Keep meaningful memory.",
        },
        {
          href: "/retrieve",
          label: "Retrieve",
          line: "Find what matters now.",
        },
        {
          href: "/connections",
          label: "Connections",
          line: "Link remembered effort.",
        },
      ]}
    />
  )
}
