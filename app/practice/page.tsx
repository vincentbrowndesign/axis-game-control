import ContinuityWorld from "@/components/ContinuityWorld"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"

export default function PracticePage() {
  const firstWarmup = getCalibrationMissions()[0]

  return (
    <ContinuityWorld
      eyebrow="Practice"
      title="Record effort"
      line="Start with one warmup. Keep the memory that should return tomorrow."
      primaryHref={firstWarmup ? `/?warmup=${firstWarmup.id}` : "/"}
      primaryLabel="Record With Axis"
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
