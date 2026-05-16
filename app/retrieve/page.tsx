import ContinuityWorld from "@/components/ContinuityWorld"

export default function RetrievePage() {
  return (
    <ContinuityWorld
      eyebrow="Retrieve"
      title="What returns"
      line="Find the reps, resets, rhythm, and transfer clips that matter now."
      primaryHref="/archive"
      primaryLabel="Open Archive"
      links={[
        {
          href: "/practice",
          label: "Tomorrow",
          line: "Repeat intentionally.",
        },
        {
          href: "/connections",
          label: "Patterns",
          line: "Follow returning structure.",
        },
        {
          href: "/team/local",
          label: "Team",
          line: "Carry memory together.",
        },
      ]}
    />
  )
}
