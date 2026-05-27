import { redirect } from "next/navigation"
import { getAxisRequestIdentity } from "@/lib/axis-auth/identity"
import { getAxisMembershipWorlds } from "@/lib/axis-orgs/memberships"
import { normalizeOrganizationSlug } from "@/lib/axis-orgs/organizations"
import { PlayerContinuitySurface } from "@/components/axis-daily/PlayerContinuitySurface"

type PlayerCheckInPageProps = {
  searchParams?: Promise<{
    joined?: string
    org?: string
  }>
}

export default async function PlayerCheckInPage({
  searchParams,
}: PlayerCheckInPageProps) {
  const identity = await getAxisRequestIdentity()

  if (!identity) {
    redirect("/sign-in?redirect_url=/player/check-in")
  }

  const search = searchParams ? await searchParams : {}
  const requestedOrganization = normalizeOrganizationSlug(search.org || "")

  if (requestedOrganization) {
    return (
      <PlayerContinuitySurface
        joined={search.joined === "1"}
        organizationSlug={requestedOrganization}
      />
    )
  }

  const memberships = await getAxisMembershipWorlds(identity)
  const playerWorld = memberships[0]

  if (!playerWorld) {
    redirect("/player/join")
  }

  return <PlayerContinuitySurface organizationSlug={playerWorld.organizationSlug} />
}
