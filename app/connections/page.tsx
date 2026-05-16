import ContinuityWorld from "@/components/ContinuityWorld"

export default function ConnectionsPage() {
  return (
    <ContinuityWorld
      eyebrow="Connections"
      title="Effort links"
      line="Memories connect through repeated rhythm, recurring resets, and practice-to-game transfer."
      primaryHref="/retrieve"
      primaryLabel="Retrieve Pattern"
      links={[
        {
          href: "/player/local",
          label: "Player",
          line: "Individual continuity.",
        },
        {
          href: "/team/local",
          label: "Team",
          line: "Shared continuity.",
        },
        {
          href: "/archive",
          label: "Archive",
          line: "Return to memory.",
        },
      ]}
    />
  )
}
