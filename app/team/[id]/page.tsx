import ContinuityWorld from "@/components/ContinuityWorld"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function TeamPage({ params }: Props) {
  const { id } = await params

  return (
    <ContinuityWorld
      eyebrow="Team"
      title={id === "local" ? "Team memory" : "Team continuity"}
      line="Shared practice memory connects players, drills, retrieval, and transfer into scrimmage."
      primaryHref="/practice"
      primaryLabel="Plan Practice"
      links={[
        {
          href: "/player/local",
          label: "Roster",
          line: "Player continuity.",
        },
        {
          href: "/connections",
          label: "Links",
          line: "Shared patterns.",
        },
        {
          href: "/retrieve",
          label: "Coach Retrieval",
          line: "Find clips to repeat.",
        },
      ]}
    />
  )
}
