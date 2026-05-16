import ContinuityWorld from "@/components/ContinuityWorld"

type Props = {
  params: Promise<{
    id: string
  }>
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params

  return (
    <ContinuityWorld
      eyebrow="Player"
      title={id === "local" ? "Local player" : "Player memory"}
      line="Individual continuity lives here: warmups, archive, retrieval, and accountability."
      primaryHref="/archive"
      primaryLabel="Open Memory"
      links={[
        {
          href: "/archive",
          label: "Archive",
          line: "Remembered effort.",
        },
        {
          href: "/retrieve",
          label: "Retrieve",
          line: "Find what returns.",
        },
        {
          href: "/team/local",
          label: "Team",
          line: "Connect effort.",
        },
      ]}
    />
  )
}
