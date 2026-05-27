import { PlayerContinuitySurface } from "@/components/axis-daily/PlayerContinuitySurface"

type OrganizationPageProps = {
  params: Promise<{
    organization: string
  }>
  searchParams?: Promise<{
    joined?: string
  }>
}

export default async function OrganizationPage({
  params,
  searchParams,
}: OrganizationPageProps) {
  const { organization } = await params
  const search = searchParams ? await searchParams : {}

  return (
    <PlayerContinuitySurface
      joined={search.joined === "1"}
      organizationSlug={organization}
    />
  )
}
