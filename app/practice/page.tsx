import ContinuityWorld from "@/components/ContinuityWorld"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"

export default function PracticePage() {
  const firstMemorySource = getCalibrationMissions()[0]

  return (
    <ContinuityWorld
      eyebrow="Practice"
      title="Continue memory"
      line="Return to the thread already moving."
      primaryHref={firstMemorySource ? `/?warmup=${firstMemorySource.id}` : "/"}
      primaryLabel="Add Memory"
      preferredWarmupId={firstMemorySource?.id}
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
