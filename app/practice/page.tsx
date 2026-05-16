import ContinuityWorld from "@/components/ContinuityWorld"
import { getCalibrationMissions } from "@/lib/missions/getCalibrationMissions"

export default function PracticePage() {
  const firstMemorySource = getCalibrationMissions()[0]

  return (
    <ContinuityWorld
      eyebrow="Practice"
      title="Add memory"
      line="Record once. Let the archive carry what matters."
      primaryHref={firstMemorySource ? `/?warmup=${firstMemorySource.id}` : "/"}
      primaryLabel="Add Memory"
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
