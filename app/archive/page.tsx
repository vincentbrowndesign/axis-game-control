import ContinuityWorld from "@/components/ContinuityWorld"

export default function ArchivePage() {
  return (
    <ContinuityWorld
      eyebrow="Archive"
      title="Remembered effort"
      line="Keep memories that carry rhythm, resets, repetition, and practice lineage."
      primaryHref="/sessions"
      primaryLabel="Open Memories"
      links={[
        {
          href: "/practice",
          label: "Practice",
          line: "Add the next memory.",
        },
        {
          href: "/retrieve",
          label: "Retrieve",
          line: "Bring back what matters.",
        },
        {
          href: "/connections",
          label: "Connections",
          line: "See what keeps returning.",
        },
      ]}
    />
  )
}
